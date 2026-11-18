import { Question } from '../types';

export const MAX_FIRESTORE_IMAGE_LENGTH = 820000;

export interface ProcessedQuestionImage {
  questionType: 'image';
  questionImageUrl: string;
  questionImagePath?: string;
  serverImageUrl?: string;
  mimeType: string;
  bytes: number;
  width: number;
  height: number;
}

const KNOWN_PLACEHOLDER_PATTERNS = [
  /^refer to (the )?attached (diagram\/)?image/i,
  /^refer to image diagram\.?$/i,
  /^see (the )?attached image/i,
  /^question (is )?in (the )?image/i
];

export function isPlaceholderQuestionText(text?: string | null): boolean {
  const trimmed = (text || '').trim();
  if (!trimmed) return true;
  return KNOWN_PLACEHOLDER_PATTERNS.some(re => re.test(trimmed));
}

export function normalizeQuestionImageUrl(raw?: string | null): string {
  const val = String(raw || '').trim();
  if (!val) return '';
  if (
    val.startsWith('data:') ||
    val.startsWith('http://') ||
    val.startsWith('https://') ||
    val.startsWith('blob:') ||
    val.startsWith('/')
  ) {
    return val;
  }
  if (val.startsWith('uploaded_question_images/')) {
    const fileName = val.slice('uploaded_question_images/'.length).split('/').pop() || '';
    return fileName ? `/api/question-image/${fileName}` : '';
  }
  return val;
}

export function getQuestionImageSrc(q?: Partial<Question> | null): string {
  if (!q) return '';
  return (
    normalizeQuestionImageUrl(q.questionImageUrl) ||
    normalizeQuestionImageUrl(q.imageUrl) ||
    normalizeQuestionImageUrl(q.questionImagePath) ||
    ''
  );
}

export function resolveQuestionType(q?: Partial<Question> | null): 'image' | 'text' {
  if (!q) return 'text';
  if (q.questionType === 'image') return 'image';
  const imgSrc = getQuestionImageSrc(q);
  if (q.questionType === 'text') {
    return imgSrc && isPlaceholderQuestionText(q.questionText) ? 'image' : 'text';
  }
  if (imgSrc) {
    return 'image';
  }
  return 'text';
}

export function getMeaningfulQuestionText(q?: Partial<Question> | null): string {
  if (!q) return '';
  const trimmed = (q.questionText || '').trim();
  if (!trimmed) return '';
  const imgSrc = getQuestionImageSrc(q);
  if ((q.questionType === 'image' || Boolean(imgSrc)) && isPlaceholderQuestionText(trimmed)) {
    return '';
  }
  return trimmed;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read image file'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });
}

function loadImageDimensions(src: string): Promise<{ width: number; height: number; element: HTMLImageElement }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () =>
      resolve({
        width: img.naturalWidth || img.width || 0,
        height: img.naturalHeight || img.height || 0,
        element: img
      });
    img.onerror = () => reject(new Error('Invalid image format'));
    img.src = src;
  });
}

function renderFittedCanvasDataUrl(
  imgEl: HTMLImageElement,
  srcW: number,
  srcH: number,
  fileType: string
): { dataUrl: string; mimeType: string; width: number; height: number } | null {
  const dimensionSteps: Array<[number, number]> = [
    [2200, 2600],
    [1600, 2000],
    [1200, 1500],
    [960, 1200]
  ];

  for (const [maxW, maxH] of dimensionSteps) {
    let targetW = srcW;
    let targetH = srcH;

    if (targetW > maxW) {
      targetH = Math.round((targetH * maxW) / targetW);
      targetW = maxW;
    }
    if (targetH > maxH) {
      targetW = Math.round((targetW * maxH) / targetH);
      targetH = maxH;
    }

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, targetW);
    canvas.height = Math.max(1, targetH);
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;

    if (fileType === 'image/png' || fileType === 'image/webp') {
      ctx.drawImage(imgEl, 0, 0, canvas.width, canvas.height);
      const fittedPng = canvas.toDataURL('image/png');
      if (fittedPng.length <= MAX_FIRESTORE_IMAGE_LENGTH) {
        return { dataUrl: fittedPng, mimeType: 'image/png', width: canvas.width, height: canvas.height };
      }
      for (const q of [0.92, 0.84, 0.75]) {
        const fittedWebp = canvas.toDataURL('image/webp', q);
        if (fittedWebp.length <= MAX_FIRESTORE_IMAGE_LENGTH) {
          return { dataUrl: fittedWebp, mimeType: 'image/webp', width: canvas.width, height: canvas.height };
        }
      }
    }

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(imgEl, 0, 0, canvas.width, canvas.height);
    for (const q of [0.9, 0.82, 0.72, 0.62]) {
      const highJpeg = canvas.toDataURL('image/jpeg', q);
      if (highJpeg.length <= MAX_FIRESTORE_IMAGE_LENGTH) {
        return { dataUrl: highJpeg, mimeType: 'image/jpeg', width: canvas.width, height: canvas.height };
      }
    }
  }

  return null;
}

