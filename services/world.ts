import { KnowledgePoint, MasteryRecord } from '../types';
import { SPECIES, SpeciesDef, EVOLVE_EXP, PLAYER_START } from '../data/world';

/** 玩家拥有的文灵 */
export interface OwnedCreature {
  uid: string;
  speciesId: string;
  exp: number;
  hp: number; // 当前 HP（受伤会保留，回书院治疗）
}

export interface WorldData {
  creatures: OwnedCreature[];
  activeUid: string | null;
  items: { brush: number; herb: number }; // 文昌笔（捕捉）/ 灵芝草（战斗回血）
  materials: { wood: number; brick: number };
  buildings: string[];
  gymBadges: string[];
  seen: string[]; // 图鉴：遇见过的物种
  pos: { x: number; y: number };
}

export const DEFAULT_WORLD: WorldData = {
  creatures: [],
  activeUid: null,
  items: { brush: 3, herb: 1 },
  materials: { wood: 0, brick: 0 },
  buildings: [],
  gymBadges: [],
  seen: [],
  pos: { ...PLAYER_START },
};

export function speciesOf(id: string): SpeciesDef {
  return SPECIES.find((s) => s.id === id)!;
}

/** 由经验值得到进化阶段 0/1/2 */
export function stageOf(exp: number): number {
  if (exp >= EVOLVE_EXP[2]) return 2;
  if (exp >= EVOLVE_EXP[1]) return 1;
  return 0;
}

export function maxHpOf(stage: number): number {
  return 60 + stage * 30;
}

/** 该文灵绑定模块的真实掌握均值（0-5）——学得越熟，文灵越强 */
export function masteryAvgOf(species: SpeciesDef, kps: KnowledgePoint[], mastery: Record<string, MasteryRecord>): number {
  const list = kps.filter((k) => k.subject === species.subject && species.units.includes(k.unit));
  if (list.length === 0) return 0;
  const sum = list.reduce((acc, k) => acc + (mastery[k.id]?.level ?? 0), 0);
  return sum / list.length;
}

/** 文灵攻击力 = 基础 + 进化阶段 + 真实掌握加成 + 演武场加成 */
export function atkOf(stage: number, masteryAvg: number, buildings: string[]): number {
  return 12 + stage * 5 + Math.round(masteryAvg * 2) + (buildings.includes('arena') ? 4 : 0);
}

/** 野生文灵攻击力 */
export function wildAtkOf(stage: number): number {
  return 9 + stage * 5;
}

/** 捕捉成功率：血越残越好抓，文昌塔加成，封顶 92% */
export function catchChance(hpRatio: number, buildings: string[]): number {
  return Math.min(0.92, 0.18 + (1 - hpRatio) * 0.68 + (buildings.includes('tower') ? 0.12 : 0));
}

export function makeUid(): string {
  return `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

/** 战斗胜利经验（藏书阁 +25%） */
export function expGain(wildStage: number, gym: boolean, buildings: string[]): number {
  const base = gym ? 70 : 22 + wildStage * 12;
  return Math.round(base * (buildings.includes('library') ? 1.25 : 1));
}
