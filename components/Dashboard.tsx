import React from 'react';
import { CalendarClock, Flame, BookOpenCheck, Target, TrendingDown, Sparkles, ArrowRight, Zap, Trophy, CheckCircle2, Swords } from 'lucide-react';
import { KnowledgePoint, MasteryRecord, WrongRecord } from '../types';
import { SUBJECTS, SUBJECT_IDS, daysUntilExam, nextExamDate } from '../constants';
import { buildReviewQueue, isMastered, weakTopics, todayKey } from '../services/srs';
import { GameData, QUESTS, BADGES, computeStreak } from '../services/game';
import { ProgressBar, SubjectBadge } from './ui';

interface Props {
  kps: KnowledgePoint[];
  mastery: Record<string, MasteryRecord>;
  wrong: WrongRecord[];
  studyLog: Record<string, number>;
  game: GameData;
  aiKpCount: number;
  onGoReview: () => void;
  onGoSprint: () => void;
  onGoAdventure: () => void;
  onGoWrong: () => void;
}

const Dashboard: React.FC<Props> = ({ kps, mastery, wrong, studyLog, game, aiKpCount, onGoReview, onGoSprint, onGoAdventure, onGoWrong }) => {
  const days = daysUntilExam();
  const exam = nextExamDate();
  const { due, fresh } = buildReviewQueue(kps, mastery);
  const todayCount = studyLog[todayKey()] ?? 0;
  const unresolvedWrong = wrong.filter((w) => !w.resolved).length;
  const weak = weakTopics(kps, mastery).filter((t) => t.avg < 3).slice(0, 5);
  const streak = computeStreak(studyLog);
  const daily = game.daily.date === todayKey() ? game.daily : { review: 0, correct: 0, resolved: 0, rewarded: [] as string[] };

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
          <p className="mt-1 text-sm text-slate-300">每天：清「到期复习」→ 打一局「极速挑战」→ 睡前清错题。三步走，功名自然来。</p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <button
            onClick={onGoAdventure}
            className="flex items-center gap-2 bg-amber-400 hover:bg-amber-300 text-slate-900 font-semibold px-5 py-3 rounded-xl transition"
          >
            <Swords className="w-4 h-4" />
            赶考之路
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={onGoReview}
            className="flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold px-5 py-3 rounded-xl transition"
          >
            今日复习（{due.length + fresh.length}）
          </button>
          <button
            onClick={onGoSprint}
            className="flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold px-5 py-3 rounded-xl transition"
          >
            <Zap className="w-4 h-4 text-amber-400" />
            极速挑战
          </button>
        </div>
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
        <StatCard icon={<Trophy className="w-5 h-5 text-amber-500" />} label="极速挑战纪录" value={`${game.bestSprint} 分`} onClick={onGoSprint} />
      </div>

      {/* 每日任务 */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-slate-800 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            每日任务
          </span>
          <span className="text-xs text-slate-400">完成即领 XP，凌晨刷新</span>
        </div>
        <div className="mt-3 grid md:grid-cols-3 gap-3">
          {QUESTS.map((q) => {
            const progress = Math.min(daily[q.key], q.target);
            const doneQuest = daily.rewarded.includes(q.id);
            return (
              <div key={q.id} className={`rounded-xl border p-3 ${doneQuest ? 'border-emerald-200 bg-emerald-50/60' : 'border-slate-200'}`}>
                <div className="flex items-center justify-between text-sm">
                  <span className={doneQuest ? 'text-emerald-700 font-medium' : 'text-slate-700'}>{q.label}</span>
                  <span className={`text-xs font-semibold ${doneQuest ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {doneQuest ? '✓ 已领' : `+${q.reward} XP`}
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex-1">
                    <ProgressBar value={progress} max={q.target} colorClass={doneQuest ? 'bg-emerald-500' : 'bg-amber-400'} />
                  </div>
                  <span className="text-xs text-slate-400 tabular-nums">
                    {progress}/{q.target}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
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

      <div className="grid md:grid-cols-2 gap-4">
        {/* 薄弱专题 */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 font-semibold text-slate-800">
            <TrendingDown className="w-5 h-5 text-rose-500" />
            薄弱专题雷达
          </div>
          {weak.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">暂无明显薄弱专题——先去「今日复习」积累数据，系统会自动定位短板。</p>
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

        {/* 徽章墙 */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-800 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-violet-500" />
              功勋墙
            </span>
            <span className="text-xs text-slate-400">
              {game.badges.length}/{BADGES.length} · AI 新增考点 {aiKpCount} 张
            </span>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {BADGES.map((b) => {
              const owned = game.badges.includes(b.id);
              return (
                <div
                  key={b.id}
                  title={`${b.name}：${b.desc}`}
                  className={`rounded-xl border p-2.5 text-center transition ${
                    owned ? 'border-amber-200 bg-amber-50/70' : 'border-slate-100 bg-slate-50 opacity-45 grayscale'
                  }`}
                >
                  <div className="text-xl">{b.icon}</div>
                  <div className={`mt-1 text-[11px] font-medium ${owned ? 'text-amber-800' : 'text-slate-400'}`}>{b.name}</div>
                </div>
              );
            })}
          </div>
        </div>
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
