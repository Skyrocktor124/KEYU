import React, { useMemo, useState } from 'react';
import { Eye, RotateCcw, Check, Zap, PartyPopper } from 'lucide-react';
import { KnowledgePoint, MasteryRecord, ReviewGrade } from '../types';
import { buildReviewQueue } from '../services/srs';
import { sfx } from '../services/effects';
import { RichText, SubjectBadge, LevelDots, AiTag } from './ui';

interface Props {
  kps: KnowledgePoint[];
  mastery: Record<string, MasteryRecord>;
  onRate: (kpId: string, grade: ReviewGrade) => void;
}

/**
 * 今日复习：闪卡式间隔重复。
 * 队列在进入页面时快照，「忘了」的卡片回到队尾当场重过一遍。
 */
const ReviewSession: React.FC<Props> = ({ kps, mastery, onRate }) => {
  const initialQueue = useMemo(() => {
    const { due, fresh } = buildReviewQueue(kps, mastery);
    return [...due, ...fresh].map((k) => k.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [queue, setQueue] = useState<string[]>(initialQueue);
  const [revealed, setRevealed] = useState(false);
  const [done, setDone] = useState(0);

  const kpMap = useMemo(() => new Map(kps.map((k) => [k.id, k])), [kps]);
  const current = queue.length > 0 ? kpMap.get(queue[0]) : undefined;

  const grade = (g: ReviewGrade) => {
    if (!current) return;
    g === 'again' ? sfx.wrong() : sfx.correct();
    onRate(current.id, g);
    setRevealed(false);
    setQueue((q) => {
      const rest = q.slice(1);
      return g === 'again' ? [...rest, current.id] : rest; // 忘了的卡片队尾再来一遍
    });
    if (g !== 'again') setDone((n) => n + 1);
  };

  if (!current) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
        <PartyPopper className="w-12 h-12 text-amber-500 mx-auto" />
        <h2 className="mt-4 text-xl font-bold text-slate-800">今日复习完成！</h2>
        <p className="mt-2 text-slate-500">
          {done > 0 ? `本次巩固了 ${done} 个考点。` : '当前没有到期的考点。'}
          可以去「智能刷题」检验效果，或到「知识库」预习新专题。
        </p>
      </div>
    );
  }

  const rec = mastery[current.id];

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between text-sm text-slate-500 mb-3">
        <span>
          剩余 <strong className="text-slate-800">{queue.length}</strong> 张 · 已完成 {done}
        </span>
        <LevelDots level={rec?.level ?? 0} />
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center gap-2 flex-wrap">
            <SubjectBadge subject={current.subject} small />
            <span className="text-xs text-slate-400">
              {current.unit} · {current.topic}
            </span>
            {current.source === 'ai' && <AiTag />}
          </div>
          <h2 className="mt-2 text-xl font-bold text-slate-900">{current.title}</h2>
          <p className="mt-1 text-sm text-slate-500">先在脑中复述要点，再翻开答案对照。</p>
        </div>

        {revealed ? (
          <div className="p-6 bg-slate-50">
            <RichText text={current.content} className="text-slate-700 text-[15px]" />
            {current.examTip && (
              <div className="mt-4 text-sm bg-amber-50 border border-amber-200 rounded-xl p-3 text-amber-800">
                <strong>考法提示：</strong>
                {current.examTip}
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {current.keywords.map((kw) => (
                <span key={kw} className="text-xs bg-slate-200/70 text-slate-600 rounded-full px-2 py-0.5">
                  {kw}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <button
            onClick={() => {
              sfx.flip();
              setRevealed(true);
            }}
            className="w-full p-10 flex items-center justify-center gap-2 text-slate-500 hover:bg-slate-50 transition"
          >
            <Eye className="w-5 h-5" />
            显示考点内容
          </button>
        )}

        {revealed && (
          <div className="grid grid-cols-3 divide-x divide-slate-100 border-t border-slate-100">
            <GradeBtn onClick={() => grade('again')} icon={<RotateCcw className="w-4 h-4" />} label="忘了" sub="今天再来" color="text-rose-600" />
            <GradeBtn onClick={() => grade('good')} icon={<Check className="w-4 h-4" />} label="一般" sub="按曲线复习" color="text-slate-700" />
            <GradeBtn onClick={() => grade('easy')} icon={<Zap className="w-4 h-4" />} label="轻松" sub="拉长间隔" color="text-emerald-600" />
          </div>
        )}
      </div>
    </div>
  );
};

const GradeBtn: React.FC<{ onClick: () => void; icon: React.ReactNode; label: string; sub: string; color: string }> = ({
  onClick,
  icon,
  label,
  sub,
  color,
}) => (
  <button onClick={onClick} className="py-4 hover:bg-slate-50 transition flex flex-col items-center gap-0.5">
    <span className={`flex items-center gap-1.5 font-semibold ${color}`}>
      {icon}
      {label}
    </span>
    <span className="text-xs text-slate-400">{sub}</span>
  </button>
);

export default ReviewSession;
