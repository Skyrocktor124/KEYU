import { KnowledgePoint, QuizQuestion, SubjectId } from '../types';
import { StageDef } from '../data/adventure';

/** 赶考之路的存档 */
export interface AdventureData {
  coins: number;
  items: { ginseng: number; exclude: number }; // 参汤（回血）/ 锦囊（排除两个错误项）
  stars: Record<string, number>; // stageId -> 0-3 星
}

export const DEFAULT_ADVENTURE: AdventureData = {
  coins: 60,
  items: { ginseng: 1, exclude: 2 },
  stars: {},
};

export const ITEM_PRICES = { ginseng: 50, exclude: 40 };

/** 战斗用题：与 QuizQuestion 同构，realId 存在时表示来自真题库（答错要进错题本） */
export interface BattleQuestion {
  question: string;
  options: string[];
  answer: number;
  explanation: string;
  subject: SubjectId;
  realId?: string;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 关卡的真题池（含 AI 生成的题，题库越长战斗越丰富） */
export function stageRealQuestions(stage: StageDef, questions: QuizQuestion[], kps: KnowledgePoint[]): QuizQuestion[] {
  const kpUnit = new Map(kps.map((k) => [k.id, k.unit]));
  return questions.filter((q) => {
    if (!stage.subjects.includes(q.subject)) return false;
    if (!stage.units) return true;
    const unit = q.kpId ? kpUnit.get(q.kpId) : undefined;
    return unit === undefined || stage.units.includes(unit);
  });
}

/** 关卡考点池 */
export function stageKps(stage: StageDef, kps: KnowledgePoint[]): KnowledgePoint[] {
  return kps.filter((k) => stage.subjects.includes(k.subject) && (!stage.units || stage.units.includes(k.unit)));
}

/**
 * 自动生成「揪出伪装者」题：给出某考点的 3 个真关键词 + 1 个混入的外来术语。
 * 术语归属辨析本身就是选择题干扰项的解法基本功，同时让小怪战题量无限。
 */
export function makeIntruderQuestion(pool: KnowledgePoint[], all: KnowledgePoint[]): BattleQuestion | null {
  const candidates = pool.filter((k) => k.keywords.length >= 3);
  if (candidates.length === 0 || all.length < 2) return null;
  const kp = candidates[Math.floor(Math.random() * candidates.length)];
  const others = all.filter((k) => k.topic !== kp.topic && k.keywords.length > 0);
  if (others.length === 0) return null;
  const other = others[Math.floor(Math.random() * others.length)];
  const intruder = other.keywords[Math.floor(Math.random() * other.keywords.length)];
  if (kp.keywords.includes(intruder)) return null;
  const own = shuffle(kp.keywords).slice(0, 3);
  const options = shuffle([...own, intruder]);
  return {
    question: `【揪出伪装者】下列术语中，哪一个不属于考点「${kp.title}」？`,
    options,
    answer: options.indexOf(intruder),
    explanation: `「${intruder}」属于考点「${other.title}」（${other.topic}）。其余三项（${own.join('、')}）都是「${kp.title}」的核心术语。`,
    subject: kp.subject,
  };
}

export function toBattleQuestion(q: QuizQuestion): BattleQuestion {
  return { question: q.question, options: q.options, answer: q.answer, explanation: q.explanation, subject: q.subject, realId: q.id };
}

/**
 * 抽一道战斗题：小怪 50% 概率出「伪装者」快问题，精英与 Boss 只出真题。
 * avoid 用于避免同一场战斗内真题重复。
 */
export function drawQuestion(
  kind: 'minion' | 'elite' | 'boss',
  reals: QuizQuestion[],
  pool: KnowledgePoint[],
  all: KnowledgePoint[],
  avoid: Set<string>,
): BattleQuestion | null {
  const freshReals = reals.filter((q) => !avoid.has(q.id));
  const realList = freshReals.length > 0 ? freshReals : reals;
  const wantIntruder = kind === 'minion' && Math.random() < 0.5;
  if (!wantIntruder && realList.length > 0) {
    return toBattleQuestion(realList[Math.floor(Math.random() * realList.length)]);
  }
  return makeIntruderQuestion(pool, all) ?? (realList.length > 0 ? toBattleQuestion(realList[Math.floor(Math.random() * realList.length)]) : null);
}
