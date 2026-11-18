import React, { useState } from 'react';
import { usePortal } from '../../context/PortalContext';
import { FolderPlus, X, FileText, Users, Calendar, Save, Check } from 'lucide-react';
import { getQuestionImageSrc, getMeaningfulQuestionText, resolveQuestionType } from '../../utils/imageCompress';

export const CreateFolderModal: React.FC = () => {
  const {
    createFolderModalOpen,
    setCreateFolderModalOpen,
    setCreateQuestionModalOpen,
    setActiveTargetExamIdForQuestion,
    setActiveTargetFolderIdForQuestion,
    questions,
    addFolder,
    addExam,
    showToast
  } = usePortal();

  const [activeTab, setActiveTab] = useState<'info' | 'questions' | 'students'>('info');
  const [folderName, setFolderName] = useState('');
  const [examName, setExamName] = useState('');
  const [classSection, setClassSection] = useState('11th Standard');
  const [selectedTag, setSelectedTag] = useState('JEE Mains (+4/-1)');
  const [duration, setDuration] = useState('60');
  const [passingMarks, setPassingMarks] = useState('0');
  const [allowedTabSwitches, setAllowedTabSwitches] = useState('3');
  const [publish, setPublish] = useState(true);
  const [webcam, setWebcam] = useState(true);
  const [randomize, setRandomize] = useState(false);
  const [instructions, setInstructions] = useState('Read each question carefully. Marks: +4 correct, -1 wrong.');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [selectedBankQIds, setSelectedBankQIds] = useState<string[]>([]);

  if (!createFolderModalOpen) return null;

  const normalizedClass = classSection.includes('12')
    ? '12th'
    : classSection.includes('Repeater')
    ? 'Repeater'
    : classSection.includes('Foundation')
    ? 'Foundation'
    : '11th';

  const handleToggleBankQ = (id: string) => {
    setSelectedBankQIds(prev =>
      prev.includes(id) ? prev.filter(qId => qId !== id) : [...prev, id]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const effectiveFolderName = folderName.trim() || `Class ${normalizedClass} Maths Paper`;
    const effectiveExamName = examName.trim() || `${effectiveFolderName} — ${normalizedClass}`;
    const examCategory = selectedTag.startsWith('MHT-CET')
      ? 'MHT-CET'
      : selectedTag.startsWith('JEE Advanced')
      ? 'JEE Advanced'
      : selectedTag.startsWith('NEET')
      ? 'NEET'
      : 'JEE Mains';

    const createdFolder = addFolder({
      name: effectiveFolderName,
      description: instructions,
      category: examCategory
    });

    const posMarks = selectedTag.includes('+2') ? 2 : 4;
    const negMarks = selectedTag.includes('-0') ? 0 : -1;
    const preselectedQuestions = questions
      .filter(q => selectedBankQIds.includes(q.id))
      .map(q => {
        const imgSrc = getQuestionImageSrc(q);
        const qType = resolveQuestionType(q);
        return {
          ...q,
          questionType: qType,
          questionImageUrl: imgSrc,
          imageUrl: imgSrc,
          questionText: getMeaningfulQuestionText(q),
          chapter: q.chapter || q.topic,
          marks: q.marks ?? q.marksPositive ?? posMarks,
          negativeMarks: q.negativeMarks ?? q.marksNegative ?? negMarks
        };
      });

    const createdExam = addExam({
      title: effectiveExamName,
      code: `GYAN-${Math.floor(1000 + Math.random() * 9000)}`,
      folderId: createdFolder.id,
      folderName: effectiveFolderName,
      durationMinutes: parseInt(duration) || 60,
      totalMarks: preselectedQuestions.length * posMarks || 100,
      positiveMarks: posMarks,
      negativeMarks: negMarks,
      passPercentage: parseInt(passingMarks) || 0,
      status: publish ? 'Live' : 'Draft',
      instructions: [instructions],
      targetClass: normalizedClass,
      examCategory,
      maxTabSwitches: parseInt(allowedTabSwitches) || 3,
      webcamEnabled: webcam,
      randomizeQuestions: randomize,
      batchIds: [],
      startTime: startAt || new Date().toISOString(),
      endTime: endAt || new Date(Date.now() + 86400000).toISOString(),
      isPublic: publish,
      publicAccessUrl: '',
      sections: [
        {
          id: 'sec-1',
          name: `Mathematics Section (Class ${normalizedClass})`,
          subject: 'Mathematics',
          questionIds: preselectedQuestions.map(q => q.id),
          instructions: `+${posMarks} for correct answer, ${negMarks} for wrong response.`
        }
      ],
      questions: preselectedQuestions
    });

    // Lock target folder & exam so every uploaded/created question immediately attaches to this exam
    setActiveTargetFolderIdForQuestion(createdFolder.id);
    setActiveTargetExamIdForQuestion(createdExam.id);

    // Reset form for next use
    setFolderName('');
    setExamName('');
    setSelectedBankQIds([]);
    setActiveTab('info');

    showToast(`Exam folder "${effectiveFolderName}" (Class ${normalizedClass}) created! Now upload or type your questions.`);
    setCreateFolderModalOpen(false);
    setCreateQuestionModalOpen(true);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-2xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-md border border-gray-200 shadow-2xl max-w-2xl w-full overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-100 font-sans text-xs">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-gray-900 font-bold text-sm">
            <FolderPlus className="w-4 h-4 text-blue-700" />
            <span>Create Exam Folder*</span>
          </div>
          <button
            type="button"
            onClick={() => setCreateFolderModalOpen(false)}
            className="text-gray-400 hover:text-gray-700 cursor-pointer p-1 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 3 Tabs */}
        <div className="px-6 pt-3 border-b border-gray-200 flex items-center space-x-2 bg-gray-50/50">
          <button
            type="button"
            onClick={() => setActiveTab('info')}
            className={`px-3.5 py-1.5 rounded-t text-xs font-semibold cursor-pointer border-t border-l border-r ${
              activeTab === 'info'
                ? 'bg-white border-gray-200 text-gray-900 shadow-2xs'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Folder Info
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('questions')}
            className={`px-3 py-1.5 rounded-t text-xs font-medium cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'questions'
                ? 'bg-white border-t border-l border-r border-gray-200 text-gray-900 shadow-2xs'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-gray-400" />
            <span>Questions ({selectedBankQIds.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('students')}
            className={`px-3 py-1.5 rounded-t text-xs font-medium cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'students'
                ? 'bg-white border-t border-l border-r border-gray-200 text-gray-900 shadow-2xs'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-gray-400" />
            <span>Students (Class {normalizedClass})</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {activeTab === 'info' && (
            <>
              {/* Row 1: Folder Name * & Exam Name * */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-800 mb-1">
                    Folder Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 11th JEE Maths Paper 1"
                    value={folderName}
                    onChange={e => setFolderName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-xs text-gray-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 placeholder:text-gray-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-800 mb-1">
                    Exam Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Class 11th Mock Test"
                    value={examName}
                    onChange={e => setExamName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-xs text-gray-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 placeholder:text-gray-400"
                  />
                </div>
              </div>

              {/* Row 2: Class / Section & Exam Tag */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-800 mb-1">
                    Class / Section
                  </label>
                  <select
                    value={classSection}
                    onChange={e => setClassSection(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-xs text-gray-900 bg-white focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  >
                    <option value="11th Standard">11th Standard</option>
                    <option value="12th Standard">12th Standard</option>
                    <option value="Repeater Batch">Repeater Batch</option>
                    <option value="Foundation">Foundation</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-800 mb-1">
                    Exam Tag
                  </label>
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {[
                      'JEE Mains (+4/-1)',
                      'JEE Advanced (+4/-1)',
                      'MHT-CET (+2/-0)',
                      'NEET (+4/-1)'
                    ].map(tag => {
                      const isActive = selectedTag === tag;
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => setSelectedTag(tag)}
                          className={`px-2.5 py-1 rounded text-[11px] font-semibold cursor-pointer transition ${
                            isActive
                              ? 'bg-[#002FA7] text-white shadow-2xs'
                              : 'bg-white border border-gray-200 text-gray-800 hover:bg-gray-50'
                          }`}
                        >
                          {tag}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Row 3: Duration (min) & Passing marks */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-800 mb-1">
                    Duration (min)
                  </label>
                  <input
                    type="number"
                    value={duration}
                    onChange={e => setDuration(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-xs text-gray-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-800 mb-1">
                    Passing marks
                  </label>
                  <input
                    type="number"
                    value={passingMarks}
                    onChange={e => setPassingMarks(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-xs text-gray-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  />
                </div>
              </div>

              {/* Row 4: Allowed tab switches & 3 Switch Toggles */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                <div>
                  <label className="block text-xs font-semibold text-gray-800 mb-1">
                    Allowed tab switches
                  </label>
                  <input
                    type="number"
                    value={allowedTabSwitches}
                    onChange={e => setAllowedTabSwitches(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-xs text-gray-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  />
                </div>

                <div className="flex items-center space-x-4 pt-4">
                  <div className="flex items-center space-x-1.5">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={publish}
                      onClick={() => setPublish(!publish)}
                      className={`relative inline-flex h-4.5 w-8 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none ${
                        publish ? 'bg-[#002FA7]' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-xs transition duration-200 ease-in-out my-auto ${
                          publish ? 'translate-x-3.5' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                    <span className="text-xs text-gray-800 select-none">Publish</span>
                  </div>

                  <div className="flex items-center space-x-1.5">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={webcam}
                      onClick={() => setWebcam(!webcam)}
                      className={`relative inline-flex h-4.5 w-8 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none ${
                        webcam ? 'bg-[#002FA7]' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-xs transition duration-200 ease-in-out my-auto ${
                          webcam ? 'translate-x-3.5' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                    <span className="text-xs text-gray-800 select-none">Webcam</span>
                  </div>

                  <div className="flex items-center space-x-1.5">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={randomize}
                      onClick={() => setRandomize(!randomize)}
                      className={`relative inline-flex h-4.5 w-8 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none ${
                        randomize ? 'bg-[#002FA7]' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-xs transition duration-200 ease-in-out my-auto ${
                          randomize ? 'translate-x-3.5' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                    <span className="text-xs text-gray-800 select-none">Randomize</span>
                  </div>
                </div>
              </div>

              {/* Row 5: Instructions */}
              <div>
                <label className="block text-xs font-semibold text-gray-800 mb-1">
                  Instructions
                </label>
                <textarea
                  rows={2}
                  value={instructions}
                  onChange={e => setInstructions(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-xs text-gray-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 leading-relaxed"
                />
              </div>

              {/* Row 6: Start at & End at */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-800 mb-1">
                    Start at (optional — opens)
                  </label>
                  <div className="relative">
                    <input
                      type="datetime-local"
                      value={startAt}
                      onChange={e => setStartAt(e.target.value)}
                      className="w-full px-3 py-2 pr-8 border border-gray-300 rounded text-xs text-gray-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                    />
                    <Calendar className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-2.5 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-800 mb-1">
                    End at (optional — window closes)
                  </label>
                  <div className="relative">
                    <input
                      type="datetime-local"
                      value={endAt}
                      onChange={e => setEndAt(e.target.value)}
                      className="w-full px-3 py-2 pr-8 border border-gray-300 rounded text-xs text-gray-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                    />
                    <Calendar className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-2.5 pointer-events-none" />
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === 'questions' && (
            <div className="space-y-2.5">
              <div className="p-2.5 bg-blue-50 border border-blue-200 rounded text-[11px] text-blue-900">
                Optionally pick existing Question Bank items below, or click <strong>Create Folder → Add Questions</strong> to upload new image/text questions directly into this folder.
              </div>
              <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                {questions
                  .filter(q => !normalizedClass || normalizedClass === 'Repeater' || normalizedClass === 'Foundation' || !q.targetClass || q.targetClass === normalizedClass)
                  .map(q => {
                    const checked = selectedBankQIds.includes(q.id);
                    return (
                      <div
                        key={q.id}
                        onClick={() => handleToggleBankQ(q.id)}
                        className={`p-2.5 rounded border flex items-start space-x-2.5 cursor-pointer transition ${
                          checked ? 'bg-blue-50 border-blue-300' : 'bg-white border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded flex items-center justify-center mt-0.5 border ${checked ? 'bg-[#002FA7] border-[#002FA7] text-white' : 'border-gray-300 bg-white'}`}>
                          {checked && <Check className="w-3 h-3" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 text-[11px]">
                            <span className="font-mono font-bold text-[#002FA7]">{q.code}</span>
                            <span className="text-gray-500">{q.topic}</span>
                            {resolveQuestionType(q) === 'image' && (
                              <span className="px-1.5 py-0.2 bg-blue-50 text-[#002FA7] border border-blue-200 rounded text-[10px] font-bold">
                                IMG
                              </span>
                            )}
                            {q.targetClass && (
                              <span className="px-1.5 py-0.2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[10px] font-semibold">
                                {q.targetClass}
                              </span>
                            )}
                          </div>
                          {getMeaningfulQuestionText(q) ? (
                            <p className="text-gray-800 truncate mt-0.5">{getMeaningfulQuestionText(q)}</p>
                          ) : (
                            <p className="text-blue-700 italic text-[11px] mt-0.5">[Original Image Question]</p>
                          )}
                          {getQuestionImageSrc(q) && (
                            <img
                              src={getQuestionImageSrc(q)}
                              alt={q.code}
                              className="mt-1 h-12 max-w-full object-contain rounded border border-gray-200 bg-white"
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {activeTab === 'students' && (
            <div className="p-6 text-center bg-slate-50 border border-slate-200 rounded space-y-1.5">
              <p className="font-semibold text-gray-800">Assigned Target Class: Class {normalizedClass}</p>
              <p className="text-gray-500">
                Any student opening the shared exam or CBT link will automatically receive this exact Class {normalizedClass} paper and be synced to your Admin Dashboard.
              </p>
            </div>
          )}

          {/* Bottom Button */}
          <div className="pt-3 border-t border-gray-100 flex justify-end">
            <button
              type="submit"
              className="px-5 py-2.5 bg-[#002FA7] hover:bg-blue-800 text-white font-semibold text-xs rounded flex items-center space-x-2 cursor-pointer shadow-xs transition"
            >
              <Save className="w-4 h-4" />
              <span>Create Folder → Add Questions</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
