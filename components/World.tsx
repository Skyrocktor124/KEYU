import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BookMarked, Hammer, X } from 'lucide-react';
import { KnowledgePoint, MasteryRecord, QuizQuestion, SubjectId } from '../types';
import { SUBJECTS } from '../constants';
import {
  SPECIES,
  STARTERS,
  WORLD_MAP,
  GRASS_SUBJECT,
  GYMS,
  GymDef,
  BUILDINGS,
  ITEM_PRICES_WORLD,
  PLAYER_START,
} from '../data/world';
import {
  WorldData,
  OwnedCreature,
  speciesOf,
  stageOf,
  maxHpOf,
  masteryAvgOf,
  atkOf,
  wildAtkOf,
  catchChance,
  makeUid,
  expGain,
} from '../services/world';
import { AdventureData } from '../services/adventure';
import { BattleQuestion, makeIntruderQuestion, toBattleQuestion } from '../services/adventure';
import { sfx, confetti } from '../services/effects';
import { SubjectBadge } from './ui';

interface Props {
  kps: KnowledgePoint[];
  questions: QuizQuestion[];
  mastery: Record<string, MasteryRecord>;
  adventure: AdventureData; // 共享钱包（金币）
  setAdventure: React.Dispatch<React.SetStateAction<AdventureData>>;
  world: WorldData;
  setWorld: React.Dispatch<React.SetStateAction<WorldData>>;
  onWrong: (questionId: string) => void;
  onBattleResult: (victory: boolean, gym: boolean) => void;
}

interface WildEnemy {
  speciesId: string;
  stage: number;
  hp: number;
  maxHp: number;
  gym: GymDef | null;
}

type BattlePhase = 'fight' | 'resolve' | 'won' | 'lost' | 'caught' | 'fled';

interface BattleState {
  enemy: WildEnemy;
  phase: BattlePhase;
  q: BattleQuestion | null;
  picked: number | null;
  combo: number;
  reward?: { exp: number; coins: number; wood: number; brick: number; badge?: string };
}

const BLOCKED = new Set(['#', '~', 'r', 'c', 'm']);

const TILE_EMOJI: Record<string, string> = {
  '#': '🌲',
  '~': '🌊',
  '=': '🌉',
  r: '🏺',
  c: '🏯',
  m: '⛰️',
  B: '🏫',
  S: '🏪',
  '1': '⛩️',
  '2': '⛩️',
  '3': '⛩️',
};

const GRASS_BG: Record<string, string> = {
  h: 'bg-amber-100',
  g: 'bg-emerald-100',
  p: 'bg-rose-100',
};

function drawWorldQuestion(subject: SubjectId, units: string[], questions: QuizQuestion[], kps: KnowledgePoint[]): BattleQuestion | null {
  const kpUnit = new Map(kps.map((k) => [k.id, k.unit]));
  const pool = kps.filter((k) => k.subject === subject && units.includes(k.unit));
  const reals = questions.filter((q) => {
    if (q.subject !== subject) return false;
    const u = q.kpId ? kpUnit.get(q.kpId) : undefined;
    return u === undefined || units.includes(u);
  });
  if (Math.random() < 0.55 && reals.length > 0) return toBattleQuestion(reals[Math.floor(Math.random() * reals.length)]);
  return makeIntruderQuestion(pool, kps) ?? (reals.length > 0 ? toBattleQuestion(reals[Math.floor(Math.random() * reals.length)]) : null);
}

