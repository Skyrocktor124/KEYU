import { SubjectId } from '../types';

/**
 * 文灵世界：宝可梦式的沉浸学习世界。
 * 每只「文灵」绑定一组教材模块——它的题目来自该模块，
 * 它的攻击力随你对该模块的真实掌握度（SRS 等级）成长。
 */

export interface SpeciesDef {
  id: string;
  subject: SubjectId;
  units: string[]; // 绑定的教材模块
  stages: { name: string; emoji: string }[]; // 三段进化
  lore: string;
}

export const SPECIES: SpeciesDef[] = [
  // ---- 历史（赤系）----
  {
    id: 'sp-jiagu',
    subject: 'history',
    units: ['中国古代史'],
    stages: [
      { name: '甲骨雏', emoji: '🐣' },
      { name: '青铜麒', emoji: '🦬' },
      { name: '鼎天圣兽', emoji: '🐲' },
    ],
    lore: '诞生于殷墟龟甲的裂纹之中，把三千年王朝兴衰刻在骨纹里。',
  },
  {
    id: 'sp-fenghuo',
    subject: 'history',
    units: ['中国近代史', '中国现代史'],
    stages: [
      { name: '烽火狐', emoji: '🦊' },
      { name: '铁血狼', emoji: '🐺' },
      { name: '觉醒神狮', emoji: '🦁' },
    ],
    lore: '尾焰是虎门销烟的余烬。它记得每一条不平等条约，也记得觉醒的每一声怒吼。',
  },
  {
    id: 'sp-xinfeng',
    subject: 'history',
    units: ['世界史'],
    stages: [
      { name: '信风雀', emoji: '🐦' },
      { name: '远洋鸥', emoji: '🕊️' },
      { name: '寰宇鲲鹏', emoji: '🐋' },
    ],
    lore: '随哥伦布的帆船起飞，绕过好望角，看尽两次工业革命的烟与火。',
  },
  // ---- 地理（青系）----
  {
    id: 'sp-yunrong',
    subject: 'geography',
    units: ['自然地理'],
    stages: [
      { name: '云绒羊', emoji: '🐑' },
      { name: '季风鹤', emoji: '🦤' },
      { name: '环流神凰', emoji: '🦚' },
    ],
    lore: '毛里藏着七个气压带六个风带。它打个喷嚏，就是一场锋面雨。',
  },
  {
    id: 'sp-xiliu',
    subject: 'geography',
    units: ['自然地理'],
    stages: [
      { name: '溪流鲤', emoji: '🐟' },
      { name: '洋流豚', emoji: '🐬' },
      { name: '沧海龙王', emoji: '🐉' },
    ],
    lore: '从水循环的第一滴蒸发开始游泳，能背出全世界每一条洋流的名字。',
  },
  {
    id: 'sp-tianlong',
    subject: 'geography',
    units: ['人文地理'],
    stages: [
      { name: '田垄鼠', emoji: '🐹' },
      { name: '阡陌鹿', emoji: '🦌' },
      { name: '五谷神象', emoji: '🐘' },
    ],
    lore: '把区位因素当粮食吃：光照、水源、市场、交通……吃得越全，长得越壮。',
  },
  {
    id: 'sp-luopan',
    subject: 'geography',
    units: ['区域发展与国家安全'],
    stages: [
      { name: '罗盘蟹', emoji: '🦀' },
      { name: '界碑豹', emoji: '🐆' },
      { name: '山河社稷龙', emoji: '🐍' },
    ],
    lore: '钳子一挥就是一条经济带。守护耕地红线与两百海里专属经济区。',
  },
  // ---- 政治（紫系）----
  {
    id: 'sp-mingli',
    subject: 'politics',
    units: ['哲学与文化'],
    stages: [
      { name: '明理兔', emoji: '🐇' },
      { name: '思辨枭', emoji: '🦉' },
      { name: '太极玄龟', emoji: '🐢' },
    ],
    lore: '左耳收对立，右耳收统一。最爱在月夜辩论「主次矛盾与矛盾主次方面」。',
  },
  {
    id: 'sp-shiji',
    subject: 'politics',
    units: ['经济与社会'],
    stages: [
      { name: '市集鼠', emoji: '🐭' },
      { name: '金算貂', emoji: '🦦' },
      { name: '招财瑞牛', emoji: '🐂' },
    ],
    lore: '尾巴是一根供需曲线。市场失灵时，它会亮出「宏观调控」的角。',
  },
  {
    id: 'sp-lvling',
    subject: 'politics',
    units: ['政治与法治', '中国特色社会主义'],
    stages: [
      { name: '律令犬', emoji: '🐶' },
      { name: '守宪獒', emoji: '🦮' },
      { name: '麒麟判官', emoji: '🦄' },
    ],
    lore: '鼻子能嗅出「政协是国家机关」这类错误表述，一口咬碎选项陷阱。',
  },
  {
    id: 'sp-fengwen',
    subject: 'politics',
    units: ['时政热点', '选择性必修'],
    stages: [
      { name: '风闻雏', emoji: '🐥' },
      { name: '时评鹦', emoji: '🦜' },
      { name: '天下鸿鹄', emoji: '🦢' },
    ],
    lore: '每天清晨衔来最新时政。它的羽毛会随「热点与考点的挂钩」变色。',
  },
  {
    id: 'sp-yanya',
    subject: 'geography',
    units: ['自然地理'],
    stages: [
      { name: '岩晶蜥', emoji: '🦎' },
      { name: '板块犀', emoji: '🦏' },
      { name: '造山龙王', emoji: '🦕' },
    ],
    lore: '背甲是一部岩石圈物质循环图。它翻个身，就是一次造山运动。',
  },
];

