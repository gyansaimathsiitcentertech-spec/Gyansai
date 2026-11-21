import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import { defineConfig } from 'vite';

function syncExamPlugin() {
  const examsFilePath = path.resolve('./shared_exams_store.json');
  const studentsFilePath = path.resolve('./shared_students_store.json');
  const imagesDirPath = path.resolve('./uploaded_question_images');
  try {
    if (!fs.existsSync(imagesDirPath)) {
      fs.mkdirSync(imagesDirPath, { recursive: true });
    }
  } catch (e) {
    console.warn('Failed to create uploaded_question_images dir:', e);
  }
  const sharedExamsMap = new Map<string, any>();
  const sharedStudentsMap = new Map<string, any>();

  const normImgPath = (raw?: string) => {
    if (!raw) return undefined;
    if (raw.startsWith('uploaded_question_images/')) {
      const f = raw.slice('uploaded_question_images/'.length).split('/').pop();
      return f ? `/api/question-image/${f}` : undefined;
    }
    return raw;
  };

  // Preload exams from persistent disk storage
  try {
    if (fs.existsSync(examsFilePath)) {
      const content = fs.readFileSync(examsFilePath, 'utf-8');
      const list = JSON.parse(content);
      if (Array.isArray(list)) {
        list.forEach(item => {
          if (Array.isArray(item.questions)) {
            item.questions = item.questions.map((q: any) => {
              const p = normImgPath(q?.questionImagePath);
              const u = normImgPath(q?.questionImageUrl) || normImgPath(q?.imageUrl) || p;
              return {
                ...q,
                ...(u ? { questionImageUrl: u, imageUrl: u } : {}),
                ...(p ? { questionImagePath: p } : {})
              };
            });
          }
          if (item.code) sharedExamsMap.set(item.code.toLowerCase().trim(), item);
          if (item.id) sharedExamsMap.set(item.id.toLowerCase().trim(), item);
        });
      }
    }
  } catch (e) {
    console.warn('Failed to load shared exams from disk:', e);
  }

  // Preload students from persistent disk storage
  try {
    if (fs.existsSync(studentsFilePath)) {
      const content = fs.readFileSync(studentsFilePath, 'utf-8');
      const list = JSON.parse(content);
      if (Array.isArray(list)) {
        list.forEach(item => {
          const key = (item.phone || item.id || item.username || '').toLowerCase().trim();
          if (key) sharedStudentsMap.set(key, item);
        });
      }
    }
  } catch (e) {
    console.warn('Failed to load shared students from disk:', e);
  }

  const saveExamsToDisk = () => {
    try {
      const uniqueExams = Array.from(new Set(sharedExamsMap.values()));
      fs.writeFileSync(examsFilePath, JSON.stringify(uniqueExams, null, 2), 'utf-8');
    } catch (e) {
      console.warn('Failed to save shared exams to disk:', e);
    }
  };

  const saveStudentsToDisk = () => {
    try {
      const uniqueStudents = Array.from(new Set(sharedStudentsMap.values()));
      fs.writeFileSync(studentsFilePath, JSON.stringify(uniqueStudents, null, 2), 'utf-8');
    } catch (e) {
      console.warn('Failed to save shared students to disk:', e);
    }
  };

  const mergeQuestionsPreservingImages = (incomingQs: any[], existingQs: any[]) => {
    if (!Array.isArray(incomingQs) || incomingQs.length === 0) {
      return Array.isArray(existingQs) ? existingQs : [];
    }
    const existingById = new Map<string, any>();
    (Array.isArray(existingQs) ? existingQs : []).forEach(eq => {
      if (eq?.id) existingById.set(eq.id, eq);
      if (eq?.code) existingById.set(eq.code, eq);
    });
    return incomingQs.map(q => {
      const prev = existingById.get(q?.id) || existingById.get(q?.code) || {};
      const imgPath = normImgPath(q?.questionImagePath) || normImgPath(prev?.questionImagePath) || undefined;
      const imgUrl = normImgPath(q?.questionImageUrl) || normImgPath(q?.imageUrl) || normImgPath(prev?.questionImageUrl) || normImgPath(prev?.imageUrl) || imgPath || undefined;
      const qType = q?.questionType || prev?.questionType || (imgUrl && !q?.questionText ? 'image' : undefined);
      return {
        ...prev,
        ...q,
        ...(qType ? { questionType: qType } : {}),
        ...(imgUrl ? { questionImageUrl: imgUrl, imageUrl: imgUrl } : {}),
        ...(imgPath ? { questionImagePath: imgPath } : {})
      };
    });
  };

  const isTrustedDevOrigin = (origin: string | undefined, req: any): boolean => {
    if (!origin) return true;
    try {
      const parsed = new URL(origin);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
      const reqHost = String(req?.headers?.['x-forwarded-host'] || req?.headers?.host || '')
        .split(',')[0]
        .trim()
        .toLowerCase();
      if (reqHost && parsed.host.toLowerCase() === reqHost) return true;
      const host = parsed.hostname.toLowerCase();
      if (host === 'localhost' || host === '127.0.0.1') return true;
      const knownPortalHosts = [
        'ais-dev-f7jpkmgt4fqk7n2ogmc4x2-740969633609.asia-southeast1.run.app',
        'ais-pre-f7jpkmgt4fqk7n2ogmc4x2-740969633609.asia-southeast1.run.app'
      ];
      if (parsed.protocol === 'https:' && knownPortalHosts.includes(host)) return true;
      const allowed = [process.env.ALLOWED_ORIGINS, process.env.APP_URL]
        .filter(Boolean)
        .join(',')
        .split(',')
        .map(s => s.trim().replace(/\/+$/, '').toLowerCase())
        .filter(Boolean);
      return allowed.includes(origin.trim().replace(/\/+$/, '').toLowerCase());
    } catch {
      return false;
    }
  };

  const applyMiddlewareCors = (
    req: any,
    res: any,
    opts: { resourcePolicy: 'cross-origin' | 'same-site'; restrictReads?: boolean }
  ): boolean => {
    const rawOrigin = req?.headers?.origin;
    const origin = Array.isArray(rawOrigin) ? rawOrigin[0] : rawOrigin;
    const trusted = isTrustedDevOrigin(origin, req);

    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cross-Origin-Resource-Policy', opts.resourcePolicy);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
    res.setHeader('Access-Control-Max-Age', '86400');

    if (origin && trusted) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }

    if (req.method === 'OPTIONS') {
      res.statusCode = origin && !trusted ? 403 : 204;
      res.end();
      return true;
    }

    if (origin && !trusted && (req.method !== 'GET' || opts.restrictReads)) {
      res.statusCode = 403;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: false, error: 'Cross-origin request blocked' }));
      return true;
    }

    return false;
  };

  const attachMiddlewares = (middlewares: any) => {
    middlewares.use((req: any, res: any, next: any) => {
        // 0a. Upload original untouched question image to persistent disk store
        if (req.url && req.url.startsWith('/api/upload-image')) {
          if (applyMiddlewareCors(req, res, { resourcePolicy: 'same-site', restrictReads: true })) return;
          if (req.method !== 'POST') {
            res.statusCode = 405;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: 'Method not allowed' }));
            return;
          }
          res.setHeader('Cache-Control', 'no-store, max-age=0');
          const chunks: Buffer[] = [];
          req.on('data', (chunk: Buffer) => { chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)); });
          req.on('end', () => {
            try {
              const body = Buffer.concat(chunks).toString('utf-8');
              const parsed = JSON.parse(body || '{}');
              const dataUrl = String(parsed.dataUrl || '');
              const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9+.\-]+);base64,(.+)$/);
              if (!match) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: false, error: 'Invalid base64 image payload' }));
                return;
              }
              const mimeType = match[1].toLowerCase();
              const base64Data = match[2];
              const extMap: Record<string, string> = {
                'image/png': 'png',
                'image/jpeg': 'jpg',
                'image/jpg': 'jpg',
                'image/webp': 'webp',
                'image/gif': 'gif',
                'image/svg+xml': 'svg'
              };
              const ext = extMap[mimeType] || 'png';
              const safePrefix = String(parsed.questionId || parsed.examId || 'qimg')
                .replace(/[^a-zA-Z0-9_-]/g, '-')
                .slice(0, 48) || 'qimg';
              const safeFileName = `${safePrefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
              const destPath = path.resolve(imagesDirPath, safeFileName);
              if (!destPath.startsWith(path.resolve(imagesDirPath) + path.sep)) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: false, error: 'Invalid upload destination' }));
                return;
              }
              const buffer = Buffer.from(base64Data, 'base64');
              fs.writeFileSync(destPath, buffer);

              const publicUrl = `/api/question-image/${safeFileName}`;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({
                success: true,
                path: publicUrl,
                url: publicUrl,
                mimeType,
                bytes: buffer.length
              }));
            } catch (e: any) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: false, error: e?.message || 'Image save failed' }));
            }
          });
          return;
        }

        // 0b. Serve persisted original question images with correct Content-Type & CORP headers
        if (req.url && req.url.startsWith('/api/question-image/')) {
          if (applyMiddlewareCors(req, res, { resourcePolicy: 'cross-origin' })) return;
          if (req.method !== 'GET') {
            res.statusCode = 405;
            res.end('Method not allowed');
            return;
          }
          const rawName = decodeURIComponent(req.url.split('?')[0].replace('/api/question-image/', ''));
          if (!/^[a-zA-Z0-9_.\-]+$/.test(rawName) || rawName.includes('..')) {
            res.statusCode = 400;
            res.end('Invalid image filename');
            return;
          }
          const resolvedBase = path.resolve(imagesDirPath);
          const targetFile = path.resolve(resolvedBase, rawName);
          if (!targetFile.startsWith(resolvedBase + path.sep) || !fs.existsSync(targetFile)) {
            res.statusCode = 404;
            res.end('Image not found');
            return;
          }
          const ext = path.extname(rawName).toLowerCase();
          const ctMap: Record<string, string> = {
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.webp': 'image/webp',
            '.gif': 'image/gif',
            '.svg': 'image/svg+xml'
          };
          res.setHeader('Content-Type', ctMap[ext] || 'application/octet-stream');
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          fs.createReadStream(targetFile).pipe(res);
          return;
        }

        // 1. Exam sync endpoint
        if (req.url && req.url.startsWith('/api/sync-exam')) {
          if (applyMiddlewareCors(req, res, { resourcePolicy: 'cross-origin' })) return;
          res.setHeader('Cache-Control', 'no-store, max-age=0');
          const urlObj = new URL(req.url, 'http://localhost:3000');
          if (req.method === 'POST') {
            const chunks: Buffer[] = [];
            req.on('data', (chunk: Buffer) => { chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)); });
            req.on('end', () => {
              try {
                const body = Buffer.concat(chunks).toString('utf-8');
                const data = JSON.parse(body);
                if (data && (data.code || data.id)) {
                  const codeKey = data.code ? String(data.code).toLowerCase().trim() : '';
                  const idKey = data.id ? String(data.id).toLowerCase().trim() : '';
                  const existing = (codeKey && sharedExamsMap.get(codeKey)) || (idKey && sharedExamsMap.get(idKey)) || {};
                  const mergedQuestions = mergeQuestionsPreservingImages(data.questions, existing.questions);
                  const merged = {
                    ...existing,
                    ...data,
                    questions: mergedQuestions
                  };
                  if (codeKey) sharedExamsMap.set(codeKey, merged);
                  if (idKey) sharedExamsMap.set(idKey, merged);
                  saveExamsToDisk();
                }
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: true, total: sharedExamsMap.size }));
              } catch (e: any) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: e.message }));
              }
            });
            return;
          }

          if (req.method === 'GET') {
            const code = urlObj.searchParams.get('code') || urlObj.searchParams.get('id');
            res.setHeader('Content-Type', 'application/json');
            if (code) {
              const item = sharedExamsMap.get(code.toLowerCase().trim());
              if (item) {
                res.end(JSON.stringify({ success: true, data: item }));
              } else {
                res.statusCode = 404;
                res.end(JSON.stringify({ success: false, error: 'Exam not found' }));
              }
              return;
            }
            const list = Array.from(new Set(sharedExamsMap.values()));
            res.end(JSON.stringify({ success: true, data: list }));
            return;
          }
        }

        // 2. Student registration sync endpoint
        if (req.url && req.url.startsWith('/api/sync-student')) {
          if (applyMiddlewareCors(req, res, { resourcePolicy: 'same-site', restrictReads: true })) return;
          res.setHeader('Cache-Control', 'no-store, max-age=0');
          if (req.method === 'POST') {
            const chunks: Buffer[] = [];
            req.on('data', (chunk: Buffer) => { chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)); });
            req.on('end', () => {
              try {
                const body = Buffer.concat(chunks).toString('utf-8');
                const data = JSON.parse(body);
                if (data && (data.id || data.phone || data.username)) {
                  const { password: _omittedPassword, ...safeStudent } = data;
                  const key = String(safeStudent.phone || safeStudent.id || safeStudent.username).toLowerCase().trim();
                  sharedStudentsMap.set(key, safeStudent);
                  saveStudentsToDisk();
                }
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: true, total: sharedStudentsMap.size }));
              } catch (e: any) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: e.message }));
              }
            });
            return;
          }

          if (req.method === 'GET') {
            res.setHeader('Content-Type', 'application/json');
            const list = Array.from(new Set(sharedStudentsMap.values()));
            res.end(JSON.stringify({ success: true, data: list }));
            return;
          }
        }

        next();
      });
  };

  return {
    name: 'sync-exam-middleware',
    configureServer(server: any) {
      attachMiddlewares(server.middlewares);
    },
    configurePreviewServer(server: any) {
      attachMiddlewares(server.middlewares);
    }
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), syncExamPlugin()],
    resolve: {
      alias: {
        '@': path.resolve('.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
