import React, { useState, useEffect, useMemo } from 'react';
import { usePortal } from '../../context/PortalContext';
import { Share2, X, Copy, Check, MessageSquare, Mail, QrCode, ExternalLink, Download, Play, FileText, Sparkles, AlertCircle } from 'lucide-react';
import QRCode from 'qrcode';
import { Question } from '../../types';
import { resolveExamQuestions, generateExamShareUrl, getShareUrlImageStatus, copyTextToClipboard } from '../../utils/examShare';

export const ShareExamModal: React.FC = () => {
  const {
    activeExamIdForShare,
    setActiveExamIdForShare,
    isAdminAuthenticated,
    currentUser,
    exams,
    questions,
    firebaseAdminEmail,
    signInAdminWithGoogle,
    syncSingleExamToCloud,
    showToast
  } = usePortal();

  const [shareType, setShareType] = useState<'cbt' | 'overview'>('cbt');
  const [copied, setCopied] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [syncStatus, setSyncStatus] = useState<'syncing' | 'synced' | 'error'>('syncing');

  const currentExam = useMemo(() => {
    if (!activeExamIdForShare) return null;
    return (
      exams.find(
        e => e.id.toLowerCase() === activeExamIdForShare.toLowerCase() ||
             e.code.toLowerCase() === activeExamIdForShare.toLowerCase()
      ) || null
    );
  }, [exams, activeExamIdForShare]);

  const relevantQuestions = useMemo(() => {
    if (!currentExam) return [];
    return resolveExamQuestions(currentExam, questions);
  }, [currentExam, questions]);

  const liveStudioUrl = 'https://ais-pre-f7jpkmgt4fqk7n2ogmc4x2-740969633609.asia-southeast1.run.app';
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : liveStudioUrl;
  const isVercelHost = currentOrigin.toLowerCase().includes('vercel.app');

  // Allow switching to public studio link to bypass Vercel "You Need Access" protection
  const [selectedDomain, setSelectedDomain] = useState<'current' | 'aistudio'>(isVercelHost ? 'aistudio' : 'current');

  const activeOrigin = selectedDomain === 'aistudio' ? liveStudioUrl : currentOrigin;
  const slug = encodeURIComponent(currentExam?.code || currentExam?.id || '');

  // 1. Direct CBT Test Link (Students jump directly into the test interface, carrying &q= & &d=)
  const cbtShareUrl = useMemo(() => {
    if (!currentExam) return '';
    return generateExamShareUrl(currentExam, relevantQuestions, activeOrigin, 'cbt');
  }, [activeOrigin, currentExam, relevantQuestions]);

  // 2. Overview / Registration Link (Students read instructions & register details, carrying &q= & &d=)
  const overviewShareUrl = useMemo(() => {
    if (!currentExam) return '';
    return generateExamShareUrl(currentExam, relevantQuestions, activeOrigin, 'overview');
  }, [activeOrigin, currentExam, relevantQuestions]);

  const activeUrl = shareType === 'cbt' ? cbtShareUrl : overviewShareUrl;
  const shareImageStatus = useMemo(
    () => getShareUrlImageStatus(activeUrl, relevantQuestions),
    [activeUrl, relevantQuestions]
  );

  // Short URLs are already compact enough for high-speed smartphone QR scanning
  const qrTargetUrl = activeUrl;

  // Sync exam and all questions + original images to server store and Firestore so short links resolve across devices
  useEffect(() => {
    if (!currentExam) return;
    let cancelled = false;
    setSyncStatus('syncing');

    const payloadExam = {
      ...currentExam,
      questions: relevantQuestions
    };

    const syncAll = async () => {
      let ok = false;
      try {
        const res = await fetch('/api/sync-exam', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payloadExam)
        });
        if (res.ok) ok = true;
      } catch {
        // Static/Vercel runtime may rely on Firestore
      }
      if (firebaseAdminEmail) {
        try {
          await syncSingleExamToCloud(payloadExam);
          ok = true;
        } catch {
          // Handled inside syncSingleExamToCloud
        }
      }
      if (!cancelled) {
        setSyncStatus(ok ? 'synced' : 'error');
      }
    };

    syncAll();
    return () => {
      cancelled = true;
    };
  }, [currentExam, relevantQuestions, firebaseAdminEmail]);

  useEffect(() => {
    // Generate an ultra-scannable, high-contrast QR code compliant with ISO/IEC 18004
    // Pure pitch-black (#000000) on pure white (#FFFFFF) with quiet zone margin of 3
    if (qrTargetUrl) {
      QRCode.toDataURL(qrTargetUrl, {
        width: 360,
        margin: 3,
        errorCorrectionLevel: 'M',
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      })
        .then(url => setQrDataUrl(url))
        .catch(err => {
          console.warn('High-res QR code generation failed, retrying standard mode:', err);
          QRCode.toDataURL(qrTargetUrl, { width: 300, margin: 2, errorCorrectionLevel: 'L' })
            .then(url => setQrDataUrl(url))
            .catch(e => console.error('Fallback QR code failed:', e));
        });
    }
  }, [qrTargetUrl]);

  if (!activeExamIdForShare || !currentExam || !isAdminAuthenticated || currentUser?.role !== 'admin') return null;

  const handleCopyLink = async (url: string, typeKey: string) => {
    await copyTextToClipboard(url);
    setCopied(typeKey);
    showToast(typeKey.startsWith('cbt') ? 'Short CBT Test Link copied!' : 'Short Exam Overview Link copied!');
    setTimeout(() => setCopied(null), 2500);
  };

  const handleWhatsApp = () => {
    let text = '';
    if (shareType === 'cbt') {
      text = encodeURIComponent(
        `🎓 *GYANSAI MATHS IIT CENTER — Online CBT Exam*\n\n` +
        `📝 *Exam:* ${currentExam.title}\n` +
        `📌 *Code:* ${currentExam.code}\n` +
        `⏱️ *Duration:* ${currentExam.durationMinutes} Minutes\n` +
        `🏆 *Marking:* +${currentExam.positiveMarks || 4} / ${currentExam.negativeMarks || -1}\n` +
        `👥 *Class:* Class ${currentExam.targetClass || '11th'}\n\n` +
        `⚡ *Direct Link to Start Online CBT Test:*\n${cbtShareUrl}\n\n` +
        `_Tap the link to open the CBT examination directly on mobile or laptop._`
      );
    } else {
      text = encodeURIComponent(
        `🎓 *GYANSAI MATHS IIT CENTER — Exam Invitation*\n\n` +
        `📝 *Exam:* ${currentExam.title}\n` +
        `📌 *Code:* ${currentExam.code}\n` +
        `⏱️ *Duration:* ${currentExam.durationMinutes} Minutes\n` +
        `👥 *Class:* Class ${currentExam.targetClass || '11th'}\n\n` +
        `👉 *View Guidelines & Attempt:* ${overviewShareUrl}\n\n` +
        `_Read instructions and enter student roll number before starting._`
      );
    }
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const handleEmail = () => {
    const subject = encodeURIComponent(`CBT Examination: ${currentExam.title} - Gyansai Maths IIT Center`);
    const body = encodeURIComponent(
      `Hello Aspirant,\n\nYou are invited to attempt the following online examination:\n\n` +
      `Exam: ${currentExam.title} (${currentExam.code})\n` +
      `Class: Class ${currentExam.targetClass || '11th'}\n` +
      `Duration: ${currentExam.durationMinutes} mins\n` +
      `Total Marks: ${currentExam.totalMarks || 100}\n\n` +
      `⚡ Start CBT Test directly:\n${cbtShareUrl}\n\n` +
      `📋 Exam Guidelines & Syllabus:\n${overviewShareUrl}\n\n` +
      `Best regards,\nGyansai Maths IIT Center`
    );
    window.open(`mailto:?subject=${subject}&body=${body}`);
  };

  const handleTestLinkInNewTab = () => {
    window.open(activeUrl, '_blank');
  };

  const handleDownloadQr = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    const cleanCode = (currentExam.code || 'exam').replace(/[^a-zA-Z0-9_-]/g, '_');
    const suffix = shareType === 'cbt' ? 'Direct_CBT' : 'Overview';
    a.download = `GYANSAI_${cleanCode}_${suffix}_QR.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast(`QR Code (${suffix}) downloaded as high-res PNG!`);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-2xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-lg border border-gray-200 shadow-2xl max-w-xl w-full my-auto overflow-hidden animate-in fade-in zoom-in-95 duration-100">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-gray-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-2 text-gray-900 font-bold text-sm">
            <Share2 className="w-4 h-4 text-[#002FA7]" />
            <span>Share Online Examination to Students</span>
          </div>
          <button
            type="button"
            onClick={() => setActiveExamIdForShare(null)}
            className="text-gray-400 hover:text-gray-700 cursor-pointer p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 space-y-4 font-sans text-xs">
          {/* Exam Details Header Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-1.5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#002FA7] bg-blue-50 border border-blue-200 px-2 py-0.5 rounded inline-block mb-1">
                  // EXAM PAPER READY TO SHARE
                </span>
                <h3 className="font-extrabold text-base text-gray-950">
                  {currentExam.title}
                </h3>
              </div>
              <div className="flex items-center space-x-1.5 shrink-0">
                <span className="font-mono text-[11px] font-bold text-[#002FA7] bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                  {currentExam.code}
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                  (currentExam.targetClass || '').includes('12')
                    ? 'bg-purple-50 text-purple-700 border-purple-200'
                    : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                }`}>
                  Class: {currentExam.targetClass || '11th'}
                </span>
              </div>
            </div>

            <p className="text-gray-500 font-mono text-[11px] flex flex-wrap items-center gap-x-1.5 gap-y-1">
              <span>Duration: {currentExam.durationMinutes} mins &bull; Scheme: +{currentExam.positiveMarks || 4} / {currentExam.negativeMarks || -1} &bull;</span>
              <span className={relevantQuestions.length === 0 ? "text-amber-700 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200" : "text-[#002FA7] font-bold"}>
                {relevantQuestions.length} Questions
              </span>
              <span>&bull;</span>
              <span className={syncStatus === 'synced' ? 'text-emerald-700 font-bold' : syncStatus === 'syncing' ? 'text-blue-700 font-semibold' : 'text-amber-700 font-semibold'}>
                {syncStatus === 'syncing' ? 'Syncing paper...' : syncStatus === 'synced' ? 'Short link ready' : 'Local browser only'}
              </span>
            </p>
          </div>

          {relevantQuestions.length === 0 && (
            <div className="p-2.5 bg-amber-50 border border-amber-300 rounded text-amber-900 text-[11px] flex items-center justify-between">
              <span>⚠️ <strong>Notice:</strong> This exam currently has <strong>0 questions</strong> assigned. Candidates will see an empty test. Use <strong>Manage Questions</strong> in Exam Management to add questions.</span>
            </div>
          )}

          {!firebaseAdminEmail && (
            <div className="p-2.5 bg-blue-50 border border-blue-300 rounded-lg text-blue-950 text-[11px] flex flex-wrap items-center justify-between gap-2">
              <span>
                <strong>Sync for Student Mobile Links:</strong> Sign in with Google so short links (<code>/?cbt={slug}</code>) load all questions &amp; original images on student phones and Published Live URL.
              </span>
              <button
                type="button"
                onClick={async () => {
                  const res = await signInAdminWithGoogle();
                  if (!res.success && res.error) {
                    showToast(res.error, 'error');
                  }
                }}
                className="px-3 py-1 bg-[#002FA7] hover:bg-blue-800 text-white font-bold rounded text-[11px] cursor-pointer shrink-0"
              >
                Connect Google Cloud Sync
              </button>
            </div>
          )}

          {firebaseAdminEmail && shareImageStatus.oversizedImages > 0 && (
            <div className="p-2.5 bg-amber-50 border border-amber-300 rounded-lg text-amber-950 text-[11px]">
              <strong>Large Image Notice:</strong> {shareImageStatus.oversizedImages} uploaded question image(s) exceed Firestore&apos;s 890KB limit. Re-uploading or keeping images under 890KB ensures instant cloud sync across all phones.
            </div>
          )}

          {/* Vercel Deployment Protection & Domain Switcher Alert */}
          {isVercelHost ? (
            <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg text-amber-950 space-y-1.5 text-[11px]">
              <div className="font-bold flex items-center space-x-1.5 text-amber-900">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Fix Vercel "You Need Access" Screen for Students:</span>
              </div>
              <p className="leading-relaxed">
                Vercel preview URLs enable <strong>Vercel Authentication</strong> by default, which displays a black "You Need Access" screen to students.
                To allow students to open without login: Go to <strong>Vercel Dashboard → Project Settings → Deployment Protection → Turn Off "Vercel Authentication"</strong>.
              </p>
              <div className="pt-1 flex flex-wrap items-center gap-1.5">
                <span className="text-gray-600 font-semibold">Active Share URL:</span>
                <button
                  type="button"
                  onClick={() => setSelectedDomain('aistudio')}
                  className={`px-2.5 py-1 rounded text-[10px] font-bold cursor-pointer transition ${
                    selectedDomain === 'aistudio'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  ✓ AI Studio Public URL (No Login Needed &bull; Recommended)
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDomain('current')}
                  className={`px-2.5 py-1 rounded text-[10px] font-bold cursor-pointer transition ${
                    selectedDomain === 'current'
                      ? 'bg-[#002FA7] text-white shadow-xs'
                      : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Vercel App Domain
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px] px-1 text-slate-500">
                <span className="font-semibold text-slate-700">Link Domain:</span>
                <div className="flex items-center space-x-1 font-mono">
                  <button
                    type="button"
                    onClick={() => setSelectedDomain('current')}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                      selectedDomain === 'current' ? 'bg-[#002FA7] text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Current Domain
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedDomain('aistudio')}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                      selectedDomain === 'aistudio' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Public Live URL
                  </button>
                </div>
              </div>
              {selectedDomain === 'aistudio' && currentOrigin !== liveStudioUrl && (
                <p className="text-[10px] text-slate-500 px-1">
                  Note: Public Live URL runs your last <strong>Published</strong> build. Click Publish in AI Studio after portal updates.
                </p>
              )}
            </div>
          )}

          {/* Share Mode Selector Tabs: Direct CBT vs Overview */}
          <div>
            <div className="text-[11px] font-mono font-bold text-gray-700 uppercase mb-1.5">
              Select Sharing Method for Students:
            </div>
            <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 rounded-lg border border-gray-200">
              <button
                type="button"
                onClick={() => setShareType('cbt')}
                className={`py-2 px-3 rounded-md font-bold text-xs flex items-center justify-center space-x-2 transition cursor-pointer ${
                  shareType === 'cbt'
                    ? 'bg-[#002FA7] text-white shadow-xs'
                    : 'text-gray-700 hover:bg-gray-200/70'
                }`}
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>⚡ Direct Test CBT Link</span>
              </button>

              <button
                type="button"
                onClick={() => setShareType('overview')}
                className={`py-2 px-3 rounded-md font-bold text-xs flex items-center justify-center space-x-2 transition cursor-pointer ${
                  shareType === 'overview'
                    ? 'bg-[#002FA7] text-white shadow-xs'
                    : 'text-gray-700 hover:bg-gray-200/70'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>📋 Overview & Details Link</span>
              </button>
            </div>
          </div>

          {/* Context Explanatory Banner */}
          <div className="p-2.5 bg-blue-50/70 border border-blue-200 rounded-md text-[11px] text-blue-900 leading-relaxed">
            {shareType === 'cbt' ? (
              <p>
                <strong>⚡ Direct CBT Test Link:</strong> When students tap this link on mobile or desktop, they <strong>instantly enter the online CBT exam console</strong> with the real-time countdown timer, question palette, diagram zooms, and submission options.
              </p>
            ) : (
              <p>
                <strong>📋 Overview & Registration Link:</strong> Students first view the exam guidelines, syllabus breakdown, and enter their roll number/phone before clicking to launch the CBT test.
              </p>
            )}
          </div>

          {/* Active URL Box */}
          <div className="p-3 bg-gray-50 border border-gray-200 rounded-md space-y-1.5">
            <div className="flex items-center justify-between text-[10px] text-gray-500 font-mono gap-2">
              <div className="flex items-center space-x-2">
                <span className="font-bold text-gray-700 uppercase">
                  {shareType === 'cbt' ? '⚡ Direct Student CBT Link' : '📋 Official Overview Link'}
                </span>
                <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
                  {activeUrl.length} chars · Short
                </span>
              </div>
              <button
                type="button"
                onClick={handleTestLinkInNewTab}
                className="text-[#002FA7] hover:underline font-bold flex items-center space-x-1 cursor-pointer shrink-0"
              >
                <span>{shareType === 'cbt' ? 'Test CBT Now' : 'Test Overview'}</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </button>
            </div>
            <div className="p-2 bg-white border border-gray-300 rounded font-mono text-[11px] text-gray-900 break-all select-all shadow-2xs font-semibold">
              {activeUrl}
            </div>
          </div>

          {/* Quick Action Buttons Grid (Copy, WhatsApp, Email) */}
          <div className="grid grid-cols-3 gap-2.5">
            <button
              type="button"
              onClick={() => handleCopyLink(activeUrl, shareType)}
              className="py-2.5 px-3 bg-[#002FA7] hover:bg-blue-800 text-white font-bold rounded flex items-center justify-center space-x-1.5 cursor-pointer shadow-2xs transition active:scale-98"
            >
              {copied === shareType ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4 text-white" />}
              <span>{copied === shareType ? 'Copied Link!' : (shareType === 'cbt' ? 'Copy CBT Link' : 'Copy Link')}</span>
            </button>

            <button
              type="button"
              onClick={handleWhatsApp}
              className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded flex items-center justify-center space-x-1.5 cursor-pointer shadow-2xs transition active:scale-98"
            >
              <MessageSquare className="w-4 h-4" />
              <span>WhatsApp</span>
            </button>

            <button
              type="button"
              onClick={handleEmail}
              className="py-2.5 px-3 bg-white border border-gray-300 hover:bg-gray-50 text-gray-800 font-semibold rounded flex items-center justify-center space-x-1.5 cursor-pointer shadow-2xs transition"
            >
              <Mail className="w-4 h-4 text-gray-600" />
              <span>Email</span>
            </button>
          </div>

          {/* Quick Copy Shortcut for Both Links */}
          <div className="pt-2 border-t border-gray-200">
            <div className="text-[10px] font-mono font-bold text-gray-500 uppercase mb-1.5">
              Quick 1-Click Copy Links:
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
              <div className="p-2 bg-slate-50 border border-slate-200 rounded flex items-center justify-between">
                <div className="truncate mr-2">
                  <span className="font-bold text-slate-800 block">⚡ Direct CBT Link</span>
                  <span className="font-mono text-[10px] text-slate-500 truncate block">/?cbt={slug}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopyLink(cbtShareUrl, 'cbt_quick')}
                  className="px-2 py-1 bg-white hover:bg-blue-50 border border-gray-300 text-[#002FA7] rounded font-bold text-[10px] shrink-0 cursor-pointer"
                >
                  {copied === 'cbt_quick' ? '✓ Copied' : 'Copy'}
                </button>
              </div>

              <div className="p-2 bg-slate-50 border border-slate-200 rounded flex items-center justify-between">
                <div className="truncate mr-2">
                  <span className="font-bold text-slate-800 block">📋 Overview Link</span>
                  <span className="font-mono text-[10px] text-slate-500 truncate block">/?exam={slug}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopyLink(overviewShareUrl, 'overview_quick')}
                  className="px-2 py-1 bg-white hover:bg-gray-100 border border-gray-300 text-gray-700 rounded font-bold text-[10px] shrink-0 cursor-pointer"
                >
                  {copied === 'overview_quick' ? '✓ Copied' : 'Copy'}
                </button>
              </div>
            </div>
          </div>

          {/* QR Code Graphic Display - High Contrast & Decodable */}
          <div className="pt-3 flex flex-col items-center justify-center border-t border-gray-200">
            <div className="flex items-center justify-between w-full mb-2">
              <span className="text-[11px] font-mono font-bold text-gray-700 uppercase flex items-center space-x-1">
                <QrCode className="w-3.5 h-3.5 text-[#002FA7]" />
                <span>
                  {shareType === 'cbt'
                    ? 'Instant Mobile QR (Scan to Start CBT Test)'
                    : 'Overview Mobile QR (Scan for Guidelines)'}
                </span>
              </span>
              <button
                type="button"
                onClick={handleDownloadQr}
                disabled={!qrDataUrl}
                className="text-[11px] font-bold text-[#002FA7] hover:underline flex items-center space-x-1 cursor-pointer disabled:opacity-50"
              >
                <Download className="w-3 h-3" />
                <span>Download PNG</span>
              </button>
            </div>

            <div className="p-3.5 bg-white border-2 border-gray-900 rounded-xl shadow-md">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="High contrast exam QR code"
                  className="w-44 h-44 object-contain rendering-pixelated"
                />
              ) : (
                <div className="w-44 h-44 bg-gray-100 flex items-center justify-center text-gray-400">
                  Generating Ultra-Clean QR...
                </div>
              )}
            </div>

            <div className="flex items-center space-x-2 mt-2.5">
              <button
                type="button"
                onClick={handleDownloadQr}
                className="px-3.5 py-1.5 bg-gray-900 hover:bg-gray-800 text-white rounded text-[11px] font-semibold flex items-center space-x-1.5 cursor-pointer shadow-2xs transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download QR Code (PNG)</span>
              </button>
              <button
                type="button"
                onClick={() => handleCopyLink(activeUrl, shareType)}
                className="px-3 py-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded text-[11px] font-semibold flex items-center space-x-1 cursor-pointer transition"
              >
                <Copy className="w-3 h-3 text-[#002FA7]" />
                <span>Copy URL</span>
              </button>
            </div>

            <p className="text-[10px] text-gray-500 font-mono mt-2 text-center max-w-sm">
              Instant autofocus & decoding on all smartphone cameras (Google Lens, iOS Camera, WhatsApp, and QR Scanners).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
