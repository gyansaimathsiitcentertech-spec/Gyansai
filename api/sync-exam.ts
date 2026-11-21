// Vercel Serverless Function: sync-exam
// Handles cross-device exam synchronization with validated CORS and original image preservation

import { applyCorsHeaders, stripDangerousKeys } from './_cors';

const MAX_STORED_EXAMS = 150;

let examsStore: any[] = [
  {
    id: 'exam-gyan-1414',
    title: 'www',
    code: 'GYAN-1414',
    targetClass: '11th',
    examCategory: 'JEE',
    durationMinutes: 60,
    totalMarks: 20,
    positiveMarks: 4,
    negativeMarks: -1,
    sections: [
      {
        id: 'sec-1',
        name: 'Mathematics Section (Class 11th)',
        subject: 'Mathematics',
        questionIds: ['q-11-trig-1', 'q-11-pnc-2', 'q-11-conic-3', 'q-11-quad-4', 'q-11-seq-5'],
        instructions: '+4 for correct response, -1 for wrong response.'
      }
    ],
    status: 'Live',
    isPublic: true
  },
  {
    id: 'exam-11th-mock',
    title: 'Class 11th IIT-JEE Mathematics Comprehensive Examination',
    code: 'GYAN-11TH-MOCK',
    targetClass: '11th',
    examCategory: 'JEE',
    durationMinutes: 120,
    totalMarks: 40,
    positiveMarks: 4,
    negativeMarks: -1,
    sections: [
      {
        id: 'sec-1',
        name: 'Mathematics - Class 11th Core Section',
        subject: 'Mathematics',
        questionIds: [
          'q-11-trig-1',
          'q-11-pnc-2',
          'q-11-conic-3',
          'q-11-quad-4',
          'q-11-seq-5',
          'q-11-binom-6',
          'q-11-comp-7',
          'q-11-line-8',
          'q-11-circ-9',
          'q-11-rel-10'
        ],
        instructions: '+4 for correct, -1 for wrong.'
      }
    ],
    status: 'Live',
    isPublic: true
  },
  {
    id: 'exam-12th-mock',
    title: 'Class 12th IIT-JEE Mathematics Master Examination',
    code: 'GYAN-12TH-MOCK',
    targetClass: '12th',
    examCategory: 'JEE',
    durationMinutes: 120,
    totalMarks: 40,
    positiveMarks: 4,
    negativeMarks: -1,
    sections: [
      {
        id: 'sec-1',
        name: 'Mathematics - Class 12th Advanced Section',
        subject: 'Mathematics',
        questionIds: [
          'q-1',
          'q-2',
          'q-3',
          'q-4',
          'q-5',
          'q-12-cont-6',
          'q-12-3d-7',
          'q-12-area-8',
          'q-12-itf-9',
          'q-12-aod-10'
        ],
        instructions: '+4 for correct, -1 for wrong.'
      }
    ],
    status: 'Live',
    isPublic: true
  },
  {
    id: 'exam-cet-mock',
    title: 'MHT-CET Mathematics Speed & Accuracy Paper',
    code: 'GYAN-CET-2025',
    targetClass: '12th',
    examCategory: 'MHT-CET',
    durationMinutes: 90,
    totalMarks: 10,
    positiveMarks: 2,
    negativeMarks: 0,
    sections: [
      {
        id: 'sec-1',
        name: 'MHT-CET Mathematics Section',
        subject: 'Mathematics',
        questionIds: ['q-cet-logic-1', 'q-cet-mat-2', 'q-cet-pair-3', 'q-cet-diff-4', 'q-cet-lpp-5'],
        instructions: '+2 for correct, 0 for wrong.'
      }
    ],
    status: 'Live',
    isPublic: true
  }
];

function normImgPath(raw?: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const val = raw.trim();
  if (!val) return undefined;
  if (val.startsWith('uploaded_question_images/')) {
    const f = val.slice('uploaded_question_images/'.length).split('/').pop();
    return f ? `/api/question-image/${f}` : undefined;
  }
  return val;
}

