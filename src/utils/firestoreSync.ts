import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType, ADMIN_EMAIL } from '../firebase';
import { Exam, ExamAttempt, ExamFolder, Question, User } from '../types';
import {
  getMeaningfulQuestionText,
  getQuestionImageSrc,
  normalizeQuestionImageUrl,
  resolveQuestionType
} from './imageCompress';

export function sanitizeFirestoreId(raw: string, fallbackPrefix = 'doc'): string {
  const cleaned = (raw || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 120);
  return cleaned || `${fallbackPrefix}-${Date.now()}`;
}

export function isVerifiedAdminSignedIn(): boolean {
  const user = auth.currentUser;
  if (!user || !user.emailVerified) return false;
  return (user.email || '').toLowerCase() === ADMIN_EMAIL.toLowerCase();
}

function clampString(val: string | undefined, max: number): string {
  if (!val) return '';
  return String(val).slice(0, max);
}

export async function syncFolderToFirestore(folder: ExamFolder): Promise<void> {
  if (!isVerifiedAdminSignedIn() || !auth.currentUser) return;
  const folderId = sanitizeFirestoreId(folder.id, 'folder');
  const path = `folders/${folderId}`;
  try {
    const ref = doc(db, 'folders', folderId);
    const snap = await getDoc(ref);
    const payload: Record<string, any> = {
      id: folderId,
      name: clampString(folder.name, 160) || 'Untitled Folder',
      targetClass: clampString(folder.targetClass || folder.category, 40) || '11th',
      examCount: Math.max(0, Math.min(10000, Math.floor(Number(folder.examCount) || 0))),
      createdByUid: snap.exists() ? snap.data().createdByUid : auth.currentUser.uid,
      createdAt: snap.exists() ? snap.data().createdAt : serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    if (folder.description) payload.description = clampString(folder.description, 500);
    if (folder.color) payload.color = clampString(folder.color, 40);

    await setDoc(ref, payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteFolderFromFirestore(folderId: string): Promise<void> {
  if (!isVerifiedAdminSignedIn()) return;
  const safeId = sanitizeFirestoreId(folderId, 'folder');
  const path = `folders/${safeId}`;
  try {
    await deleteDoc(doc(db, 'folders', safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function syncExamAndQuestionsToFirestore(
  exam: Exam,
  questionsList: Question[]
): Promise<void> {
  if (!isVerifiedAdminSignedIn() || !auth.currentUser) return;

  const examId = sanitizeFirestoreId(exam.id, 'exam');
  const examPath = `exams/${examId}`;

  // Resolve full question objects assigned to this exam, merging image fields cleanly
  const qMap = new Map<string, Question>();
  (exam.questions || []).forEach(eq => {
    const fromBank = questionsList.find(bq => bq.id === eq.id || bq.code === eq.code);
    const resolvedImg = getQuestionImageSrc(eq) || getQuestionImageSrc(fromBank);
    const resolvedPath = eq.questionImagePath || fromBank?.questionImagePath;
    const merged: Question = {
      ...(fromBank || {}),
      ...eq,
      questionType: resolveQuestionType({ ...(fromBank || {}), ...eq, ...(resolvedImg ? { questionImageUrl: resolvedImg } : {}) }),
      ...(resolvedImg ? { questionImageUrl: resolvedImg, imageUrl: resolvedImg } : {}),
      ...(resolvedPath ? { questionImagePath: resolvedPath } : {})
    };
    qMap.set(eq.id, merged);
  });
  (exam.sections || []).forEach(sec => {
    (sec.questionIds || []).forEach(id => {
      if (!qMap.has(id)) {
        const fromBank = questionsList.find(q => q.id === id || q.code === id);
        if (fromBank) qMap.set(fromBank.id, fromBank);
      }
    });
  });

  const resolvedQuestions = Array.from(qMap.values()).slice(0, 200);
  const questionIds = resolvedQuestions.map(q => sanitizeFirestoreId(q.id, 'q'));
  const isPublic = exam.status !== 'Draft' && exam.isPublic !== false;
  const negMarksRaw = exam.negativeMarks !== undefined ? Number(exam.negativeMarks) : -1;
  const normalizedNeg = negMarksRaw > 0 ? -Math.abs(negMarksRaw) : Math.max(-100, Math.min(0, Math.floor(negMarksRaw)));

  try {
    const examRef = doc(db, 'exams', examId);
    const existingSnap = await getDoc(examRef);

    const examPayload: Record<string, any> = {
      id: examId,
      code: clampString(exam.code || examId, 80) || examId,
      codeLower: clampString((exam.code || examId).toLowerCase().trim(), 80) || examId.toLowerCase(),
      title: clampString(exam.title, 200) || 'Mathematics Examination',
      targetClass: clampString(exam.targetClass, 40) || '11th',
      durationMinutes: Math.max(1, Math.min(600, Math.floor(Number(exam.durationMinutes) || 60))),
      totalMarks: Math.max(0, Math.min(10000, Math.floor(Number(exam.totalMarks) || resolvedQuestions.length * 4 || 0))),
      positiveMarks: Math.max(0, Math.min(100, Math.floor(Number(exam.positiveMarks) || 4))),
      negativeMarks: normalizedNeg,
      passPercentage: Math.max(0, Math.min(100, Math.floor(Number(exam.passPercentage) || 35))),
      status: ['Live', 'Draft', 'Scheduled', 'Completed', 'Active', 'Published'].includes(exam.status)
        ? exam.status
        : 'Live',
      isPublic,
      questionIds,
      createdByUid: existingSnap.exists() ? existingSnap.data().createdByUid : auth.currentUser.uid,
      createdAt: existingSnap.exists() ? existingSnap.data().createdAt : serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    if (exam.folderId) examPayload.folderId = clampString(exam.folderId, 128);
    if (exam.folderName) examPayload.folderName = clampString(exam.folderName, 160);
    if (exam.examCategory) examPayload.examCategory = clampString(exam.examCategory, 40);

    await setDoc(examRef, examPayload);

    // Sync each question document under /exams/{examId}/questions/{questionId}
    const desiredIds = new Set<string>();
    for (let i = 0; i < resolvedQuestions.length; i++) {
      const q = resolvedQuestions[i];
      const qId = sanitizeFirestoreId(q.id, `q-${i}`);
      desiredIds.add(qId);
      const qPath = `exams/${examId}/questions/${qId}`;
      try {
        const qRef = doc(db, 'exams', examId, 'questions', qId);
        const existingQSnap = await getDoc(qRef);
        const qPos = Math.max(0, Math.min(100, Math.floor(Number(q.marks ?? q.marksPositive) || 4)));
        const qNegRaw = q.negativeMarks !== undefined ? Number(q.negativeMarks) : q.marksNegative !== undefined ? Number(q.marksNegative) : -1;
        const qNegNorm = qNegRaw > 0 ? -Math.abs(qNegRaw) : Math.max(-100, Math.min(0, Math.floor(qNegRaw)));

        const safeOptions = Array.isArray(q.options)
          ? q.options.slice(0, 6).map((opt, idx) => ({
              id: clampString(opt.id || `opt-${idx + 1}`, 40) || `opt-${idx + 1}`,
              label: clampString(opt.label || String.fromCharCode(65 + idx), 20) || String.fromCharCode(65 + idx),
              text: clampString(opt.text || '', 500)
            }))
          : [];

        const rawImageSrc = getQuestionImageSrc(q);
        const qType = resolveQuestionType(q);
        const meaningfulText = getMeaningfulQuestionText(q);
        const cleanText = qType === 'image' ? meaningfulText : (meaningfulText || q.questionText || '');

        const qPayload: Record<string, any> = {
          id: qId,
          examId,
          orderIndex: i,
          code: clampString(q.code || qId, 80) || qId,
          subject: clampString(q.subject || 'Mathematics', 80) || 'Mathematics',
          type: ['single_choice', 'multiple_choice', 'numerical', 'integer'].includes(q.type)
            ? q.type
            : 'single_choice',
          questionType: qType,
          questionText: clampString(cleanText, 4000),
          correctAnswer: clampString(q.correctAnswer || 'A', 64) || 'A',
          marks: qPos,
          negativeMarks: qNegNorm,
          marksPositive: qPos,
          marksNegative: qNegNorm,
          isPublic,
          options: safeOptions,
          createdByUid: existingQSnap.exists() ? existingQSnap.data().createdByUid : auth.currentUser.uid,
          createdAt: existingQSnap.exists() ? existingQSnap.data().createdAt : serverTimestamp()
        };

        const chapterVal = q.chapter || q.topic;
        if (chapterVal) {
          qPayload.chapter = clampString(chapterVal, 160);
          qPayload.topic = clampString(q.topic || chapterVal, 160);
        }
        if (q.difficulty) qPayload.difficulty = clampString(q.difficulty, 40);
        if (q.targetClass || exam.targetClass) qPayload.targetClass = clampString(q.targetClass || exam.targetClass, 40);
        if (q.folderId || exam.folderId) qPayload.folderId = clampString(q.folderId || exam.folderId, 128);
        if (q.folderName || exam.folderName) qPayload.folderName = clampString(q.folderName || exam.folderName, 160);
        if (q.tag) qPayload.tag = clampString(q.tag, 40);
        if (q.questionImagePath) qPayload.questionImagePath = clampString(normalizeQuestionImageUrl(q.questionImagePath), 300);

        // Store questionImageUrl ONCE in Firestore doc (docToQuestion mirrors it back to both imageUrl & questionImageUrl)
        // so base64 payloads never double-count against Firestore's 1MB document ceiling.
        if (rawImageSrc) {
          if (rawImageSrc.length <= 890000) {
            qPayload.questionImageUrl = rawImageSrc;
          } else if (q.questionImagePath) {
            const fallbackUrl = normalizeQuestionImageUrl(q.questionImagePath);
            console.warn(
              `[FIRESTORE SYNC] Question ${qId} inline DataURL exceeded 890KB (${rawImageSrc.length} chars); referencing persisted path ${fallbackUrl}`
            );
            qPayload.questionImageUrl = clampString(fallbackUrl, 900000);
          } else {
            console.error(
              `[FIRESTORE SYNC ERROR] Question ${qId} image exceeded 890KB (${rawImageSrc.length} chars) with no storage path fallback.`
            );
          }
        }
        // Guarantee firestore.rules requirement: either questionText >= 1 or questionImageUrl >= 1
        if (!qPayload.questionImageUrl && !qPayload.questionText) {
          qPayload.questionText = `Question ${i + 1}`;
        }
        if (q.formulaNote) qPayload.formulaNote = clampString(q.formulaNote, 1000);
        if (q.explanation) qPayload.explanation = clampString(q.explanation, 3000);

        await setDoc(qRef, qPayload);
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, qPath);
      }
    }

    // Remove any orphaned questions from this exam subcollection that were unassigned
    const existingSubSnap = await getDocs(collection(db, 'exams', examId, 'questions'));
    for (const d of existingSubSnap.docs) {
      if (!desiredIds.has(d.id)) {
        await deleteDoc(doc(db, 'exams', examId, 'questions', d.id));
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, examPath);
  }
}

export async function deleteExamFromFirestore(examId: string): Promise<void> {
  if (!isVerifiedAdminSignedIn()) return;
  const safeId = sanitizeFirestoreId(examId, 'exam');
  const path = `exams/${safeId}`;
  try {
    const subSnap = await getDocs(collection(db, 'exams', safeId, 'questions'));
    for (const d of subSnap.docs) {
      await deleteDoc(doc(db, 'exams', safeId, 'questions', d.id));
    }
    await deleteDoc(doc(db, 'exams', safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

function docToExam(data: Record<string, any>, examQuestions: Question[]): Exam {
  const createdStr =
    data.createdAt instanceof Timestamp
      ? data.createdAt.toDate().toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];

  const shareOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const slug = encodeURIComponent(data.code || data.id);

  return {
    id: data.id,
    title: data.title,
    code: data.code,
    folderId: data.folderId || 'folder-live',
    folderName: data.folderName || `Class ${data.targetClass || '11th'} Mathematics`,
    batchIds: [],
    targetClass: data.targetClass || '11th',
    examCategory: data.examCategory || 'JEE',
    durationMinutes: Number(data.durationMinutes) || 60,
    totalMarks: Number(data.totalMarks) || examQuestions.length * 4 || 0,
    positiveMarks: Number(data.positiveMarks) || 4,
    negativeMarks: data.negativeMarks !== undefined ? Number(data.negativeMarks) : -1,
    passPercentage: Number(data.passPercentage) || 35,
    status: data.status || 'Live',
    isPublic: data.isPublic !== false,
    publicAccessUrl: data.publicAccessUrl || `${shareOrigin}/?cbt=${slug}`,
    questions: examQuestions,
    sections: [
      {
        id: 'sec-1',
        name: `Mathematics Section (Class ${data.targetClass || '11th'})`,
        subject: 'Mathematics',
        questionIds: examQuestions.map(q => q.id),
        instructions: `+${Number(data.positiveMarks) || 4} for correct answer, ${data.negativeMarks ?? -1} for wrong response.`
      }
    ],
    startTime: createdStr,
    endTime: new Date(Date.now() + 90 * 24 * 3600 * 1000).toISOString().split('T')[0],
    instructions: [
      'Each question has four options with only ONE correct answer.',
      'Marking: +4 marks for correct response, -1 mark for wrong response.'
    ],
    createdAt: createdStr
  };
}

function docToQuestion(data: Record<string, any>): Question {
  const createdStr =
    data.createdAt instanceof Timestamp
      ? data.createdAt.toDate().toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];

  const normPath = normalizeQuestionImageUrl(data.questionImagePath) || undefined;
  const resolvedImg =
    normalizeQuestionImageUrl(data.questionImageUrl) ||
    normalizeQuestionImageUrl(data.imageUrl) ||
    normPath ||
    undefined;
  const resolvedType = resolveQuestionType({
    questionType: data.questionType,
    questionText: data.questionText,
    questionImageUrl: resolvedImg,
    questionImagePath: normPath
  });
  const posMarks = Number(data.marks ?? data.marksPositive) || 4;
  const negMarks = data.negativeMarks !== undefined
    ? Number(data.negativeMarks)
    : data.marksNegative !== undefined
    ? Number(data.marksNegative)
    : -1;

  return {
    id: data.id,
    code: data.code,
    examId: data.examId,
    subject: data.subject || 'Mathematics',
    chapter: data.chapter || data.topic || 'General',
    topic: data.topic || data.chapter || 'General',
    type: data.type || 'single_choice',
    questionType: resolvedType,
    difficulty: data.difficulty || 'Moderate',
    targetClass: data.targetClass,
    folderId: data.folderId,
    folderName: data.folderName,
    tag: data.tag,
    questionText: resolvedType === 'image' ? getMeaningfulQuestionText({ questionType: resolvedType, questionText: data.questionText, questionImageUrl: resolvedImg }) : (data.questionText || ''),
    questionImageUrl: resolvedImg,
    questionImagePath: normPath,
    imageUrl: resolvedImg,
    formulaNote: data.formulaNote,
    options: Array.isArray(data.options) ? data.options : [],
    correctAnswer: data.correctAnswer || 'A',
    marks: posMarks,
    negativeMarks: negMarks,
    marksPositive: posMarks,
    marksNegative: negMarks,
    explanation: data.explanation || '',
    createdAt: createdStr
  };
}

export async function fetchAllPublicExamsFromFirestore(): Promise<Exam[]> {
  try {
    const examsQuery = isVerifiedAdminSignedIn()
      ? collection(db, 'exams')
      : query(collection(db, 'exams'), where('isPublic', '==', true));
    const examsSnap = await getDocs(examsQuery);
    const hydrated: Exam[] = [];

    for (const exDoc of examsSnap.docs) {
      try {
        const qsQuery = isVerifiedAdminSignedIn()
          ? collection(db, 'exams', exDoc.id, 'questions')
          : query(collection(db, 'exams', exDoc.id, 'questions'), where('isPublic', '==', true));
        const qsSnap = await getDocs(qsQuery);
        const loadedQs = qsSnap.docs
          .map(d => ({ order: Number(d.data().orderIndex ?? 0), q: docToQuestion(d.data()) }))
          .sort((a, b) => a.order - b.order)
          .map(item => item.q);
        hydrated.push(docToExam(exDoc.data(), loadedQs));
      } catch {
        // Skip locked subcollections cleanly
      }
    }

    return hydrated;
  } catch (error) {
    console.warn('Firestore public exams list fetch skipped/failed:', error);
    return [];
  }
}

export async function fetchExamWithQuestionsFromFirestore(examCodeOrId: string): Promise<Exam | null> {
  const cleanParam = (examCodeOrId || '').trim();
  if (!cleanParam) return null;

  try {
    let examData: Record<string, any> | null = null;
    const safeId = sanitizeFirestoreId(cleanParam, 'exam');
    const cleanLower = cleanParam.toLowerCase();
    const safeLower = safeId.toLowerCase();

    // 1. Direct ID lookup (catch permission-denied if private or missing)
    try {
      const directSnap = await getDoc(doc(db, 'exams', safeId));
      if (directSnap.exists()) {
        examData = directSnap.data();
      }
    } catch {
      // Fall through to single-field public query
    }

    // 2. Single-field public exams list query (avoids missing composite index errors!)
    if (!examData) {
      const q = isVerifiedAdminSignedIn()
        ? collection(db, 'exams')
        : query(collection(db, 'exams'), where('isPublic', '==', true));
      const snap = await getDocs(q);
      const matchedDoc = snap.docs.find(d => {
        const data = d.data();
        const docId = String(data.id || d.id || '').toLowerCase();
        const docCodeLower = String(data.codeLower || data.code || '').toLowerCase();
        const docCodeSanitized = sanitizeFirestoreId(String(data.code || ''), 'exam').toLowerCase();
        return (
          docId === cleanLower ||
          docId === safeLower ||
          docCodeLower === cleanLower ||
          docCodeLower === safeLower ||
          docCodeSanitized === safeLower
        );
      });
      if (matchedDoc) {
        examData = matchedDoc.data();
      }
    }

    if (!examData) return null;

    // Fetch public questions from subcollection (single-field index query)
    const qsQuery = isVerifiedAdminSignedIn()
      ? collection(db, 'exams', examData.id, 'questions')
      : query(collection(db, 'exams', examData.id, 'questions'), where('isPublic', '==', true));

    const qsSnap = await getDocs(qsQuery);
    const loadedQs = qsSnap.docs
      .map(d => ({ order: Number(d.data().orderIndex ?? 0), q: docToQuestion(d.data()) }))
      .sort((a, b) => a.order - b.order)
      .map(item => item.q);

    return docToExam(examData, loadedQs);
  } catch (error) {
    console.warn('Firestore public exam fetch failed:', error);
    return null;
  }
}

export async function submitPublicRegistrationToFirestore(student: {
  id: string;
  name: string;
  phone: string;
  targetClass: string;
  collegeName: string;
  rollNo?: string;
  examId?: string;
  examTitle?: string;
}): Promise<void> {
  if (!student.examId) return;
  const regId = sanitizeFirestoreId(`reg-${student.phone || Date.now()}-${student.examId}`, 'reg');
  const examId = sanitizeFirestoreId(student.examId, 'exam');
  const path = `public_registrations/${regId}`;
  try {
    // Only submit to Firestore if parent exam exists in Firestore
    const examExists = await getDoc(doc(db, 'exams', examId)).catch(() => null);
    if (!examExists || !examExists.exists()) return;

    const payload: Record<string, any> = {
      id: regId,
      name: clampString(student.name, 120) || 'Student',
      phone: clampString(student.phone.replace(/\D/g, '') || student.phone, 20) || '0000000000',
      targetClass: clampString(student.targetClass, 60) || '11th',
      collegeName: clampString(student.collegeName, 200) || 'Open Candidate',
      examId,
      submittedAt: serverTimestamp()
    };
    if (student.rollNo) payload.rollNo = clampString(student.rollNo, 60);
    if (student.examTitle) payload.examTitle = clampString(student.examTitle, 200);

    await setDoc(doc(db, 'public_registrations', regId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function submitAttemptToFirestore(attempt: ExamAttempt): Promise<void> {
  if (!attempt.examId) return;
  const attemptId = sanitizeFirestoreId(attempt.id, 'att');
  const examId = sanitizeFirestoreId(attempt.examId, 'exam');
  const path = `exam_attempts/${attemptId}`;
  try {
    const examExists = await getDoc(doc(db, 'exams', examId)).catch(() => null);
    if (!examExists || !examExists.exists()) return;

    const payload: Record<string, any> = {
      id: attemptId,
      examId,
      examTitle: clampString(attempt.examTitle, 200) || 'CBT Examination',
      studentName: clampString(attempt.studentName, 120) || 'Candidate',
      totalScore: Number(attempt.totalScore) || 0,
      maxScore: Math.max(0, Number(attempt.maxScore) || 0),
      correctCount: Math.max(0, Math.min(500, Math.floor(Number(attempt.correctCount) || 0))),
      incorrectCount: Math.max(0, Math.min(500, Math.floor(Number(attempt.incorrectCount) || 0))),
      unattemptedCount: Math.max(0, Math.min(500, Math.floor(Number(attempt.unattemptedCount) || 0))),
      status: attempt.status === 'Submitted' ? 'Submitted' : 'Evaluated',
      submittedAt: serverTimestamp()
    };
    if (attempt.examCode) payload.examCode = clampString(attempt.examCode, 80);
    if (attempt.studentId) payload.studentId = clampString(attempt.studentId, 128);
    if (attempt.studentRollNo) payload.studentRollNo = clampString(attempt.studentRollNo, 60);
    if (attempt.studentPhone) payload.studentPhone = clampString(attempt.studentPhone, 20);
    if (attempt.studentCollege) payload.studentCollege = clampString(attempt.studentCollege, 200);
    if (attempt.percentage !== undefined) payload.percentage = Number(attempt.percentage) || 0;
    if (attempt.accuracy !== undefined) payload.accuracy = Number(attempt.accuracy) || 0;
    if (attempt.timeTakenMinutes !== undefined) {
      payload.timeTakenMinutes = Math.max(0, Math.min(1000, Math.floor(Number(attempt.timeTakenMinutes) || 0)));
    }

    await setDoc(doc(db, 'exam_attempts', attemptId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function fetchAdminCloudState(): Promise<{
  folders: ExamFolder[];
  exams: Exam[];
  questions: Question[];
  registrations: User[];
  attempts: ExamAttempt[];
} | null> {
  if (!isVerifiedAdminSignedIn()) return null;

  try {
    const [foldersSnap, examsSnap, regsSnap, attemptsSnap] = await Promise.all([
      getDocs(collection(db, 'folders')),
      getDocs(collection(db, 'exams')),
      getDocs(collection(db, 'public_registrations')),
      getDocs(collection(db, 'exam_attempts'))
    ]);

    const folders: ExamFolder[] = foldersSnap.docs.map(d => {
      const data = d.data();
      return {
        id: data.id,
        name: data.name,
        description: data.description || '',
        category: data.category || data.targetClass || 'JEE Main',
        targetClass: data.targetClass || '11th',
        color: data.color || 'blue',
        examCount: Number(data.examCount) || 0,
        createdAt:
          data.createdAt instanceof Timestamp
            ? data.createdAt.toDate().toISOString().split('T')[0]
            : new Date().toISOString().split('T')[0]
      };
    });

    const allQuestions: Question[] = [];
    const exams: Exam[] = [];
    for (const exDoc of examsSnap.docs) {
      const qsSnap = await getDocs(collection(db, 'exams', exDoc.id, 'questions'));
      const qs = qsSnap.docs
        .map(d => ({ order: Number(d.data().orderIndex ?? 0), q: docToQuestion(d.data()) }))
        .sort((a, b) => a.order - b.order)
        .map(item => item.q);
      qs.forEach(q => allQuestions.push(q));
      exams.push(docToExam(exDoc.data(), qs));
    }

    const registrations: User[] = regsSnap.docs.map(d => {
      const data = d.data();
      const joinedDate =
        data.submittedAt instanceof Timestamp
          ? data.submittedAt.toDate().toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0];
      return {
        id: data.id,
        name: data.name,
        username: `g_${(data.phone || '').replace(/\D/g, '')}`,
        password: '',
        email: `${(data.phone || 'student').replace(/\D/g, '')}@quickjoin.gyansai.in`,
        phone: data.phone,
        role: 'student',
        rollNo: data.rollNo || 'GMI-ONLINE',
        targetExam: `${data.targetClass || '11th'} IIT-JEE / CET`,
        collegeName: data.collegeName || 'Open Candidate',
        batchName: 'Quick Join Candidate',
        assignedExamId: data.examId,
        assignedExamTitle: data.examTitle,
        joinedDate
      };
    });

    const attempts: ExamAttempt[] = attemptsSnap.docs.map(d => {
      const data = d.data();
      const submittedAt =
        data.submittedAt instanceof Timestamp
          ? data.submittedAt.toDate().toISOString()
          : new Date().toISOString();
      return {
        id: data.id,
        examId: data.examId,
        examTitle: data.examTitle,
        examCode: data.examCode,
        studentId: data.studentId || data.id,
        studentName: data.studentName,
        studentRollNo: data.studentRollNo || 'GMI-ONLINE',
        studentEmail:
          data.studentEmail ||
          (data.studentPhone ? `${String(data.studentPhone).replace(/\D/g, '')}@quickjoin.gyansai.in` : 'candidate@gyansai.in'),
        studentPhone: data.studentPhone || '',
        studentCollege: data.studentCollege || 'Open Candidate',
        isQuickJoin: true,
        answers: {},
        totalScore: Number(data.totalScore) || 0,
        maxScore: Number(data.maxScore) || 100,
        percentage: Number(data.percentage) || 0,
        accuracy: Number(data.accuracy) || 0,
        correctCount: Number(data.correctCount) || 0,
        incorrectCount: Number(data.incorrectCount) || 0,
        unattemptedCount: Number(data.unattemptedCount) || 0,
        rank: 1,
        totalParticipants: 1,
        startedAt: submittedAt,
        submittedAt,
        timeTakenMinutes: Number(data.timeTakenMinutes) || 1,
        status: 'Evaluated'
      };
    });

    return { folders, exams, questions: allQuestions, registrations, attempts };
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'admin-cloud-sync');
  }
}
