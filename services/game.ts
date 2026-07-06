import { ReviewGrade, SubjectId } from '../types';
import { todayKey } from './srs';

/**
 * 游戏化引擎：XP / 科举等级 / 连击 / 每日任务 / 成就徽章。
 * 主题：从「童生」一路考到「状元」——与高考冲刺天然同构。
 */

export interface GameData {
  xp: number;
  bestSprint: number;
  soundOn: boolean;
  badges: string[];
  daily: { date: string; review: number; correct: number; resolved: number; rewarded: string[] };
  totals: {
    reviews: number;
    answered: number;
    correct: number;
    resolved: number;
    maxCombo: number;
    perfectRounds: number;
    subjects: SubjectId[];
  };
}

export const DEFAULT_GAME: GameData = {
  xp: 0,
  bestSprint: 0,
  soundOn: true,
  badges: [],
  daily: { date: '', review: 0, correct: 0, resolved: 0, rewarded: [] },
  totals: { reviews: 0, answered: 0, correct: 0, resolved: 0, maxCombo: 0, perfectRounds: 0, subjects: [] },
};

/** 科举功名进阶：等级越高，路越难走——就像真实的科考 */
export const LEVELS = [
  { title: '童生', xp: 0, motto: '开蒙入学，万里之行始于足下' },
  { title: '秀才', xp: 100, motto: '初入县学，已胜过十之七八' },
  { title: '廪生', xp: 260, motto: '官府供米的优等生，稳扎稳打' },
  { title: '举人', xp: 480, motto: '乡试中式，鲤鱼已跃龙门' },
  { title: '解元', xp: 760, motto: '乡试第一！唐伯虎也不过如此' },
  { title: '贡士', xp: 1100, motto: '会试登科，殿试在望' },
  { title: '会元', xp: 1500, motto: '会试魁首，距三元只差一步' },
  { title: '进士', xp: 2000, motto: '金榜题名，天子门生' },
  { title: '探花', xp: 2600, motto: '一甲第三，风流天下闻' },
  { title: '榜眼', xp: 3300, motto: '一甲第二，只在状元一人之下' },
  { title: '状元', xp: 4100, motto: '大魁天下！文科考场再无敌手' },
];

export interface LevelInfo {
  index: number;
  title: string;
  motto: string;
  cur: number; // 当前等级起点
  next: number | null; // 下一等级门槛
  progress: number; // 0-1
}

export function levelOf(xp: number): LevelInfo {
  let index = 0;
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].xp) {
      index = i;
      break;
    }
  }
  const cur = LEVELS[index].xp;
  const next = index + 1 < LEVELS.length ? LEVELS[index + 1].xp : null;
  return {
    index,
    title: LEVELS[index].title,
    motto: LEVELS[index].motto,
    cur,
    next,
    progress: next === null ? 1 : (xp - cur) / (next - cur),
  };
}

export const QUESTS = [
  { id: 'q-review', label: '复习 10 张考点卡', key: 'review' as const, target: 10, reward: 40 },
  { id: 'q-correct', label: '刷题答对 8 道', key: 'correct' as const, target: 8, reward: 40 },
  { id: 'q-resolve', label: '销账 2 道错题', key: 'resolved' as const, target: 2, reward: 30 },
];

export interface BadgeDef {
  id: string;
  name: string;
  desc: string;
  icon: string;
  test: (d: GameData, streak: number) => boolean;
}

export const BADGES: BadgeDef[] = [
  { id: 'first-blood', name: '初试锋芒', desc: '完成第一次复习', icon: '⚔️', test: (d) => d.totals.reviews >= 1 },
  { id: 'combo-10', name: '十连斩', desc: '刷题连对 10 题', icon: '🔥', test: (d) => d.totals.maxCombo >= 10 },
  { id: 'cards-100', name: '百卡斩', desc: '累计复习 100 张卡', icon: '🗡️', test: (d) => d.totals.reviews >= 100 },
  { id: 'resolver', name: '错题终结者', desc: '销账 10 道错题', icon: '🧹', test: (d) => d.totals.resolved >= 10 },
  { id: 'tri-master', name: '三科全能', desc: '史地政三科都学过', icon: '🎯', test: (d) => d.totals.subjects.length >= 3 },
  { id: 'streak-7', name: '七日之约', desc: '连续学习 7 天', icon: '📅', test: (_d, streak) => streak >= 7 },
  { id: 'sprint-150', name: '极速之王', desc: '极速挑战单局 150 分', icon: '⚡', test: (d) => d.bestSprint >= 150 },
  { id: 'perfect', name: '满分卷', desc: '一轮刷题（≥5题）全对', icon: '💯', test: (d) => d.totals.perfectRounds >= 1 },
  { id: 'zhuangyuan', name: '状元及第', desc: '修行至最高等级', icon: '👑', test: (d) => levelOf(d.xp).index === LEVELS.length - 1 },
];