const World: React.FC<Props> = ({ kps, questions, mastery, adventure, setAdventure, world, setWorld, onWrong, onBattleResult }) => {
  const [battle, setBattle] = useState<BattleState | null>(null);
  const [panel, setPanel] = useState<'none' | 'dex' | 'academy' | 'shop'>('none');
  const [msg, setMsg] = useState<string | null>(null);
  const [evo, setEvo] = useState<{ name0: string; e0: string; name1: string; e1: string } | null>(null);
  const msgTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const say = (text: string) => {
    setMsg(text);
    clearTimeout(msgTimer.current);
    msgTimer.current = setTimeout(() => setMsg(null), 2600);
  };

  const active: OwnedCreature | undefined =
    world.creatures.find((c) => c.uid === world.activeUid && c.hp > 0) ?? world.creatures.find((c) => c.hp > 0);

  /* ---------- 移动 ---------- */
  const tryMove = (dx: number, dy: number) => {
    if (battle || evo || world.creatures.length === 0) return;
    const nx = world.pos.x + dx;
    const ny = world.pos.y + dy;
    const row = WORLD_MAP[ny];
    if (!row) return;
    const tile = row[nx];
    if (tile === undefined || BLOCKED.has(tile)) return;
    setWorld((w) => ({ ...w, pos: { x: nx, y: ny } }));
    setPanel('none');

    if (tile === 'B') {
      setWorld((w) => ({ ...w, creatures: w.creatures.map((c) => ({ ...c, hp: maxHpOf(stageOf(c.exp)) })) }));
      sfx.quest();
      say('🏫 书院先生为你的文灵恢复了全部体力');
      setPanel('academy');
      return;
    }
    if (tile === 'S') {
      setPanel('shop');
      return;
    }
    const gym = GYMS.find((g) => g.tile === tile);
    if (gym) {
      startGym(gym);
      return;
    }
    if (GRASS_SUBJECT[tile] && Math.random() < 0.24) {
      startWild(GRASS_SUBJECT[tile]);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (battle || panel !== 'none' || evo) return;
      const map: Record<string, [number, number]> = {
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
        w: [0, -1],
        s: [0, 1],
        a: [-1, 0],
        d: [1, 0],
      };
      const mv = map[e.key];
      if (mv) {
        e.preventDefault();
        tryMove(mv[0], mv[1]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  /* ---------- 遭遇 ---------- */
  const startWild = (subject: SubjectId) => {
    const candidates = SPECIES.filter((s) => s.subject === subject);
    const sp = candidates[Math.floor(Math.random() * candidates.length)];
    const r = Math.random();
    const stage = r < 0.7 ? 0 : r < 0.95 ? 1 : 2;
    const hp = maxHpOf(stage);
    setWorld((w) => ({ ...w, seen: w.seen.includes(sp.id) ? w.seen : [...w.seen, sp.id] }));
    sfx.flip();
    setBattle({
      enemy: { speciesId: sp.id, stage, hp, maxHp: hp, gym: null },
      phase: 'fight',
      q: drawWorldQuestion(sp.subject, sp.units, questions, kps),
      picked: null,
      combo: 0,
    });
  };

  const startGym = (gym: GymDef) => {
    if (world.gymBadges.includes(gym.badge)) {
      say(`${gym.badgeEmoji} 你已拥有「${gym.badge}」——馆主朝你点头致意`);
      return;
    }
    const sp = speciesOf(gym.speciesId);
    const hp = maxHpOf(2) + 40;
    setWorld((w) => ({ ...w, seen: w.seen.includes(sp.id) ? w.seen : [...w.seen, sp.id] }));
    sfx.hurt();
    setBattle({
      enemy: { speciesId: gym.speciesId, stage: 2, hp, maxHp: hp, gym },
      phase: 'fight',
      q: drawWorldQuestion(sp.subject, sp.units, questions, kps),
      picked: null,
      combo: 0,
    });
  };

  /* ---------- 战斗 ---------- */
  const enemySp = battle ? speciesOf(battle.enemy.speciesId) : null;

  const nextQ = () => {
    if (!battle || !enemySp) return;
    setBattle((b) => b && { ...b, q: drawWorldQuestion(enemySp.subject, enemySp.units, questions, kps), picked: null, phase: 'fight' });
  };

  const grantVictory = (b: BattleState) => {
    const gym = b.enemy.gym;
    const exp = expGain(b.enemy.stage, !!gym, world.buildings);
    const coins = gym ? 60 : 15 + b.enemy.stage * 8;
    const wood = 1 + Math.floor(Math.random() * 2);
    const brick = Math.random() < 0.6 ? 1 : 0;
    const beforeStage = active ? stageOf(active.exp) : 0;
    setAdventure((a) => ({ ...a, coins: a.coins + coins }));
    setWorld((w) => {
      const creatures = w.creatures.map((c) => {
        if (c.uid !== active?.uid) return c;
        const newExp = c.exp + exp;
        const healed = w.buildings.includes('clinic') ? Math.min(maxHpOf(stageOf(newExp)), c.hp + 20) : c.hp;
        return { ...c, exp: newExp, hp: healed };
      });
      return {
        ...w,
        creatures,
        materials: { wood: w.materials.wood + wood, brick: w.materials.brick + brick },
        gymBadges: gym && !w.gymBadges.includes(gym.badge) ? [...w.gymBadges, gym.badge] : w.gymBadges,
      };
    });
    if (active) {
      const afterStage = stageOf(active.exp + exp);
      if (afterStage > beforeStage) {
        const sp = speciesOf(active.speciesId);
        setTimeout(() => {
          setEvo({ name0: sp.stages[beforeStage].name, e0: sp.stages[beforeStage].emoji, name1: sp.stages[afterStage].name, e1: sp.stages[afterStage].emoji });
          confetti();
          sfx.levelUp();
        }, 900);
      }
    }
    if (gym) confetti();
    sfx.victory();
    onBattleResult(true, !!gym);
    setBattle({ ...b, phase: 'won', reward: { exp, coins, wood, brick, badge: gym ? `${gym.badgeEmoji} ${gym.badge}` : undefined } });
  };

  const enemyStrikes = (b: BattleState, afterPhase: BattlePhase = 'resolve') => {
    if (!active) return;
    const dmg = wildAtkOf(b.enemy.stage) + (b.enemy.gym ? 4 : 0);
    sfx.hurt();
    const newHp = Math.max(0, active.hp - dmg);
    setWorld((w) => ({ ...w, creatures: w.creatures.map((c) => (c.uid === active.uid ? { ...c, hp: newHp } : c)) }));
    if (newHp <= 0) {
      const others = world.creatures.filter((c) => c.uid !== active.uid && c.hp > 0);
      if (others.length > 0) {
        say(`💫 ${speciesOf(active.speciesId).stages[stageOf(active.exp)].name} 倒下了！${speciesOf(others[0].speciesId).stages[stageOf(others[0].exp)].name} 上场！`);
        setWorld((w) => ({ ...w, activeUid: others[0].uid }));
        setBattle({ ...b, phase: afterPhase });
      } else {
        // 全灭：送回书院
        sfx.defeat();
        onBattleResult(false, !!b.enemy.gym);
        setWorld((w) => ({
          ...w,
          pos: { ...PLAYER_START },
          creatures: w.creatures.map((c) => ({ ...c, hp: maxHpOf(stageOf(c.exp)) })),
        }));
        setAdventure((a) => ({ ...a, coins: Math.max(0, a.coins - 20) }));
        setBattle({ ...b, phase: 'lost' });
      }
    } else {
      setBattle({ ...b, phase: afterPhase });
    }
  };

  const pick = (i: number) => {
    if (!battle || battle.phase !== 'fight' || battle.picked !== null || !battle.q || !active) return;
    const b = { ...battle, picked: i };
    setBattle(b);
    const correct = i === battle.q.answer;
    if (correct) {
      const combo = battle.combo + 1;
      const sp = speciesOf(active.speciesId);
      const base = atkOf(stageOf(active.exp), masteryAvgOf(sp, kps, mastery), world.buildings);
      const dmg = combo >= 3 ? Math.round(base * 1.5) : base;
      combo >= 3 ? sfx.crit() : sfx.hit();
      const newHp = Math.max(0, battle.enemy.hp - dmg);
      setTimeout(() => {
        if (newHp <= 0) {
          grantVictory({ ...b, combo, enemy: { ...b.enemy, hp: 0 } });
        } else {
          setBattle({ ...b, combo, enemy: { ...b.enemy, hp: newHp }, q: drawWorldQuestion(enemySp!.subject, enemySp!.units, questions, kps), picked: null });
        }
      }, 650);
      setBattle({ ...b, combo, enemy: { ...b.enemy, hp: newHp } });
    } else {
      if (battle.q.realId) onWrong(battle.q.realId);
      setTimeout(() => enemyStrikes({ ...b, combo: 0 }), 500);
    }
  };

  const throwBrush = () => {
    if (!battle || battle.phase !== 'fight' || battle.enemy.gym || world.items.brush <= 0 || !enemySp) return;
    setWorld((w) => ({ ...w, items: { ...w.items, brush: w.items.brush - 1 } }));
    const chance = catchChance(battle.enemy.hp / battle.enemy.maxHp, world.buildings);
    sfx.flip();
    if (Math.random() < chance) {
      const exp = battle.enemy.stage === 0 ? 0 : battle.enemy.stage === 1 ? 60 : 160;
      const uid = makeUid();
      setWorld((w) => ({
        ...w,
        creatures: [...w.creatures, { uid, speciesId: battle.enemy.speciesId, exp, hp: maxHpOf(battle.enemy.stage) }],
        activeUid: w.activeUid ?? uid,
      }));
      sfx.victory();
      confetti(80);
      setBattle({ ...battle, phase: 'caught' });
    } else {
      say(`💨 ${enemySp.stages[battle.enemy.stage].name} 挣脱了文昌笔！`);
      enemyStrikes(battle, 'fight');
    }
  };

  const useHerb = () => {
    if (!battle || battle.phase !== 'fight' || world.items.herb <= 0 || !active) return;
    const cap = maxHpOf(stageOf(active.exp));
    if (active.hp >= cap) return;
    sfx.quest();
    setWorld((w) => ({
      ...w,
      items: { ...w.items, herb: w.items.herb - 1 },
      creatures: w.creatures.map((c) => (c.uid === active.uid ? { ...c, hp: Math.min(cap, c.hp + 30) } : c)),
    }));
  };

  const flee = () => {
    if (!battle || battle.phase !== 'fight' || battle.enemy.gym) return;
    if (Math.random() < 0.7) {
      setBattle({ ...battle, phase: 'fled' });
    } else {
      say('🏃 没能逃掉！');
      enemyStrikes(battle, 'fight');
    }
  };

  /* ---------- 御三家 ---------- */
  if (world.creatures.length === 0) {
    return (
      <div className="max-w-2xl mx-auto bg-white rounded-2xl border border-slate-200 p-8 text-center">
        <div className="text-4xl">🧑‍🎓</div>
        <h2 className="mt-2 text-2xl font-black text-slate-900">欢迎来到文灵世界</h2>
        <p className="mt-2 text-sm text-slate-500 leading-relaxed">
          书院先生："野外的草丛里栖息着由知识凝成的精灵——文灵。<br />
          它们的力量来自你对考点的真实掌握。选一只伙伴，开始旅程吧！"
        </p>
        <div className="mt-6 grid grid-cols-3 gap-3">
          {STARTERS.map((id) => {
            const sp = speciesOf(id);
            return (
              <button
                key={id}
                onClick={() => {
                  const uid = makeUid();
                  setWorld((w) => ({
                    ...w,
                    creatures: [{ uid, speciesId: id, exp: 0, hp: maxHpOf(0) }],
                    activeUid: uid,
                    seen: [...w.seen, id],
                  }));
                  confetti(80);
                  sfx.victory();
                }}
                className="rounded-2xl border-2 border-slate-200 hover:border-amber-400 hover:shadow-lg p-4 transition group"
              >
                <div className="text-5xl group-hover:scale-110 transition">{sp.stages[0].emoji}</div>
                <div className="mt-2 font-bold text-slate-800">{sp.stages[0].name}</div>
                <div className="mt-1"><SubjectBadge subject={sp.subject} small /></div>
                <p className="mt-2 text-[11px] text-slate-400 leading-relaxed">{sp.lore}</p>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  /* ---------- 战斗画面 ---------- */
  if (battle && enemySp && active) {
    const activeSp = speciesOf(active.speciesId);
    const aStage = stageOf(active.exp);
    const aMax = maxHpOf(aStage);
    const enemyName = enemySp.stages[battle.enemy.stage].name;
    return (
      <div className="max-w-3xl mx-auto">
        <div className="relative rounded-2xl bg-gradient-to-b from-emerald-900 via-emerald-800 to-emerald-700 p-5 text-white overflow-hidden">
          <div className="absolute top-3 left-4 text-xs text-emerald-200">
            {battle.enemy.gym ? `⛩️ ${battle.enemy.gym.name} · 馆主 ${battle.enemy.gym.leader}` : '🌿 野生文灵出现了！'}
          </div>
          {/* 敌方（右上） */}
          <div className="mt-5 flex justify-end pr-6">
            <div className="text-center">
              <div className={`text-6xl enemy-idle ${battle.enemy.hp === 0 ? 'enemy-die' : ''}`}>{enemySp.stages[battle.enemy.stage].emoji}</div>
              <div className="mt-1 text-sm font-bold">{battle.enemy.gym ? '👑 ' : ''}{enemyName} <span className="text-xs text-emerald-300">Lv.{battle.enemy.stage + 1}</span></div>
              <div className="mt-1 w-40 h-2.5 bg-emerald-950/60 rounded-full overflow-hidden mx-auto">
                <div className="h-full bg-gradient-to-r from-lime-400 to-emerald-400 transition-all duration-300" style={{ width: `${(battle.enemy.hp / battle.enemy.maxHp) * 100}%` }} />
              </div>
              <div className="text-[10px] text-emerald-200 mt-0.5 tabular-nums">{battle.enemy.hp}/{battle.enemy.maxHp}</div>
            </div>
          </div>
          {/* 我方（左下） */}
          <div className="mt-2 flex justify-start pl-6 pb-1">
            <div className="text-center">
              <div className="text-6xl" style={{ transform: 'scaleX(-1)' }}>{activeSp.stages[aStage].emoji}</div>
              <div className="mt-1 text-sm font-bold">{activeSp.stages[aStage].name} <span className="text-xs text-emerald-300">EXP {active.exp}</span></div>
              <div className="mt-1 w-40 h-2.5 bg-emerald-950/60 rounded-full overflow-hidden mx-auto">
                <div className={`h-full transition-all duration-300 ${active.hp / aMax <= 0.3 ? 'bg-rose-500 hp-low' : 'bg-gradient-to-r from-rose-400 to-rose-500'}`} style={{ width: `${(active.hp / aMax) * 100}%` }} />
              </div>
              <div className="text-[10px] text-emerald-200 mt-0.5 tabular-nums">{active.hp}/{aMax}</div>
            </div>
            {battle.combo >= 2 && (
              <span className="self-center ml-4 text-lg font-bold text-orange-300"><span className="animate-flame">🔥</span> ×{battle.combo}{battle.combo >= 3 && ' 暴击!'}</span>
            )}
          </div>
          {battle.enemy.gym && battle.phase === 'fight' && <p className="text-xs text-emerald-200 italic text-center pb-1">{battle.enemy.gym.intro}</p>}
        </div>

        {/* 结算 */}
        {(battle.phase === 'won' || battle.phase === 'lost' || battle.phase === 'caught' || battle.phase === 'fled') && (
          <div className="mt-3 bg-white rounded-2xl border border-slate-200 p-6 text-center">
            {battle.phase === 'won' && (
              <>
                <div className="text-4xl">🏆</div>
                <h3 className="mt-2 text-xl font-black text-slate-900">{battle.enemy.gym ? `击败馆主！获得${battle.reward?.badge}！` : `打败了 ${enemyName}！`}</h3>
                <p className="mt-2 text-sm text-slate-500">
                  EXP +{battle.reward?.exp} · 💰 +{battle.reward?.coins} · 🪵 +{battle.reward?.wood} · 🧱 +{battle.reward?.brick}
                </p>
              </>
            )}
            {battle.phase === 'caught' && (
              <>
                <div className="text-4xl">🖌️✨</div>
                <h3 className="mt-2 text-xl font-black text-slate-900">收服了 {enemyName}！</h3>
                <p className="mt-2 text-sm text-slate-500">它已加入你的队伍。复习「{enemySp.units.join('、')}」的考点能让它变强！</p>
              </>
            )}
            {battle.phase === 'lost' && (
              <>
                <div className="text-4xl">💫</div>
                <h3 className="mt-2 text-xl font-black text-slate-900">文灵全部力竭……</h3>
                <p className="mt-2 text-sm text-slate-500">你被送回了书院疗伤（-20 金币）。去复习考点，让文灵变强再来！</p>
              </>
            )}
            {battle.phase === 'fled' && <h3 className="text-lg font-bold text-slate-700">🏃 成功逃脱！</h3>}
            <button onClick={() => setBattle(null)} className="mt-4 px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl transition">
              返回世界
            </button>
          </div>
        )}

        {/* 出题区 */}
        {(battle.phase === 'fight' || battle.phase === 'resolve') && battle.q && (
          <div className="mt-3 bg-white rounded-2xl border border-slate-200 p-5">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
              <span className="flex items-center gap-2">
                <SubjectBadge subject={battle.q.subject} small />
                {battle.q.realId ? '真题一击' : '快问快答'}
              </span>
              <div className="flex gap-2">
                {!battle.enemy.gym && (
                  <button onClick={throwBrush} disabled={world.items.brush <= 0 || battle.phase !== 'fight'} className="text-xs bg-violet-600 hover:bg-violet-500 disabled:opacity-30 text-white rounded-lg px-2.5 py-1.5 transition" title="投掷文昌笔捕捉（血越残越好抓）">
                    🖌️ 收服 ×{world.items.brush}
                  </button>
                )}
                <button onClick={useHerb} disabled={world.items.herb <= 0 || battle.phase !== 'fight'} className="text-xs bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 text-white rounded-lg px-2.5 py-1.5 transition" title="灵芝草：文灵回复 30 HP">
                  🌿 ×{world.items.herb}
                </button>
                {!battle.enemy.gym && (
                  <button onClick={flee} disabled={battle.phase !== 'fight'} className="text-xs bg-slate-500 hover:bg-slate-400 disabled:opacity-30 text-white rounded-lg px-2.5 py-1.5 transition">
                    🏃 逃跑
                  </button>
                )}
              </div>
            </div>
            <p className="text-slate-900 font-medium leading-relaxed text-[15px]">{battle.q.question}</p>
            <div className="mt-3 space-y-2">
              {battle.q.options.map((opt, i) => {
                let cls = 'border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/50 active:scale-[0.99]';
                if (battle.picked !== null) {
                  if (i === battle.q!.answer) cls = 'border-emerald-400 bg-emerald-50';
                  else if (i === battle.picked) cls = 'border-rose-400 bg-rose-50';
                  else cls = 'border-slate-200 opacity-60';
                }
                return (
                  <button key={i} onClick={() => pick(i)} disabled={battle.picked !== null} className={`w-full text-left px-4 py-2.5 rounded-xl border text-sm transition flex items-start gap-2 ${cls}`}>
                    <span className="font-semibold text-slate-400">{'ABCD'[i]}.</span>
                    <span className="text-slate-700">{opt}</span>
                  </button>
                );
              })}
            </div>
            {battle.phase === 'resolve' && (
              <>
                <div className="mt-3 bg-slate-50 rounded-xl p-3.5 text-sm text-slate-600">
                  <strong className="text-slate-800">💡 拆招要诀：</strong>
                  <span className="block mt-1 leading-relaxed">{battle.q.explanation}</span>
                </div>
                <button onClick={nextQ} className="mt-3 w-full py-2.5 bg-slate-800 text-white rounded-xl text-sm font-medium hover:bg-slate-700 transition">
                  ⚔️ 记住了，再战！
                </button>
              </>
            )}
          </div>
        )}
        {msg && <div className="mt-3 text-center text-sm text-slate-600 bg-white border border-slate-200 rounded-xl py-2 animate-pop">{msg}</div>}
      </div>
    );
  }

  /* ---------- 大地图 ---------- */
  const activeSp = active ? speciesOf(active.speciesId) : null;
  const aStage = active ? stageOf(active.exp) : 0;

  return (
    <div className="max-w-4xl mx-auto">
      {/* 顶部状态 */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {activeSp && active && (
          <button onClick={() => setPanel(panel === 'dex' ? 'none' : 'dex')} className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-1.5 hover:border-amber-400 transition">
            <span className="text-xl">{activeSp.stages[aStage].emoji}</span>
            <span className="text-sm font-semibold text-slate-700">{activeSp.stages[aStage].name}</span>
            <span className="text-xs text-slate-400 tabular-nums">HP {active.hp}/{maxHpOf(aStage)} · EXP {active.exp}</span>
          </button>
        )}
        <span className="text-sm bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-slate-600">💰 {adventure.coins} · 🖌️ ×{world.items.brush} · 🌿 ×{world.items.herb} · 🪵 {world.materials.wood} · 🧱 {world.materials.brick}</span>
        <span className="text-sm bg-white border border-slate-200 rounded-xl px-3 py-1.5">{GYMS.map((g) => (world.gymBadges.includes(g.badge) ? g.badgeEmoji : '⬜')).join(' ')}</span>
        <button onClick={() => setPanel(panel === 'dex' ? 'none' : 'dex')} className="ml-auto flex items-center gap-1.5 text-sm bg-slate-800 text-white rounded-xl px-3 py-1.5 hover:bg-slate-700 transition">
          <BookMarked className="w-4 h-4" />
          图鉴 {world.seen.length}/{SPECIES.length}
        </button>
      </div>

      {/* 地图 */}
      <div className="bg-white rounded-2xl border border-slate-200 p-3 overflow-x-auto">
        <div className="mx-auto" style={{ width: 'fit-content' }}>
          {WORLD_MAP.map((row, y) => (
            <div key={y} className="flex">
              {row.split('').map((tile, x) => {
                const isPlayer = world.pos.x === x && world.pos.y === y;
                const grassBg = GRASS_BG[tile] ?? (tile === '~' ? 'bg-sky-200' : tile === '#' ? 'bg-emerald-200/60' : 'bg-amber-50/50');
                return (
                  <div key={x} className={`w-8 h-8 flex items-center justify-center text-lg select-none ${grassBg}`}>
                    {isPlayer ? <span className="animate-pop">🧑‍🎓</span> : TILE_EMOJI[tile] ?? (GRASS_SUBJECT[tile] ? '🌿' : '')}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* 提示 + 方向键 */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-400 leading-relaxed">
          ⌨️ 方向键 / WASD 移动 · 🌿 草丛遇野生文灵（黄=历史 绿=地理 红=政治）· ⛩️ 挑战道馆 · 🏫 书院治疗与建造 · 🏪 书肆购物
        </p>
        <div className="grid grid-cols-3 gap-1">
          <span />
          <DPad onClick={() => tryMove(0, -1)} label="↑" />
          <span />
          <DPad onClick={() => tryMove(-1, 0)} label="←" />
          <DPad onClick={() => tryMove(0, 1)} label="↓" />
          <DPad onClick={() => tryMove(1, 0)} label="→" />
        </div>
      </div>
      {msg && <div className="mt-2 text-center text-sm text-slate-700 bg-amber-50 border border-amber-200 rounded-xl py-2 animate-pop">{msg}</div>}

      {/* 图鉴 */}
      {panel === 'dex' && (
        <Panel title={`文灵图鉴（已发现 ${world.seen.length}/${SPECIES.length}）`} onClose={() => setPanel('none')}>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
            {SPECIES.map((sp) => {
              const seen = world.seen.includes(sp.id);
              const owned = world.creatures.filter((c) => c.speciesId === sp.id).sort((a, b) => b.exp - a.exp)[0];
              return (
                <div key={sp.id} className={`rounded-xl border p-3 ${owned ? 'border-amber-200 bg-amber-50/50' : 'border-slate-200'}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-3xl">{seen ? sp.stages[owned ? stageOf(owned.exp) : 0].emoji : '❓'}</span>
                    <div className="min-w-0">
                      <div className="font-bold text-sm text-slate-800 truncate">{seen ? sp.stages[owned ? stageOf(owned.exp) : 0].name : '？？？'}</div>
                      <SubjectBadge subject={sp.subject} small />
                    </div>
                  </div>
                  {seen && <p className="mt-2 text-[11px] text-slate-400 leading-relaxed">{sp.lore}</p>}
                  {seen && (
                    <div className="mt-1.5 text-[11px] text-slate-500">
                      进化链：{sp.stages.map((s) => s.emoji).join(' → ')} · 绑定：{sp.units.join('、')}
                    </div>
                  )}
                  {owned && (
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-xs text-slate-500 tabular-nums">EXP {owned.exp} · HP {owned.hp}/{maxHpOf(stageOf(owned.exp))}</span>
                      {world.activeUid !== owned.uid && (
                        <button onClick={() => setWorld((w) => ({ ...w, activeUid: owned.uid }))} className="text-xs bg-slate-800 text-white rounded-lg px-2 py-1 hover:bg-slate-700 transition">
                          设为首发
                        </button>
                      )}
                      {world.activeUid === owned.uid && <span className="text-xs font-bold text-amber-600">⭐ 首发</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-slate-400">💡 文灵的攻击力 = 基础 + 进化阶段 + <strong>你对它绑定模块的掌握度 ×2</strong>——去「今日复习」把它的考点刷熟，它会立刻变强。</p>
        </Panel>
      )}

      {/* 书院（建造） */}
      {panel === 'academy' && (
        <Panel title="🏫 书院 · 治疗与营造" onClose={() => setPanel('none')}>
          <p className="text-sm text-slate-500 mb-3">文灵已全部治愈。用战斗掉落的木材与砖石营造设施（永久生效）：</p>
          <div className="grid sm:grid-cols-2 gap-3">
            {BUILDINGS.map((b) => {
              const built = world.buildings.includes(b.id);
              const afford = world.materials.wood >= b.cost.wood && world.materials.brick >= b.cost.brick;
              return (
                <div key={b.id} className={`rounded-xl border p-3 flex items-center gap-3 ${built ? 'border-emerald-200 bg-emerald-50/60' : 'border-slate-200'}`}>
                  <span className="text-3xl">{b.emoji}</span>
                  <div className="flex-1">
                    <div className="font-bold text-sm text-slate-800">{b.name}</div>
                    <div className="text-xs text-slate-500">{b.desc}</div>
                    {!built && <div className="text-[11px] text-slate-400 mt-0.5">造价：🪵{b.cost.wood} 🧱{b.cost.brick}</div>}
                  </div>
                  {built ? (
                    <span className="text-xs font-bold text-emerald-600">✓ 已建成</span>
                  ) : (
                    <button
                      onClick={() => {
                        if (!afford) return;
                        sfx.coin();
                        setWorld((w) => ({
                          ...w,
                          materials: { wood: w.materials.wood - b.cost.wood, brick: w.materials.brick - b.cost.brick },
                          buildings: [...w.buildings, b.id],
                        }));
                        say(`${b.emoji} ${b.name}落成！${b.desc}`);
                      }}
                      disabled={!afford}
                      className="text-xs bg-amber-500 hover:bg-amber-400 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold rounded-lg px-3 py-1.5 transition"
                    >
                      <Hammer className="w-3.5 h-3.5 inline mr-1" />建造
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </Panel>
      )}

      {/* 书肆（商店） */}
      {panel === 'shop' && (
        <Panel title="🏪 书肆 · 行囊补给" onClose={() => setPanel('none')}>
          <div className="grid sm:grid-cols-2 gap-3">
            <ShopRow emoji="🖌️" name="文昌笔" desc="投向野生文灵将其收服（血越残越好抓）" price={ITEM_PRICES_WORLD.brush} coins={adventure.coins}
              onBuy={() => { sfx.coin(); setAdventure((a) => ({ ...a, coins: a.coins - ITEM_PRICES_WORLD.brush })); setWorld((w) => ({ ...w, items: { ...w.items, brush: w.items.brush + 1 } })); }} />
            <ShopRow emoji="🌿" name="灵芝草" desc="战斗中为文灵回复 30 HP" price={ITEM_PRICES_WORLD.herb} coins={adventure.coins}
              onBuy={() => { sfx.coin(); setAdventure((a) => ({ ...a, coins: a.coins - ITEM_PRICES_WORLD.herb })); setWorld((w) => ({ ...w, items: { ...w.items, herb: w.items.herb + 1 } })); }} />
          </div>
        </Panel>
      )}

      {/* 进化动画 */}
      {evo && (
        <div className="fixed inset-0 z-[95] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setEvo(null)}>
          <div className="bg-white rounded-3xl p-10 text-center max-w-sm w-full animate-pop shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="text-5xl flex items-center justify-center gap-3">
              <span className="opacity-40">{evo.e0}</span>
              <span className="text-2xl">✨→✨</span>
              <span className="animate-pop text-6xl">{evo.e1}</span>
            </div>
            <h2 className="mt-4 text-2xl font-black text-slate-900">进化了！</h2>
            <p className="mt-2 text-sm text-slate-500">
              {evo.name0} 进化成了 <strong className="text-amber-600">{evo.name1}</strong>！
            </p>
            <button onClick={() => setEvo(null)} className="mt-5 px-8 py-2.5 bg-amber-500 hover:bg-amber-400 text-white font-bold rounded-xl transition">
              太棒了！
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const DPad: React.FC<{ onClick: () => void; label: string }> = ({ onClick, label }) => (
  <button onClick={onClick} className="w-10 h-10 bg-white border border-slate-200 rounded-lg text-slate-600 font-bold hover:bg-slate-100 active:scale-95 transition">
    {label}
  </button>
);

const Panel: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({ title, onClose, children }) => (
  <div className="mt-3 bg-white rounded-2xl border border-slate-200 p-5">
    <div className="flex items-center justify-between mb-3">
      <h3 className="font-bold text-slate-800">{title}</h3>
      <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 transition"><X className="w-4 h-4" /></button>
    </div>
    {children}
  </div>
);

const ShopRow: React.FC<{ emoji: string; name: string; desc: string; price: number; coins: number; onBuy: () => void }> = ({ emoji, name, desc, price, coins, onBuy }) => (
  <div className="rounded-xl border border-slate-200 p-3 flex items-center gap-3">
    <span className="text-3xl">{emoji}</span>
    <div className="flex-1">
      <div className="font-bold text-sm text-slate-800">{name}</div>
      <div className="text-xs text-slate-500">{desc}</div>
    </div>
    <button onClick={onBuy} disabled={coins < price} className="text-xs font-bold bg-amber-500 hover:bg-amber-400 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-lg px-3 py-1.5 transition">
      💰 {price}
    </button>
  </div>
);

export default World;
