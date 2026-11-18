// Vercel Serverless Function: sync-exam
// Handles cross-device exam synchronization on Vercel deployments

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
        questionIds: ['q-11-trig-1', 'q-11-pnc-2', 'q-11-conic-3', 'q-11-quad-4', 'q-11-seq-5', 'q-11-binom-6', 'q-11-comp-7', 'q-11-line-8', 'q-11-circ-9', 'q-11-rel-10'],
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
        questionIds: ['q-1', 'q-2', 'q-3', 'q-4', 'q-5', 'q-12-cont-6', 'q-12-3d-7', 'q-12-area-8', 'q-12-itf-9', 'q-12-aod-10'],
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

export default function handler(req: any, res: any) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'POST') {
    try {
      const data = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (data && (data.code || data.id)) {
        const idx = examsStore.findIndex(
          e => (data.code && e.code && e.code.toLowerCase() === data.code.toLowerCase()) ||
               (data.id && e.id && e.id.toLowerCase() === data.id.toLowerCase())
        );
        if (idx >= 0) {
          examsStore[idx] = { ...examsStore[idx], ...data };
        } else {
          examsStore.unshift(data);
        }
      }
      return res.status(200).json({ success: true, total: examsStore.length });
    } catch (err: any) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  if (req.method === 'GET') {
    const code = (req.query?.code || req.query?.id || '') as string;
    if (code) {
      const match = examsStore.find(
        e => (e.code && e.code.toLowerCase() === code.toLowerCase().trim()) ||
             (e.id && e.id.toLowerCase() === code.toLowerCase().trim())
      );
      if (match) {
        return res.status(200).json({ success: true, data: match });
      }
      return res.status(404).json({ success: false, error: 'Exam not found' });
    }
    return res.status(200).json({ success: true, data: examsStore });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
