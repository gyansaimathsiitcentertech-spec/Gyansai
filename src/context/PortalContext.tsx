import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import {
  User,
  Batch,
  Teacher,
  Question,
  ExamFolder,
  Exam,
  ExamAttempt,
  AttendanceRecord,
  StudyMaterial,
  NotificationItem,
  Course,
  TestSeries,
  PaymentTransaction,
  InstituteSettings
} from '../types';
import {
  INITIAL_INSTITUTE_SETTINGS,
  INITIAL_USERS,
  INITIAL_BATCHES,
  INITIAL_TEACHERS,
  INITIAL_QUESTIONS,
  INITIAL_EXAM_FOLDERS,
  INITIAL_EXAMS,
  INITIAL_ATTEMPTS,
  INITIAL_ATTENDANCE,
  INITIAL_STUDY_MATERIAL,
  INITIAL_NOTIFICATIONS,
  INITIAL_COURSES,
  INITIAL_TEST_SERIES,
  INITIAL_PAYMENTS
} from '../data/initialData';
import { decodeExamFromUrl, resolveExamQuestions } from '../utils/examShare';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleProvider, ADMIN_EMAIL } from '../firebase';
import {
  syncFolderToFirestore,
  deleteFolderFromFirestore,
  syncExamAndQuestionsToFirestore,
  deleteExamFromFirestore,
  fetchExamWithQuestionsFromFirestore,
  fetchAllPublicExamsFromFirestore,
  submitPublicRegistrationToFirestore,
  submitAttemptToFirestore,
  fetchAdminCloudState,
  isVerifiedAdminSignedIn
} from '../utils/firestoreSync';
import {
  getQuestionImageSrc,
  normalizeQuestionImageUrl,
  resolveQuestionType,
  isPlaceholderQuestionText
} from '../utils/imageCompress';
import { loadFromIndexedDb, saveToIndexedDb, clearIndexedDb } from '../utils/localDb';

function mergeQuestionRecord(incoming: Question, existing?: Question): Question {
  const incomingImg =
    normalizeQuestionImageUrl(incoming.questionImageUrl) ||
    normalizeQuestionImageUrl(incoming.imageUrl);
  const existingImg =
    normalizeQuestionImageUrl(existing?.questionImageUrl) ||
    normalizeQuestionImageUrl(existing?.imageUrl);
  const mergedPath =
    normalizeQuestionImageUrl(incoming.questionImagePath) ||
    normalizeQuestionImageUrl(existing?.questionImagePath) ||
    (incomingImg && !incomingImg.startsWith('data:') ? incomingImg : '') ||
    (existingImg && !existingImg.startsWith('data:') ? existingImg : '') ||
    undefined;
  // Prefer incoming non-empty image, or inline DataURL from existing if same question only synced a path reference
  const mergedImg =
    (incomingImg && incomingImg.startsWith('data:'))
      ? incomingImg
      : (existingImg && existingImg.startsWith('data:') && (!incomingImg || incomingImg === mergedPath))
      ? existingImg
      : (incomingImg || existingImg || mergedPath || undefined);

  const candidate: Question = {
    ...(existing || {}),
    ...incoming,
    questionImageUrl: mergedImg,
    imageUrl: mergedImg,
    questionImagePath: mergedPath
  };
  const resolvedType = resolveQuestionType(candidate);
  const rawText = (incoming.questionText !== undefined ? incoming.questionText : existing?.questionText) || '';
  const cleanedText = resolvedType === 'image' && isPlaceholderQuestionText(rawText) ? '' : rawText;

  return {
    ...candidate,
    chapter: incoming.chapter || existing?.chapter || incoming.topic || existing?.topic,
    marks: incoming.marks ?? incoming.marksPositive ?? existing?.marks ?? existing?.marksPositive ?? 4,
    negativeMarks: incoming.negativeMarks ?? incoming.marksNegative ?? existing?.negativeMarks ?? existing?.marksNegative ?? -1,
    questionType: resolvedType,
    questionText: cleanedText
  };
}

function mergeQuestionArrays(primary?: Question[], secondary?: Question[]): Question[] | undefined {
  const listA = Array.isArray(primary) ? primary : [];
  const listB = Array.isArray(secondary) ? secondary : [];
  if (listA.length === 0 && listB.length === 0) return undefined;
  const base = listA.length > 0 ? listA : listB;
  const altMap = new Map<string, Question>();
  (listA.length > 0 ? listB : listA).forEach(q => {
    if (q?.id) altMap.set(q.id, q);
    if (q?.code) altMap.set(q.code, q);
  });
  return base.map(q => mergeQuestionRecord(q, altMap.get(q.id) || altMap.get(q.code)));
}

export type PortalMode = 'landing' | 'login' | 'admin' | 'student' | 'public_exam' | 'taking_exam';

interface ToastInfo {
  id: string;
  message: string;
  type: 'success' | 'info' | 'error';
}

interface PortalContextType {
  currentUser: User;
  setCurrentUser: (user: User) => void;
  portalMode: PortalMode;
  setPortalMode: (mode: PortalMode) => void;
  isAdminAuthenticated: boolean;
  firebaseAdminEmail: string | null;
  isCloudSyncing: boolean;
  adminLoginModalOpen: boolean;
  setAdminLoginModalOpen: (open: boolean) => void;
  loginAdmin: (password: string, emailOrUsername?: string) => { success: boolean; error?: string };
  signInAdminWithGoogle: () => Promise<{ success: boolean; error?: string }>;
  syncAllExamsToCloud: () => Promise<void>;
  syncSingleExamToCloud: (examObj: Exam) => Promise<void>;
  logoutAdmin: () => void;
  requestAdminAccess: () => void;

  activeAdminTab: string;
  setActiveAdminTab: (tab: string) => void;
  activeStudentTab: string;
  setActiveStudentTab: (tab: string) => void;

  activeExamIdForCBT: string | null;
  setActiveExamIdForCBT: (examId: string | null) => void;
  activeExamIdForShare: string | null;
  setActiveExamIdForShare: (examId: string | null) => void;
  activePublicExamId: string | null;
  setActivePublicExamId: (examId: string | null) => void;
  isResolvingExamRoute: boolean;
  examRouteError: string | null;
  retryResolveExamRoute: () => void;
  activeExamForQuestionsModal: Exam | null;
  setActiveExamForQuestionsModal: (exam: Exam | null) => void;
  selectedAttemptForResult: ExamAttempt | null;
  setSelectedAttemptForResult: (attempt: ExamAttempt | null) => void;

  createFolderModalOpen: boolean;
  setCreateFolderModalOpen: (open: boolean) => void;
  createQuestionModalOpen: boolean;
  setCreateQuestionModalOpen: (open: boolean) => void;
  activeTargetExamIdForQuestion: string | null;
  setActiveTargetExamIdForQuestion: (id: string | null) => void;
  activeTargetFolderIdForQuestion: string | null;
  setActiveTargetFolderIdForQuestion: (id: string | null) => void;
  authModalOpen: boolean;
  setAuthModalOpen: (open: boolean) => void;
  authModalTab: 'login' | 'signup';
  setAuthModalTab: (tab: 'login' | 'signup') => void;
  quickJoinModalOpen: boolean;
  setQuickJoinModalOpen: (open: boolean) => void;

  settings: InstituteSettings;
  updateSettings: (newSettings: Partial<InstituteSettings>) => void;

  users: User[];
  addUser: (user: Omit<User, 'id'>) => User;
  updateUser: (id: string, data: Partial<User>) => void;
  deleteUser: (id: string) => void;

  batches: Batch[];
  addBatch: (batch: Omit<Batch, 'id'>) => void;
  updateBatch: (id: string, data: Partial<Batch>) => void;
  deleteBatch: (id: string) => void;

  teachers: Teacher[];
  addTeacher: (teacher: Omit<Teacher, 'id'>) => void;
  updateTeacher: (id: string, data: Partial<Teacher>) => void;
  deleteTeacher: (id: string) => void;

  questions: Question[];
  addQuestion: (q: Omit<Question, 'id' | 'createdAt'>) => Question;
  updateQuestion: (id: string, data: Partial<Question>) => void;
  deleteQuestion: (id: string) => void;
  importQuestions: (newQuestions: Question[]) => void;

  folders: ExamFolder[];
  addFolder: (f: Omit<ExamFolder, 'id' | 'createdAt' | 'examCount'>) => ExamFolder;
  updateFolder: (id: string, data: Partial<ExamFolder>) => void;
  deleteFolder: (id: string) => void;

  exams: Exam[];
  addExam: (e: Omit<Exam, 'id' | 'createdAt'>) => Exam;
  updateExam: (id: string, data: Partial<Exam>) => void;
  attachQuestionToExam: (q: Question, examId: string) => void;
  attachQuestionsToExam: (qs: Question[], examId: string) => void;
  deleteExam: (id: string) => void;

  attempts: ExamAttempt[];
  recordAttempt: (att: Omit<ExamAttempt, 'id'>) => ExamAttempt;
  updateAttempt: (id: string, data: Partial<ExamAttempt>) => void;
  deleteAttempt: (id: string) => void;

  attendance: AttendanceRecord[];
  saveAttendance: (batchId: string, date: string, records: AttendanceRecord['records']) => void;

  studyMaterials: StudyMaterial[];
  addStudyMaterial: (mat: Omit<StudyMaterial, 'id' | 'uploadedAt' | 'downloadCount'>) => void;
  deleteStudyMaterial: (id: string) => void;

  notifications: NotificationItem[];
  addNotification: (notif: Omit<NotificationItem, 'id' | 'createdAt'>) => void;
  deleteNotification: (id: string) => void;

  courses: Course[];
  addCourse: (course: Omit<Course, 'id' | 'enrolledCount'>) => void;
  updateCourse: (id: string, data: Partial<Course>) => void;
  deleteCourse: (id: string) => void;

  testSeries: TestSeries[];
  addTestSeries: (ts: Omit<TestSeries, 'id' | 'enrolledCount'>) => void;
  updateTestSeries: (id: string, data: Partial<TestSeries>) => void;
  deleteTestSeries: (id: string) => void;

  payments: PaymentTransaction[];
  setPayments: React.Dispatch<React.SetStateAction<PaymentTransaction[]>>;
  addPayment: (p: Omit<PaymentTransaction, 'id' | 'receiptNo' | 'date'>) => PaymentTransaction;
  verifyPayment: (id: string) => void;
  deletePayment: (id: string) => void;
  togglePaymentStatus: (id: string, reason?: string) => void;
  clearRejectedPayments: () => void;
  resetPaymentsToDefault: () => void;

  toasts: ToastInfo[];
  showToast: (message: string, type?: 'success' | 'info' | 'error') => void;
  removeToast: (id: string) => void;

