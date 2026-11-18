import React from 'react';
import { usePortal } from '../../context/PortalContext';
import { X, HelpCircle, CheckCircle } from 'lucide-react';
import { Question } from '../../types';
import {
  normalizeAnswerChoice,
  getQuestionImageSrc,
  getMeaningfulQuestionText,
  resolveQuestionType
} from '../../utils/imageCompress';

export const ViewQuestionsModal: React.FC = () => {
  const {
    activeExamForQuestionsModal,
    setActiveExamForQuestionsModal,
    questions
  } = usePortal();

  if (!activeExamForQuestionsModal) return null;

  // Collect all unique questions from both embedded exam.questions and sections[].questionIds
  const examQuestionsMap = new Map<string, Question>();
  (activeExamForQuestionsModal.questions || []).forEach(eq => {
    const bankMatch = questions.find(bq => bq.id === eq.id || bq.code === eq.code);
    const mergedImg = getQuestionImageSrc(eq) || getQuestionImageSrc(bankMatch) || undefined;
    examQuestionsMap.set(eq.id, {
      ...(bankMatch || {}),
      ...eq,
      questionType: resolveQuestionType(eq.questionImageUrl || eq.imageUrl ? eq : bankMatch || eq),
      questionImageUrl: mergedImg,
      imageUrl: mergedImg,
      questionImagePath: eq.questionImagePath || bankMatch?.questionImagePath
    });
  });

  const sectionIds = (activeExamForQuestionsModal.sections || []).flatMap(s => s.questionIds || []);
  sectionIds.forEach(id => {
    if (!examQuestionsMap.has(id)) {
      const bankMatch = questions.find(q => q.id === id || q.code === id);
      if (bankMatch) {
        examQuestionsMap.set(bankMatch.id, bankMatch);
      }
    }
  });

  const examQuestions = Array.from(examQuestionsMap.values());

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded bg-blue-100 text-[#1E3A8A] flex items-center justify-center font-bold">
              <HelpCircle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-tight">
                Exam Questions &amp; Answer Key
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                {activeExamForQuestionsModal.title} ({activeExamForQuestionsModal.code})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActiveExamForQuestionsModal(null)}
            className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          <div className="flex items-center justify-between bg-blue-50/50 p-2.5 rounded border border-blue-100 text-[11px]">
            <span className="font-semibold text-slate-700">
              Total Questions in Exam: <strong className="text-[#1E3A8A]">{examQuestions.length}</strong>
            </span>
            <span className="text-slate-500">
              Sections: {(activeExamForQuestionsModal.sections || []).map(s => s.name).join(', ')}
            </span>
          </div>

          {examQuestions.length === 0 ? (
            <div className="p-8 text-center text-slate-500 border border-dashed border-slate-300 rounded-lg">
              No questions assigned to this examination yet.
            </div>
          ) : (
            examQuestions.map((q, idx) => (
              <div key={q.id} className="p-4 bg-white border border-slate-200 rounded-lg shadow-2xs space-y-2.5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div className="flex items-center space-x-2">
                    <span className="w-6 h-6 rounded bg-[#1E3A8A] text-white flex items-center justify-center font-bold text-xs">
                      {idx + 1}
                    </span>
                    <span className="font-mono text-slate-500 font-semibold">{q.code}</span>
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-semibold">
                      {q.subject} &bull; {q.topic}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2 text-[11px]">
                    <span className="text-emerald-700 font-semibold">+{q.marksPositive} Marks</span>
                    <span className="text-red-600 font-semibold">{q.marksNegative} Neg</span>
                  </div>
                </div>

                {getMeaningfulQuestionText(q) ? (
                  <div className="text-slate-800 font-medium leading-relaxed text-xs">
                    {getMeaningfulQuestionText(q)}
                  </div>
                ) : (
                  <div>
                    <span className="px-2 py-0.5 bg-blue-50 text-[#002FA7] border border-blue-200 rounded font-mono text-[10px] font-bold">
                      ORIGINAL IMAGE QUESTION
                    </span>
                  </div>
                )}

                {getQuestionImageSrc(q) && (
                  <div className="py-1.5">
                    <img
                      src={getQuestionImageSrc(q)}
                      alt={`Question ${idx + 1} original image`}
                      className="max-h-72 max-w-full rounded border border-slate-300 bg-white object-contain p-1"
                    />
                  </div>
                )}

                {q.formulaNote && (
                  <div className="p-2 bg-amber-50/60 border border-amber-200 rounded text-[11px] text-amber-900 font-mono">
                    Hint / Reference: {q.formulaNote}
                  </div>
                )}

                {/* Options if SCQ */}
                {q.options && q.options.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    {q.options.map(opt => {
                      const isCorrect = normalizeAnswerChoice(q.correctAnswer) === normalizeAnswerChoice(opt.label);
                      return (
                        <div
                          key={opt.id}
                          className={`p-2 rounded border text-xs flex items-center space-x-2 ${
                            isCorrect
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-semibold'
                              : 'bg-slate-50 border-slate-200 text-slate-700'
                          }`}
                        >
                          <span
                            className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold ${
                              isCorrect ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
                            }`}
                          >
                            {opt.label}
                          </span>
                          <span>{opt.text}</span>
                          {isCorrect && <CheckCircle className="w-3.5 h-3.5 text-emerald-600 ml-auto" />}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Numerical if no options */}
                {(!q.options || q.options.length === 0) && (
                  <div className="p-2 bg-slate-50 border border-slate-200 rounded text-slate-700 text-xs">
                    Numerical Value Answer: <strong className="text-emerald-700 font-mono text-sm">{q.correctAnswer}</strong>
                  </div>
                )}

                {/* Solution Explanation */}
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded text-[11px] text-slate-600 leading-relaxed">
                  <strong className="text-slate-900 block mb-0.5">Step-by-step Solution:</strong>
                  {q.explanation}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-end">
          <button
            type="button"
            onClick={() => setActiveExamForQuestionsModal(null)}
            className="px-4 py-1.5 bg-[#1E3A8A] hover:bg-blue-900 text-white font-semibold rounded text-xs cursor-pointer"
          >
            Close Questions
          </button>
        </div>
      </div>
    </div>
  );
};
