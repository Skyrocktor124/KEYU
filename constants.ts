import { SubjectId } from './types';

export const SUBJECTS: Record<
  SubjectId,
  { name: string; short: string; color: string; bg: string; border: string; desc: string }
> = {
  history: {
    name: '历史',
    short: '史',
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-300',
    desc: '《中外历史纲要》上下册 + 选择性必修',
  },
  geography: {
    name: '地理',
    short: '地',
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
    border: 'border-emerald-300',
    desc: '自然地理 + 人文地理 + 区域发展与国家安全',
  },
  politics: {
    name: '政治',
    short: '政',
    color: 'text-rose-700',
    bg: 'bg-rose-50',
    border: 'border-rose-300',
    desc: '必修四册 + 选择性必修 + 时政热点',
  },
};

export const SUBJECT_IDS: SubjectId[] = ['history', 'geography', 'politics'];

/** 间隔重复：level 1-5 对应的复习间隔（天），level 0 表示立即到期 */
export const SRS_INTERVALS_DAYS = [0, 1, 3, 7, 15, 30];

/** 视为「已掌握」的最低等级 */
export const MASTERED_LEVEL = 4;

/** 每天最多引入的新考点数（复习优先，防止贪多） */
export const NEW_CARDS_PER_DAY = 12;

/** 北京高考（等级考）时间：每年 6 月上旬。返回下一次考试日期 */
export function nextExamDate(now = new Date()): Date {
  const thisYear = new Date(now.getFullYear(), 5, 9); // 6 月 9 日等级考结束前都算本届
  return now <= thisYear ? thisYear : new Date(now.getFullYear() + 1, 5, 9);
}

export function daysUntilExam(now = new Date()): number {
  return Math.max(0, Math.ceil((nextExamDate(now).getTime() - now.getTime()) / 86400000));
}

export const STORAGE_KEYS = {
  mastery: 'jhwk_mastery',
  wrong: 'jhwk_wrong',
  aiKps: 'jhwk_ai_kps',
  aiQuestions: 'jhwk_ai_questions',
  studyLog: 'jhwk_study_log',
  game: 'jhwk_game',
  adventure: 'jhwk_adventure',
  world: 'jhwk_world',
  academy: 'jhwk_academy',
};

export const GEMINI_MODEL = 'gemini-3-flash-preview';
