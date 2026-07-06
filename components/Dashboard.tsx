import React from 'react';
import { CalendarClock, Flame, BookOpenCheck, Target, TrendingDown, Sparkles, ArrowRight } from 'lucide-react';
import { KnowledgePoint, MasteryRecord, WrongRecord } from '../types';
import { SUBJECTS, SUBJECT_IDS, daysUntilExam, nextExamDate } from '../constants';
import { buildReviewQueue, isMastered, weakTopics, todayKey } from '../services/srs';
import { ProgressBar, SubjectBadge } from './ui';

interface Props {
  kps: KnowledgePoint[];
  mastery: Record<string, MasteryRecord>;
  wrong: WrongRecord[];
  studyLog: Record<string, number>;
  aiKpCount: number;
  onGoReview: () => void;
  onGoWrong: () => void;
}

const Dashboard: React.FC<Props> = ({ kps, mastery, wrong, studyLog, aiKpCount, onGoReview, onGoWrong }) => {
  const days = daysUntilExam();
  const exam = nextExamDate();
  const { due, fresh } = buildReviewQueue(kps, mastery);
  const todayCount = studyLog[todayKey()] ?? 0;
  const unresolvedWrong = wrong.filter((w) => !w.resolved).length;
  const weak = weakTopics(kps, mastery).filter((t) => t.avg < 3).slice(0, 5);

  // 连续学习天数
  let streak = 0;
  const d = new Date();
  if (!studyLog[todayKey(d.getTime())]) d.setDate(d.getDate() - 1);
  while (studyLog[todayKey(d.getTime())]) {
    streak += 1;
    d.setDate(d.getDate() - 1);
  }

  return (
    <div className="space-y-6">
      {/* 倒计时横幅 */}
      <div className="rounded-2xl bg-gradient-to-r from-slate-800 to-slate-700 text-white p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-slate-300 text-sm">
            <CalendarClock className="w-4 h-4" />
            北京高考等级考（{exam.getFullYear()} 年 6 月）
          </div>
          <div className="mt-1 text-3xl font-bold">
            距考试还有 <span className="text-amber-400">{days}</span> 天
          </div>
          <p className="mt-1 text-sm text-slate-300">短期突破策略：每天先清「到期复习」，再攻「薄弱专题」，错题当天回炉。</p>
        </div>
        <button
          onClick={onGoReview}
          className="flex items-center gap-2 bg-amber-400 hover:bg-amber-300 text-slate-900 font-semibold px-5 py-3 rounded-xl transition"
        >
          开始今日复习（{due.length + fresh.length}）
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* 数据卡 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={<BookOpenCheck className="w-5 h-5 text-emerald-600" />} label="今日已复习" value={`${todayCount} 张`} />
        <StatCard icon={<Flame className="w-5 h-5 text-orange-500" />} label="连续学习" value={`${streak} 天`} />
        <StatCard
          icon={<Target className="w-5 h-5 text-rose-500" />}
          label="待清错题"
          value={`${unresolvedWrong} 道`}
          onClick={unresolvedWrong > 0 ? onGoWrong : undefined}
        />
        <StatCard icon={<Sparkles className="w-5 h-5 text-violet-500" />} label="AI 迭代新增考点" value={`${aiKpCount} 张`} />
      </div>

      {/* 三科掌握度 */}
      <div className="grid md:grid-cols-3 gap-4">
        {SUBJECT_IDS.map((sid) => {
          const list = kps.filter((k) => k.subject === sid);
          const mastered = list.filter((k) => isMastered(mastery[k.id])).length;
          const started = list.filter((k) => mastery[k.id]).length;
          return (
            <div key={sid} className="bg-white rounded-2xl border border-slate-200 p-5">
              <div className="flex items-center justify-between">
                <SubjectBadge subject={sid} />
                <span className="text-sm text-slate-500">
                  掌握 {mastered}/{list.length}
                </span>
              </div>
              <div className="mt-3">
                <ProgressBar value={mastered} max={list.length} />
              </div>
              <p className="mt-2 text-xs text-slate-500">已学 {started} 个考点 · {SUBJECTS[sid].desc}</p>
            </div>
          );
        })}
      </div>

      {/* 薄弱专题 */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex items-center gap-2 font-semibold text-slate-800">
          <TrendingDown className="w-5 h-5 text-rose-500" />
          薄弱专题雷达（平均掌握等级 &lt; 3）
        </div>
        {weak.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">暂无明显薄弱专题——先去「今日复习」积累学习数据，系统会自动定位你的短板。</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {weak.map((t) => (
              <li key={t.topic} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <SubjectBadge subject={t.subject as any} small />
                  <span className="text-slate-700">{t.topic}</span>
                </span>
                <span className="text-slate-400">均值 {t.avg.toFixed(1)} / 5</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

const StatCard: React.FC<{ icon: React.ReactNode; label: string; value: string; onClick?: () => void }> = ({ icon, label, value, onClick }) => (
  <div
    onClick={onClick}
    className={`bg-white rounded-2xl border border-slate-200 p-4 ${onClick ? 'cursor-pointer hover:border-slate-400 transition' : ''}`}
  >
    <div className="flex items-center gap-2 text-sm text-slate-500">
      {icon}
      {label}
    </div>
    <div className="mt-2 text-2xl font-bold text-slate-800">{value}</div>
  </div>
);

export default Dashboard;
