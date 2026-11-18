import { Exam, ExamSection, Question } from '../types';
import { getQuestionImageSrc, normalizeQuestionImageUrl, resolveQuestionType } from './imageCompress';

export interface CompactExamPayload {
  id: string;
  title: string;
  code: string;
  folderId?: string;
  folderName?: string;
  durationMinutes: number;
  totalMarks: number;
  positiveMarks: number;
  negativeMarks: number;
  passPercentage?: number;
  targetClass?: string;
  examCategory?: string;
  instructions?: string[];
  qIds?: string[];
  questions?: Partial<Question>[];
  startTime?: string;
  endTime?: string;
}

/**
 * Encodes a string to URL-safe base64
 */
export function toBase64Url(str: string): string {
  try {
    const utf8Bytes = new TextEncoder().encode(str);
    let binary = '';
    for (let i = 0; i < utf8Bytes.length; i++) {
      binary += String.fromCharCode(utf8Bytes[i]);
    }
    return btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  } catch {
    return encodeURIComponent(str);
  }
}

/**
 * Decodes a URL-safe base64 string
 */
export function fromBase64Url(base64Url: string): string {
  try {
    let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  } catch {
    try {
      return decodeURIComponent(base64Url);
    } catch {
      return '';
    }
  }
}

/**
 * Resolves exact ordered questions belonging to an exam from exam.questions,
 * exam.sections[].questionIds, q.examId links, and exam folder fallback (only when explicit list is empty).
 */
export function resolveExamQuestions(exam: Exam, allQuestions: Question[]): Question[] {
  const byId = new Map<string, Question>();

  const attachNormalized = (raw: Question) => {
    const bankMatch = allQuestions.find(bq => bq.id === raw.id || (raw.code && bq.code === raw.code));
    const mergedImg = getQuestionImageSrc(raw) || getQuestionImageSrc(bankMatch) || undefined;
    const rawPath = raw.questionImagePath || bankMatch?.questionImagePath;
    const mergedPath = normalizeQuestionImageUrl(rawPath) || undefined;
    const merged: Question = {
      ...(bankMatch || {}),
      ...raw,
      examId: raw.examId || exam.id,
      questionType: resolveQuestionType({
        ...(bankMatch || {}),
        ...raw,
        ...(mergedImg ? { questionImageUrl: mergedImg, imageUrl: mergedImg } : {}),
        ...(mergedPath ? { questionImagePath: mergedPath } : {})
      }),
      ...(mergedImg ? { questionImageUrl: mergedImg, imageUrl: mergedImg } : {}),
      ...(mergedPath ? { questionImagePath: mergedPath } : {})
    };
    byId.set(merged.id, merged);
  };

  if (Array.isArray(exam.questions) && exam.questions.length > 0) {
    exam.questions.forEach(attachNormalized);
  }

  const sectionIds = (exam.sections && exam.sections.length > 0)
    ? exam.sections.flatMap(s => s.questionIds || [])
    : [];
  sectionIds.forEach(id => {
    if (!byId.has(id)) {
      const bankMatch = allQuestions.find(q => q.id === id || q.code === id);
      if (bankMatch) attachNormalized(bankMatch);
    }
  });

  // Also include any questions explicitly created with q.examId === exam.id
  allQuestions.forEach(q => {
    if (q.examId && q.examId.toLowerCase() === exam.id.toLowerCase() && !byId.has(q.id)) {
      attachNormalized(q);
    }
  });

  if (byId.size > 0) {
    return Array.from(byId.values());
  }

  // Only if no explicit questions/section IDs exist yet, include questions uploaded directly to this exam's folder
  if (exam.folderId || exam.folderName) {
    const folderMatches = allQuestions.filter(q =>
      (exam.folderId && q.folderId === exam.folderId) ||
      (exam.folderName && q.folderName === exam.folderName)
    );
    folderMatches.forEach(attachNormalized);
  }

  return Array.from(byId.values());
}

/**
 * Copies text to clipboard reliably with textarea fallback for iframe / HTTP contexts.
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (!text) return false;
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to execCommand fallback
  }
  try {
    if (typeof document !== 'undefined') {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.top = '-9999px';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    }
  } catch {
    // Ignore clipboard fallback errors
  }
  return false;
}

/**
 * Generates a clean, short shareable URL for an Exam (/?cbt=CODE or /?exam=CODE).
 * Full question payloads and original images are hydrated remotely via Firestore
 * and /api/sync-exam so student WhatsApp/SMS links remain short and clean.
 */