export const STARTERS = ['sp-jiagu', 'sp-yunrong', 'sp-mingli'];

/** 进化经验门槛：0-59 一阶，60-159 二阶，160+ 三阶 */
export const EVOLVE_EXP = [0, 60, 160];

/**
 * 世界地图（18 × 12）。
 * # 密林(阻挡)  . 小径  ~ 河流(阻挡)  = 桥
 * h/g/p 草丛（历史/地理/政治遭遇区）
 * r 遗迹  c 城郭  m 山岳（风景，阻挡）
 * B 书院(治疗+建造)  S 书肆(商店)  1/2/3 道馆
 */
export const WORLD_MAP = [
  '##################',
  '#rrr...##....ccc.#',
  '#rhhh...S....ppp.#',
  '#rhhh.......3ppp.#',
  '#.hh1...B....pp..#',
  '#..............~~#',
  '#....~~~=~~~~..~~#',
  '#gggg.....mmm....#',
  '#ggggg.2..mmm....#',
  '#gggg........m...#',
  '#..gg............#',
  '##################',
];

export const PLAYER_START = { x: 8, y: 5 };

export const GRASS_SUBJECT: Record<string, SubjectId> = { h: 'history', g: 'geography', p: 'politics' };

export interface GymDef {
  tile: string;
  name: string;
  leader: string;
  subject: SubjectId;
  speciesId: string; // 馆主的三阶文灵
  badge: string;
  badgeEmoji: string;
  intro: string;
}

export const GYMS: GymDef[] = [
  {
    tile: '1',
    name: '太史馆',
    leader: '司马道长',
    subject: 'history',
    speciesId: 'sp-jiagu',
    badge: '青史徽章',
    badgeEmoji: '📜',
    intro: '「以史为镜，可知兴替。接我三千年一击！」',
  },
  {
    tile: '2',
    name: '坤舆馆',
    leader: '徐霞客传人',
    subject: 'geography',
    speciesId: 'sp-xiliu',
    badge: '山河徽章',
    badgeEmoji: '🗺️',
    intro: '「读万卷书，行万里路。看你认不认得这片山河！」',
  },
  {
    tile: '3',
    name: '明德馆',
    leader: '稷下先生',
    subject: 'politics',
    speciesId: 'sp-mingli',
    badge: '明德徽章',
    badgeEmoji: '⚖️',
    intro: '「格物致知，明德至善。用辩证法接招吧！」',
  },
];

export interface BuildingDef {
  id: string;
  name: string;
  emoji: string;
  cost: { wood: number; brick: number };
  desc: string;
}

export const BUILDINGS: BuildingDef[] = [
  { id: 'library', name: '藏书阁', emoji: '📚', cost: { wood: 6, brick: 3 }, desc: '文灵战斗经验 +25%' },
  { id: 'arena', name: '演武场', emoji: '🏹', cost: { wood: 4, brick: 5 }, desc: '文灵攻击力 +4' },
  { id: 'clinic', name: '医馆', emoji: '🏥', cost: { wood: 3, brick: 6 }, desc: '每次战斗胜利后文灵回复 20 HP' },
  { id: 'tower', name: '文昌塔', emoji: '🗼', cost: { wood: 7, brick: 7 }, desc: '文昌笔捕捉成功率 +12%' },
];

export const ITEM_PRICES_WORLD = { brush: 30, herb: 25 };