export type GameEvent =
  | { type: 'review'; grade: ReviewGrade; subject: SubjectId }
  | { type: 'answer'; correct: boolean; combo: number; subject: SubjectId }
  | { type: 'roundEnd'; right: number; total: number }
  | { type: 'resolve' }
  | { type: 'sprintEnd'; score: number; maxCombo: number };

export interface GameResult {
  data: GameData;
  xpGain: number;
  messages: string[];
  newBadges: BadgeDef[];
  levelUp: LevelInfo | null;
}

export function computeStreak(studyLog: Record<string, number>, now = Date.now()): number {
  let streak = 0;
  const d = new Date(now);
  if (!studyLog[todayKey(d.getTime())]) d.setDate(d.getDate() - 1);
  while (studyLog[todayKey(d.getTime())]) {
    streak += 1;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

/** 纯函数：结算一次游戏事件（XP、任务、徽章、升级），副作用（音效/特效）由调用方触发 */
export function applyEvent(prev: GameData, ev: GameEvent, streak: number): GameResult {
  const d: GameData = JSON.parse(JSON.stringify(prev));
  const today = todayKey();
  if (d.daily.date !== today) d.daily = { date: today, review: 0, correct: 0, resolved: 0, rewarded: [] };

  const before = levelOf(d.xp);
  let xpGain = 0;
  const messages: string[] = [];
  const addSubject = (s: SubjectId) => {
    if (!d.totals.subjects.includes(s)) d.totals.subjects.push(s);
  };

  switch (ev.type) {
    case 'review':
      xpGain += ev.grade === 'again' ? 2 : ev.grade === 'good' ? 10 : 14;
      d.daily.review += 1;
      d.totals.reviews += 1;
      addSubject(ev.subject);
      break;
    case 'answer':
      d.totals.answered += 1;
      addSubject(ev.subject);
      if (ev.correct) {
        xpGain += 15 + Math.min(ev.combo, 5) * 3; // 连击加成，上限 +15
        d.daily.correct += 1;
        d.totals.correct += 1;
        d.totals.maxCombo = Math.max(d.totals.maxCombo, ev.combo);
      } else {
        xpGain += 3; // 错了也有辛苦分——看解析才是重点
      }
      break;
    case 'roundEnd':
      if (ev.total >= 5 && ev.right === ev.total) {
        d.totals.perfectRounds += 1;
        xpGain += 30;
        messages.push('💯 满分卷！额外 +30 XP');
      }
      break;
    case 'resolve':
      xpGain += 25;
      d.daily.resolved += 1;
      d.totals.resolved += 1;
      break;
    case 'sprintEnd':
      xpGain += Math.round(ev.score / 2);
      d.bestSprint = Math.max(d.bestSprint, ev.score);
      d.totals.maxCombo = Math.max(d.totals.maxCombo, ev.maxCombo);
      break;
  }

  // 每日任务：进度冲线即自动发奖
  for (const q of QUESTS) {
    if (d.daily[q.key] >= q.target && !d.daily.rewarded.includes(q.id)) {
      d.daily.rewarded.push(q.id);
      xpGain += q.reward;
      messages.push(`✅ 每日任务「${q.label}」完成 +${q.reward} XP`);
    }
  }

  d.xp += xpGain;

  // 徽章检定
  const newBadges: BadgeDef[] = [];
  for (const b of BADGES) {
    if (!d.badges.includes(b.id) && b.test(d, streak)) {
      d.badges.push(b.id);
      newBadges.push(b);
    }
  }

  const after = levelOf(d.xp);
  return { data: d, xpGain, messages, newBadges, levelUp: after.index > before.index ? after : null };
}
