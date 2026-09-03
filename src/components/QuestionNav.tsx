import React from 'react';

interface QuestionNavProps {
  questions: { id: string; label: string }[];
  currentQuestionId: string;
  onQuestionSelect: (id: string) => void;
  answers: Record<string, string>;
  skippedQuestions: Record<string, boolean>;
}

export default function QuestionNav({
  questions,
  currentQuestionId,
  onQuestionSelect,
  answers,
  skippedQuestions
}: QuestionNavProps) {
  const getStatusColorClass = (id: string) => {
    const ans = answers[id];
    const isSkipped = !!skippedQuestions[id] || ans === '__SKIPPED__';
    const isAnswered = !!ans && ans.trim() !== '' && ans !== '__SKIPPED__';

    if (isSkipped) {
      return 'bg-amber-400 text-amber-950 font-black border-amber-500 shadow-xs';
    }
    if (isAnswered) {
      return 'bg-emerald-600 text-white font-bold border-transparent';
    }
    return 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200';
  };

  const answeredCount = questions.filter(
    (q) => !!answers[q.id] && answers[q.id].trim() !== '' && answers[q.id] !== '__SKIPPED__'
  ).length;

  const skippedCount = questions.filter(
    (q) => !!skippedQuestions[q.id] || answers[q.id] === '__SKIPPED__'
  ).length;

  const notStartedCount = questions.length - answeredCount - skippedCount;

  return (
    <div id="question-navigator-card" className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col">
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">
          Danh sách câu hỏi
        </h3>
        <span className="text-xs font-mono text-slate-700 bg-slate-50 px-2.5 py-0.5 rounded-md border border-slate-200 font-bold">
          {answeredCount} / {questions.length} Đã làm
        </span>
      </div>

      {/* Grid of Question Numbers */}
      <div className="grid grid-cols-5 gap-2 max-h-[300px] overflow-y-auto pr-1 flex-grow scrollbar-thin">
        {questions.map((q, idx) => {
          const isActive = q.id === currentQuestionId;
          const statusClass = getStatusColorClass(q.id);

          return (
            <button
              key={q.id}
              id={`nav-q-${q.id}`}
              onClick={() => onQuestionSelect(q.id)}
              className={`w-full aspect-square flex items-center justify-center text-xs font-bold rounded-lg border transition-all cursor-pointer ${statusClass} ${
                isActive ? 'ring-2 ring-indigo-900 ring-offset-2 scale-105 border-indigo-900 font-extrabold' : ''
              }`}
            >
              {(idx + 1).toString().padStart(2, '0')}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-5 space-y-2 border-t border-slate-100 pt-4 text-xs font-medium text-slate-600">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="w-3.5 h-3.5 rounded bg-emerald-600 mr-2 shrink-0"></div>
            <span>Đã làm ({answeredCount})</span>
          </div>
          <span className="text-[10px] font-bold text-emerald-700 font-mono">
            {questions.length > 0 ? Math.round((answeredCount / questions.length) * 100) : 0}%
          </span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="w-3.5 h-3.5 rounded bg-amber-400 border border-amber-500 mr-2 shrink-0"></div>
            <span>Đã bỏ qua ({skippedCount})</span>
          </div>
          <span className="text-[10px] font-bold text-amber-800 font-mono">
            {skippedCount} câu
          </span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="w-3.5 h-3.5 rounded bg-slate-100 border border-slate-200 mr-2 shrink-0"></div>
            <span>Chưa làm ({notStartedCount})</span>
          </div>
          <span className="text-[10px] font-bold text-slate-500 font-mono">
            {notStartedCount} câu
          </span>
        </div>
      </div>
    </div>
  );
}