  startExamForStudent: (examId: string, studentOverride?: User) => void;
  registerQuickJoinStudent: (data: {
    name: string;
    phone: string;
    targetClass: string;
    collegeName: string;
    rollNo?: string;
    username?: string;
    password?: string;
    examId?: string;
    examTitle?: string;
    email?: string;
  }) => User;
  quickJoinAndStartExam: (
    name: string,
    phone: string,
    targetClassOrEmail: string,
    collegeNameOrTargetExam?: string,
    customRollNoOrExamCode?: string,
    examCodeOrIdParam?: string,
    optionalEmailParam?: string
  ) => void;
  resetAllToDefault: () => void;
}

const STORAGE_PREFIX = 'gyansai_test_portal_v1_';

function loadFromStorage<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(STORAGE_PREFIX + key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (err) {
    console.error(`Error loading ${key} from storage:`, err);
    return defaultValue;
  }
}

function stripHeavyDataUrlsForQuota<T>(key: string, value: T): T {
  const slimQuestion = (q: any) => {
    if (!q || typeof q !== 'object') return q;
    const normPath = normalizeQuestionImageUrl(q.questionImagePath) || undefined;
    const rawImg = normalizeQuestionImageUrl(q.questionImageUrl) || normalizeQuestionImageUrl(q.imageUrl);
    const keepUrl = rawImg && (!rawImg.startsWith('data:') || rawImg.length <= 64000)
      ? rawImg
      : (normPath || rawImg);
    return {
      ...q,
      questionType: resolveQuestionType({ ...q, questionImageUrl: keepUrl || rawImg, questionImagePath: normPath }),
      questionImageUrl: keepUrl || undefined,
      imageUrl: undefined,
      questionImagePath: normPath
    };
  };

  if (key === 'questions' && Array.isArray(value)) {
    return value.map(slimQuestion) as unknown as T;
  }
  if (key === 'exams' && Array.isArray(value)) {
    return value.map((ex: any) => ({
      ...ex,
      questions: Array.isArray(ex?.questions) ? ex.questions.map(slimQuestion) : ex?.questions
    })) as unknown as T;
  }
  return value;
}

function saveToStorage<T>(key: string, value: T): void {
  if (key === 'questions' || key === 'exams') {
    saveToIndexedDb(key, value).catch(() => {});
  }
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
  } catch (err) {
    if (key === 'questions' || key === 'exams') {
      try {
        const slim = stripHeavyDataUrlsForQuota(key, value);
        localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(slim));
        return;
      } catch {
        // Still over 5MB quota -> IndexedDB holds full state cleanly
      }
    }
    console.warn(`[STORAGE WARNING] Could not persist full ${key} payload in localStorage (exceeds quota); IndexedDB & cloud/server store remain active:`, err);
  }
}