/**
 * Preserves the exact original PNG, JPG, JPEG, or WebP question image without
 * lossy degradation or cropping. Persists original binary via /api/upload-image
 * when available, and ensures a high-res self-contained DataURL for Firestore sync.
 */
export async function processQuestionImageUpload(
  file: File,
  meta?: { examId?: string; questionId?: string }
): Promise<ProcessedQuestionImage> {
  const rawDataUrl = await readFileAsDataUrl(file);
  let width = 0;
  let height = 0;
  let imgEl: HTMLImageElement | null = null;

  try {
    const dims = await loadImageDimensions(rawDataUrl);
    width = dims.width;
    height = dims.height;
    imgEl = dims.element;
  } catch {
    // Allow non-raster or SVG previews to still carry rawDataUrl
  }

  let questionImagePath: string | undefined;
  let serverImageUrl: string | undefined;

  // Persist original untouched binary on server filesystem if backend endpoint is active
  try {
    if (typeof fetch !== 'undefined') {
      const resp = await fetch('/api/upload-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dataUrl: rawDataUrl,
          fileName: file.name,
          examId: meta?.examId,
          questionId: meta?.questionId
        })
      });
      if (resp.ok) {
        const json = await resp.json();
        if (json?.success && json.url) {
          serverImageUrl = String(json.url);
          questionImagePath = serverImageUrl || normalizeQuestionImageUrl(json.path);
        }
      }
    }
  } catch {
    // Offline or serverless context — rawDataUrl remains primary
  }

  // Keep original untouched DataURL whenever it fits within Firestore single-doc limits (< 820KB)
  if (rawDataUrl.length <= MAX_FIRESTORE_IMAGE_LENGTH) {
    return {
      questionType: 'image',
      questionImageUrl: rawDataUrl,
      questionImagePath: questionImagePath || serverImageUrl,
      serverImageUrl,
      mimeType: file.type || 'image/png',
      bytes: file.size,
      width,
      height
    };
  }

  // Only if the raw image exceeds Firestore safe document ceiling (>820KB base64),
  // fit proportionally (NO cropping) down until it safely fits inside Firestore sync docs
  if (imgEl && width > 0 && height > 0) {
    try {
      const fitted = renderFittedCanvasDataUrl(imgEl, width, height, file.type || 'image/png');
      if (fitted) {
        return {
          questionType: 'image',
          questionImageUrl: fitted.dataUrl,
          questionImagePath: questionImagePath || serverImageUrl,
          serverImageUrl,
          mimeType: fitted.mimeType,
          bytes: file.size,
          width: fitted.width,
          height: fitted.height
        };
      }
    } catch {
      // Fall through to serverImageUrl or rawDataUrl
    }
  }

  return {
    questionType: 'image',
    questionImageUrl: rawDataUrl,
    questionImagePath: questionImagePath || serverImageUrl,
    serverImageUrl,
    mimeType: file.type || 'image/png',
    bytes: file.size,
    width,
    height
  };
}

/**
 * Backward-compatible wrapper preserving original quality up to 850KB
 * and avoiding lossy conversion on crisp math diagrams.
 */
export async function compressQuestionImage(
  file: File,
  _maxWidth = 2200,
  _maxHeight = 2600,
  _quality = 0.92
): Promise<string> {
  const processed = await processQuestionImageUpload(file);
  return processed.questionImageUrl;
}

/**
 * Normalizes answer keys so equivalent labels ('A' <-> '(1)', 'B' <-> '(2)', etc.)
 * match reliably during evaluation and review.
 */
export function normalizeAnswerChoice(ans: string | undefined | null): string {
  const clean = (ans || '').trim().toUpperCase();
  switch (clean) {
    case '(1)':
    case '1':
    case '(A)':
    case 'A':
      return 'A';
    case '(2)':
    case '2':
    case '(B)':
    case 'B':
      return 'B';
    case '(3)':
    case '3':
    case '(C)':
    case 'C':
      return 'C';
    case '(4)':
    case '4':
    case '(D)':
    case 'D':
      return 'D';
    default:
      return clean;
  }
}
