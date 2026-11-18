import React, { useState, useRef, useEffect } from 'react';
import { usePortal } from '../../context/PortalContext';
import { X, Upload, Save, Plus, Share2, Folder, CheckCircle2 } from 'lucide-react';
import { Question } from '../../types';
import { processQuestionImageUpload } from '../../utils/imageCompress';

export const CreateQuestionModal: React.FC = () => {
  const {
    createQuestionModalOpen,
    setCreateQuestionModalOpen,
    activeTargetExamIdForQuestion,
    setActiveTargetExamIdForQuestion,
    activeTargetFolderIdForQuestion,
    setActiveTargetFolderIdForQuestion,
    exams,
    folders,
    addQuestion,
    attachQuestionToExam,
    setActiveExamIdForShare,
    setActiveAdminTab,
    showToast
  } = usePortal();

  const [currentQIndex, setCurrentQIndex] = useState(1);
  const [sessionSavedCount, setSessionSavedCount] = useState(0);
  const [selectedExamId, setSelectedExamId] = useState<string>('');
  const [targetClass, setTargetClass] = useState<string>('11th');
  const [questionText, setQuestionText] = useState('');
  const [questionType, setQuestionType] = useState('MCQ — Single');
  const [correctAnswer, setCorrectAnswer] = useState<'A' | 'B' | 'C' | 'D'>('A');
  const [numericalAnswer, setNumericalAnswer] = useState('');
  const [marksPositive, setMarksPositive] = useState(4);
  const [marksNegative, setMarksNegative] = useState(1);
  const [uploadedImage, setUploadedImage] = useState<string>('');
  const [uploadedImagePath, setUploadedImagePath] = useState<string>('');
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [lastSavedFingerprint, setLastSavedFingerprint] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const computeCurrentFingerprint = () =>
    JSON.stringify({
      selectedExamId,
      targetClass,
      questionText: questionText.trim(),
      uploadedImage,
      questionType,
      correctAnswer: questionType === 'Numerical Value' ? numericalAnswer.trim() : correctAnswer,
      marksPositive,
      marksNegative
    });

  // Auto-preselect the newly created exam folder when opened from CreateFolderModal
  useEffect(() => {
    if (!createQuestionModalOpen) return;

    if (activeTargetExamIdForQuestion) {
      setSelectedExamId(activeTargetExamIdForQuestion);
      const matchedExam = exams.find(
        e => e.id === activeTargetExamIdForQuestion || e.code === activeTargetExamIdForQuestion
      );
      if (matchedExam) {
        setTargetClass(matchedExam.targetClass || '11th');
        setMarksPositive(matchedExam.positiveMarks || 4);
        setMarksNegative(Math.abs(matchedExam.negativeMarks ?? 1));
        const existingCount = matchedExam.questions?.length || matchedExam.sections?.flatMap(s => s.questionIds || []).length || 0;
        setCurrentQIndex(existingCount + 1);
      }
    } else if (activeTargetFolderIdForQuestion) {
      const matchedExam = exams.find(e => e.folderId === activeTargetFolderIdForQuestion);
      if (matchedExam) {
        setSelectedExamId(matchedExam.id);
        setTargetClass(matchedExam.targetClass || '11th');
      }
    } else {
      setSelectedExamId('');
      setCurrentQIndex(1);
    }
    setSessionSavedCount(0);
    setLastSavedFingerprint('');
  }, [createQuestionModalOpen, activeTargetExamIdForQuestion, activeTargetFolderIdForQuestion]);

  if (!createQuestionModalOpen) return null;

  const selectedExam = exams.find(e => e.id === selectedExamId);
  const selectedFolder = selectedExam
    ? folders.find(f => f.id === selectedExam.folderId)
    : folders.find(f => f.id === activeTargetFolderIdForQuestion);

  const handleExamSelectChange = (examId: string) => {
    setSelectedExamId(examId);
    const ex = exams.find(item => item.id === examId);
    if (ex) {
      if (ex.targetClass) setTargetClass(ex.targetClass);
      setMarksPositive(ex.positiveMarks || 4);
      setMarksNegative(Math.abs(ex.negativeMarks ?? 1));
    }
  };

  const handleImageFile = async (file: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('Please select a valid image file (PNG, JPG, WebP).', 'error');
      return;
    }
    setIsProcessingImage(true);
    try {
      const processed = await processQuestionImageUpload(file, {
        examId: selectedExamId || undefined
      });
      setUploadedImage(processed.questionImageUrl);
      setUploadedImagePath(processed.questionImagePath || processed.serverImageUrl || '');
      showToast('Original question image attached!');
    } catch (err) {
      console.error('Failed to process uploaded question image:', err);
      showToast('Failed to read image file. Please try another image.', 'error');
    } finally {
      setIsProcessingImage(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleImageFile(e.dataTransfer.files[0]);
    }
  };

  const resetCurrentFields = () => {
    setQuestionText('');
    setUploadedImage('');
    setUploadedImagePath('');
    setNumericalAnswer('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const saveCurrentQuestion = (): Question | null => {
    const trimmedText = questionText.trim();
    if (!trimmedText && !uploadedImage) {
      showToast('Please type question text or upload a question image.', 'error');
      return null;
    }

    if (questionType === 'Numerical Value' && !numericalAnswer.trim()) {
      showToast('Please enter the correct numerical answer.', 'error');
      return null;
    }

    const effectiveFolderId = selectedExam?.folderId || selectedFolder?.id || activeTargetFolderIdForQuestion || undefined;
    const effectiveFolderName = selectedExam?.folderName || selectedFolder?.name || undefined;
    const tagPrefix = targetClass === 'MHT-CET' ? 'CET' : `${targetClass} JEE`;
    const finalCorrectAnswer = questionType === 'Numerical Value' ? numericalAnswer.trim() : correctAnswer;
    const posMarks = Number(marksPositive) || 4;
    const negMarks = -Math.abs(Number(marksNegative) || 0);
    const resolvedQType: 'image' | 'text' = uploadedImage ? 'image' : 'text';

    const newQData: Omit<Question, 'id' | 'createdAt'> = {
      examId: selectedExamId || undefined,
      code: `MATH-Q${currentQIndex}-${Date.now().toString().slice(-4)}`,
      subject: 'Mathematics',
      chapter: effectiveFolderName || 'JEE & Entrance Exam Practice',
      topic: effectiveFolderName || 'JEE & Entrance Exam Practice',
      type: questionType === 'Numerical Value' ? 'numerical' : questionType === 'MCQ — Multiple' ? 'multiple_choice' : 'single_choice',
      questionType: resolvedQType,
      difficulty: 'Moderate',
      tag: tagPrefix,
      targetClass: targetClass === 'MHT-CET' ? '12th' : targetClass,
      folderId: effectiveFolderId,
      folderName: effectiveFolderName,
      year: `[${new Date().getFullYear()}]`,
      questionText: trimmedText,
      questionImageUrl: uploadedImage || undefined,
      questionImagePath: uploadedImagePath || undefined,
      imageUrl: uploadedImage || undefined,
      options: questionType === 'Numerical Value' ? [] : [
        { id: 'opt-1', label: 'A', text: 'Option A' },
        { id: 'opt-2', label: 'B', text: 'Option B' },
        { id: 'opt-3', label: 'C', text: 'Option C' },
        { id: 'opt-4', label: 'D', text: 'Option D' }
      ],
      correctAnswer: finalCorrectAnswer,
      marks: posMarks,
      negativeMarks: negMarks,
      marksPositive: posMarks,
      marksNegative: negMarks,
      explanation: `Correct answer is ${finalCorrectAnswer}. Marks awarded: +${marksPositive}, penalty: -${Math.abs(marksNegative)}.`
    };

    const createdQ = addQuestion(newQData);

    // Attach immediately to the target Exam & sync to backend!
    if (selectedExamId) {
      attachQuestionToExam(createdQ, selectedExamId);
    }

    setLastSavedFingerprint(computeCurrentFingerprint());
    setSessionSavedCount(prev => prev + 1);
    return createdQ;
  };

  const handleSaveCurrent = (proceedToNext = false, finish = false, shareAfterFinish = false) => {
    const hasUnsavedInput = Boolean(questionText.trim() || uploadedImage);
    const currentFingerprint = computeCurrentFingerprint();
    const isAlreadySavedCurrent = Boolean(lastSavedFingerprint && lastSavedFingerprint === currentFingerprint);

    // Allow finishing cleanly if user already saved >=1 question and clicked Finish without new edits
    if (finish && (!hasUnsavedInput || isAlreadySavedCurrent) && sessionSavedCount > 0) {
      finalizeModal(shareAfterFinish);
      return;
    }

    if (isAlreadySavedCurrent) {
      if (proceedToNext) {
        setCurrentQIndex(prev => prev + 1);
        resetCurrentFields();
        setLastSavedFingerprint('');
        showToast(`Ready for Q${currentQIndex + 1}.`);
      } else {
        showToast(`Q${currentQIndex} is already saved.`);
      }
      return;
    }

    const saved = saveCurrentQuestion();
    if (!saved) return;

    if (finish) {
      finalizeModal(shareAfterFinish);
    } else if (proceedToNext) {
      showToast(
        selectedExam
          ? `Q${currentQIndex} saved & attached to "${selectedExam.title}"! Ready for Q${currentQIndex + 1}.`
          : `Q${currentQIndex} saved to Question Bank! Ready for Q${currentQIndex + 1}.`
      );
      setCurrentQIndex(prev => prev + 1);
      resetCurrentFields();
      setLastSavedFingerprint('');
    } else {
      showToast(
        selectedExam
          ? `Q${currentQIndex} saved & attached to "${selectedExam.title}".`
          : `Q${currentQIndex} saved to Question Bank.`
      );
    }
  };

  const finalizeModal = (openShare: boolean) => {
    const examToShare = selectedExam;
    setCreateQuestionModalOpen(false);
    setActiveTargetExamIdForQuestion(null);
    setActiveTargetFolderIdForQuestion(null);
    setCurrentQIndex(1);
    setLastSavedFingerprint('');
    resetCurrentFields();

    if (openShare && examToShare) {
      setActiveAdminTab('Exams');
      setActiveExamIdForShare(examToShare.id);
      showToast(`All questions attached to "${examToShare.title}" (${examToShare.code})! Ready to share link.`);
    } else if (examToShare) {
      showToast(`Questions saved & assigned to Class ${examToShare.targetClass || targetClass} exam "${examToShare.title}"!`);
    } else {
      showToast('Questions saved to Question Bank!');
    }
  };

  const handleClose = () => {
    setCreateQuestionModalOpen(false);
    setActiveTargetExamIdForQuestion(null);
    setActiveTargetFolderIdForQuestion(null);
    setLastSavedFingerprint('');
    resetCurrentFields();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-2xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-md border border-gray-200 shadow-2xl max-w-xl w-full overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-100 font-sans text-xs">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center space-x-2.5 flex-wrap gap-1">
            <h2 className="text-sm font-bold text-gray-900 tracking-tight">
              Create Question
            </h2>
            <span className="px-2 py-0.5 bg-[#002FA7] text-white font-bold text-xs rounded-xs tracking-wider">
              Q{currentQIndex}
            </span>
            {sessionSavedCount > 0 && (
              <span className="px-2 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold text-[11px] rounded flex items-center space-x-1">
                <CheckCircle2 className="w-3 h-3" />
                <span>{sessionSavedCount} Attached</span>
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-700 cursor-pointer p-1 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Target Exam / Folder & Class Assignment Bar */}
        <div className="px-6 py-3 bg-blue-50/70 border-b border-blue-200 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-[#002FA7] mb-1 flex items-center space-x-1">
              <Folder className="w-3 h-3" />
              <span>Assign to Exam Folder / Paper *</span>
            </label>
            <select
              value={selectedExamId}
              onChange={e => handleExamSelectChange(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-white border border-blue-300 rounded text-xs font-semibold text-gray-900 focus:outline-none focus:border-[#002FA7]"
            >
              <option value="">Question Bank Only (Unassigned)</option>
              {exams.map(ex => (
                <option key={ex.id} value={ex.id}>
                  [{ex.code}] {ex.title} ({ex.folderName || 'General'} &bull; Class {ex.targetClass || '11th'})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#002FA7] mb-1">
              Target Class *
            </label>
            <select
              value={targetClass}
              onChange={e => setTargetClass(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-white border border-blue-300 rounded text-xs font-semibold text-gray-900 focus:outline-none focus:border-[#002FA7]"
            >
              <option value="11th">Class 11th</option>
              <option value="12th">Class 12th</option>
              <option value="MHT-CET">MHT-CET</option>
              <option value="Repeater">Repeater Batch</option>
              <option value="Foundation">Foundation</option>
            </select>
          </div>
        </div>

        {/* Modal Form Body */}
        <div className="p-6 space-y-4">
          {/* 1. Question text */}
          <div>
            <label className="block text-xs font-semibold text-gray-800 mb-1">
              Question text (optional if problem is in image)
            </label>
            <textarea
              rows={3}
              placeholder="Type the question (or upload an image below)"
              value={questionText}
              onChange={e => setQuestionText(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-gray-300 rounded text-xs text-gray-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 leading-relaxed"
            />
          </div>

          {/* 2. Image Drag & Drop Container */}
          <div>
            <label className="block text-xs font-semibold text-gray-800 mb-1">
              Question Image / Diagram
            </label>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              onChange={e => {
                if (e.target.files && e.target.files[0]) {
                  handleImageFile(e.target.files[0]);
                }
              }}
              className="hidden"
            />

            {!uploadedImage ? (
              <div
                onDragOver={e => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => !isProcessingImage && fileInputRef.current?.click()}
                className="border border-dashed border-gray-300 rounded p-5 text-center bg-white hover:bg-gray-50/50 cursor-pointer transition select-none"
              >
                <div className="w-8 h-8 mx-auto mb-1 flex items-center justify-center text-blue-600">
                  <Upload className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div className="text-xs text-gray-600">
                  {isProcessingImage ? (
                    <span className="text-blue-700 font-semibold">Processing &amp; saving original question image...</span>
                  ) : (
                    <>
                      Drag &amp; drop or{' '}
                      <span className="text-blue-600 underline font-medium">browse question image (PNG, JPG, JPEG, WebP)</span>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="relative border border-gray-200 rounded p-2.5 bg-gray-50 flex items-center space-x-3">
                <img
                  src={uploadedImage}
                  alt="Uploaded question attachment"
                  className="w-20 h-20 object-contain bg-white rounded border p-0.5"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-emerald-700 truncate">
                    ✓ Original Question Image Ready ({Math.round(uploadedImage.length / 1024)} KB)
                  </p>
                  <p className="text-[10px] text-gray-500">
                    {selectedExam
                      ? `Will display as original image in "${selectedExam.title}" (${selectedExam.code})`
                      : 'Will display as original image inside Question Bank & assigned exams'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setUploadedImage('');
                    setUploadedImagePath('');
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="px-2.5 py-1 text-xs text-red-600 hover:bg-red-50 rounded border border-red-200 cursor-pointer"
                >
                  Remove
                </button>
              </div>
            )}
          </div>

          {/* 3. Question type */}
          <div>
            <label className="block text-xs font-semibold text-gray-800 mb-1">
              Question type
            </label>
            <select
              value={questionType}
              onChange={e => setQuestionType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded text-xs text-gray-900 bg-white focus:outline-none focus:border-blue-600"
            >
              <option value="MCQ — Single">MCQ — Single</option>
              <option value="MCQ — Multiple">MCQ — Multiple</option>
              <option value="Numerical Value">Numerical Value</option>
              <option value="Matrix Match">Matrix Match</option>
            </select>
          </div>

          {/* 4. Correct Answer */}
          {questionType === 'Numerical Value' ? (
            <div>
              <label className="block text-xs font-semibold text-gray-800 mb-1">
                Correct Numerical Value
              </label>
              <input
                type="text"
                placeholder="e.g. 42 or 3.14"
                value={numericalAnswer}
                onChange={e => setNumericalAnswer(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm font-mono font-bold text-gray-900 focus:outline-none focus:border-blue-600"
              />
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-gray-800 mb-1">
                Correct Answer Key
              </label>
              <div className="grid grid-cols-4 gap-3">
                {(['A', 'B', 'C', 'D'] as const).map(opt => {
                  const isSelected = correctAnswer === opt;
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setCorrectAnswer(opt)}
                      className={`py-3 border rounded text-lg font-bold transition cursor-pointer flex items-center justify-center ${
                        isSelected
                          ? 'border-[#002FA7] bg-[#002FA7] text-white shadow-xs'
                          : 'border-gray-200 bg-white text-gray-900 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <span>{opt}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 5. Marks (+) & Negative (-) */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-800 mb-1">
                Marks (+)
              </label>
              <input
                type="number"
                value={marksPositive}
                onChange={e => setMarksPositive(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded text-xs text-gray-900 focus:outline-none focus:border-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-800 mb-1">
                Negative (-)
              </label>
              <input
                type="number"
                value={marksNegative}
                onChange={e => setMarksNegative(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded text-xs text-gray-900 focus:outline-none focus:border-blue-600"
              />
            </div>
          </div>

          {/* Footer Action Buttons */}
          <div className="pt-4 border-t border-gray-200 flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => handleSaveCurrent(false, false, false)}
              className="px-3.5 py-2 border border-gray-300 rounded text-xs font-medium text-gray-800 hover:bg-gray-50 flex items-center space-x-1.5 cursor-pointer shadow-2xs"
            >
              <Save className="w-3.5 h-3.5 text-gray-600" />
              <span>Save</span>
            </button>

            <button
              type="button"
              onClick={() => handleSaveCurrent(true, false, false)}
              className="px-3.5 py-2 border border-gray-300 rounded text-xs font-medium text-gray-800 hover:bg-gray-50 flex items-center space-x-1.5 cursor-pointer shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5 text-gray-600" />
              <span>Save &amp; Add Next</span>
            </button>

            {selectedExam && (
              <button
                type="button"
                onClick={() => handleSaveCurrent(false, true, true)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded flex items-center space-x-1.5 cursor-pointer shadow-2xs transition"
              >
                <Share2 className="w-3.5 h-3.5 text-white" />
                <span>Finish &amp; Share Link</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => handleSaveCurrent(false, true, false)}
              className="px-4 py-2 bg-[#002FA7] hover:bg-blue-800 text-white font-semibold text-xs rounded flex items-center space-x-1.5 cursor-pointer shadow-2xs transition"
            >
              <Save className="w-3.5 h-3.5 text-white" />
              <span>Finish</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