async function safeParseJsonResponse(res: Response): Promise<any | null> {
  try {
    if (!res.ok) return null;
    const text = await res.text();
    if (!text || text.trim().startsWith('<')) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function hasExamRouteInLocation(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    const path = window.location.pathname.toLowerCase();
    const search = window.location.search.toLowerCase();
    const hash = window.location.hash.toLowerCase();
    return Boolean(
      search.includes('cbt=') ||
      search.includes('mode=cbt') ||
      search.includes('exam=') ||
      search.includes('share=') ||
      search.includes('test=') ||
      search.includes('d=') ||
      search.includes('examdata=') ||
      path.includes('/cbt') ||
      path.includes('/exam') ||
      path.includes('/share') ||
      path.includes('/test') ||
      hash.includes('/cbt') ||
      hash.includes('/exam') ||
      hash.includes('cbt=') ||
      hash.includes('exam=') ||
      hash.includes('d=')
    );
  } catch {
    return false;
  }
}

const PortalContext = createContext<PortalContextType | undefined>(undefined);

export const PortalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<InstituteSettings>(() =>
    loadFromStorage('settings', INITIAL_INSTITUTE_SETTINGS)
  );
  const [users, setUsers] = useState<User[]>(() => loadFromStorage('users', INITIAL_USERS));
  const [currentUser, setCurrentUser] = useState<User>(() => {
    try {
      const savedStudent = sessionStorage.getItem('cbt_active_student');
      if (savedStudent) {
        return JSON.parse(savedStudent);
      }
    } catch {}
    const storedUsers = loadFromStorage('users', INITIAL_USERS);
    return storedUsers[0] || INITIAL_USERS[0];
  });
  const [batches, setBatches] = useState<Batch[]>(() => loadFromStorage('batches', INITIAL_BATCHES));
  const [teachers, setTeachers] = useState<Teacher[]>(() => loadFromStorage('teachers', INITIAL_TEACHERS));
  const [questions, setQuestions] = useState<Question[]>(() => {
    const stored = loadFromStorage('questions', INITIAL_QUESTIONS);
    const existingIds = new Set(stored.map(q => q.id));
    const missing = INITIAL_QUESTIONS.filter(q => !existingIds.has(q.id));
    return missing.length > 0 ? [...stored, ...missing] : stored;
  });
  const [folders, setFolders] = useState<ExamFolder[]>(() => loadFromStorage('folders', INITIAL_EXAM_FOLDERS));
  const [exams, setExams] = useState<Exam[]>(() => {
    const stored = loadFromStorage('exams', INITIAL_EXAMS);
    const existingIds = new Set(stored.map(e => e.id));
    const existingCodes = new Set(stored.map(e => (e.code || '').toLowerCase()));
    const missing = INITIAL_EXAMS.filter(e => !existingIds.has(e.id) && !existingCodes.has((e.code || '').toLowerCase()));
    return missing.length > 0 ? [...missing, ...stored] : stored;
  });
  const [attempts, setAttempts] = useState<ExamAttempt[]>(() => loadFromStorage('attempts', INITIAL_ATTEMPTS));
  const [attendance, setAttendance] = useState<AttendanceRecord[]>(() => loadFromStorage('attendance', INITIAL_ATTENDANCE));
  const [studyMaterials, setStudyMaterials] = useState<StudyMaterial[]>(() => loadFromStorage('studyMaterials', INITIAL_STUDY_MATERIAL));
  const [notifications, setNotifications] = useState<NotificationItem[]>(() => loadFromStorage('notifications', INITIAL_NOTIFICATIONS));
  const [courses, setCourses] = useState<Course[]>(() => loadFromStorage('courses', INITIAL_COURSES));
  const [testSeries, setTestSeries] = useState<TestSeries[]>(() => loadFromStorage('testSeries', INITIAL_TEST_SERIES));
  const [payments, setPayments] = useState<PaymentTransaction[]>(() => {
    try {
      const approvals = localStorage.getItem('gyansai_payment_approvals_v1');
      if (approvals) {
        const parsed = JSON.parse(approvals);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return loadFromStorage('payments', INITIAL_PAYMENTS);
  });
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(() =>
    loadFromStorage('admin_auth', false)
  );
  const [firebaseAdminEmail, setFirebaseAdminEmail] = useState<string | null>(null);
  const [isCloudSyncing, setIsCloudSyncing] = useState<boolean>(false);
  const [adminLoginModalOpen, setAdminLoginModalOpen] = useState<boolean>(false);

  const [portalModeState, setPortalModeState] = useState<PortalMode>(() => {
    try {
      const hasSession = typeof window !== 'undefined' && sessionStorage.getItem('cbt_active_taking_exam') && sessionStorage.getItem('cbt_active_student');
      if (hasSession) {
        return 'taking_exam';
      }
      const path = window.location.pathname.toLowerCase();
      if (hasExamRouteInLocation()) {
        return 'public_exam';
      }
      const isAuth = loadFromStorage('admin_auth', false);
      if (path.includes('/admin')) {
        return isAuth ? 'admin' : 'landing';
      }
      if (path.includes('/app') || path.includes('/student')) return 'student';
      if (path.includes('/login') || path.includes('/auth')) return 'login';
      return 'landing';
    } catch {
      return 'landing';
    }
  });

  const portalMode = portalModeState;

  const setPortalMode = (mode: PortalMode) => {
    if (mode === 'admin' && !isAdminAuthenticated) {
      setAdminLoginModalOpen(true);
      return;
    }
    if (mode !== 'admin') {
      setActiveExamIdForShare(null);
    }
    portalModeRef.current = mode;
    setPortalModeState(mode);
    try {
      if (mode === 'landing') {
        window.history.pushState({}, '', '/');
      } else if (mode === 'student') {
        window.history.pushState({}, '', '/student');
      } else if (mode === 'login') {
        window.history.pushState({}, '', '/login');
      } else if (mode === 'admin') {
        window.history.pushState({}, '', '/admin');
      }
    } catch {
      // ignore
    }
  };
  const [activeAdminTab, setActiveAdminTab] = useState<string>('Dashboard');
  const [activeStudentTab, setActiveStudentTab] = useState<string>('Dashboard');

  const [activeExamIdForCBT, setActiveExamIdForCBT] = useState<string | null>(() => {
    try {
      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        const cbtVal = urlParams.get('cbt');
        if (cbtVal && cbtVal !== 'true' && cbtVal !== '1') {
          return cbtVal;
        }
        if (cbtVal === 'true' || cbtVal === '1' || urlParams.get('mode') === 'cbt') {
          const matched = urlParams.get('exam') || urlParams.get('test') || null;
          if (matched) return matched;
        }
      }
      return sessionStorage.getItem('cbt_active_taking_exam') || null;
    } catch {
      return null;
    }
  });
  const [activeExamIdForShare, setActiveExamIdForShare] = useState<string | null>(null);
  const [activePublicExamId, setActivePublicExamId] = useState<string | null>(() => {
    try {
      const path = window.location.pathname;
      if (path.toLowerCase().includes('/exam/')) {
        const parts = path.split(/\/exam\//i);
        if (parts[1]) {
          const raw = decodeURIComponent(parts[1].split('/')[0].split('?')[0]);
          if (raw) return raw;
        }
      }
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get('cbt') || urlParams.get('exam') || urlParams.get('test') || urlParams.get('share') || null;
    } catch {
      return null;
    }
  });
  const [isResolvingExamRoute, setIsResolvingExamRoute] = useState<boolean>(() => hasExamRouteInLocation());
  const [examRouteError, setExamRouteError] = useState<string | null>(null);
  const [routeRetryTick, setRouteRetryTick] = useState<number>(0);

  const retryResolveExamRoute = () => {
    setIsResolvingExamRoute(true);
    setExamRouteError(null);
    setRouteRetryTick(prev => prev + 1);
  };

  const [activeExamForQuestionsModal, setActiveExamForQuestionsModal] = useState<Exam | null>(null);
  const [selectedAttemptForResult, setSelectedAttemptForResult] = useState<ExamAttempt | null>(null);

  const [createFolderModalOpen, setCreateFolderModalOpen] = useState<boolean>(false);
  const [createQuestionModalOpen, setCreateQuestionModalOpen] = useState<boolean>(false);
  const [activeTargetExamIdForQuestion, setActiveTargetExamIdForQuestion] = useState<string | null>(null);
  const [activeTargetFolderIdForQuestion, setActiveTargetFolderIdForQuestion] = useState<string | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState<boolean>(false);
  const [authModalTab, setAuthModalTab] = useState<'login' | 'signup'>('login');
  const [quickJoinModalOpen, setQuickJoinModalOpen] = useState<boolean>(false);

  const [toasts, setToasts] = useState<ToastInfo[]>([]);

  // Synchronized refs so resolveUrlRoute can read fresh state without triggering re-renders
  const portalModeRef = useRef(portalModeState);
  useEffect(() => { portalModeRef.current = portalModeState; }, [portalModeState]);

  useEffect(() => {
    if (portalModeState !== 'admin' || !isAdminAuthenticated || currentUser?.role !== 'admin') {
      setActiveExamIdForShare(null);
    }
  }, [portalModeState, isAdminAuthenticated, currentUser?.role]);

  const examsRef = useRef(exams);
  useEffect(() => { examsRef.current = exams; }, [exams]);

  const questionsRef = useRef(questions);
  useEffect(() => { questionsRef.current = questions; }, [questions]);

  const foldersRef = useRef(folders);
  useEffect(() => { foldersRef.current = folders; }, [folders]);

  const syncAllExamsToCloud = async () => {
    if (!isVerifiedAdminSignedIn()) {
      showToast('Please connect Google Cloud Sync first so student mobile links work across devices.', 'error');
      return;
    }
    setIsCloudSyncing(true);
    let failedCount = 0;
    try {
      for (const f of foldersRef.current) {
        await syncFolderToFirestore(f).catch(err => {
          failedCount++;
          console.warn('Folder sync error:', err);
        });
      }
      for (const ex of examsRef.current) {
        const resolvedQs = resolveExamQuestions(ex, questionsRef.current);
        const enrichedExam: Exam = { ...ex, questions: resolvedQs };
        await syncExamAndQuestionsToFirestore(enrichedExam, questionsRef.current).catch(err => {
          failedCount++;
          console.warn('Exam sync error:', ex.code, err);
        });
      }
      if (failedCount > 0) {
        showToast(`Cloud sync finished with ${failedCount} warning(s). Check large images or retry.`, 'error');
      } else {
        showToast('All exams & uploaded question images synced to Cloud!');
      }
    } finally {
      setIsCloudSyncing(false);
    }
  };

  const syncSingleExamToCloud = async (examObj: Exam) => {
    if (!isVerifiedAdminSignedIn()) return;
    setIsCloudSyncing(true);
    try {
      const resolvedQs = resolveExamQuestions(examObj, questionsRef.current);
      const enrichedExam: Exam = { ...examObj, questions: resolvedQs };
      await syncExamAndQuestionsToFirestore(enrichedExam, questionsRef.current);
    } catch (err) {
      console.warn('Single exam sync warning:', err);
      showToast('Cloud sync warning: some exam data may need retry.', 'error');
    } finally {
      setIsCloudSyncing(false);
    }
  };

  // Monitor Firebase Auth state for admin cloud sync
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser && fbUser.emailVerified && fbUser.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
        setFirebaseAdminEmail(fbUser.email);
        setIsCloudSyncing(true);
        try {
          const cloudState = await fetchAdminCloudState();
          if (cloudState) {
            if (cloudState.folders.length > 0) {
              setFolders(prev => {
                const map = new Map(prev.map(f => [f.id, f]));
                cloudState.folders.forEach(cf => map.set(cf.id, { ...(map.get(cf.id) || {}), ...cf }));
                const merged = Array.from(map.values());
                saveToStorage('folders', merged);
                return merged;
              });
            }
            if (cloudState.questions.length > 0) {
              setQuestions(prev => {
                const map = new Map(prev.map(q => [q.id, q]));
                cloudState.questions.forEach(cq => {
                  const ex = map.get(cq.id);
                  map.set(cq.id, mergeQuestionRecord(cq, ex));
                });
                const merged = Array.from(map.values());
                saveToStorage('questions', merged);
                return merged;
              });
            }
            if (cloudState.exams.length > 0) {
              setExams(prev => {
                const next = [...prev];
                cloudState.exams.forEach(ce => {
                  const idx = next.findIndex(
                    e => e.id.toLowerCase() === ce.id.toLowerCase() || e.code.toLowerCase() === ce.code.toLowerCase()
                  );
                  if (idx >= 0) {
                    const existing = next[idx];
                    const cloudHasQs = ce.questions && ce.questions.length > 0;
                    next[idx] = {
                      ...existing,
                      ...ce,
                      questions: cloudHasQs
                        ? mergeQuestionArrays(ce.questions, existing.questions)
                        : existing.questions,
                      sections: cloudHasQs ? ce.sections : existing.sections
                    };
                  } else {
                    next.unshift(ce);
                  }
                });
                saveToStorage('exams', next);
                return next;
              });
            }
            if (cloudState.registrations.length > 0) {
              setUsers(prev => {
                const map = new Map(prev.map(u => [u.id, u]));
                cloudState.registrations.forEach(reg => {
                  const existingByPhone = prev.find(u => u.phone && reg.phone && u.phone.replace(/\D/g, '') === reg.phone.replace(/\D/g, ''));
                  if (!existingByPhone) {
                    map.set(reg.id, reg);
                  }
                });
                const merged = Array.from(map.values());
                saveToStorage('users', merged);
                return merged;
              });
            }
            if (cloudState.attempts.length > 0) {
              setAttempts(prev => {
                const map = new Map(prev.map(a => [a.id, a]));
                cloudState.attempts.forEach(ca => {
                  if (!map.has(ca.id)) map.set(ca.id, ca);
                });
                const merged = Array.from(map.values());
                saveToStorage('attempts', merged);
                return merged;
              });
            }
          }

          // Ensure local exams & folders not yet in Firestore are pushed immediately
          for (const f of foldersRef.current) {
            await syncFolderToFirestore(f).catch(() => {});
          }
          for (const ex of examsRef.current) {
            await syncExamAndQuestionsToFirestore(ex, questionsRef.current).catch(() => {});
          }
        } catch (err) {
          console.warn('Cloud sync load error:', err);
        } finally {
          setIsCloudSyncing(false);
        }
      } else {
        setFirebaseAdminEmail(null);
      }
    });
    return () => unsub();
  }, []);

  // Check URL pathname & query parameters on mount, popstate, and manual retry for direct shared exam landing
  useEffect(() => {
    const resolveUrlRoute = async () => {
      const expectingExam = hasExamRouteInLocation() || Boolean(typeof window !== 'undefined' && sessionStorage.getItem('cbt_active_taking_exam'));
      if (expectingExam) {
        setIsResolvingExamRoute(true);
        setExamRouteError(null);
      }

      try {
        // Helper to fetch and merge remote exam from BOTH Firestore + /api/sync-exam
        const hydrateRemoteExam = async (lookupKey: string): Promise<Exam | null> => {
          try {
            const [cloudResult, apiResult] = await Promise.allSettled([
              fetchExamWithQuestionsFromFirestore(lookupKey),
              fetch(`/api/sync-exam?code=${encodeURIComponent(lookupKey)}`).then(async res => {
                const json = await safeParseJsonResponse(res);
                return json && json.success && json.data ? (json.data as Exam) : null;
              })
            ]);

            const cloudExam = cloudResult.status === 'fulfilled' ? cloudResult.value : null;
            const apiExam = apiResult.status === 'fulfilled' ? apiResult.value : null;

            if (!cloudExam && !apiExam) return null;

            const baseExam = cloudExam && (!apiExam || (cloudExam.questions && cloudExam.questions.length > 0))
              ? cloudExam
              : (apiExam || cloudExam)!;
            const altExam = baseExam === cloudExam ? apiExam : cloudExam;

            const mergedQs = mergeQuestionArrays(baseExam.questions, altExam?.questions);
            return {
              ...(altExam || {}),
              ...baseExam,
              questions: mergedQs,
              sections: (baseExam.sections && baseExam.sections.length > 0 && baseExam.sections.some(s => (s.questionIds || []).length > 0))
                ? baseExam.sections
                : altExam?.sections || baseExam.sections
            };
          } catch (e) {
            console.warn('[SYNC FETCH ERROR]', e);
            return null;
          }
        };

        // If candidate is actively taking an examination in CBT mode (e.g. page refresh!),
        // keep them in taking_exam AND re-hydrate latest question images from BOTH URL token (?d=) and remote stores!
        if (typeof window !== 'undefined' && sessionStorage.getItem('cbt_active_taking_exam')) {
          const takingId = sessionStorage.getItem('cbt_active_taking_exam');
          if (takingId) {
            setActiveExamIdForShare(null);
            setActiveExamIdForCBT(takingId);
            setPortalModeState('taking_exam');
            const decodedReload = decodeExamFromUrl();
            const refreshedExam = await hydrateRemoteExam(takingId);
            const urlMatchesTaking = Boolean(
              decodedReload?.exam &&
              (decodedReload.exam.id.toLowerCase() === takingId.toLowerCase() ||
               decodedReload.exam.code.toLowerCase() === takingId.toLowerCase())
            );
            const combinedReloadQuestions = mergeQuestionArrays(
              refreshedExam?.questions,
              urlMatchesTaking ? decodedReload?.customQuestions : undefined
            );

            if (combinedReloadQuestions && combinedReloadQuestions.length > 0) {
              const qMap = new Map(questionsRef.current.map(q => [q.id, q]));
              combinedReloadQuestions.forEach(q => {
                if (q?.id) qMap.set(q.id, mergeQuestionRecord(q, qMap.get(q.id)));
              });
              const updatedQs = Array.from(qMap.values());
              questionsRef.current = updatedQs;
              saveToStorage('questions', updatedQs);
              setQuestions(updatedQs);
            }

            const baseReloadExam = refreshedExam || (urlMatchesTaking ? decodedReload?.exam : null);
            if (baseReloadExam) {
              const nextExams = [...examsRef.current];
              const idx = nextExams.findIndex(
                e => e.id.toLowerCase() === baseReloadExam.id.toLowerCase() ||
                     e.code.toLowerCase() === baseReloadExam.code.toLowerCase()
              );
              if (idx >= 0) {
                const existing = nextExams[idx];
                nextExams[idx] = {
                  ...existing,
                  ...baseReloadExam,
                  questions: mergeQuestionArrays(combinedReloadQuestions || baseReloadExam.questions, existing.questions)
                };
              } else {
                nextExams.unshift({
                  ...baseReloadExam,
                  questions: combinedReloadQuestions || baseReloadExam.questions
                });
              }
              examsRef.current = nextExams;
              saveToStorage('exams', nextExams);
              setExams(nextExams);
            }
          } else {
            setPortalModeState('taking_exam');
          }
          return;
        }

        // 1. Check if the URL has a self-hydrating exam payload (?d= or #?d=)
        const decoded = decodeExamFromUrl();
        if (decoded && decoded.exam) {
          setActiveExamIdForShare(null);
          // Immediately hydrate decoded exam & embedded images before network round-trip
          if (decoded.customQuestions && decoded.customQuestions.length > 0) {
            const immediateMap = new Map(questionsRef.current.map(q => [q.id, q]));
            decoded.customQuestions.forEach(q => {
              if (q?.id) immediateMap.set(q.id, mergeQuestionRecord(q, immediateMap.get(q.id)));
            });
            const immediateQs = Array.from(immediateMap.values());
            questionsRef.current = immediateQs;
            saveToStorage('questions', immediateQs);
            setQuestions(immediateQs);
          }

          const immediateExamList = [...examsRef.current];
          const immIdx = immediateExamList.findIndex(
            e => e.id.toLowerCase() === decoded.exam.id.toLowerCase() ||
                 e.code.toLowerCase() === decoded.exam.code.toLowerCase()
          );
          if (immIdx >= 0) {
            immediateExamList[immIdx] = {
              ...immediateExamList[immIdx],
              ...decoded.exam,
              questions: mergeQuestionArrays(decoded.customQuestions, immediateExamList[immIdx].questions)
            };
          } else {
            immediateExamList.unshift(decoded.exam);
          }
          examsRef.current = immediateExamList;
          saveToStorage('exams', immediateExamList);
          setExams(immediateExamList);

          const inActiveExamNow =
            portalModeRef.current === 'taking_exam' ||
            (typeof window !== 'undefined' && Boolean(sessionStorage.getItem('cbt_active_taking_exam')));

          if (!inActiveExamNow) {
            setActivePublicExamId(decoded.exam.id);
            setActiveExamIdForCBT(decoded.exam.id);
            setPortalModeState('public_exam');
          }

          const remoteFromSlug = await hydrateRemoteExam(decoded.exam.code || decoded.exam.id);
          const localMatch = examsRef.current.find(
            e => e.id.toLowerCase() === decoded.exam.id.toLowerCase() ||
                 e.code.toLowerCase() === decoded.exam.code.toLowerCase()
          );

          const mergedQuestions =
            mergeQuestionArrays(
              mergeQuestionArrays(remoteFromSlug?.questions, localMatch?.questions),
              decoded.customQuestions
            ) || decoded.customQuestions;

          if (mergedQuestions && mergedQuestions.length > 0) {
            const map = new Map(questionsRef.current.map(q => [q.id, q]));
            mergedQuestions.forEach(q => {
              if (q?.id) map.set(q.id, mergeQuestionRecord(q, map.get(q.id)));
            });
            const updated = Array.from(map.values());
            questionsRef.current = updated;
            saveToStorage('questions', updated);
            setQuestions(updated);
          }

          const finalDecodedExam: Exam = {
            ...(localMatch || {}),
            ...decoded.exam,
            ...(remoteFromSlug || {}),
            questions: mergedQuestions.length > 0
              ? mergedQuestions
              : (remoteFromSlug?.questions || localMatch?.questions || decoded.exam.questions),
            sections: (remoteFromSlug?.sections && remoteFromSlug.sections.some(s => (s.questionIds || []).length > 0))
              ? remoteFromSlug.sections
              : (decoded.exam.sections && decoded.exam.sections.some(s => (s.questionIds || []).length > 0))
              ? decoded.exam.sections
              : localMatch?.sections || decoded.exam.sections
          };

          const updatedExams = [...examsRef.current];
          const finalIdx = updatedExams.findIndex(
            e => e.id.toLowerCase() === finalDecodedExam.id.toLowerCase() ||
                 e.code.toLowerCase() === finalDecodedExam.code.toLowerCase()
          );
          if (finalIdx >= 0) {
            updatedExams[finalIdx] = {
              ...updatedExams[finalIdx],
              ...finalDecodedExam,
              questions: mergeQuestionArrays(finalDecodedExam.questions, updatedExams[finalIdx].questions)
            };
          } else {
            updatedExams.unshift(finalDecodedExam);
          }
          examsRef.current = updatedExams;
          saveToStorage('exams', updatedExams);
          setExams(updatedExams);

          const inActiveExam =
            portalModeRef.current === 'taking_exam' ||
            (typeof window !== 'undefined' && Boolean(sessionStorage.getItem('cbt_active_taking_exam')));

          if (!inActiveExam) {
            setActivePublicExamId(finalDecodedExam.id);
            setActiveExamIdForCBT(finalDecodedExam.id);
            setPortalModeState('public_exam');
          }
          return;
        }

        const currentExams = examsRef.current;
        const currentQuestions = questionsRef.current;

        const path = window.location.pathname;
        const search = window.location.search;
        let examParam: string | null = null;

        const urlParams = new URLSearchParams(search);
        const cbtParam = urlParams.get('cbt');
        if (cbtParam !== null && cbtParam !== '') {
          if (cbtParam !== 'true' && cbtParam !== '1') {
            examParam = cbtParam;
          } else {
            examParam = urlParams.get('exam') || urlParams.get('test') || urlParams.get('share');
          }
        } else if (urlParams.get('mode') === 'cbt') {
          examParam = urlParams.get('exam') || urlParams.get('test') || urlParams.get('share');
        } else if (path.toLowerCase().includes('/cbt/')) {
          const parts = path.split(/\/cbt\//i);
          if (parts[1]) {
            examParam = decodeURIComponent(parts[1].split('/')[0].split('?')[0]);
          }
        }

        if (!examParam && path.toLowerCase().includes('/exam/')) {
          const parts = path.split(/\/exam\//i);
          if (parts[1]) {
            examParam = decodeURIComponent(parts[1].split('/')[0].split('?')[0]);
          }
        }
        if (!examParam) {
          examParam = urlParams.get('exam') || urlParams.get('test') || urlParams.get('share');
        }
        if (!examParam && window.location.hash) {
          try {
            const hash = window.location.hash;
            if (hash.toLowerCase().includes('/cbt/')) {
              const parts = hash.split(/\/cbt\//i);
              if (parts[1]) examParam = decodeURIComponent(parts[1].split('/')[0].split('?')[0]);
            } else if (hash.toLowerCase().includes('/exam/')) {
              const parts = hash.split(/\/exam\//i);
              if (parts[1]) examParam = decodeURIComponent(parts[1].split('/')[0].split('?')[0]);
            } else if (hash.includes('?')) {
              const hashParams = new URLSearchParams(hash.split('?')[1]);
              const hCbt = hashParams.get('cbt');
              if (hCbt !== null && hCbt !== '') {
                examParam = (hCbt !== 'true' && hCbt !== '1') ? hCbt : (hashParams.get('exam') || hashParams.get('test'));
              } else {
                examParam = hashParams.get('exam') || hashParams.get('test') || hashParams.get('share');
              }
            }
          } catch {}
        }

        if (examParam) {
          const remoteExam = await hydrateRemoteExam(examParam);
          const latestExams = examsRef.current.length > 0 ? examsRef.current : currentExams;
          const latestQuestions = questionsRef.current.length > 0 ? questionsRef.current : currentQuestions;
          const foundLocal = latestExams.find(
            e => e.id.toLowerCase() === examParam!.toLowerCase() ||
                 e.code.toLowerCase() === examParam!.toLowerCase()
          );

          const urlCls = urlParams.get('cls');
          const urlCat = urlParams.get('cat');
          const urlTitle = urlParams.get('title');
          const urlDur = Number(urlParams.get('dur'));
          const urlQ = urlParams.get('q');

          if (remoteExam) {
            console.log('[EXAM IDENTIFIER] Remote teacher exam retrieved:', {
              id: remoteExam.id,
              code: remoteExam.code,
              title: remoteExam.title,
              targetClass: remoteExam.targetClass,
              questionsCount: remoteExam.questions?.length || 0
            });

            setActiveExamIdForShare(null);
            if (remoteExam.questions && remoteExam.questions.length > 0) {
              const map = new Map(questionsRef.current.map(q => [q.id, q]));
              remoteExam.questions.forEach((q: Question) => {
                if (q && q.id) map.set(q.id, mergeQuestionRecord(q, map.get(q.id)));
              });
              const updatedQs = Array.from(map.values());
              questionsRef.current = updatedQs;
              saveToStorage('questions', updatedQs);
              setQuestions(updatedQs);
            }

            const updatedExamsList = [...examsRef.current];
            const idx = updatedExamsList.findIndex(
              e => e.id.toLowerCase() === remoteExam.id.toLowerCase() ||
                   e.code.toLowerCase() === remoteExam.code.toLowerCase()
            );
            if (idx >= 0) {
              const existing = updatedExamsList[idx];
              updatedExamsList[idx] = {
                ...existing,
                ...remoteExam,
                questions: mergeQuestionArrays(remoteExam.questions, existing.questions)
              };
            } else {
              updatedExamsList.unshift(remoteExam);
            }
            examsRef.current = updatedExamsList;
            saveToStorage('exams', updatedExamsList);
            setExams(updatedExamsList);

            const inActiveExam =
              portalModeRef.current === 'taking_exam' ||
              (typeof window !== 'undefined' && Boolean(sessionStorage.getItem('cbt_active_taking_exam')));

            if (!inActiveExam) {
              setActivePublicExamId(remoteExam.id);
              setActiveExamIdForCBT(remoteExam.id);
              setPortalModeState('public_exam');
            }
            return;
          }

          if (foundLocal) {
            const hasExistingQuestions = Array.isArray(foundLocal.questions) && foundLocal.questions.length > 0;
            if (urlCls || urlTitle || (urlQ && !hasExistingQuestions)) {
              setExams(prev => prev.map(e => {
                if (e.id === foundLocal.id) {
                  const updated: Exam = { ...e };
                  if (urlCls) updated.targetClass = urlCls;
                  if (urlCat) updated.examCategory = urlCat;
                  if (urlTitle) updated.title = decodeURIComponent(urlTitle);
                  if (urlDur) updated.durationMinutes = urlDur;
                  if (urlQ && !hasExistingQuestions) {
                    const qIds = urlQ.split(',').filter(Boolean);
                    const matchedQs = qIds.map(id => latestQuestions.find(q => q.id === id || q.code === id)).filter(Boolean) as Question[];
                    if (matchedQs.length > 0) {
                      updated.questions = matchedQs;
                      updated.sections = [{
                        id: 'sec-1',
                        name: `Mathematics Section (Class ${urlCls || e.targetClass || '11th'})`,
                        subject: 'Mathematics',
                        questionIds: matchedQs.map(q => q.id)
                      }];
                      updated.totalMarks = matchedQs.length * (e.positiveMarks || 4);
                    }
                  }
                  return updated;
                }
                return e;
              }));
            }

            const inActiveExam =
              portalModeRef.current === 'taking_exam' ||
              (typeof window !== 'undefined' && Boolean(sessionStorage.getItem('cbt_active_taking_exam')));

            if (!inActiveExam) {
              setActivePublicExamId(foundLocal.id);
              setActiveExamIdForCBT(foundLocal.id);
              setPortalModeState('public_exam');
            }
            return;
          }

          // Neither remoteExam nor local exam was found:
          // Only materialize if explicit URL question IDs actually match stored questions; NEVER invent random INITIAL_QUESTIONS!
          const explicitIds = urlQ ? urlQ.split(',').filter(Boolean) : [];
          const explicitMatchedQs = explicitIds
            .map(id => latestQuestions.find(q => q.id === id || q.code === id))
            .filter(Boolean) as Question[];

          if (explicitMatchedQs.length > 0) {
            const cleanCode = examParam.trim();
            const targetClass = urlCls || '11th';
            const targetCategory = urlCat || 'JEE';
            const dynamicTitle = urlTitle ? decodeURIComponent(urlTitle) : cleanCode;
            const rebuiltExam: Exam = {
              id: cleanCode,
              title: dynamicTitle,
              code: cleanCode,
              folderId: targetClass.includes('12') ? 'folder-12th' : 'folder-11th',
              folderName: `Class ${targetClass} Mathematics`,
              batchIds: [],
              durationMinutes: urlDur || 60,
              totalMarks: explicitMatchedQs.length * 4,
              positiveMarks: 4,
              negativeMarks: -1,
              passPercentage: 40,
              targetClass,
              examCategory: targetCategory,
              sections: [
                {
                  id: 'sec-1',
                  name: `Mathematics Section (Class ${targetClass})`,
                  subject: 'Mathematics',
                  questionIds: explicitMatchedQs.map(q => q.id),
                  instructions: '+4 for correct answer, -1 for wrong response.'
                }
              ],
              questions: explicitMatchedQs,
              startTime: new Date().toISOString().slice(0, 16),
              endTime: new Date(Date.now() + 90 * 24 * 3600 * 1000).toISOString().slice(0, 16),
              status: 'Live',
              isPublic: true,
              publicAccessUrl: window.location.href,
              instructions: [
                'Each question has four options with only ONE correct answer.',
                'Marking: +4 marks for correct response, -1 mark for wrong response.'
              ],
              createdAt: new Date().toISOString()
            };
            setExams(prev => [rebuiltExam, ...prev]);
            setActivePublicExamId(rebuiltExam.id);
            setActiveExamIdForCBT(rebuiltExam.id);
            setPortalModeState('public_exam');
            return;
          }

          // Honest missing/unsynced exam error — NEVER silently substitute exams[0] ("www") or random questions!
          console.warn('[EXAM ROUTE NOT FOUND] Requested exam could not be resolved remotely or locally:', examParam);
          setExamRouteError(
            `Examination "${examParam}" could not be loaded on this device yet. If your teacher just created it, ask them to connect Google Cloud Sync or click Share again so the paper syncs to the cloud.`
          );
          setActivePublicExamId(examParam);
          setActiveExamIdForCBT(examParam);
          setPortalModeState('public_exam');
        } else if (path.toLowerCase().includes('/login')) {
          setPortalModeState('login');
        } else if (path.toLowerCase().includes('/student') || path.toLowerCase().includes('/app')) {
          setPortalModeState('student');
        } else if (path.toLowerCase().includes('/admin')) {
          const isAuth = loadFromStorage('admin_auth', false);
          setPortalModeState(isAuth ? 'admin' : 'landing');
        }
      } catch (err) {
        console.error('Error resolving URL route:', err);
        setExamRouteError('Unable to load examination details. Please check your connection and retry.');
      } finally {
        setIsResolvingExamRoute(false);
      }
    };

    resolveUrlRoute();
    window.addEventListener('popstate', resolveUrlRoute);
    return () => window.removeEventListener('popstate', resolveUrlRoute);
  }, [routeRetryTick]);

  // Sync to localStorage
  useEffect(() => { saveToStorage('settings', settings); }, [settings]);
  useEffect(() => { saveToStorage('users', users); }, [users]);
  useEffect(() => { saveToStorage('batches', batches); }, [batches]);
  useEffect(() => { saveToStorage('teachers', teachers); }, [teachers]);
  useEffect(() => { saveToStorage('questions', questions); }, [questions]);
  useEffect(() => { saveToStorage('folders', folders); }, [folders]);
  useEffect(() => { saveToStorage('exams', exams); }, [exams]);
  useEffect(() => { saveToStorage('attempts', attempts); }, [attempts]);
  useEffect(() => { saveToStorage('attendance', attendance); }, [attendance]);
  useEffect(() => { saveToStorage('studyMaterials', studyMaterials); }, [studyMaterials]);
  useEffect(() => { saveToStorage('notifications', notifications); }, [notifications]);
  useEffect(() => { saveToStorage('courses', courses); }, [courses]);
  useEffect(() => { saveToStorage('testSeries', testSeries); }, [testSeries]);
  useEffect(() => {
    saveToStorage('payments', payments);
    try {
      localStorage.setItem('gyansai_payment_approvals_v1', JSON.stringify(payments));
    } catch {}
  }, [payments]);
  useEffect(() => { saveToStorage('admin_auth', isAdminAuthenticated); }, [isAdminAuthenticated]);

  // Synchronize persisted students, IndexedDB full-res images, backend disk store, and public Firestore exams on mount
  useEffect(() => {
    const mergeRemoteExamsAndQuestions = (remoteExams: Exam[]) => {
      if (!Array.isArray(remoteExams) || remoteExams.length === 0) return;
      const allRemoteQs: Question[] = [];
      remoteExams.forEach((ex: Exam) => {
        if (Array.isArray(ex?.questions)) {
          ex.questions.forEach((q: Question) => {
            if (q && q.id) allRemoteQs.push(q);
          });
        }
      });
      if (allRemoteQs.length > 0) {
        setQuestions(prev => {
          const map = new Map(prev.map(q => [q.id, q]));
          allRemoteQs.forEach(q => {
            const existing = map.get(q.id);
            map.set(q.id, mergeQuestionRecord(q, existing));
          });
          const mergedQs = Array.from(map.values());
          questionsRef.current = mergedQs;
          saveToStorage('questions', mergedQs);
          return mergedQs;
        });
      }

      setExams(prev => {
        const next = [...prev];
        remoteExams.forEach((ex: Exam) => {
          if (!ex || (!ex.id && !ex.code)) return;
          const idx = next.findIndex(
            item =>
              (ex.id && item.id.toLowerCase() === ex.id.toLowerCase()) ||
              (ex.code && item.code.toLowerCase() === ex.code.toLowerCase())
          );
          if (idx >= 0) {
            const existing = next[idx];
            next[idx] = {
              ...existing,
              ...ex,
              questions: mergeQuestionArrays(ex.questions, existing.questions) || existing.questions,
              sections: (ex.sections && ex.sections.length > 0 && ex.sections.some(s => (s.questionIds || []).length > 0))
                ? ex.sections
                : existing.sections
            };
          } else {
            next.unshift(ex);
          }
        });
        examsRef.current = next;
        saveToStorage('exams', next);
        return next;
      });
    };

    // 0. Hydrate full-resolution images & exams from IndexedDB (bypasses 5MB localStorage limit)
    loadFromIndexedDb<Question[]>('questions').then(idbQuestions => {
      if (Array.isArray(idbQuestions) && idbQuestions.length > 0) {
        setQuestions(prev => {
          const map = new Map(prev.map(q => [q.id, q]));
          idbQuestions.forEach(iq => {
            if (iq && iq.id) map.set(iq.id, mergeQuestionRecord(iq, map.get(iq.id)));
          });
          const merged = Array.from(map.values());
          questionsRef.current = merged;
          return merged;
        });
      }
    }).catch(() => {});

    loadFromIndexedDb<Exam[]>('exams').then(idbExams => {
      if (Array.isArray(idbExams) && idbExams.length > 0) {
        mergeRemoteExamsAndQuestions(idbExams);
      }
    }).catch(() => {});

    // 1. Sync remote students
    fetch('/api/sync-student')
      .then(res => safeParseJsonResponse(res))
      .then(json => {
        if (json && json.success && Array.isArray(json.data) && json.data.length > 0) {
          setUsers(prev => {
            const map = new Map(prev.map(u => [u.id, u]));
            json.data.forEach((stu: User) => {
              if (stu && stu.id) {
                map.set(stu.id, { ...(map.get(stu.id) || {}), ...stu });
              }
            });
            const merged = Array.from(map.values());
            saveToStorage('users', merged);
            return merged;
          });
        }
      })
      .catch(() => {});

    // 2. Sync remote exams from backend store
    fetch('/api/sync-exam')
      .then(res => safeParseJsonResponse(res))
      .then(json => {
        if (json && json.success && Array.isArray(json.data) && json.data.length > 0) {
          mergeRemoteExamsAndQuestions(json.data);
        }
      })
      .catch(() => {});

    // 3. Hydrate all public exams & original question images from Firestore for Student Portal & cross-device access
    fetchAllPublicExamsFromFirestore()
      .then(publicExams => {
        if (publicExams.length > 0) {
          mergeRemoteExamsAndQuestions(publicExams);
        }
      })
      .catch(() => {});
  }, []);

  // Dynamically sync browser tab favicon with custom logo/favicon
  useEffect(() => {
    try {
      const fav = settings?.faviconUrl || settings?.logoUrl;
      if (fav) {
        let link = document.querySelector("link[rel*='icon']") as HTMLLinkElement | null;
        if (!link) {
          link = document.createElement('link');
          link.rel = 'shortcut icon';
          document.head.appendChild(link);
        }
        link.href = fav;
      }
    } catch {
      // ignore in SSR / environments without document
    }
  }, [settings?.faviconUrl, settings?.logoUrl]);

  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    const id = 'toast-' + Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const updateSettings = (newSettings: Partial<InstituteSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
    showToast('Institute settings saved successfully!');
  };

  const addUser = (userData: Omit<User, 'id'>): User => {
    const newUser: User = {
      ...userData,
      id: 'usr-' + Date.now(),
      joinedDate: new Date().toISOString().split('T')[0]
    };
    setUsers(prev => [newUser, ...prev]);
    showToast(`User ${newUser.name} added successfully.`);
    return newUser;
  };

  const updateUser = (id: string, data: Partial<User>) => {
    setUsers(prev => prev.map(u => u.id === id ? { ...u, ...data } : u));
    if (currentUser.id === id) {
      setCurrentUser(prev => ({ ...prev, ...data }));
    }
    showToast('User record updated.');
  };

  const deleteUser = (id: string) => {
    const targetUser = users.find(u => u.id === id);
    setUsers(prev => {
      const next = prev.filter(u => u.id !== id);
      saveToStorage('users', next);
      return next;
    });
    if (targetUser) {
      setAttempts(prev => {
        const next = prev.filter(a => a.studentId !== id && a.studentName.toLowerCase() !== targetUser.name.toLowerCase());
        saveToStorage('attempts', next);
        return next;
      });
    }
    showToast(`Student ${targetUser?.name || ''} deleted.`);
  };

  const addBatch = (batchData: Omit<Batch, 'id'>) => {
    const newBatch: Batch = {
      ...batchData,
      id: 'batch-' + Date.now()
    };
    setBatches(prev => [newBatch, ...prev]);
    showToast(`Batch "${newBatch.name}" created successfully.`);
  };

  const updateBatch = (id: string, data: Partial<Batch>) => {
    setBatches(prev => prev.map(b => b.id === id ? { ...b, ...data } : b));
    showToast('Batch updated.');
  };

  const deleteBatch = (id: string) => {
    setBatches(prev => prev.filter(b => b.id !== id));
    showToast('Batch deleted.');
  };

  const addTeacher = (teacherData: Omit<Teacher, 'id'>) => {
    const newTeacher: Teacher = {
      ...teacherData,
      id: 'teacher-' + Date.now()
    };
    setTeachers(prev => [newTeacher, ...prev]);
    showToast(`Faculty "${newTeacher.name}" added successfully.`);
  };

  const updateTeacher = (id: string, data: Partial<Teacher>) => {
    setTeachers(prev => prev.map(t => t.id === id ? { ...t, ...data } : t));
    showToast('Faculty updated.');
  };

  const deleteTeacher = (id: string) => {
    setTeachers(prev => prev.filter(t => t.id !== id));
    showToast('Faculty removed.');
  };

  const addQuestion = (qData: Omit<Question, 'id' | 'createdAt'>): Question => {
    const resolvedImg = getQuestionImageSrc(qData) || undefined;
    const resolvedPath = normalizeQuestionImageUrl(qData.questionImagePath) || undefined;
    const resolvedQType = resolveQuestionType({
      ...qData,
      questionImageUrl: resolvedImg,
      imageUrl: resolvedImg,
      questionImagePath: resolvedPath
    });
    const newQ: Question = {
      ...qData,
      id: 'q-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      chapter: qData.chapter || qData.topic,
      marks: qData.marks ?? qData.marksPositive ?? 4,
      negativeMarks: qData.negativeMarks ?? qData.marksNegative ?? -1,
      questionType: resolvedQType,
      questionText: resolvedQType === 'image' && isPlaceholderQuestionText(qData.questionText) ? '' : (qData.questionText || ''),
      questionImageUrl: resolvedImg,
      imageUrl: resolvedImg,
      ...(resolvedPath ? { questionImagePath: resolvedPath } : {}),
      createdAt: new Date().toISOString().split('T')[0]
    };
    const nextQuestions = [newQ, ...questionsRef.current];
    questionsRef.current = nextQuestions;
    saveToStorage('questions', nextQuestions);
    setQuestions(nextQuestions);
    showToast(`Question ${newQ.code} added to Question Bank.`);
    return newQ;
  };

  const updateQuestion = (id: string, data: Partial<Question>) => {
    const applyQUpdate = (q: Question): Question => {
      const mergedRaw: Question = { ...q, ...data };
      const resolvedImg =
        data.questionImageUrl === undefined && data.imageUrl === undefined
          ? getQuestionImageSrc(q) || undefined
          : (getQuestionImageSrc(data) || undefined);
      const resolvedPath =
        data.questionImagePath === undefined
          ? normalizeQuestionImageUrl(q.questionImagePath) || undefined
          : normalizeQuestionImageUrl(data.questionImagePath) || undefined;
      const qType = data.questionType || resolveQuestionType({
        ...mergedRaw,
        questionImageUrl: resolvedImg,
        imageUrl: resolvedImg,
        questionImagePath: resolvedPath
      });
      return {
        ...mergedRaw,
        chapter: mergedRaw.chapter || mergedRaw.topic,
        marks: mergedRaw.marks ?? mergedRaw.marksPositive ?? 4,
        negativeMarks: mergedRaw.negativeMarks ?? mergedRaw.marksNegative ?? -1,
        questionType: qType,
        questionImageUrl: resolvedImg,
        imageUrl: resolvedImg,
        questionImagePath: resolvedPath
      };
    };

    const nextQuestions = questionsRef.current.map(q => (q.id === id ? applyQUpdate(q) : q));
    questionsRef.current = nextQuestions;
    saveToStorage('questions', nextQuestions);
    setQuestions(nextQuestions);

    const syncedExams: Exam[] = [];
    const nextExams = examsRef.current.map(ex => {
      if (!ex.questions || !ex.questions.some(q => q.id === id)) return ex;
      const updatedEx: Exam = {
        ...ex,
        questions: ex.questions.map(q => (q.id === id ? applyQUpdate(q) : q))
      };
      syncedExams.push(updatedEx);
      return updatedEx;
    });
    examsRef.current = nextExams;
    saveToStorage('exams', nextExams);
    setExams(nextExams);

    syncedExams.forEach(updatedEx => {
      try {
        fetch('/api/sync-exam', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedEx)
        }).catch(() => {});
      } catch {}
      syncExamAndQuestionsToFirestore(updatedEx, updatedEx.questions || nextQuestions).catch(() => {});
    });

    showToast('Question updated.');
  };

  const deleteQuestion = (id: string) => {
    const next = questionsRef.current.filter(q => q.id !== id);
    questionsRef.current = next;
    saveToStorage('questions', next);
    setQuestions(next);
    showToast('Question deleted.');
  };

  const importQuestions = (newQuestions: Question[]) => {
    setQuestions(prev => {
      const next = [...newQuestions, ...prev];
      saveToStorage('questions', next);
      return next;
    });
    showToast(`${newQuestions.length} questions imported successfully!`);
  };

  const addFolder = (fData: Omit<ExamFolder, 'id' | 'createdAt' | 'examCount'>): ExamFolder => {
    const newFolder: ExamFolder = {
      ...fData,
      id: 'folder-' + Date.now(),
      examCount: 0,
      createdAt: new Date().toISOString().split('T')[0]
    };
    setFolders(prev => {
      const next = [newFolder, ...prev];
      saveToStorage('folders', next);
      return next;
    });
    syncFolderToFirestore(newFolder).catch(() => {});
    showToast(`Exam folder "${newFolder.name}" created.`);
    return newFolder;
  };

  const updateFolder = (id: string, data: Partial<ExamFolder>) => {
    setFolders(prev => prev.map(f => {
      if (f.id === id) {
        const updated = { ...f, ...data };
        syncFolderToFirestore(updated).catch(() => {});
        return updated;
      }
      return f;
    }));
    showToast('Folder updated.');
  };

  const deleteFolder = (id: string) => {
    const next = foldersRef.current.filter(f => f.id !== id);
    foldersRef.current = next;
    saveToStorage('folders', next);
    setFolders(next);
    deleteFolderFromFirestore(id).catch(() => {});
    showToast('Folder deleted.');
  };

  const addExam = (eData: Omit<Exam, 'id' | 'createdAt'>): Exam => {
    const newExamId = 'exam-' + Date.now();
    const currentQs = questionsRef.current;
    let finalQuestions = eData.questions || [];
    if (finalQuestions.length === 0 && eData.sections && eData.sections.length > 0) {
      const qIds = eData.sections.flatMap(s => s.questionIds || []);
      finalQuestions = currentQs.filter(q => qIds.includes(q.id) || qIds.includes(q.code));
    }
    finalQuestions = finalQuestions.map(q =>
      mergeQuestionRecord(
        { ...q, examId: newExamId },
        currentQs.find(bq => bq.id === q.id || bq.code === q.code)
      )
    );

    const newExam: Exam = {
      ...eData,
      questions: finalQuestions,
      id: newExamId,
      createdAt: new Date().toISOString().split('T')[0]
    };
    const nextExams = [newExam, ...examsRef.current];
    examsRef.current = nextExams;
    saveToStorage('exams', nextExams);
    setExams(nextExams);

    if (newExam.folderId) {
      setFolders(prev => prev.map(f => f.id === newExam.folderId ? { ...f, examCount: f.examCount + 1 } : f));
    }
    try {
      fetch('/api/sync-exam', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newExam)
      }).catch(() => {});
    } catch {}
    syncExamAndQuestionsToFirestore(newExam, [...currentQs, ...finalQuestions]).catch(() => {});
    showToast(`Exam "${newExam.title}" created successfully!`);
    return newExam;
  };

  const attachQuestionsToExam = (qsToAttach: Question[], examId: string) => {
    if (!qsToAttach || qsToAttach.length === 0) return;
    let updatedTargetExam: Exam | null = null;
    const nextExams = examsRef.current.map(e => {
      if (e.id.toLowerCase() !== examId.toLowerCase() && e.code.toLowerCase() !== examId.toLowerCase()) {
        return e;
      }
      const existingQs: Question[] = Array.isArray(e.questions) ? [...e.questions] : [];
      qsToAttach.forEach(q => {
        const bankMatch = questionsRef.current.find(bq => bq.id === q.id || (q.code && bq.code === q.code));
        const enrichedQ = mergeQuestionRecord({ ...q, examId: e.id }, bankMatch);
        const existingQIdx = existingQs.findIndex(item => item.id === enrichedQ.id || (enrichedQ.code && item.code === enrichedQ.code));
        if (existingQIdx >= 0) {
          existingQs[existingQIdx] = enrichedQ;
        } else {
          existingQs.push(enrichedQ);
        }
      });

      const existingSecIds = (e.sections && e.sections.length > 0)
        ? e.sections.flatMap(s => s.questionIds || [])
        : [];
      const mergedIds = Array.from(new Set([...existingSecIds, ...existingQs.map(item => item.id)]));

      const posMarks = e.positiveMarks || 4;
      const negMarks = e.negativeMarks !== undefined ? (e.negativeMarks > 0 ? -e.negativeMarks : e.negativeMarks) : -1;

      updatedTargetExam = {
        ...e,
        questions: existingQs,
        sections: [
          {
            id: (e.sections && e.sections[0]?.id) || 'sec-1',
            name: (e.sections && e.sections[0]?.name) || `Mathematics Section (Class ${e.targetClass || '11th'})`,
            subject: 'Mathematics',
            questionIds: mergedIds,
            instructions: `+${posMarks} for correct answer, ${negMarks} for wrong response.`
          }
        ],
        totalMarks: mergedIds.length * posMarks
      };
      return updatedTargetExam;
    });

    examsRef.current = nextExams;
    saveToStorage('exams', nextExams);
    setExams(nextExams);

    if (updatedTargetExam) {
      const syncedExam: Exam = updatedTargetExam;
      try {
        fetch('/api/sync-exam', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(syncedExam)
        }).catch(() => {});
      } catch {}
      syncExamAndQuestionsToFirestore(syncedExam, [...questionsRef.current, ...(syncedExam.questions || [])]).catch(() => {});
    }
  };

  const attachQuestionToExam = (q: Question, examId: string) => {
    attachQuestionsToExam([q], examId);
  };

  const updateExam = (id: string, data: Partial<Exam>) => {
    let updatedExamObj: Exam | null = null;
    const currentQs = questionsRef.current;
    const nextExams = examsRef.current.map(e => {
      if (e.id !== id) return e;
      const updated: Exam = { ...e, ...data };
      if (data.sections && (!data.questions || data.questions.length === 0)) {
        const qIds = data.sections.flatMap(s => s.questionIds || []);
        const attached = qIds.map(qId => {
          const bankQ = currentQs.find(q => q.id === qId || q.code === qId);
          const embeddedQ = e.questions?.find(q => q.id === qId || q.code === qId);
          return bankQ || embeddedQ ? mergeQuestionRecord(embeddedQ || bankQ!, bankQ) : null;
        }).filter(Boolean) as Question[];
        if (attached.length > 0) {
          updated.questions = attached;
        } else if (qIds.length === 0) {
          updated.questions = [];
        }
      }
      updatedExamObj = updated;
      return updated;
    });

    examsRef.current = nextExams;
    saveToStorage('exams', nextExams);
    setExams(nextExams);

    if (updatedExamObj) {
      const targetExam: Exam = updatedExamObj;
      try {
        fetch('/api/sync-exam', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(targetExam)
        }).catch(() => {});
      } catch {}
      syncExamAndQuestionsToFirestore(targetExam, currentQs).catch(() => {});
    }
    showToast('Exam updated.');
  };

  const deleteExam = (id: string) => {
    const next = examsRef.current.filter(e => e.id !== id);
    examsRef.current = next;
    saveToStorage('exams', next);
    setExams(next);
    deleteExamFromFirestore(id).catch(() => {});
    showToast('Exam deleted.');
  };

  const recordAttempt = (attData: Omit<ExamAttempt, 'id'>): ExamAttempt => {
    const newAtt: ExamAttempt = {
      ...attData,
      id: 'att-' + Date.now()
    };
    setAttempts(prev => [newAtt, ...prev]);
    submitAttemptToFirestore(newAtt).catch(() => {});
    showToast(`Exam submitted! Score: ${newAtt.totalScore}/${newAtt.maxScore}`);
    return newAtt;
  };

  const updateAttempt = (id: string, data: Partial<ExamAttempt>) => {
    setAttempts(prev => prev.map(a => a.id === id ? { ...a, ...data } : a));
    showToast('Submission updated.');
  };

  const deleteAttempt = (id: string) => {
    setAttempts(prev => prev.filter(a => a.id !== id));
    showToast('Attempt record removed.');
  };

  const saveAttendance = (batchId: string, date: string, records: AttendanceRecord['records']) => {
    const newRec: AttendanceRecord = {
      id: 'att-rec-' + Date.now(),
      batchId,
      date,
      records
    };
    setAttendance(prev => {
      const filtered = prev.filter(r => !(r.batchId === batchId && r.date === date));
      return [newRec, ...filtered];
    });
    showToast(`Attendance marked for ${records.length} students on ${date}.`);
  };

  const addStudyMaterial = (matData: Omit<StudyMaterial, 'id' | 'uploadedAt' | 'downloadCount'>) => {
    const newMat: StudyMaterial = {
      ...matData,
      id: 'mat-' + Date.now(),
      uploadedAt: new Date().toISOString().split('T')[0],
      downloadCount: 0
    };
    setStudyMaterials(prev => [newMat, ...prev]);
    showToast(`Study material "${newMat.title}" uploaded.`);
  };

  const deleteStudyMaterial = (id: string) => {
    setStudyMaterials(prev => prev.filter(m => m.id !== id));
    showToast('Study material deleted.');
  };

  const addNotification = (notifData: Omit<NotificationItem, 'id' | 'createdAt'>) => {
    const newNotif: NotificationItem = {
      ...notifData,
      id: 'notif-' + Date.now(),
      createdAt: new Date().toLocaleString()
    };
    setNotifications(prev => [newNotif, ...prev]);
    showToast('Notification published to students.');
  };

  const deleteNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    showToast('Notification removed.');
  };

  const addCourse = (courseData: Omit<Course, 'id' | 'enrolledCount'>) => {
    const newCourse: Course = {
      ...courseData,
      id: 'crs-' + Date.now(),
      enrolledCount: 0
    };
    setCourses(prev => [newCourse, ...prev]);
    showToast(`Course "${newCourse.title}" created.`);
  };

  const updateCourse = (id: string, data: Partial<Course>) => {
    setCourses(prev => prev.map(c => c.id === id ? { ...c, ...data } : c));
    showToast('Course updated.');
  };

  const deleteCourse = (id: string) => {
    setCourses(prev => prev.filter(c => c.id !== id));
    showToast('Course deleted.');
  };

  const addTestSeries = (tsData: Omit<TestSeries, 'id' | 'enrolledCount'>) => {
    const newTS: TestSeries = {
      ...tsData,
      id: 'ts-' + Date.now(),
      enrolledCount: 0
    };
    setTestSeries(prev => [newTS, ...prev]);
    showToast(`Test Series "${newTS.title}" created.`);
  };

  const updateTestSeries = (id: string, data: Partial<TestSeries>) => {
    setTestSeries(prev => prev.map(t => t.id === id ? { ...t, ...data } : t));
    showToast('Test Series updated.');
  };

  const deleteTestSeries = (id: string) => {
    setTestSeries(prev => prev.filter(t => t.id !== id));
    showToast('Test series deleted.');
  };

  const addPayment = (pData: Omit<PaymentTransaction, 'id' | 'receiptNo' | 'date'>): PaymentTransaction => {
    const receiptNo = `REC-GMI-2025-${(payments.length + 1).toString().padStart(3, '0')}`;
    const newPay: PaymentTransaction = {
      ...pData,
      id: 'pay-' + Date.now(),
      receiptNo,
      date: new Date().toLocaleString()
    };
    setPayments(prev => [newPay, ...prev]);
    showToast(`Payment of ₹${newPay.amount.toLocaleString()} recorded successfully!`);
    return newPay;
  };

  const verifyPayment = (id: string) => {
    setPayments(prev => prev.map(p => p.id === id ? { ...p, status: 'Verified' } : p));
    showToast('Payment verified successfully.');
  };

  const deletePayment = (id: string) => {
    setPayments(prev => prev.filter(p => p.id !== id));
    showToast('Payment approval record deleted.');
  };

  const togglePaymentStatus = (id: string, reason?: string) => {
    setPayments(prev => prev.map(p => {
      if (p.id === id) {
        const isVerified = p.status === 'SUCCESS' || p.status === 'Verified' || p.status === 'Success';
        const nextStatus = isVerified ? 'REJECTED' : 'SUCCESS';
        return {
          ...p,
          status: nextStatus,
          actionTimestamp: nextStatus === 'SUCCESS' ? '✓ Verified' : '✕ Rejected',
          actionReason: nextStatus === 'SUCCESS' ? '' : (reason || 'Payment rejected by admin')
        };
      }
      return p;
    }));
    showToast('Payment status updated.');
  };

  const clearRejectedPayments = () => {
    const rejectedCount = payments.filter(p => p.status === 'REJECTED' || p.status === 'Failed').length;
    if (rejectedCount === 0) {
      showToast('No rejected payments to clear.');
      return;
    }
    setPayments(prev => prev.filter(p => p.status !== 'REJECTED' && p.status !== 'Failed'));
    showToast(`Removed ${rejectedCount} rejected payment record(s).`);
  };

  const resetPaymentsToDefault = () => {
    setPayments(INITIAL_PAYMENTS);
    showToast('Reset payments ledger to default records.');
  };

  const startExamForStudent = (examId: string, studentOverride?: User) => {
    if (studentOverride) {
      setCurrentUser(studentOverride);
      try {
        sessionStorage.setItem('cbt_active_student', JSON.stringify(studentOverride));
      } catch {}
    }
    try {
      sessionStorage.setItem('cbt_active_taking_exam', examId);
    } catch {}
    setActiveExamIdForShare(null);
    setQuickJoinModalOpen(false);
    setActiveExamIdForCBT(examId);
    portalModeRef.current = 'taking_exam';
    setPortalModeState('taking_exam');
    try {
      window.scrollTo({ top: 0, behavior: 'instant' });
    } catch {}
  };

  const registerQuickJoinStudent = (data: {
    name: string;
    phone: string;
    targetClass: string;
    collegeName: string;
    rollNo?: string;
    username?: string;
    password?: string;
    examId?: string;
    examTitle?: string;
    email?: string;
  }): User => {
    setActiveExamIdForShare(null);
    const cleanPhone = (data.phone || '').trim().replace(/\D/g, '');
    const cleanName = (data.name || '').trim();
    const assignedRollNo = data.rollNo?.trim() || `GMI-QJ-${Math.floor(1000 + Math.random() * 9000)}`;
    const genUsername = data.username?.trim() || `g_${cleanPhone || Date.now().toString().slice(-6)}`;
    const genEmail = data.email?.trim() || `${cleanPhone || Date.now()}@quickjoin.gyansai.in`;
    const finalClass = data.targetClass.startsWith('Class') ? data.targetClass : `Class ${data.targetClass}`;

    let student = users.find(u =>
      (cleanPhone && u.phone && u.phone.replace(/\D/g, '') === cleanPhone) ||
      (u.username && u.username.toLowerCase() === genUsername.toLowerCase()) ||
      (genEmail && u.email && u.email.toLowerCase() === genEmail.toLowerCase())
    );

    let savedUser: User;
    if (student) {
      const updatedData: Partial<User> = {
        name: cleanName || student.name,
        phone: cleanPhone || student.phone,
        collegeName: (data.collegeName || '').trim() || student.collegeName,
        targetExam: `${finalClass} IIT-JEE / CET`,
        assignedExamId: data.examId || student.assignedExamId,
        assignedExamTitle: data.examTitle || student.assignedExamTitle,
        rollNo: data.rollNo?.trim() || student.rollNo || assignedRollNo,
        batchName: student.batchName || 'Quick Join Candidate'
      };
      savedUser = { ...student, ...updatedData };
      setUsers(prev => {
        const next = prev.map(u => u.id === student!.id ? savedUser : u);
        saveToStorage('users', next);
        return next;
      });
    } else {
      savedUser = {
        id: 'usr-' + Date.now(),
        name: cleanName,
        username: genUsername,
        password: data.password || 'gyansai123',
        email: genEmail,
        phone: cleanPhone,
        role: 'student',
        rollNo: assignedRollNo,
        targetExam: `${finalClass} IIT-JEE / CET`,
        collegeName: (data.collegeName || '').trim(),
        batchName: 'Quick Join Candidate',
        assignedExamId: data.examId,
        assignedExamTitle: data.examTitle,
        joinedDate: new Date().toISOString().split('T')[0]
      };
      setUsers(prev => {
        const next = [savedUser, ...prev];
        saveToStorage('users', next);
        return next;
      });
    }

    // Auto-sync student to server, disk storage, and Firestore for Admin Dashboard
    try {
      fetch('/api/sync-student', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(savedUser)
      }).catch(() => {});
    } catch {}
    submitPublicRegistrationToFirestore({
      id: savedUser.id,
      name: savedUser.name,
      phone: savedUser.phone || cleanPhone,
      targetClass: finalClass,
      collegeName: savedUser.collegeName || 'Open Candidate',
      rollNo: savedUser.rollNo,
      examId: data.examId,
      examTitle: data.examTitle
    }).catch(() => {});

    return savedUser;
  };

  const quickJoinAndStartExam = (
    name: string,
    phone: string,
    targetClassOrEmail: string,
    collegeNameOrTargetExam?: string,
    customRollNoOrExamCode?: string,
    examCodeOrIdParam?: string,
    optionalEmailParam?: string
  ) => {
    let targetClass = '11th';
    let collegeName = '';
    let customRollNo = '';
    let examCodeOrId = '';
    let email = '';

    if (examCodeOrIdParam !== undefined) {
      // Direct call: (name, phone, targetClass, collegeName, customRollNo, examCodeOrId, optionalEmail)
      targetClass = targetClassOrEmail || '11th';
      collegeName = collegeNameOrTargetExam || '';
      customRollNo = customRollNoOrExamCode || '';
      examCodeOrId = examCodeOrIdParam;
      email = optionalEmailParam || `${phone.replace(/\D/g, '') || Date.now()}@quickjoin.gyansai.in`;
    } else {
      // Legacy call: (name, phone, email, targetExam, examCodeOrId)
      email = targetClassOrEmail;
      targetClass = collegeNameOrTargetExam || '11th';
      examCodeOrId = customRollNoOrExamCode || '';
      collegeName = '';
    }

    const cleanPhone = phone.trim().replace(/\D/g, '');

    // Locate the exact target exam from code or ID first
    const allExams = examsRef.current.length > 0 ? examsRef.current : exams;
    const lookupShareId = examCodeOrId || activePublicExamId || activeExamIdForShare;
    const targetExamObj = lookupShareId
      ? allExams.find(
          e => e.id.toLowerCase() === lookupShareId.toLowerCase() ||
               e.code.toLowerCase() === lookupShareId.toLowerCase()
        )
      : allExams[0];

    if (!targetExamObj) {
      showToast('Assigned examination paper could not be loaded yet. Please retry.', 'error');
      return;
    }

    const student = registerQuickJoinStudent({
      name,
      phone: cleanPhone,
      targetClass,
      collegeName,
      rollNo: customRollNo,
      examId: targetExamObj.id,
      examTitle: targetExamObj.title,
      email
    });

    setActiveExamIdForShare(null);
    setCurrentUser(student);
    setQuickJoinModalOpen(false);
    startExamForStudent(targetExamObj.id, student);
  };

  const loginAdmin = (password: string, emailOrUsername?: string): { success: boolean; error?: string } => {
    const expectedPassword = (settings.adminPassword || 'admin123').trim();
    if (password.trim() === expectedPassword) {
      setIsAdminAuthenticated(true);
      saveToStorage('admin_auth', true);
      const adminUser = users.find(u => u.role === 'admin') || INITIAL_USERS[0];
      setCurrentUser(adminUser);
      setAdminLoginModalOpen(false);
      setPortalModeState('admin');
      setActiveAdminTab('Dashboard');
      showToast(`Admin access granted. Welcome, ${adminUser.name}!`);
      return { success: true };
    }
    return {
      success: false,
      error: 'Invalid administrator password. Please check your credentials.'
    };
  };

  const signInAdminWithGoogle = async (): Promise<{ success: boolean; error?: string }> => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const email = (result.user.email || '').toLowerCase();
      if (email !== ADMIN_EMAIL.toLowerCase()) {
        await signOut(auth);
        return {
          success: false,
          error: `Please sign in with the authorized faculty account (${ADMIN_EMAIL}).`
        };
      }
      setFirebaseAdminEmail(result.user.email);
      setIsAdminAuthenticated(true);
      saveToStorage('admin_auth', true);
      const adminUser = users.find(u => u.role === 'admin') || INITIAL_USERS[0];
      setCurrentUser(adminUser);
      setAdminLoginModalOpen(false);
      setPortalModeState('admin');
      setActiveAdminTab('Dashboard');
      showToast('Google Cloud Sync connected! Exams & image questions now sync across all mobile links.');
      return { success: true };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Google Sign-In was cancelled or failed.'
      };
    }
  };

  const logoutAdmin = () => {
    setIsAdminAuthenticated(false);
    saveToStorage('admin_auth', false);
    signOut(auth).catch(() => {});
    const studentUser = users.find(u => u.role === 'student') || INITIAL_USERS[1];
    setCurrentUser(studentUser);
    setPortalModeState('landing');
    showToast('Signed out of Administrator Console.');
  };

  const requestAdminAccess = () => {
    if (isAdminAuthenticated) {
      const adminUser = users.find(u => u.role === 'admin') || INITIAL_USERS[0];
      setCurrentUser(adminUser);
      setPortalModeState('admin');
    } else {
      setAdminLoginModalOpen(true);
    }
  };

  const resetAllToDefault = () => {
    localStorage.clear();
    clearIndexedDb().catch(() => {});
    setSettings(INITIAL_INSTITUTE_SETTINGS);
    setUsers(INITIAL_USERS);
    setCurrentUser(INITIAL_USERS[1] || INITIAL_USERS[0]);
    setBatches(INITIAL_BATCHES);
    setTeachers(INITIAL_TEACHERS);
    setQuestions(INITIAL_QUESTIONS);
    setFolders(INITIAL_EXAM_FOLDERS);
    setExams(INITIAL_EXAMS);
    setAttempts(INITIAL_ATTEMPTS);
    setAttendance(INITIAL_ATTENDANCE);
    setStudyMaterials(INITIAL_STUDY_MATERIAL);
    setNotifications(INITIAL_NOTIFICATIONS);
    setCourses(INITIAL_COURSES);
    setTestSeries(INITIAL_TEST_SERIES);
    setPayments(INITIAL_PAYMENTS);
    setIsAdminAuthenticated(false);
    setAdminLoginModalOpen(false);
    setPortalModeState('landing');
    setActiveAdminTab('Dashboard');
    showToast('All data reset to initial Gyansai Maths IIT Center state.');
  };

  return (
    <PortalContext.Provider
      value={{
        currentUser,
        setCurrentUser,
        portalMode,
        setPortalMode,
        isAdminAuthenticated,
        firebaseAdminEmail,
        isCloudSyncing,
        adminLoginModalOpen,
        setAdminLoginModalOpen,
        loginAdmin,
        signInAdminWithGoogle,
        syncAllExamsToCloud,
        syncSingleExamToCloud,
        logoutAdmin,
        requestAdminAccess,
        activeAdminTab,
        setActiveAdminTab,
        activeStudentTab,
        setActiveStudentTab,
        activeExamIdForCBT,
        setActiveExamIdForCBT,
        activeExamIdForShare,
        setActiveExamIdForShare,
        activePublicExamId,
        setActivePublicExamId,
        isResolvingExamRoute,
        examRouteError,
        retryResolveExamRoute,
        activeExamForQuestionsModal,
        setActiveExamForQuestionsModal,
        selectedAttemptForResult,
        setSelectedAttemptForResult,
        createFolderModalOpen,
        setCreateFolderModalOpen,
        createQuestionModalOpen,
        setCreateQuestionModalOpen,
        activeTargetExamIdForQuestion,
        setActiveTargetExamIdForQuestion,
        activeTargetFolderIdForQuestion,
        setActiveTargetFolderIdForQuestion,
        authModalOpen,
        setAuthModalOpen,
        authModalTab,
        setAuthModalTab,
        quickJoinModalOpen,
        setQuickJoinModalOpen,
        settings,
        updateSettings,
        users,
        addUser,
        updateUser,
        deleteUser,
        batches,
        addBatch,
        updateBatch,
        deleteBatch,
        teachers,
        addTeacher,
        updateTeacher,
        deleteTeacher,
        questions,
        addQuestion,
        updateQuestion,
        deleteQuestion,
        importQuestions,
        folders,
        addFolder,
        updateFolder,
        deleteFolder,
        exams,
        addExam,
        updateExam,
        attachQuestionToExam,
        attachQuestionsToExam,
        deleteExam,
        attempts,
        recordAttempt,
        updateAttempt,
        deleteAttempt,
        attendance,
        saveAttendance,
        studyMaterials,
        addStudyMaterial,
        deleteStudyMaterial,
        notifications,
        addNotification,
        deleteNotification,
        courses,
        addCourse,
        updateCourse,
        deleteCourse,
        testSeries,
        addTestSeries,
        updateTestSeries,
        deleteTestSeries,
        payments,
        setPayments,
        addPayment,
        verifyPayment,
        deletePayment,
        togglePaymentStatus,
        clearRejectedPayments,
        resetPaymentsToDefault,
        toasts,
        showToast,
        removeToast,
        startExamForStudent,
        registerQuickJoinStudent,
        quickJoinAndStartExam,
        resetAllToDefault
      }}
    >
      {children}
    </PortalContext.Provider>
  );
};

export const usePortal = (): PortalContextType => {
  const context = useContext(PortalContext);
  if (!context) {
    throw new Error('usePortal must be used within a PortalProvider');
  }
  return context;
};
