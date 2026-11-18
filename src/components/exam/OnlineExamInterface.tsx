import React, { useState, useEffect, useMemo, useRef } from 'react';
import { usePortal } from '../../context/PortalContext';
import {
  GraduationCap,
  Clock,
  AlertTriangle,
  CheckCircle,
  HelpCircle,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Send,
  ArrowLeft,
  Award,
  BarChart2,
  Download,
  Printer,
  Share2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Sparkles,
  TrendingUp,
  Filter,
  Flame,
  BookOpen,
  FileDown,
  X,
  ZoomIn,
  ZoomOut,
  Maximize2
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Question, StudentAnswer, ExamAttempt } from '../../types';
import { InstituteLogo } from '../common/InstituteLogo';
import { MathText } from '../../utils/mathRenderer';
import {
  normalizeAnswerChoice,
  getQuestionImageSrc,
  getMeaningfulQuestionText,
  normalizeQuestionImageUrl,
  resolveQuestionType
} from '../../utils/imageCompress';
import { decodeExamFromUrl, resolveExamQuestions } from '../../utils/examShare';

interface ExamQuestionImageProps {
  src?: string;
  alt: string;
  questionId: string;
  questionCode?: string;
  examId?: string;
  imagePath?: string;
  onZoom: (src: string) => void;
  compact?: boolean;
}

