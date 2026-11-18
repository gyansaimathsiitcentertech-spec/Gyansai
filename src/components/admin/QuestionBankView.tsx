import React, { useState, useRef } from 'react';
import { usePortal } from '../../context/PortalContext';
import {
  Upload,
  FolderPlus,
  Plus,
  Edit2,
  Trash2,
  X,
  Check,
  Folder,
  Zap,
  CheckCircle2
} from 'lucide-react';
import { Question } from '../../types';
import {
  processQuestionImageUpload,
  getQuestionImageSrc,
  getMeaningfulQuestionText,
  resolveQuestionType
} from '../../utils/imageCompress';

interface BulkImageItem {
  id: string;
  fileName: string;
  imageUrl: string;
  imagePath?: string;
  correctAnswer: 'A' | 'B' | 'C' | 'D';
  topic: string;
}

export const QuestionBankView: React.FC = () => {
  const {
    questions,
    folders,
    exams,
    addQuestion,
    updateQuestion,
    deleteQuestion,
    attachQuestionsToExam,
    setActiveTargetExamIdForQuestion,
    setActiveTargetFolderIdForQuestion,
    setCreateFolderModalOpen,
    setCreateQuestionModalOpen,
    showToast
  } = usePortal();

  const [subjectFilter, setSubjectFilter] = useState('All');
  const [diffFilter, setDiffFilter] = useState('All');
  const [folderFilter, setFolderFilter] = useState('All folders');
  const [classFilter, setClassFilter] = useState('All');
  const [searchText, setSearchText] = useState('');

  // Modals state
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);

  // Bulk Images Modal state
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkItems, setBulkItems] = useState<BulkImageItem[]>([]);
  const [bulkTargetClass, setBulkTargetClass] = useState<'11th' | '12th' | 'Repeater' | 'Foundation'>('11th');
  const [bulkTargetExamId, setBulkTargetExamId] = useState<string>('');
  const [isCompressingBulk, setIsCompressingBulk] = useState(false);

  // Quick Assign Modal state
  const [quickAssignModalOpen, setQuickAssignModalOpen] = useState(false);
  const [quickAssignExamId, setQuickAssignExamId] = useState<string>('');
  const [quickAssignSelectedIds, setQuickAssignSelectedIds] = useState<string[]>([]);

  const pdfInputRef = useRef<HTMLInputElement>(null);
  const bulkFileInputRef = useRef<HTMLInputElement>(null);

  const handlePdfImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Simulate OCR question extraction
    showToast(`Analyzing "${file.name}" with OCR pipeline...`);
    setTimeout(() => {
      addQuestion({
        code: `IMP-${Date.now().toString().slice(-4)}`,
        subject: 'Mathematics',
        topic: 'Imported from ' + file.name,
        type: 'single_choice',
        difficulty: 'Moderate',
        targetClass: classFilter !== 'All' && classFilter !== 'CET' ? (classFilter as any) : '11th',
        questionText: `[Imported from ${file.name}] If f(x) is a continuous function satisfying f(x) + f(2 - x) = 4, then find ∫[0 to 2] f(x) dx.`,
        tag: 'JEE',
        year: '[2024]',
        options: [
          { id: 'opt-1', label: '(1)', text: '4' },
          { id: 'opt-2', label: '(2)', text: '8' },
          { id: 'opt-3', label: '(3)', text: '2' },
          { id: 'opt-4', label: '(4)', text: '0' }
        ],
        correctAnswer: '(1)',
        marksPositive: 4,
        marksNegative: -1,
        explanation: 'Using King\'s property, 2I = ∫[0 to 2] 4 dx = 8 => I = 4.'
      });
      showToast(`Successfully extracted and added questions from ${file.name}`);
    }, 1000);
  };

  const handleDelete = (q: Question) => {
    deleteQuestion(q.id);
    showToast('Question deleted from Question Bank.');
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingQuestion) return;
    const resolvedImg = getQuestionImageSrc(editingQuestion);
    const trimmedText = (editingQuestion.questionText || '').trim();
    if (!trimmedText && !resolvedImg) {
      showToast('Please provide question text or attach a question image.', 'error');
      return;
    }
    const nextQType: 'image' | 'text' = resolvedImg ? (editingQuestion.questionType || 'image') : 'text';
    updateQuestion(editingQuestion.id, {
      questionType: nextQType,
      questionText: trimmedText,
      subject: editingQuestion.subject,
      chapter: editingQuestion.chapter || editingQuestion.topic,
      topic: editingQuestion.topic,
      targetClass: editingQuestion.targetClass,
      marks: editingQuestion.marksPositive,
      negativeMarks: editingQuestion.marksNegative,
      marksPositive: editingQuestion.marksPositive,
      marksNegative: editingQuestion.marksNegative,
      questionImageUrl: resolvedImg || undefined,
      imageUrl: resolvedImg || undefined,
      questionImagePath: editingQuestion.questionImagePath
    });
    showToast('Question updated successfully.');
    setEditingQuestion(null);
  };

  const handleBulkFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsCompressingBulk(true);
    try {
      const nextItems: BulkImageItem[] = [];
      for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/')) continue;
        const processed = await processQuestionImageUpload(file, {
          examId: bulkTargetExamId || undefined
        });
        nextItems.push({
          id: `bulk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          fileName: file.name,
          imageUrl: processed.questionImageUrl,
          imagePath: processed.questionImagePath || processed.serverImageUrl,
          correctAnswer: 'A',
          topic: file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ') || 'Mathematics Problem'
        });
      }
      setBulkItems(prev => [...prev, ...nextItems]);
      showToast(`Prepared ${nextItems.length} original question image(s).`);
    } catch (err) {
      console.error('Bulk image upload failed:', err);
      showToast('Some images could not be processed.', 'error');
    } finally {
      setIsCompressingBulk(false);
    }
  };

  const handleSaveBulkImages = () => {
    if (bulkItems.length === 0) {
      showToast('Please select at least one question image.', 'error');
      return;
    }
    const targetExam = exams.find(e => e.id === bulkTargetExamId);
    const resolvedClass = targetExam?.targetClass || bulkTargetClass;
    const posMarks = targetExam?.positiveMarks || 4;
    const negMarks = targetExam?.negativeMarks !== undefined ? targetExam.negativeMarks : -1;

    const createdQuestions: Question[] = bulkItems.map((item, idx) =>
      addQuestion({
        examId: targetExam?.id,
        code: `IMG-Q${questions.length + idx + 1}-${Math.floor(100 + Math.random() * 900)}`,
        subject: 'Mathematics',
        chapter: item.topic || 'Visual Mathematics Problem',
        topic: item.topic || 'Visual Mathematics Problem',
        type: 'single_choice',
        questionType: 'image',
        difficulty: 'Moderate',
        targetClass: resolvedClass as any,
        folderId: targetExam?.folderId,
        folderName: targetExam?.folderName,
        tag: targetExam?.examCategory || 'JEE',
        year: `[${new Date().getFullYear()}]`,
        questionText: '',
        questionImageUrl: item.imageUrl,
        questionImagePath: item.imagePath,
        imageUrl: item.imageUrl,
        options: [
          { id: 'opt-1', label: 'A', text: 'Option A' },
          { id: 'opt-2', label: 'B', text: 'Option B' },
          { id: 'opt-3', label: 'C', text: 'Option C' },
          { id: 'opt-4', label: 'D', text: 'Option D' }
        ],
        correctAnswer: item.correctAnswer,
        marks: posMarks,
        negativeMarks: negMarks,
        marksPositive: posMarks,
        marksNegative: negMarks,
        explanation: `Official answer key: Option ${item.correctAnswer}.`
      })
    );

    if (targetExam && createdQuestions.length > 0) {
      attachQuestionsToExam(createdQuestions, targetExam.id);
    }

    showToast(
      targetExam
        ? `Uploaded ${bulkItems.length} original image question(s) and assigned directly to "${targetExam.title}" (Class ${resolvedClass})!`
        : `Uploaded ${bulkItems.length} original image question(s) to Class ${resolvedClass} Question Bank!`
    );
    setBulkItems([]);
    setBulkModalOpen(false);
  };

  const handleOpenQuickAssign = () => {
    const defaultExamId = exams[0]?.id || '';
    setQuickAssignExamId(defaultExamId);
    setQuickAssignSelectedIds(filteredQuestions.map(q => q.id));
    setQuickAssignModalOpen(true);
  };

  const handleExecuteQuickAssign = () => {
    const targetExam = exams.find(e => e.id === quickAssignExamId);
    if (!targetExam) {
      showToast('Please select a target exam.', 'error');
      return;
    }
    if (quickAssignSelectedIds.length === 0) {
      showToast('Please select at least one question to assign.', 'error');
      return;
    }
    const chosenQuestions = quickAssignSelectedIds
      .map(qId => questions.find(q => q.id === qId))
      .filter(Boolean) as Question[];
    if (chosenQuestions.length > 0) {
      attachQuestionsToExam(chosenQuestions, targetExam.id);
    }
    showToast(`Assigned ${chosenQuestions.length} question(s) directly to "${targetExam.title}"!`);
    setQuickAssignModalOpen(false);
  };

  // Filtered list with real folderFilter and classFilter support
  const selectedFolderObj = folders.find(f => f.name === folderFilter);
  const folderExamQuestionIds = new Set<string>();
  if (folderFilter !== 'All folders') {
    exams
      .filter(ex => ex.folderName === folderFilter || (selectedFolderObj && ex.folderId === selectedFolderObj.id))
      .forEach(ex => {
        (ex.questions || []).forEach(eq => folderExamQuestionIds.add(eq.id));
        (ex.sections || []).forEach(sec => (sec.questionIds || []).forEach(qid => folderExamQuestionIds.add(qid)));
      });
  }

  const filteredQuestions = questions.filter(q => {
    const matchSubject = subjectFilter === 'All' || q.subject === subjectFilter;
    const matchDiff = diffFilter === 'All' || q.difficulty === diffFilter;
    const matchFolder = folderFilter === 'All folders' ||
      q.folderName === folderFilter ||
      (selectedFolderObj && q.folderId === selectedFolderObj.id) ||
      folderExamQuestionIds.has(q.id);
    const matchClass = classFilter === 'All' ||
      (classFilter === 'CET'
        ? (q.tag === 'CET' || q.tag?.includes('CET'))
        : (q.targetClass === classFilter || q.tag?.includes(classFilter)));
    const matchText = !searchText.trim() ||
      q.questionText.toLowerCase().includes(searchText.toLowerCase()) ||
      q.topic.toLowerCase().includes(searchText.toLowerCase()) ||
      q.code.toLowerCase().includes(searchText.toLowerCase()) ||
      (q.folderName && q.folderName.toLowerCase().includes(searchText.toLowerCase()));
    return matchSubject && matchDiff && matchFolder && matchClass && matchText;
  });

  return (
    <div className="space-y-6 font-sans text-xs">
      {/* Top Header & 6 Action Buttons */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-mono font-medium tracking-widest text-gray-400 uppercase mb-1">
            // REPOSITORY
          </div>
          <h1 className="text-2xl font-extrabold text-gray-950 tracking-tight">
            Question Bank
          </h1>
          <p className="text-xs text-gray-500 font-mono mt-1">
            {questions.length} questions stored permanently &bull; Showing {filteredQuestions.length} matching
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="file"
            ref={pdfInputRef}
            onChange={handlePdfImport}
            accept=".pdf,.txt,.docx,.csv"
            className="hidden"
          />

          <button
            type="button"
            onClick={() => pdfInputRef.current?.click()}
            className="px-3 py-1.5 bg-white border border-gray-300 rounded text-xs font-medium text-gray-700 hover:bg-gray-50 flex items-center space-x-1 cursor-pointer shadow-2xs"
          >
            <Upload className="w-3.5 h-3.5 text-gray-500" />
            <span>Import PDF</span>
          </button>

          <button
            type="button"
            onClick={() => setCreateFolderModalOpen(true)}
            className="px-3.5 py-1.5 bg-[#0B192C] hover:bg-slate-900 text-white rounded text-xs font-medium flex items-center space-x-1.5 cursor-pointer shadow-2xs transition"
          >
            <FolderPlus className="w-3.5 h-3.5 text-blue-400" />
            <span>Create Exam Folder</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setBulkTargetExamId(exams[0]?.id || '');
              setBulkTargetClass(classFilter !== 'All' && classFilter !== 'CET' ? (classFilter as any) : '11th');
              setBulkModalOpen(true);
            }}
            className="px-3 py-1.5 bg-white border border-gray-300 rounded text-xs font-medium text-gray-700 hover:bg-gray-50 flex items-center space-x-1 cursor-pointer shadow-2xs"
          >
            <Upload className="w-3.5 h-3.5 text-gray-500" />
            <span>Bulk Images</span>
          </button>

          <button
            type="button"
            onClick={handleOpenQuickAssign}
            className="px-3 py-1.5 bg-white border border-gray-300 rounded text-xs font-medium text-gray-700 hover:bg-gray-50 flex items-center space-x-1 cursor-pointer shadow-2xs"
          >
            <Zap className="w-3.5 h-3.5 text-gray-500" />
            <span>Quick Assign</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTargetExamIdForQuestion(null);
              setActiveTargetFolderIdForQuestion(selectedFolderObj?.id || null);
              setCreateQuestionModalOpen(true);
            }}
            className="px-3.5 py-1.5 bg-[#002FA7] hover:bg-blue-800 text-white font-semibold rounded text-xs flex items-center space-x-1 cursor-pointer shadow-2xs transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Question</span>
          </button>
        </div>
      </div>

      {/* Filter Row */}
      <div className="bg-white border border-gray-200 rounded p-4 flex flex-wrap items-end gap-3 shadow-2xs">
        {/* Class Filter */}
        <div className="min-w-[120px]">
          <label className="block text-[11px] font-medium text-gray-600 mb-1">
            Target Class
          </label>
          <select
            value={classFilter}
            onChange={e => setClassFilter(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded text-xs bg-white text-gray-800 focus:outline-none focus:border-blue-600"
          >
            <option value="All">All Classes</option>
            <option value="11th">Class 11th</option>
            <option value="12th">Class 12th</option>
            <option value="CET">MHT-CET</option>
            <option value="Repeater">Repeater</option>
            <option value="Foundation">Foundation</option>
          </select>
        </div>

        {/* Subject */}
        <div className="min-w-[130px]">
          <label className="block text-[11px] font-medium text-gray-600 mb-1">
            Subject
          </label>
          <select
            value={subjectFilter}
            onChange={e => setSubjectFilter(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded text-xs bg-white text-gray-800 focus:outline-none focus:border-blue-600"
          >
            <option value="All">All</option>
            <option value="Mathematics">Mathematics</option>
            <option value="Physics">Physics</option>
            <option value="Chemistry">Chemistry</option>
          </select>
        </div>

        {/* Difficulty */}
        <div className="min-w-[130px]">
          <label className="block text-[11px] font-medium text-gray-600 mb-1">
            Difficulty
          </label>
          <select
            value={diffFilter}
            onChange={e => setDiffFilter(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded text-xs bg-white text-gray-800 focus:outline-none focus:border-blue-600"
          >
            <option value="All">All</option>
            <option value="Easy">Easy</option>
            <option value="Moderate">Moderate</option>
            <option value="Advanced IIT">Advanced IIT</option>
          </select>
        </div>

        {/* Test Folder */}
        <div className="min-w-[160px]">
          <label className="block text-[11px] font-medium text-gray-600 mb-1 flex items-center space-x-1">
            <Folder className="w-3 h-3 text-gray-400" />
            <span>Test Folder</span>
          </label>
          <select
            value={folderFilter}
            onChange={e => setFolderFilter(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded text-xs bg-white text-gray-800 focus:outline-none focus:border-blue-600"
          >
            <option value="All folders">All folders</option>
            {folders.map(f => (
              <option key={f.id} value={f.name}>{f.name}</option>
            ))}
          </select>
        </div>

        {/* Search */}
        <div className="flex-1 min-w-[200px]">
          <label className="block text-[11px] font-medium text-gray-600 mb-1">
            Search
          </label>
          <input
            type="text"
            placeholder="Search text, topic, code, or folder..."
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded text-xs focus:outline-none focus:border-blue-600"
          />
        </div>

        {/* Reset / Apply Button */}
        <div>
          <button
            type="button"
            onClick={() => {
              setSubjectFilter('All');
              setDiffFilter('All');
              setFolderFilter('All folders');
              setClassFilter('All');
              setSearchText('');
              showToast('Filters reset.');
            }}
            className="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-800 rounded text-xs font-medium cursor-pointer"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Question Cards List - Dynamic and Deletable */}
      {filteredQuestions.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded p-12 text-center text-gray-500">
          No questions found matching your filter.
        </div>
      ) : (
        <div className="space-y-4">
          {filteredQuestions.map((q, idx) => (
            <div
              key={q.id}
              className="bg-white border border-gray-200 rounded-sm p-5 space-y-4 shadow-2xs hover:border-gray-300 transition"
            >
              {/* Top row tags & actions */}
              <div className="flex items-center justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2.5 py-0.5 bg-gray-100 text-gray-700 border border-gray-200 rounded font-mono text-[11px]">
                    {q.subject}
                  </span>

                  <span className="px-2 py-0.5 bg-[#002FA7] text-white font-mono text-[11px] font-bold rounded flex items-center space-x-1">
                    <span className="w-2 h-2 bg-blue-300 rounded-2xs inline-block"></span>
                    <span>{q.tag || 'JEE'}</span>
                  </span>

                  {q.targetClass && (
                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono text-[11px] font-bold rounded">
                      Class {q.targetClass}
                    </span>
                  )}

                  {q.folderName && (
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-800 border border-blue-200 font-mono text-[11px] rounded flex items-center space-x-1">
                      <Folder className="w-3 h-3" />
                      <span>{q.folderName}</span>
                    </span>
                  )}

                  <span className="px-2 py-0.5 bg-gray-100 text-gray-600 font-mono text-[11px] rounded border border-gray-200">
                    {q.difficulty}
                  </span>

                  <span className="px-2 py-0.5 bg-gray-100 text-gray-600 font-mono text-[11px] rounded border border-gray-200">
                    +{q.marksPositive} / -{Math.abs(q.marksNegative)}
                  </span>
                </div>

                {/* Edit & Delete Icons */}
                <div className="flex items-center space-x-3">
                  <button
                    type="button"
                    onClick={() => setEditingQuestion(q)}
                    className="text-gray-400 hover:text-gray-700 cursor-pointer p-1"
                    title="Edit question"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(q)}
                    className="text-red-400 hover:text-red-600 cursor-pointer p-1"
                    title="Delete question"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Question Math Text & Original Image */}
              <div className="p-4 bg-gray-50/70 border border-gray-200 rounded text-gray-900 space-y-3 font-serif text-sm">
                {getMeaningfulQuestionText(q) ? (
                  <div className="leading-relaxed">
                    <span className="font-sans font-bold text-gray-600 mr-2 text-xs">Q{idx + 1}.</span>
                    {getMeaningfulQuestionText(q)}
                    {q.year && <span className="font-mono text-xs text-gray-500 ml-2 font-bold">{q.year}</span>}
                  </div>
                ) : (
                  <div className="font-sans flex items-center space-x-2 text-xs">
                    <span className="font-bold text-gray-700">Q{idx + 1}.</span>
                    <span className="px-2 py-0.5 bg-blue-50 text-[#002FA7] border border-blue-200 rounded font-mono text-[10px] font-bold">
                      IMAGE QUESTION ({resolveQuestionType(q).toUpperCase()})
                    </span>
                    {q.year && <span className="font-mono text-xs text-gray-500 font-bold">{q.year}</span>}
                  </div>
                )}

                {/* Diagram/Image preview if available */}
                {getQuestionImageSrc(q) && (
                  <div className="pt-2">
                    <img
                      src={getQuestionImageSrc(q)}
                      alt={`Question ${idx + 1} original diagram`}
                      className="max-h-72 max-w-full rounded border border-gray-300 bg-white object-contain p-1"
                    />
                  </div>
                )}

                {q.formulaNote && (
                  <div className="text-xs font-mono text-blue-800 bg-blue-50/80 p-2 rounded border border-blue-200">
                    💡 Formula: {q.formulaNote}
                  </div>
                )}

                {q.options && q.options.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs font-mono">
                    {q.options.map((opt, i) => (
                      <div
                        key={i}
                        className={`flex items-center space-x-2 p-1.5 rounded ${
                          opt.label === q.correctAnswer ? 'bg-green-50 border border-green-200 text-green-900 font-bold' : 'text-gray-800'
                        }`}
                      >
                        <span className="text-gray-500 font-bold">{opt.label}</span>
                        <span>{opt.text}</span>
                        {opt.label === q.correctAnswer && <Check className="w-3.5 h-3.5 text-green-600 ml-auto" />}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Bulk Images Upload Modal */}
      {bulkModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-gray-200 shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden font-sans text-xs">
            <div className="px-5 py-3.5 border-b border-gray-200 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-sm text-gray-900">Bulk Upload Question Images &amp; Assign to Exam</h3>
              <button
                type="button"
                onClick={() => setBulkModalOpen(false)}
                className="text-gray-400 hover:text-gray-700 cursor-pointer p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-blue-50/70 p-3 rounded border border-blue-200">
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 mb-1">
                    Assign Directly to Exam Paper
                  </label>
                  <select
                    value={bulkTargetExamId}
                    onChange={e => {
                      setBulkTargetExamId(e.target.value);
                      const found = exams.find(ex => ex.id === e.target.value);
                      if (found?.targetClass) setBulkTargetClass(found.targetClass as any);
                    }}
                    className="w-full px-2.5 py-1.5 border border-gray-300 rounded bg-white text-xs"
                  >
                    <option value="">-- Question Bank Only --</option>
                    {exams.map(ex => (
                      <option key={ex.id} value={ex.id}>
                        {ex.title} ({ex.code}) — Class {ex.targetClass || '11th'}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-700 mb-1">
                    Target Class
                  </label>
                  <select
                    value={bulkTargetClass}
                    onChange={e => setBulkTargetClass(e.target.value as any)}
                    className="w-full px-2.5 py-1.5 border border-gray-300 rounded bg-white text-xs"
                  >
                    <option value="11th">Class 11th</option>
                    <option value="12th">Class 12th</option>
                    <option value="Repeater">Repeater / Dropper</option>
                    <option value="Foundation">Foundation</option>
                  </select>
                </div>
              </div>

              <input
                type="file"
                ref={bulkFileInputRef}
                multiple
                accept="image/*"
                className="hidden"
                onChange={e => handleBulkFilesSelected(e.target.files)}
              />
              <button
                type="button"
                onClick={() => bulkFileInputRef.current?.click()}
                disabled={isCompressingBulk}
                className="w-full py-6 border-2 border-dashed border-blue-300 hover:border-[#002FA7] bg-blue-50/30 rounded-lg text-center cursor-pointer transition flex flex-col items-center space-y-1"
              >
                <Upload className="w-6 h-6 text-[#002FA7]" />
                <span className="font-bold text-[#002FA7]">
                  {isCompressingBulk ? 'Compressing images...' : 'Click to Select Multiple Question Images (PNG, JPG)'}
                </span>
                <span className="text-[11px] text-gray-500">Images are auto-compressed for fast mobile loading</span>
              </button>

              {bulkItems.length > 0 && (
                <div className="space-y-2.5">
                  {bulkItems.map((item, idx) => (
                    <div key={item.id} className="p-3 border border-gray-200 rounded bg-slate-50 flex items-center gap-3">
                      <img src={item.imageUrl} alt={item.fileName} className="w-20 h-16 object-contain bg-white border border-gray-300 rounded p-0.5 shrink-0" />
                      <div className="flex-1 space-y-1.5">
                        <input
                          type="text"
                          value={item.topic}
                          onChange={e => setBulkItems(prev => prev.map((it, i) => i === idx ? { ...it, topic: e.target.value } : it))}
                          className="w-full px-2 py-1 border border-gray-300 rounded bg-white text-xs"
                          placeholder="Topic / Name"
                        />
                        <div className="flex items-center space-x-2">
                          <span className="text-[11px] font-bold text-gray-600">Correct Key:</span>
                          {(['A', 'B', 'C', 'D'] as const).map(opt => (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => setBulkItems(prev => prev.map((it, i) => i === idx ? { ...it, correctAnswer: opt } : it))}
                              className={`px-2 py-0.5 rounded font-bold cursor-pointer ${
                                item.correctAnswer === opt ? 'bg-emerald-600 text-white' : 'bg-white border border-gray-300 text-gray-700'
                              }`}
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setBulkItems(prev => prev.filter((_, i) => i !== idx))}
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-gray-200 bg-slate-50 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setBulkModalOpen(false)}
                className="px-3 py-1.5 border border-gray-300 rounded text-gray-700 hover:bg-gray-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveBulkImages}
                disabled={bulkItems.length === 0 || isCompressingBulk}
                className="px-4 py-1.5 bg-[#002FA7] hover:bg-blue-800 disabled:opacity-50 text-white font-bold rounded flex items-center space-x-1.5 cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Upload &amp; Attach ({bulkItems.length})</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Assign Modal */}
      {quickAssignModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-gray-200 shadow-2xl max-w-xl w-full max-h-[85vh] flex flex-col overflow-hidden font-sans text-xs">
            <div className="px-5 py-3.5 border-b border-gray-200 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-sm text-gray-900">Quick Assign Questions to Exam Paper</h3>
              <button
                type="button"
                onClick={() => setQuickAssignModalOpen(false)}
                className="text-gray-400 hover:text-gray-700 cursor-pointer p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1">
                  Select Target Exam
                </label>
                <select
                  value={quickAssignExamId}
                  onChange={e => setQuickAssignExamId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded bg-white text-xs"
                >
                  {exams.map(ex => (
                    <option key={ex.id} value={ex.id}>
                      {ex.title} ({ex.code}) — Class {ex.targetClass || '11th'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5 max-h-64 overflow-y-auto border border-gray-200 rounded p-2">
                {filteredQuestions.map(q => {
                  const checked = quickAssignSelectedIds.includes(q.id);
                  return (
                    <label key={q.id} className="flex items-start space-x-2 p-2 rounded hover:bg-slate-50 cursor-pointer border-b border-gray-100 last:border-0">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => setQuickAssignSelectedIds(prev => checked ? prev.filter(id => id !== q.id) : [...prev, q.id])}
                        className="mt-0.5"
                      />
                      <div className="flex-1">
                        <div className="font-bold text-gray-800">[{q.code}] {q.topic} {q.targetClass ? `• Class ${q.targetClass}` : ''}</div>
                        <div className="text-gray-600 line-clamp-1">
                          {getMeaningfulQuestionText(q) || `[Image Question: ${q.topic || q.code}]`}
                        </div>
                      </div>
                      {getQuestionImageSrc(q) && <span className="text-[10px] font-mono bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">IMG</span>}
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="px-5 py-3 border-t border-gray-200 bg-slate-50 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setQuickAssignModalOpen(false)}
                className="px-3 py-1.5 border border-gray-300 rounded text-gray-700 hover:bg-gray-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteQuickAssign}
                className="px-4 py-1.5 bg-[#002FA7] hover:bg-blue-800 text-white font-bold rounded cursor-pointer"
              >
                Assign {quickAssignSelectedIds.length} Questions
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Question Modal */}
      {editingQuestion && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white rounded-md border border-gray-200 shadow-2xl max-w-lg w-full p-6 space-y-4 font-sans text-xs">
            <div className="flex items-center justify-between border-b border-gray-200 pb-3">
              <h3 className="font-bold text-sm text-gray-900">Edit Question ({editingQuestion.code})</h3>
              <button
                type="button"
                onClick={() => setEditingQuestion(null)}
                className="text-gray-400 hover:text-gray-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3 max-h-[75vh] overflow-y-auto pr-1">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Question Text {getQuestionImageSrc(editingQuestion) ? '(optional for image-based questions)' : '*'}
                </label>
                <textarea
                  rows={3}
                  required={!getQuestionImageSrc(editingQuestion)}
                  value={editingQuestion.questionText}
                  onChange={e => setEditingQuestion({ ...editingQuestion, questionText: e.target.value })}
                  placeholder={getQuestionImageSrc(editingQuestion) ? 'Leave blank for image-only question' : 'Enter question text'}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-xs text-gray-900 focus:outline-none focus:border-blue-600 font-serif"
                />
              </div>

              {/* Edit / Attach Question Image */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Question Image (Original PNG / JPG / WebP)
                </label>
                {getQuestionImageSrc(editingQuestion) ? (
                  <div className="p-2.5 border border-gray-200 rounded bg-slate-50 flex items-center justify-between gap-3">
                    <img
                      src={getQuestionImageSrc(editingQuestion)}
                      alt="Question preview"
                      className="max-h-24 max-w-[160px] object-contain bg-white border border-gray-300 rounded p-0.5"
                    />
                    <div className="flex items-center space-x-2">
                      <label className="px-2.5 py-1 bg-white border border-blue-300 text-[#002FA7] rounded text-xs font-semibold cursor-pointer hover:bg-blue-50">
                        Replace Image
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={async e => {
                            const f = e.target.files?.[0];
                            if (!f) return;
                            try {
                              const processed = await processQuestionImageUpload(f, {
                                examId: editingQuestion.examId,
                                questionId: editingQuestion.id
                              });
                              setEditingQuestion({
                                ...editingQuestion,
                                questionType: 'image',
                                questionImageUrl: processed.questionImageUrl,
                                imageUrl: processed.questionImageUrl,
                                questionImagePath: processed.questionImagePath || processed.serverImageUrl
                              });
                              showToast('Updated question image attached.');
                            } catch {
                              showToast('Failed to read image file.', 'error');
                            }
                          }}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => setEditingQuestion({
                          ...editingQuestion,
                          questionType: 'text',
                          questionImageUrl: undefined,
                          imageUrl: undefined,
                          questionImagePath: undefined
                        })}
                        className="px-2.5 py-1 text-red-600 border border-red-200 rounded hover:bg-red-50 text-xs cursor-pointer"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <label className="block border border-dashed border-gray-300 rounded p-3 text-center bg-slate-50 hover:bg-slate-100 cursor-pointer text-xs text-[#002FA7] font-semibold">
                    + Attach Question Image (PNG / JPG / WebP)
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async e => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        try {
                          const processed = await processQuestionImageUpload(f, {
                            examId: editingQuestion.examId,
                            questionId: editingQuestion.id
                          });
                          setEditingQuestion({
                            ...editingQuestion,
                            questionType: 'image',
                            questionImageUrl: processed.questionImageUrl,
                            imageUrl: processed.questionImageUrl,
                            questionImagePath: processed.questionImagePath || processed.serverImageUrl
                          });
                          showToast('Original question image attached.');
                        } catch {
                          showToast('Failed to read image file.', 'error');
                        }
                      }}
                    />
                  </label>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Subject
                  </label>
                  <select
                    value={editingQuestion.subject}
                    onChange={e => setEditingQuestion({ ...editingQuestion, subject: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-xs text-gray-900 bg-white"
                  >
                    <option value="Mathematics">Mathematics</option>
                    <option value="Physics">Physics</option>
                    <option value="Chemistry">Chemistry</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Target Class
                  </label>
                  <select
                    value={editingQuestion.targetClass || '11th'}
                    onChange={e => setEditingQuestion({ ...editingQuestion, targetClass: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-xs text-gray-900 bg-white"
                  >
                    <option value="11th">11th</option>
                    <option value="12th">12th</option>
                    <option value="Repeater">Repeater</option>
                    <option value="Foundation">Foundation</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Topic
                  </label>
                  <input
                    type="text"
                    value={editingQuestion.topic}
                    onChange={e => setEditingQuestion({ ...editingQuestion, topic: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-xs text-gray-900"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setEditingQuestion(null)}
                  className="px-3 py-1.5 border border-gray-300 rounded text-gray-700 hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#002FA7] hover:bg-blue-800 text-white font-semibold rounded cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

