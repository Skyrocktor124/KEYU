import React, { useState } from 'react';
import { CheckCircle2, XCircle, BadgeCheck } from 'lucide-react';
import { QuizQuestion, WrongRecord } from '../types';
import { RichText, SubjectBadge, AiTag } from './ui';

interface Props {
  wrong: WrongRecord[];
  questions: QuizQuestion[];
  onResolve: (questionId: string) => void;
  onWrongAgain: (questionId: string) => void;
}

/** 错题本：重做答对即可「销账」，再错则累计次数——考前只看错过 2 次以上的题 */
const WrongBook: React.FC<Props> = ({ wrong, questions, onResolve, onWrongAgain }) => {
  const [retryId, setRetryId] = useState<string | null>(null);
  const [picked, setPicked] = useState<number | null>(null);

  const qMap = new Map<string, QuizQuestion>(questions.map((q) => [q.id, q]));
  const active = wrong.filter((w) => !w.resolved && qMap.has(w.questionId)).sort((a, b) => b.times - a.times);
  const resolved = wrong.filter((w) => w.resolved).length;

  if (active.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
        <BadgeCheck className="w-12 h-12 text-emerald-500 mx-auto" />
        <h2 className="mt-4 text-xl font-bold text-slate-800">错题已清空</h2>
        <p className="mt-2 text-slate-500 text-sm">{resolved > 0 ? `已销账 ${resolved} 道错题。` : ''}去「智能刷题」继续检验吧。</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-3">
      <p className="text-sm text-slate-500">
        待销账 <strong className="text-slate-800">{active.length}</strong> 道（重做答对即销账）· 已销账 {resolved} 道
      </p>
      {active.map((w) => {
        const q = qMap.get(w.questionId)!;
        const retrying = retryId === q.id;
        return (
          <div key={q.id} className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <SubjectBadge subject={q.subject} small />
                {q.source === 'ai' && <AiTag />}
                {w.times > 1 && (
                  <span className="text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-200 rounded-full px-2 py-0.5">
                    错 {w.times} 次
                  </span>
                )}
              </span>
              {!retrying && (
                <button
                  onClick={() => {
                    setRetryId(q.id);
                    setPicked(null);
                  }}
                  className="text-sm text-slate-600 hover:text-slate-900 underline underline-offset-2"
                >
                  重做
                </button>
              )}
            </div>
            <p className="mt-2 text-slate-800 text-sm font-medium leading-relaxed">{q.question}</p>
            {retrying && (
              <div className="mt-3 space-y-2">
                {q.options.map((opt, i) => {
                  let cls = 'border-slate-200 hover:border-slate-400';
                  if (picked !== null) {
                    if (i === q.answer) cls = 'border-emerald-400 bg-emerald-50';
                    else if (i === picked) cls = 'border-rose-400 bg-rose-50';
                    else cls = 'border-slate-200 opacity-60';
                  }
                  return (
                    <button
                      key={i}
                      disabled={picked !== null}
                      onClick={() => {
                        setPicked(i);
                        if (i === q.answer) onResolve(q.id);
                        else onWrongAgain(q.id);
                      }}
                      className={`w-full text-left px-4 py-2.5 rounded-xl border text-sm transition flex items-start gap-2 ${cls}`}
                    >
                      <span className="font-semibold text-slate-400">{'ABCD'[i]}.</span>
                      <span className="text-slate-700">{opt}</span>
                      {picked !== null && i === q.answer && <CheckCircle2 className="w-4 h-4 text-emerald-500 ml-auto shrink-0 mt-0.5" />}
                      {picked !== null && i === picked && i !== q.answer && <XCircle className="w-4 h-4 text-rose-500 ml-auto shrink-0 mt-0.5" />}
                    </button>
                  );
                })}
                {picked !== null && (
                  <div className="bg-slate-50 rounded-xl p-3 text-sm text-slate-600">
                    <strong className="text-slate-800">解析：</strong>
                    <RichText text={q.explanation} className="mt-1" />
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default WrongBook;