function mergeQuestionsPreservingImages(incomingQs: any[], existingQs: any[]): any[] {
  if (!Array.isArray(incomingQs) || incomingQs.length === 0) {
    return Array.isArray(existingQs) ? existingQs : [];
  }
  const existingById = new Map<string, any>();
  (Array.isArray(existingQs) ? existingQs : []).forEach(eq => {
    if (eq?.id) existingById.set(String(eq.id), eq);
    if (eq?.code) existingById.set(String(eq.code), eq);
  });

  return incomingQs.slice(0, 200).map(q => {
    if (!q || typeof q !== 'object') return q;
    const prev = existingById.get(String(q.id || '')) || existingById.get(String(q.code || '')) || {};
    const imgPath = normImgPath(q.questionImagePath) || normImgPath(prev.questionImagePath);
    const imgUrl =
      normImgPath(q.questionImageUrl) ||
      normImgPath(q.imageUrl) ||
      normImgPath(prev.questionImageUrl) ||
      normImgPath(prev.imageUrl) ||
      imgPath;
    const qType = q.questionType || prev.questionType || (imgUrl && !q.questionText ? 'image' : undefined);

    return {
      ...prev,
      ...q,
      ...(qType ? { questionType: qType } : {}),
      ...(imgUrl ? { questionImageUrl: imgUrl, imageUrl: imgUrl } : {}),
      ...(imgPath ? { questionImagePath: imgPath } : {})
    };
  });
}

function parseBody(rawBody: unknown): Record<string, any> | null {
  if (!rawBody) return null;
  if (typeof rawBody === 'string') {
    const parsed = JSON.parse(rawBody);
    return parsed && typeof parsed === 'object' ? stripDangerousKeys(parsed) : null;
  }
  if (typeof rawBody === 'object') {
    return stripDangerousKeys(rawBody);
  }
  return null;
}

export default function handler(req: any, res: any) {
  if (applyCorsHeaders(req, res, { resourcePolicy: 'cross-origin' })) {
    return;
  }

  if (req.method === 'POST') {
    try {
      const data = parseBody(req.body);
      if (!data || (!data.code && !data.id)) {
        return res.status(400).json({ success: false, error: 'Exam payload must include a valid code or id.' });
      }
      const codeStr = typeof data.code === 'string' ? data.code.trim().slice(0, 80) : '';
      const idStr = typeof data.id === 'string' ? data.id.trim().slice(0, 128) : '';
      if (!codeStr && !idStr) {
        return res.status(400).json({ success: false, error: 'Exam code/id must be a non-empty string.' });
      }

      const idx = examsStore.findIndex(
        e =>
          (codeStr && e.code && String(e.code).toLowerCase() === codeStr.toLowerCase()) ||
          (idStr && e.id && String(e.id).toLowerCase() === idStr.toLowerCase())
      );

      if (idx >= 0) {
        const existing = examsStore[idx];
        examsStore[idx] = {
          ...existing,
          ...data,
          ...(codeStr ? { code: codeStr } : {}),
          ...(idStr ? { id: idStr } : {}),
          questions: mergeQuestionsPreservingImages(data.questions, existing.questions)
        };
      } else {
        const nextExam = {
          ...data,
          ...(codeStr ? { code: codeStr } : {}),
          ...(idStr ? { id: idStr } : {}),
          questions: mergeQuestionsPreservingImages(data.questions, [])
        };
        examsStore.unshift(nextExam);
        if (examsStore.length > MAX_STORED_EXAMS) {
          examsStore = examsStore.slice(0, MAX_STORED_EXAMS);
        }
      }

      return res.status(200).json({ success: true, total: examsStore.length });
    } catch (err: any) {
      return res.status(400).json({ success: false, error: err?.message || 'Invalid exam payload' });
    }
  }

  if (req.method === 'GET') {
    const rawCode = req.query?.code || req.query?.id || '';
    const code = (Array.isArray(rawCode) ? rawCode[0] : String(rawCode)).trim();
    if (code) {
      const target = code.toLowerCase();
      const match = examsStore.find(
        e =>
          (e.code && String(e.code).toLowerCase() === target) ||
          (e.id && String(e.id).toLowerCase() === target)
      );
      if (match) {
        return res.status(200).json({ success: true, data: match });
      }
      return res.status(404).json({ success: false, error: 'Exam not found' });
    }
    return res.status(200).json({ success: true, data: examsStore });
  }

  return res.status(405).json({ success: false, error: 'Method not allowed' });
}