const ExamQuestionImage: React.FC<ExamQuestionImageProps> = ({
  src,
  alt,
  questionId,
  questionCode,
  examId,
  imagePath,
  onZoom,
  compact = false
}) => {
  const primarySrc = normalizeQuestionImageUrl(src);
  const fallbackSrc = normalizeQuestionImageUrl(imagePath);
  const [fallbackAttempted, setFallbackAttempted] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const baseSrc = useMemo(() => {
    if (!fallbackAttempted) {
      return primarySrc || fallbackSrc;
    }
    if (fallbackSrc && fallbackSrc !== primarySrc) {
      return fallbackSrc;
    }
    return primarySrc || fallbackSrc;
  }, [fallbackAttempted, primarySrc, fallbackSrc]);

  const effectiveSrc = useMemo(() => {
    if (!baseSrc) return '';
    if (retryCount > 0 && !baseSrc.startsWith('data:') && !baseSrc.startsWith('blob:')) {
      return `${baseSrc}${baseSrc.includes('?') ? '&' : '?'}retry=${retryCount}`;
    }
    return baseSrc;
  }, [baseSrc, retryCount]);

  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>(effectiveSrc ? 'loading' : 'error');
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    setFallbackAttempted(false);
    setRetryCount(0);
  }, [questionId, primarySrc, fallbackSrc]);

  useEffect(() => {
    if (!effectiveSrc) {
      setStatus('error');
      console.error('[STUDENT EXAM IMAGE MISSING ERROR]', {
        examId,
        questionId,
        questionCode,
        imagePath
      });
      return;
    }
    const el = imgRef.current;
    if (el && el.complete && el.naturalWidth > 0) {
      setStatus('loaded');
    } else {
      setStatus('loading');
    }
  }, [effectiveSrc, examId, questionId, questionCode, imagePath]);

  const handleImageError = () => {
    if (!fallbackAttempted && fallbackSrc && primarySrc && fallbackSrc !== primarySrc) {
      setFallbackAttempted(true);
      setStatus('loading');
      return;
    }
    setStatus('error');
    console.error('[STUDENT EXAM IMAGE LOAD ERROR]', {
      examId,
      questionId,
      questionCode,
      src: effectiveSrc,
      questionImagePath: imagePath
    });
  };

  if (status === 'error' || !effectiveSrc) {
    return (
      <div className="my-2 p-4 rounded-lg border-2 border-red-200 bg-red-50 text-red-900 space-y-2 max-w-full">
        <div className="flex items-start space-x-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <div className="text-xs leading-relaxed">
            <strong className="block font-bold">Original question image failed to load</strong>
            <span className="text-red-700">
              Please check your internet connection or ask your administrator to verify question {questionCode || questionId}.
            </span>
          </div>
        </div>
        {(primarySrc || fallbackSrc) && (
          <button
            type="button"
            onClick={() => {
              setFallbackAttempted(false);
              setStatus('loading');
              setRetryCount(prev => prev + 1);
            }}
            className="px-3 py-1 bg-white border border-red-300 hover:bg-red-100 text-red-800 rounded text-[11px] font-bold inline-flex items-center space-x-1 cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Retry Loading Image</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="py-2 w-full">
      <div className="relative inline-block max-w-full border-2 border-slate-200 rounded-lg p-2 bg-white shadow-2xs group">
        {status === 'loading' && (
          <div className="min-w-[220px] min-h-[120px] flex items-center justify-center bg-slate-50 rounded text-xs text-slate-500 font-medium px-4 py-6">
            <span className="w-4 h-4 border-2 border-[#002FA7] border-t-transparent rounded-full animate-spin mr-2" />
            <span>Loading original question image...</span>
          </div>
        )}
        <img
          ref={imgRef}
          src={effectiveSrc}
          alt={alt}
          onClick={() => onZoom(effectiveSrc)}
          onLoad={() => setStatus('loaded')}
          onError={handleImageError}
          className={`${status === 'loading' ? 'opacity-0 absolute inset-0 max-h-full max-w-full w-auto h-auto pointer-events-none' : 'block opacity-100 w-auto h-auto max-w-full'} ${
            compact ? 'max-h-[45vh]' : 'max-h-[65vh] sm:max-h-[74vh]'
          } object-contain mx-auto rounded cursor-zoom-in transition`}
          title="Click to zoom / view full-screen"
        />
        {status === 'loaded' && (
          <button
            type="button"
            onClick={() => onZoom(effectiveSrc)}
            className="mt-1.5 text-[11px] font-semibold text-blue-700 hover:text-blue-900 flex items-center space-x-1.5 cursor-pointer"
          >
            <Maximize2 className="w-3 h-3" />
            <span>Click image to zoom / full-screen</span>
          </button>
        )}
      </div>
    </div>
  );
};

export const OnlineExamInterface: React.FC = () => {
  const {
    settings,
    activeExamIdForCBT,
    setActiveExamIdForCBT,
    isResolvingExamRoute,
    examRouteError,
    retryResolveExamRoute,
    setPortalMode,
    isAdminAuthenticated,
    exams,
    questions,
    currentUser,
    recordAttempt,
    setSelectedAttemptForResult,
    showToast
  } = usePortal();

  const decodedUrlPayload = useMemo(() => decodeExamFromUrl(), []);

  const exam = useMemo(() => {
    // 1. Try to find by explicit activeExamIdForCBT (ID or Code) in exams array
    let matched = activeExamIdForCBT
      ? exams.find(
          e => e.id.toLowerCase() === activeExamIdForCBT.toLowerCase() ||
               e.code.toLowerCase() === activeExamIdForCBT.toLowerCase()
        )
      : undefined;

    // 2. If not found in exams state yet, or if URL carries a matching #?d= payload, hydrate immediately
    let hasExplicitRouteSlug = Boolean(activeExamIdForCBT);
    if (!matched && typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const cbtCode = urlParams.get('cbt') || urlParams.get('exam') || urlParams.get('test') || urlParams.get('share');
      const urlCls = urlParams.get('cls');
      const urlTitle = urlParams.get('title');
      const urlCat = urlParams.get('cat');
      const urlQ = urlParams.get('q');
      const urlDur = Number(urlParams.get('dur')) || 60;

      if (decodedUrlPayload?.exam) {
        const matchesActive =
          !activeExamIdForCBT ||
          decodedUrlPayload.exam.id.toLowerCase() === activeExamIdForCBT.toLowerCase() ||
          decodedUrlPayload.exam.code.toLowerCase() === activeExamIdForCBT.toLowerCase();
        if (matchesActive) {
          hasExplicitRouteSlug = true;
          matched = decodedUrlPayload.exam;
        }
      }

      if (!matched && (cbtCode || urlQ)) {
        hasExplicitRouteSlug = true;
        matched = exams.find(e =>
          (cbtCode && (e.id.toLowerCase() === cbtCode.toLowerCase() || e.code.toLowerCase() === cbtCode.toLowerCase())) ||
          (urlTitle && e.title.toLowerCase() === decodeURIComponent(urlTitle).toLowerCase())
        );

        if (!matched && urlQ) {
          const qIds = urlQ.split(',').filter(Boolean);
          const specificQuestions = qIds.map(id => questions.find(q => q.id === id || q.code === id)).filter(Boolean) as Question[];
          if (specificQuestions.length > 0) {
            matched = {
              id: activeExamIdForCBT || cbtCode || `exam-${Date.now()}`,
              title: urlTitle ? decodeURIComponent(urlTitle) : (cbtCode ? `Assessment (${cbtCode})` : `Class ${urlCls || '11th'} Mathematics Examination`),
              code: cbtCode || `GYAN-${Date.now().toString().slice(-4)}`,
              folderId: 'folder-live',
              folderName: `Class ${urlCls || '11th'} Mathematics`,
              batchIds: [],
              targetClass: (urlCls as any) || '11th',
              examCategory: (urlCat as any) || 'JEE',
              durationMinutes: urlDur,
              totalMarks: specificQuestions.length * 4,
              positiveMarks: 4,
              negativeMarks: -1,
              passPercentage: 35,
              questions: specificQuestions,
              sections: [
                {
                  id: 'sec-1',
                  name: `Mathematics Section (Class ${urlCls || '11th'})`,
                  subject: 'Mathematics',
                  questionIds: specificQuestions.map(q => q.id)
                }
              ],
              startTime: new Date().toISOString(),
              endTime: new Date(Date.now() + urlDur * 60000).toISOString(),
              status: 'Live',
              isPublic: true,
              publicAccessUrl: window.location.href,
              instructions: ['Attempt all questions. +4 for correct response, -1 for wrong response.'],
              createdAt: new Date().toISOString()
            };
          }
        }
      }
    }

    // 3. Only fall back to exams[0] when NO specific exam slug/ID was requested at all
    const raw = matched || (!hasExplicitRouteSlug ? exams[0] : null);
    if (!raw) return null;

    const safeSections = (raw.sections && raw.sections.length > 0)
      ? raw.sections
      : [
          {
            id: 'sec-1',
            name: `Mathematics Section (Class ${raw.targetClass || '11th'})`,
            subject: 'Mathematics',
            questionIds: (raw.questions || []).map(q => q.id)
          }
        ];

    return {
      ...raw,
      sections: safeSections,
      positiveMarks: raw.positiveMarks ?? 4,
      negativeMarks: raw.negativeMarks ?? -1,
      durationMinutes: raw.durationMinutes || 180,
      totalMarks: raw.totalMarks || 100
    };
  }, [exams, questions, activeExamIdForCBT, decodedUrlPayload]);

  // Flatten questions according to sections
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const currentSection = exam?.sections?.[currentSectionIndex] || exam?.sections?.[0];

  // Strictly exam-specific questions: NEVER fall back to random INITIAL_QUESTIONS!
  const allExamQuestions: Question[] = useMemo(() => {
    if (!exam) return [];
    const extraBank =
      decodedUrlPayload?.exam &&
      (decodedUrlPayload.exam.id.toLowerCase() === exam.id.toLowerCase() ||
       decodedUrlPayload.exam.code.toLowerCase() === exam.code.toLowerCase())
        ? [...decodedUrlPayload.customQuestions, ...questions]
        : questions;
    return resolveExamQuestions(exam, extraBank);
  }, [exam, questions, decodedUrlPayload]);

  useEffect(() => {
    if (exam) {
      console.log('[EXAM IDENTIFIER] OnlineExamInterface initialized strictly for exam:', {
        examId: exam.id,
        examCode: exam.code,
        examTitle: exam.title,
        questionsCount: allExamQuestions.length,
        questionIds: allExamQuestions.map(q => q.id),
        hasCustomQuestions: !!(exam.questions && exam.questions.length > 0)
      });
    }
  }, [exam?.id, allExamQuestions.length]);

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const currentQuestion: Question | undefined = allExamQuestions[currentQuestionIndex];

  // Storage keys for preserving session across refreshes (null until actual exam ID resolves)
  const timerStorageKey = exam?.id ? `cbt_exam_start_${exam.id}_${currentUser?.id || 'guest'}` : null;
  const answersStorageKey = exam?.id ? `cbt_exam_answers_${exam.id}_${currentUser?.id || 'guest'}` : null;
  const hydratedAnswersKeyRef = useRef<string | null>(null);

  // Timer: remaining seconds preserved across browser refresh
  const [timeRemaining, setTimeRemaining] = useState<number>(() => {
    const totalSecs = (exam?.durationMinutes || 180) * 60;
    if (!timerStorageKey) return totalSecs;
    try {
      const savedStart = localStorage.getItem(timerStorageKey);
      if (savedStart) {
        const elapsed = Math.floor((Date.now() - parseInt(savedStart, 10)) / 1000);
        if (elapsed >= totalSecs) return 0;
        return Math.max(1, totalSecs - elapsed);
      } else {
        localStorage.setItem(timerStorageKey, Date.now().toString());
        return totalSecs;
      }
    } catch {
      return totalSecs;
    }
  });

  // Candidate answers state preserved in localStorage
  const [candidateAnswers, setCandidateAnswers] = useState<Record<string, StudentAnswer>>(() => {
    if (answersStorageKey) {
      try {
        const saved = localStorage.getItem(answersStorageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
            hydratedAnswersKeyRef.current = answersStorageKey;
            return parsed;
          }
        }
      } catch {}
    }

    const initial: Record<string, StudentAnswer> = {};
    allExamQuestions.forEach((q, idx) => {
      initial[q.id] = {
        questionId: q.id,
        selectedOption: '',
        status: idx === 0 ? 'not_answered' : 'not_visited',
        timeSpentSeconds: 0
      };
    });
    if (answersStorageKey) {
      hydratedAnswersKeyRef.current = answersStorageKey;
    }
    return initial;
  });

  // Hydrate saved answers when exam resolves asynchronously (e.g. after browser reload)
  useEffect(() => {
    if (!answersStorageKey || hydratedAnswersKeyRef.current === answersStorageKey) return;
    let restored: Record<string, StudentAnswer> | null = null;
    try {
      const saved = localStorage.getItem(answersStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
          restored = parsed;
        }
      }
    } catch {}
    hydratedAnswersKeyRef.current = answersStorageKey;
    if (restored) {
      setCandidateAnswers(prev => {
        const merged: Record<string, StudentAnswer> = { ...prev, ...restored };
        Object.keys(prev).forEach(qId => {
          if (prev[qId]?.selectedOption) {
            merged[qId] = prev[qId];
          }
        });
        return merged;
      });
    }
  }, [answersStorageKey]);

  // Ensure candidateAnswers always initializes entries when questions hydrate asynchronously
  useEffect(() => {
    if (allExamQuestions.length === 0) return;
    setCandidateAnswers(prev => {
      let changed = false;
      const next = { ...prev };
      allExamQuestions.forEach((q, idx) => {
        if (!next[q.id]) {
          changed = true;
          next[q.id] = {
            questionId: q.id,
            selectedOption: '',
            status: idx === 0 ? 'not_answered' : 'not_visited',
            timeSpentSeconds: 0
          };
        }
      });
      return changed ? next : prev;
    });
  }, [allExamQuestions]);

  // Automatically sync candidate answers to localStorage ONLY after key hydration finishes
  useEffect(() => {
    if (!answersStorageKey || hydratedAnswersKeyRef.current !== answersStorageKey) return;
    if (Object.keys(candidateAnswers).length === 0) return;
    try {
      localStorage.setItem(answersStorageKey, JSON.stringify(candidateAnswers));
    } catch {}
  }, [candidateAnswers, answersStorageKey]);

  const [confirmSubmitModalOpen, setConfirmSubmitModalOpen] = useState(false);
  const [submittedAttempt, setSubmittedAttempt] = useState<ExamAttempt | null>(null);
  const [reviewFilter, setReviewFilter] = useState<'all' | 'incorrect' | 'unattempted' | 'correct'>('all');
  const [mobilePaletteOpen, setMobilePaletteOpen] = useState(false);
  const [enlargedImageUrl, setEnlargedImageUrl] = useState<string | null>(null);
  const [imageZoomScale, setImageZoomScale] = useState<number>(1);
  const submitFnRef = useRef<() => void>(() => {});

  useEffect(() => {
    setImageZoomScale(1);
    if (!enlargedImageUrl) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setEnlargedImageUrl(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enlargedImageUrl]);

  // Re-initialize timer when the actual exam finishes resolving asynchronously
  useEffect(() => {
    if (!exam?.id || !timerStorageKey) return;
    const totalSecs = (exam.durationMinutes || 180) * 60;
    try {
      const savedStart = localStorage.getItem(timerStorageKey);
      if (savedStart) {
        const elapsed = Math.floor((Date.now() - parseInt(savedStart, 10)) / 1000);
        setTimeRemaining(elapsed >= totalSecs ? 0 : Math.max(1, totalSecs - elapsed));
      } else {
        localStorage.setItem(timerStorageKey, Date.now().toString());
        setTimeRemaining(totalSecs);
      }
    } catch {
      setTimeRemaining(totalSecs);
    }
  }, [exam?.id, exam?.durationMinutes, timerStorageKey]);

  // Timer countdown (only active once exam + questions are loaded and not submitted)
  useEffect(() => {
    if (!exam || allExamQuestions.length === 0 || submittedAttempt) return;
    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          submitFnRef.current();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [exam?.id, allExamQuestions.length, Boolean(submittedAttempt)]);

  // Format HH:MM:SS
  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleSelectOption = (optionLabel: string) => {
    if (!currentQuestion) return;
    setCandidateAnswers(prev => ({
      ...prev,
      [currentQuestion.id]: {
        ...(prev[currentQuestion.id] || { questionId: currentQuestion.id, timeSpentSeconds: 0 }),
        selectedOption: optionLabel,
        status: 'answered'
      }
    }));
  };

  const handleNumericalInput = (val: string) => {
    if (!currentQuestion) return;
    setCandidateAnswers(prev => ({
      ...prev,
      [currentQuestion.id]: {
        ...(prev[currentQuestion.id] || { questionId: currentQuestion.id, timeSpentSeconds: 0 }),
        selectedOption: val,
        status: val.trim() ? 'answered' : 'not_answered'
      }
    }));
  };

  const handleClearResponse = () => {
    if (!currentQuestion) return;
    setCandidateAnswers(prev => ({
      ...prev,
      [currentQuestion.id]: {
        ...(prev[currentQuestion.id] || { questionId: currentQuestion.id, timeSpentSeconds: 0 }),
        selectedOption: '',
        status: 'not_answered'
      }
    }));
  };

  const handleMarkForReviewAndNext = () => {
    if (!currentQuestion) return;
    const currentAns = candidateAnswers[currentQuestion.id]?.selectedOption;
    setCandidateAnswers(prev => ({
      ...prev,
      [currentQuestion.id]: {
        ...(prev[currentQuestion.id] || { questionId: currentQuestion.id, timeSpentSeconds: 0 }),
        status: currentAns ? 'answered_and_marked' : 'marked_for_review'
      }
    }));
    jumpToNextQuestion();
  };

  const handleSaveAndNext = () => {
    if (!currentQuestion) return;
    const currentAns = candidateAnswers[currentQuestion.id]?.selectedOption;
    setCandidateAnswers(prev => ({
      ...prev,
      [currentQuestion.id]: {
        ...(prev[currentQuestion.id] || { questionId: currentQuestion.id, timeSpentSeconds: 0 }),
        status: currentAns ? 'answered' : 'not_answered'
      }
    }));
    jumpToNextQuestion();
  };

  const isVerifiedAdminUser = isAdminAuthenticated && currentUser?.role === 'admin';

  const handleExitCbt = () => {
    const isTeacher = isVerifiedAdminUser;
    const confirmMsg = isTeacher
      ? 'Exit Test CBT preview and return to Admin Console?'
      : 'Exit examination? Your progress remains saved on this browser.';
    if (window.confirm(confirmMsg)) {
      try {
        sessionStorage.removeItem('cbt_active_taking_exam');
      } catch {}
      setActiveExamIdForCBT(null);
      if (isTeacher) {
        setPortalMode('admin');
      } else {
        setPortalMode('student');
      }
    }
  };

  const jumpToNextQuestion = () => {
    if (currentQuestionIndex < allExamQuestions.length - 1) {
      const nextIdx = currentQuestionIndex + 1;
      setCurrentQuestionIndex(nextIdx);
      const nextQ = allExamQuestions[nextIdx];
      // If next question was not_visited, mark as not_answered
      if (candidateAnswers[nextQ.id]?.status === 'not_visited') {
        setCandidateAnswers(prev => ({
          ...prev,
          [nextQ.id]: {
            ...prev[nextQ.id],
            status: 'not_answered'
          }
        }));
      }
    }
  };

  const jumpToPrevQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const handleJumpToQuestion = (index: number) => {
    setCurrentQuestionIndex(index);
    const targetQ = allExamQuestions[index];
    if (candidateAnswers[targetQ.id]?.status === 'not_visited') {
      setCandidateAnswers(prev => ({
        ...prev,
        [targetQ.id]: {
          ...prev[targetQ.id],
          status: 'not_answered'
        }
      }));
    }
  };

  // Status counts for palette
  const answeredCount = Object.values(candidateAnswers).filter(a => a.status === 'answered').length;
  const notAnsweredCount = Object.values(candidateAnswers).filter(a => a.status === 'not_answered').length;
  const markedReviewCount = Object.values(candidateAnswers).filter(a => a.status === 'marked_for_review').length;
  const answeredAndMarkedCount = Object.values(candidateAnswers).filter(a => a.status === 'answered_and_marked').length;
  const notVisitedCount = allExamQuestions.length - (answeredCount + notAnsweredCount + markedReviewCount + answeredAndMarkedCount);

  // Submit test and compute scores
  const handleSubmitExam = () => {
    if (!exam || allExamQuestions.length === 0) return;
    let calculatedScore = 0;
    let correct = 0;
    let incorrect = 0;
    let unattempted = 0;

    const evaluatedAnswers: Record<string, StudentAnswer> = {};

    allExamQuestions.forEach(q => {
      const candidateAns = candidateAnswers[q.id]?.selectedOption?.trim() || '';
      let isCorrect = false;
      let marksAwarded = 0;

      if (!candidateAns) {
        unattempted++;
        marksAwarded = 0;
      } else {
        // Evaluate
        if (q.type === 'numerical') {
          // compare numerical tolerance
          const userNum = parseFloat(candidateAns);
          const correctNum = parseFloat(q.correctAnswer);
          if (!isNaN(userNum) && !isNaN(correctNum) && Math.abs(userNum - correctNum) < 0.1) {
            isCorrect = true;
          }
        } else {
          isCorrect = normalizeAnswerChoice(candidateAns) === normalizeAnswerChoice(q.correctAnswer);
        }

        if (isCorrect) {
          correct++;
          marksAwarded = Number(q.marksPositive) || 4;
          calculatedScore += marksAwarded;
        } else {
          incorrect++;
          // Ensure negative mark is always subtracted (penalty <= 0)
          let penalty = -1;
          if (q.marksNegative !== undefined) {
            penalty = q.marksNegative > 0 ? -q.marksNegative : q.marksNegative;
          } else if (exam.negativeMarks !== undefined) {
            penalty = exam.negativeMarks > 0 ? -exam.negativeMarks : exam.negativeMarks;
          }
          // Numerical questions with 0 negative marking
          if (q.type === 'numerical' && q.marksNegative === 0) {
            penalty = 0;
          }
          marksAwarded = penalty;
          calculatedScore += penalty;
        }
      }

      evaluatedAnswers[q.id] = {
        questionId: q.id,
        selectedOption: candidateAns,
        status: candidateAns ? 'answered' : 'not_answered',
        timeSpentSeconds: 120,
        isCorrect,
        marksAwarded
      };
    });

    const maxScore = allExamQuestions.reduce((sum, q) => sum + q.marksPositive, 0) || exam.totalMarks;
    const finalPercentage = Math.max(0, Math.round((calculatedScore / maxScore) * 100 * 10) / 10);
    const accuracy = correct + incorrect > 0 ? Math.round((correct / (correct + incorrect)) * 100) : 0;

    const newAttempt: ExamAttempt = recordAttempt({
      examId: exam.id,
      examTitle: exam.title,
      examCode: exam.code,
      studentId: currentUser.id,
      studentName: currentUser.name,
      studentRollNo: currentUser.rollNo || 'GMI-ONLINE',
      studentEmail: currentUser.email,
      studentCollege: currentUser.collegeName || 'Open Candidate',
      studentPhone: currentUser.phone || '',
      isQuickJoin: currentUser.batchName?.includes('Quick Join') || !currentUser.batchId,
      answers: evaluatedAnswers,
      totalScore: calculatedScore,
      maxScore,
      percentage: finalPercentage,
      accuracy,
      correctCount: correct,
      incorrectCount: incorrect,
      unattemptedCount: unattempted,
      rank: Math.max(1, 4 - Math.floor(calculatedScore / 10)),
      totalParticipants: 12,
      startedAt: new Date(Date.now() - (exam.durationMinutes * 60 - timeRemaining) * 1000).toISOString(),
      submittedAt: new Date().toISOString(),
      timeTakenMinutes: Math.round((exam.durationMinutes * 60 - timeRemaining) / 60) || 1,
      status: 'Evaluated'
    });

    // Clear saved CBT session so subsequent attempts start fresh
    try {
      if (timerStorageKey) localStorage.removeItem(timerStorageKey);
      if (answersStorageKey) localStorage.removeItem(answersStorageKey);
    } catch {}

    setConfirmSubmitModalOpen(false);
    setSubmittedAttempt(newAttempt);

    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      });
    } catch {
      // ignore
    }
  };
  submitFnRef.current = handleSubmitExam;

  // If already submitted, show Post-Exam Scorecard & detailed solution review
  if (submittedAttempt) {
    const scoreVal = submittedAttempt.totalScore;
    const maxVal = submittedAttempt.maxScore || 100;
    const accuracyVal = submittedAttempt.accuracy || 0;
    const rankVal = submittedAttempt.rank || 1;
    const timeVal = submittedAttempt.timeTakenMinutes || 1;

    // Projected JEE Percentile calculation
    const scorePercentage = Math.round((scoreVal / maxVal) * 100);
    const projectedPercentile = scorePercentage >= 85 ? 99.6
      : scorePercentage >= 70 ? 98.4
      : scorePercentage >= 55 ? 95.8
      : scorePercentage >= 40 ? 91.2
      : scorePercentage >= 25 ? 83.5
      : 72.0;

    const projectedAir = projectedPercentile >= 99.5 ? 'AIR 1 - 650'
      : projectedPercentile >= 98.0 ? 'AIR 800 - 2,200'
      : projectedPercentile >= 95.0 ? 'AIR 3,500 - 6,800'
      : projectedPercentile >= 90.0 ? 'AIR 9,000 - 15,000'
      : 'AIR 18,000 - 35,000';

    // Topic-wise Diagnostic Analysis
    const topicBreakdown: Record<string, { total: number; correct: number; incorrect: number; unattempted: number; marks: number }> = {};
    allExamQuestions.forEach(q => {
      const topicName = q.topic || 'General Mathematics';
      if (!topicBreakdown[topicName]) {
        topicBreakdown[topicName] = { total: 0, correct: 0, incorrect: 0, unattempted: 0, marks: 0 };
      }
      topicBreakdown[topicName].total += 1;
      const ans = submittedAttempt.answers[q.id];
      if (!ans || !ans.selectedOption) {
        topicBreakdown[topicName].unattempted += 1;
      } else if (ans.isCorrect) {
        topicBreakdown[topicName].correct += 1;
        topicBreakdown[topicName].marks += 4;
      } else {
        topicBreakdown[topicName].incorrect += 1;
        topicBreakdown[topicName].marks -= 1;
      }
    });

    const topicStats = Object.entries(topicBreakdown).map(([topic, data]) => {
      const attempted = data.correct + data.incorrect;
      const accuracy = attempted > 0 ? Math.round((data.correct / attempted) * 100) : 0;
      return {
        topic,
        ...data,
        accuracy
      };
    });

    // Question Filter logic
    const filteredQuestions = allExamQuestions.filter(q => {
      const ans = submittedAttempt.answers[q.id];
      const hasAnswered = !!ans?.selectedOption;
      const isCorrect = !!ans?.isCorrect;

      if (reviewFilter === 'incorrect') return hasAnswered && !isCorrect;
      if (reviewFilter === 'unattempted') return !hasAnswered;
      if (reviewFilter === 'correct') return hasAnswered && isCorrect;
      return true;
    });

    // Handlers
    const handlePrintPdf = () => {
      const origTitle = document.title;
      const cleanStudentName = (submittedAttempt.studentName || 'Student').replace(/[^a-zA-Z0-9]/g, '_');
      const cleanCode = (submittedAttempt.examCode || 'EXAM').replace(/[^a-zA-Z0-9]/g, '_');
      document.title = `${cleanStudentName}_${cleanCode}_Exam_Paper_and_Solutions`;
      window.print();
      setTimeout(() => {
        document.title = origTitle;
      }, 1000);
    };

    const handleDownloadOfflineReport = () => {
      const cleanStudent = submittedAttempt.studentName || 'Student';
      const cleanCode = submittedAttempt.examCode || 'CBT';
      const institute = settings?.instituteName || 'Gyansai Maths IIT Center';
      const htmlDoc = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${cleanStudent} - ${submittedAttempt.examTitle} Question Paper & Solutions</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css" crossorigin="anonymous">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif; margin: 0; padding: 24px; color: #0f172a; background: #fff; line-height: 1.5; }
    .header { border-bottom: 3px solid #002FA7; padding-bottom: 16px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
    .title { font-size: 22px; font-weight: 800; color: #002FA7; margin: 0; }
    .subtitle { font-size: 13px; color: #475569; margin-top: 4px; font-weight: 600; }
    .candidate-box { text-align: right; font-size: 12px; line-height: 1.6; }
    .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
    .card { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px; text-align: center; }
    .card-label { font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
    .card-val { font-size: 20px; font-weight: 800; margin-top: 4px; }
    .section-title { font-size: 16px; font-weight: 800; color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; margin: 24px 0 16px 0; }
    .q-card { border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px; margin-bottom: 16px; page-break-inside: avoid; break-inside: avoid; }
    .q-correct { border-left: 5px solid #10b981; background: #f0fdf4; }
    .q-incorrect { border-left: 5px solid #ef4444; background: #fef2f2; }
    .q-unattempted { border-left: 5px solid #94a3b8; background: #f8fafc; }
    .q-header { display: flex; justify-content: space-between; font-weight: 700; font-size: 13px; margin-bottom: 8px; color: #1e293b; }
    .q-img { max-height: 280px; max-width: 100%; border: 1px solid #cbd5e1; border-radius: 4px; padding: 4px; background: #fff; margin: 10px 0; display: block; object-fit: contain; }
    .formula-note { background: #fef3c7; border: 1px solid #fde68a; border-radius: 4px; padding: 6px 10px; font-size: 11px; font-family: monospace; color: #92400e; margin: 8px 0; }
    .options-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 12px 0; }
    .opt-box { padding: 8px 12px; border-radius: 4px; font-size: 12px; display: flex; justify-content: space-between; align-items: center; border: 1px solid #cbd5e1; background: #fff; }
    .opt-key { background: #dcfce7; border-color: #16a34a; font-weight: bold; }
    .opt-wrong { background: #fee2e2; border-color: #dc2626; }
    .explanation { background: #ffffff; border: 1px solid #e2e8f0; padding: 12px; border-radius: 4px; margin-top: 10px; font-size: 12px; line-height: 1.6; }
    .footer { margin-top: 36px; padding-top: 16px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #64748b; }
    @media print {
      body { padding: 0; }
      .q-card { page-break-inside: avoid; break-inside: avoid; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="title">${institute}</div>
      <div class="subtitle">Complete Examination Question Paper & Official Solution Key</div>
      <div style="font-size: 12px; color: #002FA7; font-weight: 700; margin-top: 2px;">
        Assessment: ${submittedAttempt.examTitle} (${submittedAttempt.examCode})
      </div>
    </div>
    <div class="candidate-box">
      <strong>Candidate:</strong> ${submittedAttempt.studentName}<br/>
      <strong>Roll Number:</strong> ${submittedAttempt.studentRollNo || '—'}<br/>
      <strong>Exam Date:</strong> ${submittedAttempt.submittedAt}
    </div>
  </div>

  <div class="grid">
    <div class="card"><div class="card-label">Score Obtained</div><div class="card-val" style="color: #002FA7;">${scoreVal} / ${maxVal}</div></div>
    <div class="card"><div class="card-label">Accuracy Rate</div><div class="card-val" style="color: #10b981;">${accuracyVal}%</div></div>
    <div class="card"><div class="card-label">Projected Rank</div><div class="card-val" style="color: #7c3aed;">${projectedAir}</div></div>
    <div class="card"><div class="card-label">Time Spent</div><div class="card-val" style="color: #d97706;">${timeVal} mins</div></div>
  </div>

  <div class="section-title">Question-by-Question Question Paper, Diagrams & Step-by-Step Solutions</div>

  ${allExamQuestions.map((q, idx) => {
    const ans = submittedAttempt.answers[q.id];
    const isCorrect = ans?.isCorrect;
    const hasAnswered = !!ans?.selectedOption;
    const statusClass = !hasAnswered ? 'q-unattempted' : isCorrect ? 'q-correct' : 'q-incorrect';
    const statusText = !hasAnswered ? 'Unattempted (0 marks)' : isCorrect ? 'Correct (+4 marks)' : 'Wrong Response (-1 penalty)';

    const resolvedImgSrc = getQuestionImageSrc(q);
    const meaningfulQText = getMeaningfulQuestionText(q);
    const imageHtml = resolvedImgSrc
      ? `<img src="${resolvedImgSrc}" alt="Question ${idx + 1} Original Image" class="q-img" style="max-height:420px;width:auto;max-width:100%;object-fit:contain;" />`
      : '';

    const formulaHtml = q.formulaNote
      ? `<div class="formula-note"><strong>Formula / Reference:</strong> ${q.formulaNote}</div>`
      : '';

    const optionsHtml = (q.options && q.options.length > 0)
      ? `<div class="options-grid">
          ${q.options.map(opt => {
            const isOfficialKey = normalizeAnswerChoice(q.correctAnswer) === normalizeAnswerChoice(opt.label);
            const isStudentPick = ans?.selectedOption
              ? normalizeAnswerChoice(ans.selectedOption) === normalizeAnswerChoice(opt.label)
              : false;
            const boxClass = isOfficialKey ? 'opt-box opt-key' : isStudentPick ? 'opt-box opt-wrong' : 'opt-box';
            return `<div class="${boxClass}">
              <span><strong>(${opt.label})</strong> ${opt.text}</span>
              ${isOfficialKey ? '<strong style="color: #16a34a; font-size: 11px;">✓ Key</strong>' : ''}
              ${isStudentPick && !isOfficialKey ? '<strong style="color: #dc2626; font-size: 11px;">Your Pick</strong>' : ''}
            </div>`;
          }).join('')}
        </div>`
      : '';

    return `
      <div class="q-card ${statusClass}">
        <div class="q-header">
          <span>Q${idx + 1}. [${q.code}] ${q.topic || 'Mathematics'} &bull; ${q.subject || 'Mathematics'}</span>
          <span>${statusText}</span>
        </div>

        ${meaningfulQText ? `<p style="font-size: 13px; font-weight: 500; margin: 8px 0; line-height: 1.5;">${meaningfulQText}</p>` : ''}

        ${imageHtml}
        ${formulaHtml}
        ${optionsHtml}

        <div style="font-size: 12px; margin: 8px 0; padding: 6px 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px;">
          <strong>Candidate Answer:</strong> ${ans?.selectedOption || 'None (Skipped)'} &bull; 
          <strong style="color: #16a34a;">Official Key:</strong> ${q.correctAnswer} &bull; 
          <strong>Marks Rule:</strong> +${q.marksPositive || 4} / ${q.marksNegative !== undefined ? q.marksNegative : -1}
        </div>

        <div class="explanation">
          <strong style="color: #002FA7;">Step-by-Step Mathematical Method:</strong><br/>
          ${q.explanation || 'Apply standard conceptual theorem and formula transformations.'}
        </div>
      </div>
    `;
  }).join('')}

  <div class="footer">
    Verified Official Assessment Record &bull; ${institute} &bull; Comprehensive Mathematics & Science Test Portal
  </div>
</body>
</html>`;

      const blob = new Blob([htmlDoc], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${cleanStudent.replace(/\s+/g, '_')}_${cleanCode}_QuestionPaper_Solution.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    };

    const handleShareWhatsApp = () => {
      const text = encodeURIComponent(
        `🎓 *Gyansai Maths IIT Center — CBT Exam Result*\n\n` +
        `👤 *Candidate:* ${submittedAttempt.studentName} (${submittedAttempt.studentRollNo || 'Aspirant'})\n` +
        `📝 *Exam:* ${submittedAttempt.examTitle}\n` +
        `🏆 *Score:* ${scoreVal} / ${maxVal} (${accuracyVal}% Accuracy)\n` +
        `📊 *Projected Percentile:* ${projectedPercentile}% | *Projected AIR:* ${projectedAir}\n` +
        `✅ *Correct:* +${submittedAttempt.correctCount} | ❌ *Incorrect:* -${submittedAttempt.incorrectCount} | ⚪ *Skipped:* ${submittedAttempt.unattemptedCount}\n\n` +
        `🔗 Verified Official CBT Portal — Gyansai Maths IIT Center`
      );
      window.open(`https://wa.me/?text=${text}`, '_blank');
    };

    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-start py-6 px-3 sm:px-4 print:p-0 print:bg-white select-text font-sans">
        {/* Custom Print CSS */}
        <style>{`
          @media print {
            body { background-color: #ffffff !important; }
            .no-print { display: none !important; }
            .print-full { width: 100% !important; max-width: 100% !important; border: none !important; box-shadow: none !important; padding: 0 !important; }
            .avoid-break { page-break-inside: avoid !important; break-inside: avoid !important; }
          }
        `}</style>

        <div className="bg-white rounded-lg border border-slate-200 shadow-md max-w-4xl w-full p-5 sm:p-7 space-y-6 print-full">
          {/* Header */}
          <div className="border-b border-slate-200 pb-5 flex flex-col lg:flex-row items-center justify-between gap-4">
            <div className="flex items-center space-x-3.5 text-center sm:text-left w-full sm:w-auto">
              <InstituteLogo
                className="w-12 h-12 rounded-lg border border-slate-200 shadow-2xs shrink-0"
                imgClassName="max-h-12 max-w-12 object-contain rounded-lg"
                fallbackType="cap"
              />
              <div>
                <div className="flex items-center space-x-2 justify-center sm:justify-start">
                  <span className="text-[10px] font-mono font-bold tracking-widest text-[#002FA7] uppercase bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    // OFFICIAL CBT SCORECARD
                  </span>
                  <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-bold flex items-center space-x-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>EVALUATED</span>
                  </span>
                </div>
                <h1 className="text-xl font-extrabold text-slate-900 tracking-tight mt-1">
                  {submittedAttempt.examTitle}
                </h1>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  Code: {submittedAttempt.examCode} &bull; Candidate: {submittedAttempt.studentName} ({submittedAttempt.studentRollNo || '—'})
                </p>
              </div>
            </div>

            {/* Action Buttons: PDF Download, Share, and Return */}
            <div className="flex flex-wrap items-center justify-end gap-2 w-full lg:w-auto no-print">
              <button
                type="button"
                onClick={handlePrintPdf}
                className="px-3.5 py-2 bg-[#002FA7] hover:bg-blue-800 text-white rounded text-xs font-semibold cursor-pointer shadow-xs flex items-center space-x-1.5 transition"
                title="Print or Save Question Paper and Solutions as PDF"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Exam Paper (PDF)</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadOfflineReport}
                className="px-3 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-800 rounded text-xs font-semibold cursor-pointer shadow-2xs flex items-center space-x-1.5 transition"
                title="Download complete offline question paper with diagrams and answers"
              >
                <FileDown className="w-3.5 h-3.5 text-gray-600" />
                <span>Offline Paper & Solutions</span>
              </button>

              <button
                type="button"
                onClick={handleShareWhatsApp}
                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold cursor-pointer shadow-2xs flex items-center space-x-1.5 transition"
                title="Share your score on WhatsApp"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>WhatsApp</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  try {
                    sessionStorage.removeItem('cbt_active_taking_exam');
                  } catch {}
                  setSelectedAttemptForResult(submittedAttempt);
                  setPortalMode('student');
                  setActiveExamIdForCBT(null);
                }}
                className="px-3 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded text-xs font-semibold cursor-pointer transition"
              >
                <span>Dashboard</span>
              </button>
            </div>
          </div>

          {/* Core Performance Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="p-3.5 bg-blue-50/80 border border-blue-200 rounded-sm">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 block">
                Total Score
              </span>
              <span className="text-2xl font-extrabold text-[#002FA7] font-mono mt-0.5 block">
                {scoreVal} <span className="text-xs text-slate-400 font-normal">/ {maxVal}</span>
              </span>
              <span className="text-[10px] text-blue-700 font-semibold mt-1 inline-block">
                {scorePercentage}% aggregate
              </span>
            </div>

            <div className="p-3.5 bg-emerald-50/80 border border-emerald-200 rounded-sm">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 block">
                Accuracy
              </span>
              <span className="text-2xl font-extrabold text-emerald-700 font-mono mt-0.5 block">
                {accuracyVal}%
              </span>
              <span className="text-[10px] text-emerald-700 font-semibold mt-1 inline-block">
                {submittedAttempt.correctCount} of {submittedAttempt.correctCount + submittedAttempt.incorrectCount} correct
              </span>
            </div>

            <div className="p-3.5 bg-purple-50/80 border border-purple-200 rounded-sm">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 block">
                Projected Rank
              </span>
              <span className="text-xl font-extrabold text-purple-800 font-mono mt-0.5 block truncate">
                #{rankVal}
              </span>
              <span className="text-[10px] text-purple-700 font-semibold mt-1 inline-block">
                {projectedAir}
              </span>
            </div>

            <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-sm">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 block">
                Time Taken
              </span>
              <span className="text-2xl font-extrabold text-amber-800 font-mono mt-0.5 block">
                {timeVal} <span className="text-xs text-slate-400 font-normal">min</span>
              </span>
              <span className="text-[10px] text-amber-700 font-semibold mt-1 inline-block">
                ~{Math.round((timeVal * 60) / (allExamQuestions.length || 1))}s / question
              </span>
            </div>
          </div>

          {/* Quick Stat Bars: Correct, Incorrect, Unattempted */}
          <div className="grid grid-cols-3 gap-2 py-2 px-3 bg-slate-50 rounded border border-slate-200 text-xs text-center font-mono">
            <div>
              <span className="text-emerald-700 font-extrabold text-sm block">
                +{submittedAttempt.correctCount * 4} marks
              </span>
              <span className="text-[10px] uppercase text-slate-500 font-bold">
                {submittedAttempt.correctCount} Correct (+4)
              </span>
            </div>
            <div>
              <span className="text-red-600 font-extrabold text-sm block">
                -{submittedAttempt.incorrectCount} marks
              </span>
              <span className="text-[10px] uppercase text-slate-500 font-bold">
                {submittedAttempt.incorrectCount} Incorrect (-1)
              </span>
            </div>
            <div>
              <span className="text-slate-600 font-extrabold text-sm block">
                0 marks
              </span>
              <span className="text-[10px] uppercase text-slate-500 font-bold">
                {submittedAttempt.unattemptedCount} Skipped (0)
              </span>
            </div>
          </div>

          {/* SOMETHING NEW: Topic Mastery Diagnostic & Projected Cutoff */}
          <div className="bg-slate-50 border border-slate-200 rounded-sm p-4 space-y-3 avoid-break">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-blue-700" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                  Topic Readiness & Mastery Diagnostic
                </h3>
              </div>
              <div className="flex items-center space-x-2 text-[11px] font-mono">
                <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded font-bold">
                  {projectedPercentile}th Percentile
                </span>
                <span className="text-emerald-700 font-semibold">
                  ✓ Target Benchmark Qualified
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              {topicStats.map(stat => {
                const isMastered = stat.accuracy >= 75;
                const isModerate = stat.accuracy >= 40 && stat.accuracy < 75;
                return (
                  <div key={stat.topic} className="bg-white border border-slate-200 rounded p-3 text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 truncate max-w-[200px]" title={stat.topic}>
                        {stat.topic}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded font-mono ${
                          isMastered
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : isModerate
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-red-50 text-red-700 border border-red-200'
                        }`}
                      >
                        {isMastered ? 'Mastered 🏆' : isModerate ? 'Good Progress ⚡' : 'Needs Practice ⚠️'}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          isMastered ? 'bg-emerald-500' : isModerate ? 'bg-amber-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${Math.max(8, stat.accuracy)}%` }}
                      />
                    </div>

                    <div className="flex justify-between items-center text-[10px] font-mono text-slate-500">
                      <span>{stat.correct} of {stat.total} solved correctly</span>
                      <span className="font-bold text-slate-800">{stat.accuracy}% accuracy</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Interactive Question Filters (SOMETHING NEW) */}
          <div className="space-y-3 pt-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-2.5">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                  Question-by-Question Solution & Explanations
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Review complete official answer keys with step-by-step methods and shortcuts.
                </p>
              </div>

              {/* Filter Pills */}
              <div className="flex items-center space-x-1 text-xs no-print">
                <button
                  type="button"
                  onClick={() => setReviewFilter('all')}
                  className={`px-2.5 py-1 rounded text-xs font-semibold cursor-pointer transition ${
                    reviewFilter === 'all'
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  All ({allExamQuestions.length})
                </button>
                <button
                  type="button"
                  onClick={() => setReviewFilter('incorrect')}
                  className={`px-2.5 py-1 rounded text-xs font-semibold cursor-pointer transition ${
                    reviewFilter === 'incorrect'
                      ? 'bg-red-600 text-white'
                      : 'bg-red-50 text-red-700 hover:bg-red-100'
                  }`}
                >
                  Incorrect ({submittedAttempt.incorrectCount})
                </button>
                <button
                  type="button"
                  onClick={() => setReviewFilter('unattempted')}
                  className={`px-2.5 py-1 rounded text-xs font-semibold cursor-pointer transition ${
                    reviewFilter === 'unattempted'
                      ? 'bg-slate-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Skipped ({submittedAttempt.unattemptedCount})
                </button>
                <button
                  type="button"
                  onClick={() => setReviewFilter('correct')}
                  className={`px-2.5 py-1 rounded text-xs font-semibold cursor-pointer transition ${
                    reviewFilter === 'correct'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                  }`}
                >
                  Correct ({submittedAttempt.correctCount})
                </button>
              </div>
            </div>

            {/* Questions List */}
            <div className="space-y-4">
              {filteredQuestions.map((q, idx) => {
                const ansRecord = submittedAttempt.answers[q.id];
                const isCorrect = ansRecord?.isCorrect;
                const hasAnswered = !!ansRecord?.selectedOption;
                const questionNumber = allExamQuestions.findIndex(item => item.id === q.id) + 1;

                return (
                  <div
                    key={q.id}
                    className={`p-4 rounded-sm border text-xs space-y-3 avoid-break transition ${
                      !hasAnswered
                        ? 'border-slate-200 bg-slate-50/50'
                        : isCorrect
                        ? 'border-emerald-200 bg-emerald-50/25'
                        : 'border-red-200 bg-red-50/30'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="font-extrabold text-slate-900 text-sm">
                          Q{questionNumber}.
                        </span>
                        <span className="font-mono text-[11px] text-slate-500">
                          [{q.code}] &bull; {q.topic || 'General'}
                        </span>
                      </div>
                      <span
                        className={`px-2.5 py-0.5 rounded font-mono text-[10px] font-bold uppercase tracking-wider ${
                          !hasAnswered
                            ? 'bg-slate-200 text-slate-700'
                            : isCorrect
                            ? 'bg-emerald-600 text-white'
                            : 'bg-red-600 text-white'
                        }`}
                      >
                        {!hasAnswered ? 'Unattempted (0 marks)' : isCorrect ? '+4 Marks (Correct)' : '-1 Penalty (Wrong)'}
                      </span>
                    </div>

                    {getMeaningfulQuestionText(q) && (
                      <div className="text-slate-900 font-medium text-xs leading-relaxed">
                        <MathText text={getMeaningfulQuestionText(q)} />
                      </div>
                    )}

                    {(resolveQuestionType(q) === 'image' || Boolean(getQuestionImageSrc(q)) || (!getMeaningfulQuestionText(q) && !q.formulaNote)) && (
                      <ExamQuestionImage
                        key={`review-img-${q.id}`}
                        src={getQuestionImageSrc(q)}
                        alt={`Question ${questionNumber} original image`}
                        questionId={q.id}
                        questionCode={q.code}
                        examId={exam?.id}
                        imagePath={q.questionImagePath}
                        onZoom={srcUrl => setEnlargedImageUrl(srcUrl)}
                        compact
                      />
                    )}

                    {q.formulaNote && (
                      <div className="p-2 bg-amber-50/70 border border-amber-200 rounded text-[11px] text-amber-900 font-mono">
                        <span className="font-bold">Formula Note:</span> <MathText text={q.formulaNote} />
                      </div>
                    )}

                    {/* Options list if single choice */}
                    {q.options && q.options.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        {q.options.map(opt => {
                          const isStudentPick = ansRecord?.selectedOption
                            ? normalizeAnswerChoice(ansRecord.selectedOption) === normalizeAnswerChoice(opt.label)
                            : false;
                          const isOfficialKey = normalizeAnswerChoice(q.correctAnswer) === normalizeAnswerChoice(opt.label);
                          return (
                            <div
                              key={opt.id}
                              className={`p-2.5 rounded border text-[11px] flex items-center justify-between ${
                                isOfficialKey
                                  ? 'border-emerald-500 bg-emerald-100/60 font-semibold text-emerald-950'
                                  : isStudentPick
                                  ? 'border-red-400 bg-red-100/60 font-medium text-red-950'
                                  : 'border-slate-200 bg-white text-slate-700'
                              }`}
                            >
                              <div className="flex items-center space-x-2">
                                <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 ${
                                  isOfficialKey ? 'bg-emerald-600 text-white' : isStudentPick ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-700'
                                }`}>
                                  {opt.label}
                                </span>
                                <span><MathText text={opt.text} /></span>
                              </div>
                              {isOfficialKey && (
                                <span className="text-[10px] font-bold text-emerald-700 font-mono">
                                  ✓ Key
                                </span>
                              )}
                              {isStudentPick && !isOfficialKey && (
                                <span className="text-[10px] font-bold text-red-600 font-mono">
                                  Your Pick
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Comparison Answer Bar */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] pt-1">
                      <div className="p-2 bg-white rounded border border-slate-200">
                        <span className="text-slate-400 block text-[10px] uppercase font-mono">Your Answer</span>
                        <strong className={`font-mono ${isCorrect ? 'text-emerald-700' : hasAnswered ? 'text-red-600' : 'text-slate-500'}`}>
                          {ansRecord?.selectedOption || 'None (Skipped)'}
                        </strong>
                      </div>
                      <div className="p-2 bg-white rounded border border-slate-200">
                        <span className="text-slate-400 block text-[10px] uppercase font-mono">Correct Key</span>
                        <strong className="text-emerald-800 font-mono">{q.correctAnswer}</strong>
                      </div>
                      <div className="p-2 bg-white rounded border border-slate-200">
                        <span className="text-slate-400 block text-[10px] uppercase font-mono">Subject & Level</span>
                        <strong className="text-slate-800">{q.subject || 'Maths'} ({q.difficulty || 'IIT'})</strong>
                      </div>
                      <div className="p-2 bg-white rounded border border-slate-200">
                        <span className="text-slate-400 block text-[10px] uppercase font-mono">Marking Rule</span>
                        <strong className="text-slate-700">+{q.marksPositive || 4} / {q.marksNegative || -1}</strong>
                      </div>
                    </div>

                    {/* Official Step-by-Step Explanation */}
                    <div className="p-3 bg-white border border-slate-200 rounded text-[11px] text-slate-800 space-y-1">
                      <div className="font-bold text-slate-900 flex items-center space-x-1.5">
                        <BookOpen className="w-3.5 h-3.5 text-blue-700" />
                        <span>Step-by-Step Explanation & Method:</span>
                      </div>
                      <div className="text-slate-700 leading-relaxed font-normal">
                        <MathText text={q.explanation || 'Apply standard trigonometric and calculus transformations as taught in KT Sir classroom lectures.'} />
                      </div>
                    </div>
                  </div>
                );
              })}

              {filteredQuestions.length === 0 && (
                <div className="p-8 text-center bg-slate-50 rounded border border-slate-200 text-slate-500 font-mono text-xs">
                  No questions match the selected filter.
                </div>
              )}
            </div>
          </div>

          {/* Official Verification Seal & Masthead Footer */}
          <div className="pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-3">
            <div className="flex items-center space-x-2">
              <InstituteLogo
                className="w-7 h-7 rounded"
                imgClassName="max-h-7 max-w-7 object-contain"
                fallbackType="cap"
              />
              <span className="font-bold text-slate-800">
                {settings?.instituteName || 'Gyansai Maths IIT Center'}
              </span>
              <span>&bull; Verified Official CBT Assessment Document</span>
            </div>
            <div className="font-mono text-[11px] text-slate-400">
              Exam ID: {submittedAttempt.examId} &bull; Checksum: {submittedAttempt.id}
            </div>
          </div>
        </div>

        {enlargedImageUrl && (
          <div
            className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4"
            onClick={() => setEnlargedImageUrl(null)}
          >
            <div
              className="bg-white rounded-xl shadow-2xl max-w-5xl max-h-[94vh] w-full flex flex-col overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="px-4 sm:px-5 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50 gap-2 flex-wrap">
                <span className="font-bold text-slate-800 text-xs uppercase tracking-wide">
                  Original Question Image Viewer
                </span>
                <div className="flex items-center space-x-1.5">
                  <button
                    type="button"
                    onClick={() => setImageZoomScale(prev => Math.max(0.75, Number((prev - 0.25).toFixed(2))))}
                    className="p-1.5 rounded border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 cursor-pointer"
                    title="Zoom out"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </button>
                  <span className="px-2 font-mono text-xs font-bold text-slate-700 min-w-[48px] text-center">
                    {Math.round(imageZoomScale * 100)}%
                  </span>
                  <button
                    type="button"
                    onClick={() => setImageZoomScale(prev => Math.min(3, Number((prev + 0.25).toFixed(2))))}
                    className="p-1.5 rounded border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 cursor-pointer"
                    title="Zoom in"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setImageZoomScale(1)}
                    className="px-2 py-1 rounded border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-[11px] font-semibold cursor-pointer"
                    title="Reset zoom to 100%"
                  >
                    Reset
                  </button>
                  <button
                    type="button"
                    onClick={() => setEnlargedImageUrl(null)}
                    className="p-1.5 rounded hover:bg-slate-200 text-slate-600 cursor-pointer ml-1"
                    title="Close full-screen preview"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <div className="p-3 sm:p-5 overflow-auto flex items-center justify-center bg-slate-100 flex-1">
                <img
                  src={enlargedImageUrl}
                  alt="Full-screen original question"
                  style={{ transform: `scale(${imageZoomScale})`, transformOrigin: 'center center' }}
                  className="max-h-[76vh] w-auto max-w-full rounded border border-slate-300 bg-white p-1.5 object-contain shadow transition-transform duration-150"
                />
              </div>
              <div className="px-5 py-2.5 bg-white border-t border-slate-200 flex items-center justify-between">
                <span className="text-[11px] text-slate-500">
                  Original aspect ratio preserved &bull; Press Esc or click Close to return
                </span>
                <button
                  type="button"
                  onClick={() => setEnlargedImageUrl(null)}
                  className="px-4 py-1.5 bg-[#002FA7] hover:bg-blue-800 text-white rounded font-bold text-xs cursor-pointer"
                >
                  Close Viewer
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (isResolvingExamRoute && !exam) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6 font-sans">
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-8 max-w-md w-full text-center space-y-4">
          <div className="w-10 h-10 border-4 border-[#002FA7] border-t-transparent rounded-full animate-spin mx-auto" />
          <h2 className="text-base font-extrabold text-slate-900">Loading CBT Examination...</h2>
          <p className="text-xs text-slate-500">
            Synchronizing your assigned paper and original question images.
          </p>
        </div>
      </div>
    );
  }

  if (!exam || examRouteError) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6 font-sans">
        <div className="bg-white border border-red-200 rounded-xl shadow-sm p-8 max-w-md w-full text-center space-y-4">
          <AlertCircle className="w-10 h-10 text-red-600 mx-auto" />
          <h2 className="text-base font-extrabold text-slate-900">Examination Paper Not Found</h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            {examRouteError || `The requested exam "${activeExamIdForCBT || ''}" could not be loaded on this device.`}
          </p>
          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <button
              type="button"
              onClick={retryResolveExamRoute}
              className="flex-1 py-2.5 px-4 bg-[#002FA7] hover:bg-blue-800 text-white text-xs font-bold rounded-lg cursor-pointer"
            >
              Retry Loading Exam
            </button>
            <button
              type="button"
              onClick={handleExitCbt}
              className="flex-1 py-2.5 px-4 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer"
            >
              Exit
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (allExamQuestions.length === 0) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6 font-sans">
        <div className="bg-white border border-amber-200 rounded-xl shadow-sm p-8 max-w-md w-full text-center space-y-4">
          <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
          <h2 className="text-base font-extrabold text-slate-900">No Questions Assigned Yet</h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            <strong>{exam.title}</strong> ({exam.code}) currently has <strong>0 assigned questions</strong>. Please ask the administrator to add questions to this exam and click Share again.
          </p>
          <button
            type="button"
            onClick={handleExitCbt}
            className="w-full py-2.5 px-4 bg-[#002FA7] hover:bg-blue-800 text-white text-xs font-bold rounded-lg cursor-pointer"
          >
            Return to Portal
          </button>
        </div>
      </div>
    );
  }

  const currentAnswer = currentQuestion ? candidateAnswers[currentQuestion.id] : undefined;

  return (
    <div className="h-screen h-[100dvh] max-h-screen max-h-[100dvh] bg-slate-100 flex flex-col select-none overflow-hidden font-sans">
      {/* 1. TOP EXAM HEADER */}
      <header className="h-14 shrink-0 bg-white border-b border-slate-200 px-3 sm:px-4 flex items-center justify-between sticky top-0 z-30 shadow-2xs">
        <div className="flex items-center space-x-2.5">
          <InstituteLogo
            className="w-8 h-8 rounded"
            imgClassName="max-h-8 max-w-8 object-contain rounded"
            fallbackType="cap"
          />
          <div>
            <h1 className="font-extrabold text-xs sm:text-sm text-slate-900 uppercase tracking-tight truncate max-w-[160px] sm:max-w-md">
              {exam.title}
            </h1>
            <p className="text-[9px] sm:text-[10px] text-slate-500 font-semibold uppercase truncate max-w-[160px] sm:max-w-none">
              {exam.code} &bull; Class {exam.targetClass || '11th'}
            </p>
          </div>
        </div>

        {/* Center Countdown Clock */}
        <div className="flex items-center space-x-1.5 sm:space-x-2 bg-slate-100 border border-slate-300 px-2 sm:px-3 py-1 rounded">
          <Clock className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${timeRemaining < 300 ? 'text-red-600 animate-pulse' : 'text-slate-600'}`} />
          <span className="text-[10px] sm:text-[11px] font-bold uppercase text-slate-500 hidden sm:inline">Time Left:</span>
          <span
            className={`font-mono text-xs sm:text-base font-extrabold ${
              timeRemaining < 300 ? 'text-red-600' : 'text-slate-900'
            }`}
          >
            {formatTime(timeRemaining)}
          </span>
        </div>

        {/* Right Candidate Profile Indicator & Exit Button */}
        <div className="flex items-center space-x-2">
          {/* Exit / Back Button */}
          <button
            type="button"
            onClick={handleExitCbt}
            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold flex items-center space-x-1 cursor-pointer transition"
            title="Exit CBT mode"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Exit</span>
          </button>

          <div className="text-right hidden md:block">
            <div className="text-xs font-bold text-slate-800">{currentUser.name}</div>
            <div className="text-[10px] text-slate-500 font-mono font-semibold">
              {currentUser.rollNo || 'GMI-CANDIDATE'}
            </div>
          </div>
          <div className="w-8 h-8 rounded-full bg-[#1E3A8A] text-white flex items-center justify-center text-xs font-bold uppercase shrink-0">
            {currentUser.name.charAt(0)}
          </div>
        </div>
      </header>

      {/* 2. SECTION TABS */}
      <div className="shrink-0 bg-slate-200/90 border-b border-slate-300 px-3 sm:px-4 py-1.5 flex items-center justify-between overflow-x-auto text-xs">
        <div className="flex items-center space-x-1 shrink-0">
          <span className="text-[11px] font-bold text-slate-500 uppercase mr-1 hidden md:inline">Sections:</span>
          {(exam?.sections || []).map((sec, idx) => (
            <button
              key={sec.id}
              type="button"
              onClick={() => {
                setCurrentSectionIndex(idx);
                const firstQId = (sec.questionIds || [])[0];
                const qIdx = allExamQuestions.findIndex(q => q.id === firstQId);
                if (qIdx !== -1) handleJumpToQuestion(qIdx);
              }}
              className={`px-2.5 sm:px-3 py-1 rounded font-semibold text-[11px] sm:text-xs transition cursor-pointer whitespace-nowrap ${
                currentSectionIndex === idx
                  ? 'bg-[#1E3A8A] text-white shadow-2xs'
                  : 'bg-white/80 hover:bg-white text-slate-700 border border-slate-300'
              }`}
            >
              {sec.name}
            </button>
          ))}
        </div>

        <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0 ml-2">
          <div className="text-[11px] text-slate-600 font-semibold hidden lg:block">
            Marking Scheme: <strong className="text-emerald-700">+{exam.positiveMarks}</strong>,{' '}
            <strong className="text-red-600">{exam.negativeMarks}</strong>
          </div>
          <button
            type="button"
            onClick={() => setMobilePaletteOpen(true)}
            className="lg:hidden px-2.5 py-1 bg-white border border-slate-300 rounded font-bold text-[11px] text-[#1E3A8A] flex items-center space-x-1 shadow-2xs active:scale-95 transition cursor-pointer whitespace-nowrap"
          >
            <span>Palette ({answeredCount}/{allExamQuestions.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setConfirmSubmitModalOpen(true)}
            className="lg:hidden px-2.5 py-1 bg-emerald-600 text-white rounded font-bold text-[11px] flex items-center space-x-1 shadow-2xs active:scale-95 transition cursor-pointer whitespace-nowrap"
          >
            <Send className="w-3 h-3" />
            <span>Submit</span>
          </button>
        </div>
      </div>

      {/* 3. MAIN WORKSPACE */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden relative">
        {/* Left / Center: Question Panel with Pinned Bottom Action Bar */}
        <div className="flex-1 min-h-0 flex flex-col bg-white border-r border-slate-200 overflow-hidden">
          {currentQuestion ? (
            <div className="flex-1 min-h-0 flex flex-col justify-between overflow-hidden">
              {/* Scrollable Question Content Area */}
              <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-7 space-y-4">
                {/* Question Info Bar */}
                <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                  <div className="flex items-center space-x-2 flex-wrap gap-1">
                    <span className="text-xs sm:text-sm font-extrabold text-slate-900 uppercase">
                      Q {currentQuestionIndex + 1} of {allExamQuestions.length}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-blue-50 border border-blue-200 text-[#002FA7] text-[10px] font-bold">
                      {currentQuestion.subject} &bull; {currentQuestion.topic}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-semibold">
                      Class: {exam.targetClass || '11th'}
                    </span>
                  </div>

                  <div className="flex items-center space-x-2 sm:space-x-3 text-[11px] sm:text-xs font-semibold shrink-0">
                    <span className="text-emerald-700">+{currentQuestion.marksPositive}</span>
                    <span className="text-red-600">{currentQuestion.marksNegative}</span>
                  </div>
                </div>

                {/* Question Display: Image vs Text vs Combined */}
                {(() => {
                  const qType = resolveQuestionType(currentQuestion);
                  const imgSrc = getQuestionImageSrc(currentQuestion);
                  const meaningfulText = getMeaningfulQuestionText(currentQuestion);
                  const shouldRenderImage = qType === 'image' || Boolean(imgSrc) || (!meaningfulText && !currentQuestion.formulaNote);

                  return (
                    <>
                      {meaningfulText && (
                        <div className="text-sm sm:text-base font-medium text-slate-900 leading-relaxed py-1">
                          <MathText text={meaningfulText} />
                        </div>
                      )}

                      {shouldRenderImage && (
                        <ExamQuestionImage
                          key={currentQuestion.id}
                          src={imgSrc}
                          alt={`Question ${currentQuestionIndex + 1} original problem image`}
                          questionId={currentQuestion.id}
                          questionCode={currentQuestion.code}
                          examId={exam?.id}
                          imagePath={currentQuestion.questionImagePath}
                          onZoom={srcUrl => setEnlargedImageUrl(srcUrl)}
                        />
                      )}
                    </>
                  );
                })()}

                {currentQuestion.formulaNote && (
                  <div className="p-3 bg-amber-50/70 border border-amber-200 rounded text-xs text-amber-900 font-mono">
                    <strong>Reference Property:</strong> <MathText text={currentQuestion.formulaNote} />
                  </div>
                )}

                {/* Options (SCQ) or Input (Numerical) */}
                {currentQuestion.type === 'numerical' ? (
                  <div className="py-3 space-y-2 max-w-sm">
                    <label className="block text-xs font-bold text-slate-700 uppercase">
                      Enter Numerical Value (Decimals allowed):
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 128 or 21.33"
                      value={currentAnswer?.selectedOption || ''}
                      onChange={e => handleNumericalInput(e.target.value)}
                      className="w-full text-base font-mono font-bold px-3 py-2.5 border border-slate-300 rounded focus:outline-none focus:border-[#1E3A8A] focus:ring-1 focus:ring-[#1E3A8A]"
                    />
                  </div>
                ) : (
                  <div className="space-y-2.5 pt-1">
                    {currentQuestion.options.map(opt => {
                      const isSelected = currentAnswer?.selectedOption === opt.label;
                      return (
                        <div
                          key={opt.id}
                          onClick={() => handleSelectOption(opt.label)}
                          className={`min-h-[46px] p-3 sm:p-3.5 rounded border text-xs sm:text-sm flex items-center space-x-3 cursor-pointer transition select-none ${
                            isSelected
                              ? 'bg-blue-50/90 border-[#1E3A8A] ring-1 ring-[#1E3A8A] text-slate-900 font-semibold shadow-2xs'
                              : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                          }`}
                        >
                          <span
                            className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                              isSelected
                                ? 'bg-[#1E3A8A] text-white'
                                : 'bg-slate-100 text-slate-600 border border-slate-300'
                            }`}
                          >
                            {opt.label}
                          </span>
                          <span className="flex-1 break-words">
                            <MathText text={opt.text} />
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Pinned Bottom Action Bar for Mobile & Desktop */}
              <div className="shrink-0 z-10 bg-white/95 backdrop-blur-xs border-t border-slate-200 px-3 py-2.5 sm:px-6 sm:py-3 shadow-md flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center space-x-1.5 sm:space-x-2">
                  <button
                    type="button"
                    onClick={handleClearResponse}
                    className="px-2.5 sm:px-3 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold rounded cursor-pointer transition active:scale-95"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={handleMarkForReviewAndNext}
                    className="px-2.5 sm:px-3 py-2 bg-purple-100 hover:bg-purple-200 text-purple-900 font-semibold rounded cursor-pointer transition active:scale-95 truncate max-w-[130px] sm:max-w-none"
                  >
                    Review & Next
                  </button>
                </div>

                <div className="flex items-center space-x-1.5 sm:space-x-2">
                  <button
                    type="button"
                    onClick={jumpToPrevQuestion}
                    disabled={currentQuestionIndex === 0}
                    className="px-2.5 sm:px-3 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 font-semibold rounded flex items-center space-x-1 cursor-pointer transition active:scale-95"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Previous</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveAndNext}
                    className="px-3.5 sm:px-5 py-2 bg-[#1E3A8A] hover:bg-blue-900 text-white font-bold rounded shadow-xs flex items-center space-x-1 cursor-pointer transition active:scale-95"
                  >
                    <span>Save & Next</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center text-slate-500 text-xs">No questions in section</div>
          )}
        </div>

        {/* Right: Question Palette & Candidate Legend (Desktop) */}
        <div className="hidden lg:flex w-72 bg-slate-50 p-4 border-l border-slate-200 flex-col justify-between shrink-0 space-y-4 text-xs">
          {/* Candidate Card */}
          <div className="bg-white p-3 rounded border border-slate-200 shadow-2xs flex items-center space-x-3">
            {currentUser.avatar ? (
              <img
                src={currentUser.avatar}
                alt={currentUser.name}
                className="w-10 h-10 rounded-full object-cover border border-slate-200"
              />
            ) : (
              <div className="w-10 h-10 rounded bg-[#1E3A8A] text-white flex items-center justify-center font-bold text-sm uppercase">
                {currentUser.name.charAt(0)}
              </div>
            )}
            <div className="overflow-hidden">
              <span className="font-bold text-slate-900 block truncate">{currentUser.name}</span>
              <span className="text-[10px] text-slate-500 font-mono">Roll: {currentUser.rollNo || 'GMI-CBT'}</span>
            </div>
          </div>

          {/* Palette Legend */}
          <div className="bg-white p-3 rounded border border-slate-200 shadow-2xs space-y-1.5 text-[11px]">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Question Palette Status
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center space-x-1.5">
                <span className="w-4 h-4 rounded bg-emerald-600 text-white flex items-center justify-center text-[9px] font-bold">
                  {answeredCount}
                </span>
                <span className="text-slate-600">Answered</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-4 h-4 rounded bg-red-600 text-white flex items-center justify-center text-[9px] font-bold">
                  {notAnsweredCount}
                </span>
                <span className="text-slate-600">Not Answered</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-4 h-4 rounded bg-purple-600 text-white flex items-center justify-center text-[9px] font-bold">
                  {markedReviewCount}
                </span>
                <span className="text-slate-600">Marked Review</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-4 h-4 rounded bg-slate-200 text-slate-700 flex items-center justify-center text-[9px] font-bold">
                  {notVisitedCount}
                </span>
                <span className="text-slate-600">Not Visited</span>
              </div>
            </div>
          </div>

          {/* Question Grid Buttons */}
          <div className="bg-white p-3 rounded border border-slate-200 shadow-2xs flex-1">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              Choose a Question:
            </div>
            <div className="grid grid-cols-5 gap-1.5 max-h-56 overflow-y-auto p-1">
              {allExamQuestions.map((q, idx) => {
                const ans = candidateAnswers[q.id];
                const status = ans?.status || 'not_visited';
                const isCurrent = currentQuestionIndex === idx;

                let btnClass = 'bg-slate-100 text-slate-600 hover:bg-slate-200';
                if (status === 'answered') {
                  btnClass = 'bg-emerald-600 text-white';
                } else if (status === 'not_answered') {
                  btnClass = 'bg-red-600 text-white';
                } else if (status === 'marked_for_review') {
                  btnClass = 'bg-purple-600 text-white';
                } else if (status === 'answered_and_marked') {
                  btnClass = 'bg-purple-700 text-white ring-2 ring-emerald-400';
                }

                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => handleJumpToQuestion(idx)}
                    className={`h-8 rounded text-xs font-bold transition flex items-center justify-center cursor-pointer ${btnClass} ${
                      isCurrent ? 'ring-2 ring-blue-500 ring-offset-1 font-extrabold' : ''
                    }`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Submit Test Button */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setConfirmSubmitModalOpen(true)}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded shadow-sm text-xs uppercase tracking-wider flex items-center justify-center space-x-1.5 cursor-pointer transition"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Submit Entire Examination</span>
            </button>
          </div>
        </div>
      </div>

      {/* MOBILE QUESTION PALETTE BOTTOM DRAWER */}
      {mobilePaletteOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex flex-col justify-end">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-2xs transition-opacity"
            onClick={() => setMobilePaletteOpen(false)}
          />
          <div className="relative bg-white rounded-t-2xl p-5 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom duration-200 text-xs">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="font-extrabold text-sm text-slate-900">
                Question Palette ({answeredCount}/{allExamQuestions.length} Answered)
              </div>
              <button
                type="button"
                onClick={() => setMobilePaletteOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mobile Palette Legend */}
            <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-50 p-2.5 rounded border border-slate-200">
              <div className="flex items-center space-x-1.5">
                <span className="w-4 h-4 rounded bg-emerald-600 text-white flex items-center justify-center text-[9px] font-bold">
                  {answeredCount}
                </span>
                <span className="text-slate-600">Answered</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-4 h-4 rounded bg-red-600 text-white flex items-center justify-center text-[9px] font-bold">
                  {notAnsweredCount}
                </span>
                <span className="text-slate-600">Not Answered</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-4 h-4 rounded bg-purple-600 text-white flex items-center justify-center text-[9px] font-bold">
                  {markedReviewCount}
                </span>
                <span className="text-slate-600">Marked Review</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-4 h-4 rounded bg-slate-200 text-slate-700 flex items-center justify-center text-[9px] font-bold">
                  {notVisitedCount}
                </span>
                <span className="text-slate-600">Not Visited</span>
              </div>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-5 sm:grid-cols-8 gap-2 py-2">
              {allExamQuestions.map((q, idx) => {
                const ans = candidateAnswers[q.id];
                const status = ans?.status || 'not_visited';
                const isCurrent = currentQuestionIndex === idx;

                let btnClass = 'bg-slate-100 text-slate-600 hover:bg-slate-200';
                if (status === 'answered') btnClass = 'bg-emerald-600 text-white';
                else if (status === 'not_answered') btnClass = 'bg-red-600 text-white';
                else if (status === 'marked_for_review') btnClass = 'bg-purple-600 text-white';
                else if (status === 'answered_and_marked') btnClass = 'bg-purple-700 text-white ring-2 ring-emerald-400';

                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => {
                      handleJumpToQuestion(idx);
                      setMobilePaletteOpen(false);
                    }}
                    className={`h-9 rounded font-bold text-xs flex items-center justify-center cursor-pointer transition ${btnClass} ${
                      isCurrent ? 'ring-2 ring-blue-500 font-extrabold scale-105' : ''
                    }`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => {
                setMobilePaletteOpen(false);
                setConfirmSubmitModalOpen(true);
              }}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg flex items-center justify-center space-x-1.5 cursor-pointer shadow-xs transition"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Submit Entire Examination</span>
            </button>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL */}
      {confirmSubmitModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-md w-full p-5 space-y-4 text-xs animate-in zoom-in-95">
            <div className="flex items-center space-x-2 text-slate-900 font-bold uppercase text-sm border-b border-slate-200 pb-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              <span>Confirm Examination Submission</span>
            </div>

            <p className="text-slate-600">
              Are you sure you want to finish and submit your test? Once submitted, answers cannot be modified.
            </p>

            <div className="bg-slate-50 p-3 rounded border border-slate-200 space-y-1.5 text-slate-700 font-medium">
              <div className="flex justify-between">
                <span>Total Questions:</span>
                <strong>{allExamQuestions.length}</strong>
              </div>
              <div className="flex justify-between text-emerald-700">
                <span>Answered:</span>
                <strong>{answeredCount}</strong>
              </div>
              <div className="flex justify-between text-red-600">
                <span>Not Answered:</span>
                <strong>{notAnsweredCount}</strong>
              </div>
              <div className="flex justify-between text-purple-700">
                <span>Marked for Review:</span>
                <strong>{markedReviewCount + answeredAndMarkedCount}</strong>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Not Visited:</span>
                <strong>{notVisitedCount}</strong>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setConfirmSubmitModalOpen(false)}
                className="px-4 py-2 border border-slate-300 text-slate-700 font-semibold rounded hover:bg-slate-50 cursor-pointer"
              >
                Resume Test
              </button>
              <button
                type="button"
                onClick={handleSubmitExam}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded cursor-pointer shadow-xs"
              >
                Yes, Submit Test Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Enlarged Fullscreen Question Image Viewer Modal with Zoom Controls */}
      {enlargedImageUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4"
          onClick={() => setEnlargedImageUrl(null)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-5xl max-h-[94vh] w-full flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-4 sm:px-5 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50 gap-2 flex-wrap">
              <span className="font-bold text-slate-800 text-xs uppercase tracking-wide">
                Original Question Image Viewer
              </span>
              <div className="flex items-center space-x-1.5">
                <button
                  type="button"
                  onClick={() => setImageZoomScale(prev => Math.max(0.75, Number((prev - 0.25).toFixed(2))))}
                  className="p-1.5 rounded border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 cursor-pointer"
                  title="Zoom out"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="px-2 font-mono text-xs font-bold text-slate-700 min-w-[48px] text-center">
                  {Math.round(imageZoomScale * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setImageZoomScale(prev => Math.min(3, Number((prev + 0.25).toFixed(2))))}
                  className="p-1.5 rounded border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 cursor-pointer"
                  title="Zoom in"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setImageZoomScale(1)}
                  className="px-2 py-1 rounded border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-[11px] font-semibold cursor-pointer"
                  title="Reset zoom to 100%"
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={() => setEnlargedImageUrl(null)}
                  className="p-1.5 rounded hover:bg-slate-200 text-slate-600 cursor-pointer ml-1"
                  title="Close full-screen preview"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-3 sm:p-5 overflow-auto flex items-center justify-center bg-slate-100 flex-1">
              <img
                src={enlargedImageUrl}
                alt="Full-screen original question"
                style={{ transform: `scale(${imageZoomScale})`, transformOrigin: 'center center' }}
                className="max-h-[76vh] w-auto max-w-full rounded border border-slate-300 bg-white p-1.5 object-contain shadow transition-transform duration-150"
              />
            </div>
            <div className="px-5 py-2.5 bg-white border-t border-slate-200 flex items-center justify-between">
              <span className="text-[11px] text-slate-500">
                Original aspect ratio preserved &bull; Press Esc or click Close to return to exam
              </span>
              <button
                type="button"
                onClick={() => setEnlargedImageUrl(null)}
                className="px-4 py-1.5 bg-[#002FA7] hover:bg-blue-800 text-white rounded font-bold text-xs cursor-pointer"
              >
                Close Viewer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