export function generateExamShareUrl(
  exam: Exam,
  _customQuestions?: Question[],
  preferredBaseUrl?: string,
  mode: 'cbt' | 'overview' = 'overview'
): string {
  const origin = (
    preferredBaseUrl ||
    (typeof window !== 'undefined' ? window.location.origin : 'https://gyansai-exam-portal.vercel.app')
  ).replace(/\/+$/, '');
  const examSlug = encodeURIComponent((exam.code || exam.id || '').trim());
  const rootParamKey = mode === 'cbt' ? 'cbt' : 'exam';
  return `${origin}/?${rootParamKey}=${examSlug}`;
}

export function getShareUrlImageStatus(
  shareUrl: string,
  questionsList: Question[]
): { totalImageQuestions: number; inlinedImages: number; strippedImages: number; oversizedImages: number } {
  const imageQs = questionsList.filter(q => resolveQuestionType(q) === 'image' || Boolean(getQuestionImageSrc(q)));
  if (imageQs.length === 0) {
    return { totalImageQuestions: 0, inlinedImages: 0, strippedImages: 0, oversizedImages: 0 };
  }

  const MAX_CLOUD_IMAGE_CHARS = 890000;
  const oversizedImages = imageQs.filter(q => {
    const src = getQuestionImageSrc(q);
    const hasPath = Boolean(normalizeQuestionImageUrl(q.questionImagePath));
    return src.startsWith('data:') && src.length > MAX_CLOUD_IMAGE_CHARS && !hasPath;
  }).length;

  try {
    const urlObj = new URL(shareUrl);
    let dataParam = urlObj.searchParams.get('d') || urlObj.searchParams.get('examData');
    if (!dataParam && urlObj.hash) {
      const hashQuery = urlObj.hash.includes('?') ? urlObj.hash.split('?')[1] : urlObj.hash.replace(/^#/, '');
      const hashParams = new URLSearchParams(hashQuery);
      dataParam = hashParams.get('d') || hashParams.get('examData');
    }
    if (!dataParam) {
      // Short links resolve images from Cloud/Server sync rather than inline URL tokens
      return {
        totalImageQuestions: imageQs.length,
        inlinedImages: imageQs.length - oversizedImages,
        strippedImages: 0,
        oversizedImages
      };
    }
    const payload: CompactExamPayload = JSON.parse(fromBase64Url(dataParam) || '{}');
    const urlQs = Array.isArray(payload.questions) ? payload.questions : [];
    const inlinedIds = new Set(
      urlQs
        .filter(q => {
          const src = normalizeQuestionImageUrl(q.questionImageUrl) || normalizeQuestionImageUrl(q.imageUrl);
          return src.startsWith('data:') || src.startsWith('https://') || src.startsWith('http://');
        })
        .map(q => q.id)
        .filter(Boolean)
    );
    const inlinedImages = imageQs.filter(q => inlinedIds.has(q.id)).length;
    return {
      totalImageQuestions: imageQs.length,
      inlinedImages,
      strippedImages: Math.max(0, imageQs.length - inlinedImages),
      oversizedImages
    };
  } catch {
    return {
      totalImageQuestions: imageQs.length,
      inlinedImages: imageQs.length - oversizedImages,
      strippedImages: 0,
      oversizedImages
    };
  }
}

/**
 * Decodes an exam and any bundled questions from the current URL
 */
export function decodeExamFromUrl(): { exam: Exam; customQuestions: Question[] } | null {
  if (typeof window === 'undefined') return null;

  try {
    const searchParams = new URLSearchParams(window.location.search);
    let dataParam = searchParams.get('d') || searchParams.get('examData');

    // Also support hash parameters (e.g. /#?d=... or /#/?d=... or /#d=...)
    if (!dataParam && window.location.hash) {
      try {
        const hashQuery = window.location.hash.includes('?')
          ? window.location.hash.split('?')[1]
          : window.location.hash.replace(/^#/, '');
        if (hashQuery) {
          const hashParams = new URLSearchParams(hashQuery);
          dataParam = hashParams.get('d') || hashParams.get('examData');
        }
      } catch {}
    }

    if (!dataParam) {
      return null;
    }

    const jsonStr = fromBase64Url(dataParam);
    if (!jsonStr) {
      console.warn('[EXAM TOKEN PARSER] Failed to decode base64 string from token.');
      return null;
    }

    const payload: CompactExamPayload = JSON.parse(jsonStr);
    if (!payload || !payload.title) {
      console.warn('[EXAM TOKEN PARSER] Decoded payload is missing title or exam data:', payload);
      return null;
    }

    const qIds = payload.qIds || [];
    const sections: ExamSection[] = [
      {
        id: 'sec-1',
        name: 'General Assessment Section',
        subject: 'Mathematics & Science',
        questionIds: qIds,
        instructions: `+${payload.positiveMarks || 4} for correct answer, ${payload.negativeMarks || -1} for wrong response.`
      }
    ];

    const customQuestions: Question[] = (payload.questions || []).map(q => {
      const normPath = normalizeQuestionImageUrl(q.questionImagePath) || undefined;
      const resolvedImg = normalizeQuestionImageUrl(q.questionImageUrl) || normalizeQuestionImageUrl(q.imageUrl) || normPath || undefined;
      const qType = resolveQuestionType({
        questionType: q.questionType,
        questionText: q.questionText,
        questionImageUrl: resolvedImg,
        questionImagePath: normPath
      });
      const posMarks = q.marksPositive ?? q.marks ?? payload.positiveMarks ?? 4;
      const negMarks = q.marksNegative !== undefined ? q.marksNegative : (q.negativeMarks !== undefined ? q.negativeMarks : (payload.negativeMarks ?? -1));

      return {
        id: q.id || `q-shared-${Date.now()}-${Math.random()}`,
        examId: q.examId || payload.id,
        code: q.code || 'Q-SH',
        subject: q.subject || 'Mathematics',
        chapter: q.chapter || q.topic || 'General Practice',
        topic: q.topic || q.chapter || 'General Practice',
        type: q.type || 'single_choice',
        questionType: qType,
        difficulty: 'Moderate',
        questionText: qType === 'image' ? (q.questionText || '').trim() : (q.questionText || ''),
        questionImageUrl: resolvedImg,
        imageUrl: resolvedImg,
        questionImagePath: normPath,
        formulaNote: q.formulaNote,
        options: q.options || [],
        correctAnswer: q.correctAnswer || 'A',
        marks: posMarks,
        negativeMarks: negMarks,
        marksPositive: posMarks,
        marksNegative: negMarks,
        explanation: q.explanation || '',
        createdAt: new Date().toISOString()
      };
    });

    const fullExam: Exam = {
      id: payload.id || `exam-${Date.now()}`,
      title: payload.title,
      code: payload.code || `GYAN-EXAM-${Math.floor(1000 + Math.random() * 9000)}`,
      folderId: payload.folderId || 'folder-1',
      folderName: payload.folderName || 'Online Tests',
      batchIds: [],
      durationMinutes: Number(payload.durationMinutes) || 60,
      totalMarks: Number(payload.totalMarks) || (qIds.length * (payload.positiveMarks || 4)) || 100,
      positiveMarks: Number(payload.positiveMarks) || 4,
      negativeMarks: Number(payload.negativeMarks) !== undefined ? Number(payload.negativeMarks) : -1,
      passPercentage: Number(payload.passPercentage) || 40,
      targetClass: payload.targetClass || '11th',
      examCategory: payload.examCategory || 'JEE Mains',
      sections,
      questions: customQuestions.length > 0 ? customQuestions : undefined,
      startTime: payload.startTime || new Date().toISOString().slice(0, 16),
      endTime: payload.endTime || new Date(Date.now() + 90 * 24 * 3600 * 1000).toISOString().slice(0, 16),
      status: 'Live',
      isPublic: true,
      publicAccessUrl: window.location.href,
      instructions: payload.instructions && payload.instructions.length > 0 ? payload.instructions : [
        'Read each question carefully before submitting your answer.',
        `Marking Scheme: +${payload.positiveMarks || 4} for correct response, ${payload.negativeMarks || -1} for wrong response.`,
        'Use question palette to navigate between questions.',
        'Do not refresh or switch tabs during the examination.'
      ],
      createdAt: new Date().toISOString()
    };

    console.log('[EXAM TOKEN PARSER] Successfully decoded exam token:', {
      examId: fullExam.id,
      examCode: fullExam.code,
      title: fullExam.title,
      durationMinutes: fullExam.durationMinutes,
      questionsCount: customQuestions.length,
      questionIdsCount: qIds.length
    });

    return { exam: fullExam, customQuestions };
  } catch (err) {
    console.error('[EXAM TOKEN PARSER] Failed to decode shared exam from URL:', err);
    return null;
  }
}
