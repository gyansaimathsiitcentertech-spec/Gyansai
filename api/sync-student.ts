// Vercel Serverless Function: sync-student
// Handles cross-device student registration synchronization with strict trusted-origin CORS

import { applyCorsHeaders, stripDangerousKeys } from './_cors';

const MAX_STORED_STUDENTS = 500;
let studentsStore: any[] = [];

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
  if (
    applyCorsHeaders(req, res, {
      resourcePolicy: 'same-site',
      restrictReadsToTrustedOrigins: true
    })
  ) {
    return;
  }

  if (req.method === 'POST') {
    try {
      const data = parseBody(req.body);
      if (!data || (!data.phone && !data.id && !data.username)) {
        return res.status(400).json({ success: false, error: 'Student payload must include phone, id, or username.' });
      }

      // Never store or echo plaintext passwords in the serverless sync cache
      const { password: _omittedPassword, ...safeStudent } = data;
      const key = String(safeStudent.phone || safeStudent.id || safeStudent.username)
        .toLowerCase()
        .trim()
        .slice(0, 128);

      if (!key) {
        return res.status(400).json({ success: false, error: 'Invalid student identifier.' });
      }

      const idx = studentsStore.findIndex(
        s =>
          (s.phone && String(s.phone).toLowerCase().trim() === key) ||
          (s.id && String(s.id).toLowerCase().trim() === key) ||
          (s.username && String(s.username).toLowerCase().trim() === key)
      );

      if (idx >= 0) {
        studentsStore[idx] = { ...studentsStore[idx], ...safeStudent };
      } else {
        studentsStore.unshift(safeStudent);
        if (studentsStore.length > MAX_STORED_STUDENTS) {
          studentsStore = studentsStore.slice(0, MAX_STORED_STUDENTS);
        }
      }

      return res.status(200).json({ success: true, total: studentsStore.length });
    } catch (err: any) {
      return res.status(400).json({ success: false, error: err?.message || 'Invalid student payload' });
    }
  }

  if (req.method === 'GET') {
    return res.status(200).json({ success: true, data: studentsStore });
  }

  return res.status(405).json({ success: false, error: 'Method not allowed' });
}
