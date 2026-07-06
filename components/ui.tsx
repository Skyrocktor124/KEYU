import React from 'react';
import { SubjectId } from '../types';
import { SUBJECTS } from '../constants';

/** 渲染 **加粗** 与换行的轻量富文本 */
export const RichText: React.FC<{ text: string; className?: string }> = ({ text, className }) => (
  <div className={className}>
    {text.split('\n').map((line, i) => (
      <p key={i} className="mb-2 last:mb-0 leading-relaxed">
        {line.split(/(\*\*[^*]+\*\*)/g).map((seg, j) =>
          seg.startsWith('**') && seg.endsWith('**') ? (
            <strong key={j} className="font-semibold text-slate-900 bg-yellow-100/80 rounded px-0.5">
              {seg.slice(2, -2)}
            </strong>
          ) : (
            <React.Fragment key={j}>{seg}</React.Fragment>
          ),
        )}
      </p>
    ))}
  </div>
);

export const SubjectBadge: React.FC<{ subject: SubjectId; small?: boolean }> = ({ subject, small }) => {
  const s = SUBJECTS[subject];
  return (
    <span
      className={`inline-flex items-center rounded-full border ${s.border} ${s.bg} ${s.color} font-medium ${
        small ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm'
      }`}
    >
      {s.name}
    </span>
  );
};

/** 掌握等级圆点（0-5） */
export const LevelDots: React.FC<{ level: number }> = ({ level }) => (
  <span className="inline-flex gap-1 items-center" title={`掌握等级 ${level}/5`}>
    {[1, 2, 3, 4, 5].map((i) => (
      <span key={i} className={`w-2 h-2 rounded-full ${i <= level ? 'bg-emerald-500' : 'bg-slate-200'}`} />
    ))}
  </span>
);

export const ProgressBar: React.FC<{ value: number; max: number; colorClass?: string }> = ({ value, max, colorClass = 'bg-emerald-500' }) => (
  <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
    <div className={`h-full ${colorClass} transition-all`} style={{ width: `${max > 0 ? Math.min(100, (value / max) * 100) : 0}%` }} />
  </div>
);

export const AiTag: React.FC = () => (
  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-violet-100 text-violet-700 border border-violet-200">
    AI 生成
  </span>
);

export const Spinner: React.FC<{ label?: string }> = ({ label }) => (
  <span className="inline-flex items-center gap-2 text-sm text-slate-500">
    <span className="w-4 h-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
    {label}
  </span>
);
