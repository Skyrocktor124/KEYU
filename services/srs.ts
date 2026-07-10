import { MasteryRecord, ReviewGrade, KnowledgePoint } from '../types';
import { SRS_INTERVALS_DAYS, MASTERED_LEVEL, NEW_CARDS_PER_DAY } from '../constants';

const DAY = 86400000;

export function endOfToday(now = Date.now()): number {
  const d = new Date(now);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

export function todayKey(now = Date.now()): string {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * 简化版 SM-2 间隔重复：
 * - 忘了(again)：等级回落到 1，明天重来，并计一次遗忘
 * - 一般(good)：等级 +1
 * - 轻松(easy)：等级 +2
 * 等级对应间隔见 SRS_INTERVALS_DAYS，达到 MASTERED_LEVEL 视为掌握。
 */
export function rateCard(prev: MasteryRecord | undefined, kpId: string, grade: ReviewGrade, now = Date.now()): MasteryRecord {
  const level = prev?.level ?? 0;
  let next: number;
  if (grade === 'again') next = 1;
  else if (grade === 'good') next = Math.min(level + 1, 5);
  else next = Math.min(level + 2, 5);

  return {
    kpId,
    level: next,
    lastReview: now,
    nextReview: now + SRS_INTERVALS_DAYS[next] * DAY,
    reviews: (prev?.reviews ?? 0) + 1,
    lapses: (prev?.lapses ?? 0) + (grade === 'again' ? 1 : 0),
  };
}

export function isMastered(rec: MasteryRecord | undefined): boolean {
  return !!rec && rec.level >= MASTERED_LEVEL;
}

/** 今日复习队列 = 所有到期卡片 + 限量新卡片（未学习过的） */
export function buildReviewQueue(
  kps: KnowledgePoint[],
  mastery: Record<string, MasteryRecord>,
  now = Date.now(),
): { due: KnowledgePoint[]; fresh: KnowledgePoint[] } {
  const eod = endOfToday(now);
  const due: KnowledgePoint[] = [];
  const fresh: KnowledgePoint[] = [];
  for (const kp of kps) {
    const rec = mastery[kp.id];
    if (!rec) {
      if (fresh.length < NEW_CARDS_PER_DAY) fresh.push(kp);
    } else if (rec.nextReview <= eod) {
      due.push(kp);
    }
  }
  due.sort((a, b) => (mastery[a.id]?.nextReview ?? 0) - (mastery[b.id]?.nextReview ?? 0));
  return { due, fresh };
}

/** 学科薄弱专题：按平均掌握等级升序（只统计已学过的专题） */
export function weakTopics(
  kps: KnowledgePoint[],
  mastery: Record<string, MasteryRecord>,
): { topic: string; subject: string; avg: number; count: number }[] {
  const byTopic = new Map<string, { subject: string; sum: number; count: number; studied: number }>();
  for (const kp of kps) {
    const key = kp.topic;
    const cur = byTopic.get(key) ?? { subject: kp.subject, sum: 0, count: 0, studied: 0 };
    cur.count += 1;
    const rec = mastery[kp.id];
    if (rec) {
      cur.sum += rec.level;
      cur.studied += 1;
    }
    byTopic.set(key, cur);
  }
  return [...byTopic.entries()]
    .filter(([, v]) => v.studied > 0)
    .map(([topic, v]) => ({ topic, subject: v.subject, avg: v.sum / v.studied, count: v.count }))
    .sort((a, b) => a.avg - b.avg);
}
