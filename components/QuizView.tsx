import React, { useMemo, useState } from 'react';
import { CheckCircle2, XCircle, Shuffle, Sparkles } from 'lucide-react';
import { KnowledgePoint, QuizQuestion, SubjectId } from '../types';
import { SUBJECTS, SUBJECT_IDS } from '../constants';
import { aiAvailable, generateQuestions } from '../services/geminiService';
import { RichText, SubjectBadge, AiTag, Spinner } from './ui';

interface Props {
  questions: QuizQuestion[];
  kps: KnowledgePoint[];
  onWrong: (questionId: string) => void;
  onAddQuestions: (qs: QuizQuestion[]) => void;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 智能刷题：按学科抽题作答，答错自动进错题本；可让 AI 围绕薄弱考点生成新题 */
const QuizView: React.FC<Props> = ({ questions, kps, onWrong, onAddQuestions }) => {
  const [subject, setSubject] = useState<SubjectId>('history');
  const [order, setOrder] = useState<string[]>([]);
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState({ right: 0, total: 0 });
  const [genBusy, setGenBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pool = useMemo(() => questions.filter((q) => q.subject === subject), [questions, subject]);
  const qMap = useMemo(() => new Map(questions.map((q) => [q.id, q])), [questions]);
  const current = order.length > 0 && idx < order.length ? qMap.get(order[idx]) : undefined;

  const start = () => {
    setOrder(shuffle(pool.map((q) => q.id)));
    setIdx(0);
    setPicked(null);
    setScore({ right: 0, total: 0 });
  };

  const pick = (i: number) => {
    if (!current || picked !== null) return;
    setPicked(i);
    const right = i === current.answer;
    setScore((s) => ({ right: s.right + (right ? 1 : 0), total: s.total + 1 }));
    if (!right) onWrong(current.id);
  };

  const genFromWeakKp = async () => {
    setGenBusy(true);
    setError(null);
    try {
      // 优先选没有配题的考点，让题库随知识库一起生长
      const candidates = kps.filter((k) => k.subject === subject);
      const withoutQ = candidates.filter((k) => !questions.some((q) => q.kpId === k.id));
      const target = (withoutQ.length > 0 ? withoutQ : candidates)[Math.floor(Math.random() * (withoutQ.length > 0 ? withoutQ.length : candidates.length))];
      const added = await generateQuestions(target, 3);
      onAddQuestions(added);
      setOrder((o) => [...o, ...added.map((q) => q.id)]);
    } catch (e) {
      setError(`AI 出题失败：${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setGenBusy(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex bg-white border border-slate-200 rounded-xl p-1">
          {SUBJECT_IDS.map((sid) => (
            <button
              key={sid}
              onClick={() => {
                setSubject(sid);
                setOrder([]);
              }}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
                subject === sid ? `${SUBJECTS[sid].bg} ${SUBJECTS[sid].color}` : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {SUBJECTS[sid].name}（{questions.filter((q) => q.subject === sid).length}）
            </button>
          ))}
        </div>
        <button
          onClick={start}
          className="flex items-center gap-1.5 text-sm px-4 py-1.5 rounded-xl bg-slate-800 text-white hover:bg-slate-700 transition"
        >
          <Shuffle className="w-4 h-4" />
          {order.length > 0 ? '重新抽题' : '开始刷题'}
        </button>
        {aiAvailable && (
          <button
            onClick={genFromWeakKp}
            disabled={genBusy}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-xl bg-violet-600 text-white hover:bg-violet-500 disabled:opacity-50 transition"
          >
            {genBusy ? <Spinner label="AI 命题中…" /> : (
              <>
                <Sparkles className="w-4 h-4" />
                AI 出新题（题库自我扩展）
              </>
            )}
          </button>
        )}
      </div>

      {error && <div className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-xl p-3">{error}</div>}

      {order.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500 text-sm">
          选择学科后点击「开始刷题」。答错的题会自动收进错题本；配置 AI 后题库还能围绕你的考点无限生长。
        </div>
      ) : !current ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <h2 className="text-xl font-bold text-slate-800">本轮完成</h2>
          <p className="mt-2 text-slate-500">
            正确率 {score.total > 0 ? Math.round((score.right / score.total) * 100) : 0}%（{score.right}/{score.total}）
          </p>
          <button onClick={start} className="mt-4 px-4 py-2 bg-slate-800 text-white rounded-xl text-sm hover:bg-slate-700 transition">
            再来一轮
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-center justify-between text-sm text-slate-400">
            <span className="flex items-center gap-2">
              <SubjectBadge subject={current.subject} small />
              {current.source === 'ai' && <AiTag />}
            </span>
            <span>
              第 {idx + 1} / {order.length} 题 · 答对 {score.right}
            </span>
          </div>
          <p className="mt-3 text-slate-900 font-medium leading-relaxed">{current.question}</p>
          <div className="mt-4 space-y-2">
            {current.options.map((opt, i) => {
              let cls = 'border-slate-200 hover:border-slate-400';
              if (picked !== null) {
                if (i === current.answer) cls = 'border-emerald-400 bg-emerald-50';
                else if (i === picked) cls = 'border-rose-400 bg-rose-50';
                else cls = 'border-slate-200 opacity-60';
              }
              return (
                <button
                  key={i}
                  onClick={() => pick(i)}
                  disabled={picked !== null}
                  className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition flex items-start gap-2 ${cls}`}
                >
                  <span className="font-semibold text-slate-400">{'ABCD'[i]}.</span>
                  <span className="text-slate-700">{opt}</span>
                  {picked !== null && i === current.answer && <CheckCircle2 className="w-4 h-4 text-emerald-500 ml-auto shrink-0 mt-0.5" />}
                  {picked !== null && i === picked && i !== current.answer && <XCircle className="w-4 h-4 text-rose-500 ml-auto shrink-0 mt-0.5" />}
                </button>
              );
            })}
          </div>
          {picked !== null && (
            <>
              <div className="mt-4 bg-slate-50 rounded-xl p-4 text-sm text-slate-600">
                <strong className="text-slate-800">解析：</strong>
                <RichText text={current.explanation} className="mt-1" />
              </div>
              <button
                onClick={() => {
                  setIdx((i) => i + 1);
                  setPicked(null);
                }}
                className="mt-4 w-full py-2.5 bg-slate-800 text-white rounded-xl text-sm font-medium hover:bg-slate-700 transition"
              >
                下一题
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default QuizView;
