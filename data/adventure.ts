import { SubjectId } from '../types';

/**
 * 赶考之路：七大关卡的世界设定。
 * 敌人以「真实失分原因」命名——打败遗忘、马虎、绝对化，就是在打败考场上的自己。
 */

export interface EnemyDef {
  kind: 'minion' | 'elite' | 'boss';
  name: string;
  emoji: string;
  hp: number;
  atk: number;
  taunt: string; // 出场嘲讽
}

export interface StageDef {
  id: string;
  name: string;
  scene: string; // 场景 emoji
  desc: string;
  subjects: SubjectId[];
  units?: string[]; // 限定题目/考点范围（不填则该学科全部）
  enemies: EnemyDef[];
}

const minion = (name: string, emoji: string, taunt: string): EnemyDef => ({ kind: 'minion', name, emoji, hp: 40, atk: 12, taunt });
const elite = (name: string, emoji: string, taunt: string): EnemyDef => ({ kind: 'elite', name, emoji, hp: 60, atk: 18, taunt });
const boss = (name: string, emoji: string, taunt: string, hp = 90): EnemyDef => ({ kind: 'boss', name, emoji, hp, atk: 24, taunt });

export const STAGES: StageDef[] = [
  {
    id: 'st-1',
    name: '稷下学宫',
    scene: '🏯',
    desc: '古代史的起点。百家争鸣的殿堂里，潜伏着让你忘记朝代顺序的小妖。',
    subjects: ['history'],
    units: ['中国古代史'],
    enemies: [
      minion('遗忘小妖', '👻', '嘻嘻，三省六部是哪三省来着？忘了吧！'),
      minion('朝代错乱兽', '🐛', '秦汉唐宋元……我把它们全搅成一锅粥！'),
      elite('混淆怪', '👹', '内阁是法定中枢？丞相是明朝设的？分不清了吧！'),
      boss('科场判官', '🧛', '本判官阅卷三百年，最爱扣「概念不清」的分！'),
    ],
  },
  {
    id: 'st-2',
    name: '风云谷',
    scene: '⛰️',
    desc: '自然地理的险谷。这里的风向、洋流和等压线，都被妖风搅乱了。',
    subjects: ['geography'],
    units: ['自然地理'],
    enemies: [
      minion('妖风精', '🌪️', '北半球右偏还是左偏？被我吹晕了吧！'),
      minion('迷雾鬼', '🌫️', '冷锋暖锋，锋前锋后，雨在哪一侧？哈哈！'),
      elite('气旋魔', '🌀', '我逆时针辐合上升，你顺着答案往错里转！'),
      boss('山谷老龙', '🐉', '想过风云谷？先把大气环流给本龙讲明白！'),
    ],
  },
  {
    id: 'st-3',
    name: '朝堂风云',
    scene: '🏛️',
    desc: '政治制度的殿堂。人大、政协、政党……妖怪最爱在这里偷换概念。',
    subjects: ['politics'],
    units: ['中国特色社会主义', '经济与社会', '政治与法治'],
    enemies: [
      minion('偷换概念鼠', '🐀', '政协就是国家机关，对吧对吧？'),
      minion('张冠李戴猴', '🐒', '决定权？监督权？我给你戴个错帽子！'),
      elite('教条蟒', '🐍', '只背原理不看材料，你的大题一分没有！'),
      boss('绝对化魔王', '😈', '「彻底解决」「完全消除」——选我的选项，包你全错！'),
    ],
  },
  {
    id: 'st-4',
    name: '烽火关',
    scene: '🔥',
    desc: '近现代史的雄关。从鸦片战争到改革开放，时间线妖怪在此设伏。',
    subjects: ['history'],
    units: ['中国近代史', '中国现代史'],
    enemies: [
      minion('时间线蠕虫', '🪱', '五四运动和新文化运动，哪个在前？缠住你！'),
      minion('条约小鬼', '👺', '《南京条约》《马关条约》《辛丑条约》，赔款割地混着记！'),
      elite('因果颠倒枭', '🦉', '是革命引发觉醒，还是觉醒引发革命？倒过来！'),
      boss('烽火大将', '⚔️', '不懂「半殖民地半封建」的程度变化，休想过关！'),
    ],
  },
  {
    id: 'st-5',
    name: '人间烟火城',
    scene: '🏙️',
    desc: '人文地理的都会。区位、城市、产业——马虎精在繁华中等你出错。',
    subjects: ['geography'],
    units: ['人文地理', '区域发展与国家安全'],
    enemies: [
      minion('马虎精', '🙈', '题干说「不包括」，你看清了吗？嘻嘻！'),
      minion('审题盲盒怪', '📦', '主导因素？限制因素？拆开盲盒才知道！'),
      elite('套话空谈魔', '🗿', '只会背模板不结合材料？零分送给你！'),
      boss('区位老城主', '🏰', '想进城？说出京津冀协同发展的三大突破口！'),
    ],
  },
  {
    id: 'st-6',
    name: '思辨峰',
    scene: '🗻',
    desc: '哲学与文化的高峰。主次矛盾与矛盾主次方面的迷雾终年不散。',
    subjects: ['politics'],
    units: ['哲学与文化', '选择性必修', '时政热点'],
    enemies: [
      minion('二元对立蝠', '🦇', '要么全对要么全错，中间地带不存在！'),
      minion('形而上学石人', '🗿', '孤立！静止！片面！跟我念三遍！'),
      elite('迷雾双生子', '👥', '办事情？看问题？主次矛盾和主次方面，选哪个？'),
      boss('诡辩宗师', '🧙', '真理是客观的，所以永远不变——反驳我啊！'),
    ],
  },
  {
    id: 'st-7',
    name: '金銮殿 · 殿试',
    scene: '👑',
    desc: '终极考验。三科混考，直面至圣主考官——赢了，你就是状元。',
    subjects: ['history', 'geography', 'politics'],
    enemies: [
      elite('殿前侍卫 · 左', '💂', '殿试无小题，一题定乾坤！'),
      elite('殿前侍卫 · 右', '💂', '连击断了？那你的文气也断了！'),
      boss('至圣主考官', '🐲', '朕出的题，融汇史地政三科。接旨吧，考生！', 120),
    ],
  },
];
