import React, { useMemo, useRef, useState } from 'react';
import { Lock, Star, Coins, Swords, Heart, ShoppingBag, X } from 'lucide-react';
import { KnowledgePoint, QuizQuestion } from '../types';
import { STAGES, StageDef, EnemyDef } from '../data/adventure';
import {
  AdventureData,
  ITEM_PRICES,
  BattleQuestion,
  drawQuestion,
  stageKps,
  stageRealQuestions,
} from '../services/adventure';
import { sfx, confetti } from '../services/effects';
import { SubjectBadge } from './ui';

const PLAYER_MAX_HP = 100;

interface Props {
  kps: KnowledgePoint[];
  questions: QuizQuestion[];
  adventure: AdventureData;
  setAdventure: React.Dispatch<React.SetStateAction<AdventureData>>;
  onWrong: (questionId: string) => void;
  onBattleEnd: (victory: boolean, stars: number, firstClear: boolean, finalBoss: boolean) => void;
}

/* ============================== 世界地图 ============================== */

const Adventure: React.FC<Props> = (props) => {
  const { adventure, setAdventure } = props;
  const [battleStage, setBattleStage] = useState<StageDef | null>(null);
  const [shopOpen, setShopOpen] = useState(false);

  const unlockedCount = useMemo(() => {
    let n = 1;
    for (const s of STAGES) {
      if ((adventure.stars[s.id] ?? 0) > 0) n += 1;
      else break;
    }
    return Math.min(n, STAGES.length);
  }, [adventure.stars]);

  if (battleStage) {
    return <Battle {...props} stage={battleStage} onExit={() => setBattleStage(null)} />;
  }

  const buy = (item: 'ginseng' | 'exclude') => {
    const price = ITEM_PRICES[item];
    if (adventure.coins < price) return;
    sfx.coin();
    setAdventure((a) => ({ ...a, coins: a.coins - price, items: { ...a.items, [item]: a.items[item] + 1 } }));
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* 资源栏 */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Swords className="w-5 h-5 text-amber-600" />
            赶考之路
          </h2>
          <p className="text-sm text-slate-500">七关斩尽学习之敌，殿试面圣，大魁天下。答题即出招：答对砍怪，答错挨打。</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-800 text-sm font-semibold rounded-xl px-3 py-1.5">
            <Coins className="w-4 h-4" />
            <span className="tabular-nums">{adventure.coins}</span>
          </span>
          <span className="text-sm bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-slate-600">
            🧪 参汤 ×{adventure.items.ginseng} · 📜 锦囊 ×{adventure.items.exclude}
          </span>
          <button
            onClick={() => setShopOpen((v) => !v)}
            className="flex items-center gap-1.5 text-sm bg-slate-800 text-white rounded-xl px-3 py-1.5 hover:bg-slate-700 transition"
          >
            <ShoppingBag className="w-4 h-4" />
            书肆
          </button>
        </div>
      </div>

      {/* 书肆（商店） */}
      {shopOpen && (
        <div className="mb-4 bg-white border border-slate-200 rounded-2xl p-4 flex flex-wrap items-center gap-4">
          <ShopItem
            emoji="🧪"
            name="百年参汤"
            desc="战斗中回复 30 点心力"
            price={ITEM_PRICES.ginseng}
            canBuy={adventure.coins >= ITEM_PRICES.ginseng}
            onBuy={() => buy('ginseng')}
          />
          <ShopItem
            emoji="📜"
            name="锦囊妙计"
            desc="排除当前题的两个错误选项"
            price={ITEM_PRICES.exclude}
            canBuy={adventure.coins >= ITEM_PRICES.exclude}
            onBuy={() => buy('exclude')}
          />
          <p className="text-xs text-slate-400 ml-auto">金币来自战斗胜利——学得越好，装备越豪华</p>
        </div>
      )}

      {/* 关卡地图 */}
      <div className="relative">
        <div className="absolute left-8 top-6 bottom-6 w-1 bg-gradient-to-b from-amber-300 via-amber-200 to-slate-200 rounded-full" />
        <div className="space-y-3">
          {STAGES.map((stage, i) => {
            const stars = adventure.stars[stage.id] ?? 0;
            const unlocked = i < unlockedCount;
            const isNext = i === unlockedCount - 1 && stars === 0;
            return (
              <div key={stage.id} className="relative pl-16">
                <div
                  className={`absolute left-4 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center text-lg border-2 ${
                    stars > 0
                      ? 'bg-amber-400 border-amber-500'
                      : unlocked
                        ? 'bg-white border-amber-400'
                        : 'bg-slate-100 border-slate-200'
                  }`}
                >
                  {unlocked ? stage.scene : <Lock className="w-4 h-4 text-slate-400" />}
                </div>
                <button
                  disabled={!unlocked}
                  onClick={() => setBattleStage(stage)}
                  className={`w-full text-left bg-white rounded-2xl border p-4 flex items-center gap-4 transition ${
                    unlocked ? 'border-slate-200 hover:border-amber-400 hover:shadow-md cursor-pointer' : 'border-slate-100 opacity-50'
                  } ${isNext ? 'ring-2 ring-amber-300 ring-offset-2' : ''}`}
                >
                  <span className="text-4xl">{stage.scene}</span>
                  <span className="flex-1 min-w-0">
                    <span className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-900">
                        第{'一二三四五六七'[i]}关 · {stage.name}
                      </span>
                      {stage.subjects.map((s) => (
                        <SubjectBadge key={s} subject={s} small />
                      ))}
                      {isNext && <span className="text-xs font-bold text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">📍 当前进度</span>}
                    </span>
                    <span className="block mt-1 text-sm text-slate-500 truncate">{stage.desc}</span>
                  </span>
                  <span className="flex gap-0.5 shrink-0">
                    {[1, 2, 3].map((n) => (
                      <Star key={n} className={`w-5 h-5 ${n <= stars ? 'text-amber-400 fill-amber-400' : 'text-slate-200'}`} />
                    ))}
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      </div>
      <p className="mt-4 text-center text-xs text-slate-400">通关一关解锁下一关 · 剩余心力越多星越多 · 战斗中的真题答错会自动进错题本</p>
    </div>
  );
};

const ShopItem: React.FC<{ emoji: string; name: string; desc: string; price: number; canBuy: boolean; onBuy: () => void }> = ({
  emoji,
  name,
  desc,
  price,
  canBuy,
  onBuy,
}) => (
  <div className="flex items-center gap-3">
    <span className="text-3xl">{emoji}</span>
    <div>
      <div className="font-semibold text-slate-800 text-sm">{name}</div>
      <div className="text-xs text-slate-500">{desc}</div>
    </div>
    <button
      onClick={onBuy}
      disabled={!canBuy}
      className="ml-2 flex items-center gap-1 text-xs font-bold bg-amber-500 hover:bg-amber-400 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-lg px-3 py-1.5 transition"
    >
      <Coins className="w-3.5 h-3.5" />
      {price}
    </button>
  </div>
);

/* ============================== 回合制战斗 ============================== */

type BattlePhase = 'fight' | 'resolve' | 'victory' | 'defeat';

interface DmgFx {
  id: number;
  text: string;
  cls: string;
  side: 'enemy' | 'player';
}

const Battle: React.FC<Props & { stage: StageDef; onExit: () => void }> = ({
  kps,
  questions,
  adventure,
  setAdventure,
  onWrong,
  onBattleEnd,
  stage,
  onExit,
}) => {
  const pool = useMemo(() => stageKps(stage, kps), [stage, kps]);
  const reals = useMemo(() => stageRealQuestions(stage, questions, kps), [stage, questions, kps]);
  const usedReal = useRef(new Set<string>());

  const [enemyIdx, setEnemyIdx] = useState(0);
  const enemy: EnemyDef = stage.enemies[Math.min(enemyIdx, stage.enemies.length - 1)];
  const [enemyHp, setEnemyHp] = useState(stage.enemies[0].hp);
  const [playerHp, setPlayerHp] = useState(PLAYER_MAX_HP);
  const [combo, setCombo] = useState(0);
  const [phase, setPhase] = useState<BattlePhase>('fight');
  const [q, setQ] = useState<BattleQuestion | null>(() =>
    drawQuestion(stage.enemies[0].kind, reals, pool, kps, usedReal.current),
  );
  const [picked, setPicked] = useState<number | null>(null);
  const [excluded, setExcluded] = useState<number[]>([]);
  const [enemyAnim, setEnemyAnim] = useState<'idle' | 'hit' | 'enter' | 'die'>('enter');
  const [shaking, setShaking] = useState(false);
  const [vignette, setVignette] = useState(0);
  const [fxs, setFxs] = useState<DmgFx[]>([]);
  const [taunt, setTaunt] = useState(stage.enemies[0].taunt);
  const fxId = useRef(0);
  const endedRef = useRef(false);

  const pushFx = (text: string, cls: string, side: 'enemy' | 'player') => {
    const id = ++fxId.current;
    setFxs((f) => [...f, { id, text, cls, side }]);
    setTimeout(() => setFxs((f) => f.filter((x) => x.id !== id)), 1000);
  };

  const nextQuestion = (kind: EnemyDef['kind']) => {
    const nq = drawQuestion(kind, reals, pool, kps, usedReal.current);
    if (nq?.realId) usedReal.current.add(nq.realId);
    setQ(nq);
    setPicked(null);
    setExcluded([]);
  };

  const finish = (victory: boolean, stars: number) => {
    if (endedRef.current) return;
    endedRef.current = true;
    const firstClear = victory && (adventure.stars[stage.id] ?? 0) === 0;
    const finalBoss = victory && stage.id === STAGES[STAGES.length - 1].id;
    if (victory) {
      const coins = 30 + stars * 10 + (finalBoss ? 50 : 0);
      setAdventure((a) => ({
        ...a,
        coins: a.coins + coins,
        stars: { ...a.stars, [stage.id]: Math.max(a.stars[stage.id] ?? 0, stars) },
      }));
      confetti();
      sfx.victory();
    } else {
      sfx.defeat();
    }
    onBattleEnd(victory, stars, firstClear, finalBoss);
  };

  const starsFromHp = (hp: number) => (hp >= 70 ? 3 : hp >= 40 ? 2 : 1);

  const pick = (i: number) => {
    if (phase !== 'fight' || picked !== null || !q) return;
    setPicked(i);
    const correct = i === q.answer;
    if (correct) {
      const newCombo = combo + 1;
      setCombo(newCombo);
      const crit = newCombo >= 3;
      const dmg = crit ? 30 : 20;
      crit ? sfx.crit() : sfx.hit();
      pushFx(crit ? `暴击 -${dmg}！` : `-${dmg}`, crit ? 'text-2xl text-orange-500' : 'text-xl text-amber-600', 'enemy');
      setEnemyAnim('hit');
      setTimeout(() => setEnemyAnim('idle'), 420);
      const newHp = enemyHp - dmg;
      if (newHp <= 0) {
        // 击败当前敌人
        setTimeout(() => {
          setEnemyAnim('die');
          setTimeout(() => {
            if (enemyIdx + 1 >= stage.enemies.length) {
              setPhase('victory');
              finish(true, starsFromHp(playerHp));
            } else {
              const next = stage.enemies[enemyIdx + 1];
              setEnemyIdx((n) => n + 1);
              setEnemyHp(next.hp);
              setTaunt(next.taunt);
              setEnemyAnim('enter');
              nextQuestion(next.kind);
            }
          }, 550);
        }, 350);
        setEnemyHp(0);
      } else {
        setEnemyHp(newHp);
        setTimeout(() => nextQuestion(enemy.kind), 700);
      }
    } else {
      // 答错：敌人反击，展示解析
      setCombo(0);
      if (q.realId) onWrong(q.realId);
      sfx.hurt();
      setShaking(true);
      setVignette((v) => v + 1);
      setTimeout(() => setShaking(false), 420);
      pushFx(`-${enemy.atk}`, 'text-2xl text-rose-600', 'player');
      const newHp = playerHp - enemy.atk;
      setPlayerHp(Math.max(0, newHp));
      if (newHp <= 0) {
        setTimeout(() => {
          setPhase('defeat');
          finish(false, 0);
        }, 600);
      } else {
        setPhase('resolve'); // 停下来看解析，点「继续」再战
      }
    }
  };

  const useGinseng = () => {
    if (adventure.items.ginseng <= 0 || playerHp >= PLAYER_MAX_HP || phase !== 'fight') return;
    sfx.quest();
    setAdventure((a) => ({ ...a, items: { ...a.items, ginseng: a.items.ginseng - 1 } }));
    setPlayerHp((hp) => Math.min(PLAYER_MAX_HP, hp + 30));
    pushFx('+30', 'text-xl text-emerald-600', 'player');
  };

  const useExclude = () => {
    if (adventure.items.exclude <= 0 || picked !== null || !q || excluded.length > 0 || phase !== 'fight') return;
    sfx.flip();
    setAdventure((a) => ({ ...a, items: { ...a.items, exclude: a.items.exclude - 1 } }));
    const wrongs = q.options.map((_, i) => i).filter((i) => i !== q.answer);
    setExcluded(wrongs.sort(() => Math.random() - 0.5).slice(0, 2));
  };

  const hpPct = (playerHp / PLAYER_MAX_HP) * 100;
  const enemyPct = (enemyHp / enemy.hp) * 100;

  /* ---- 结算画面 ---- */
  if (phase === 'victory' || phase === 'defeat') {
    const win = phase === 'victory';
    const stars = win ? starsFromHp(playerHp) : 0;
    return (
      <div className="max-w-2xl mx-auto bg-white rounded-2xl border border-slate-200 p-10 text-center">
        <div className="text-6xl">{win ? (stage.id === 'st-7' ? '👑' : '🏆') : '💀'}</div>
        <h2 className="mt-3 text-2xl font-black text-slate-900">
          {win ? (stage.id === 'st-7' ? '殿试夺魁！金榜题名！' : `${stage.name} 通关！`) : '力竭败退……'}
        </h2>
        {win ? (
          <>
            <div className="mt-3 flex justify-center gap-1">
              {[1, 2, 3].map((n) => (
                <Star key={n} className={`w-9 h-9 ${n <= stars ? 'text-amber-400 fill-amber-400' : 'text-slate-200'}`} />
              ))}
            </div>
            <p className="mt-3 text-sm text-slate-500">
              金币 +{30 + stars * 10 + (stage.id === 'st-7' ? 50 : 0)} · XP +{40 + stars * 10}
              {stars < 3 && ' · 想拿三星？保持 70 以上心力通关'}
            </p>
          </>
        ) : (
          <p className="mt-3 text-sm text-slate-500">
            败给了「{enemy.name}」。它的弱点已记入错题本——回炉之后再来复仇！（XP +10）
          </p>
        )}
        <div className="mt-6 flex justify-center gap-3">
          <button onClick={onExit} className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl transition">
            返回地图
          </button>
        </div>
      </div>
    );
  }

  /* ---- 战斗画面 ---- */
  return (
    <div className="max-w-3xl mx-auto">
      {vignette > 0 && <div key={vignette} className="red-vignette" />}
      <div className={shaking ? 'battle-shake' : ''}>
        {/* 战场 */}
        <div className="relative rounded-2xl bg-gradient-to-b from-slate-800 via-slate-700 to-slate-600 p-5 text-white overflow-hidden">
          <div className="absolute top-3 left-4 text-xs text-slate-300 flex items-center gap-2">
            <span>{stage.scene} {stage.name}</span>
            <span className="opacity-60">敌人 {Math.min(enemyIdx + 1, stage.enemies.length)}/{stage.enemies.length}</span>
          </div>
          <button onClick={onExit} className="absolute top-2.5 right-3 p-1.5 text-slate-400 hover:text-white transition" title="撤退回地图">
            <X className="w-4 h-4" />
          </button>

          {/* 敌人 */}
          <div className="mt-6 flex flex-col items-center relative">
            {fxs.filter((f) => f.side === 'enemy').map((f) => (
              <span key={f.id} className={`dmg-float font-black ${f.cls}`} style={{ top: 8, left: `calc(50% + ${(f.id % 5) * 14 - 28}px)` }}>
                {f.text}
              </span>
            ))}
            <div className={`text-7xl select-none enemy-${enemyAnim}`}>{enemy.emoji}</div>
            <div className="mt-2 flex items-center gap-2">
              <span className={`text-sm font-bold ${enemy.kind === 'boss' ? 'text-rose-300' : 'text-slate-200'}`}>
                {enemy.kind === 'boss' ? '👿 BOSS · ' : enemy.kind === 'elite' ? '⭐ 精英 · ' : ''}
                {enemy.name}
              </span>
            </div>
            <div className="mt-1.5 w-56 h-3 bg-slate-900/60 rounded-full overflow-hidden border border-slate-500/40">
              <div
                className={`h-full transition-all duration-300 ${enemy.kind === 'boss' ? 'bg-gradient-to-r from-rose-500 to-red-600' : 'bg-gradient-to-r from-emerald-400 to-emerald-500'}`}
                style={{ width: `${Math.max(0, enemyPct)}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-slate-300 italic max-w-sm text-center">「{taunt}」</p>
          </div>

          {/* 玩家状态条 */}
          <div className="mt-5 flex items-center justify-between gap-4 bg-slate-900/50 rounded-xl px-4 py-2.5 relative">
            {fxs.filter((f) => f.side === 'player').map((f) => (
              <span key={f.id} className={`dmg-float font-black ${f.cls}`} style={{ top: -18, left: `${20 + (f.id % 4) * 12}%` }}>
                {f.text}
              </span>
            ))}
            <div className="flex items-center gap-2 flex-1">
              <Heart className={`w-4 h-4 ${hpPct <= 30 ? 'text-rose-400 hp-low' : 'text-rose-300'}`} />
              <div className="flex-1 max-w-[200px] h-3 bg-slate-800 rounded-full overflow-hidden border border-slate-600/50">
                <div
                  className={`h-full transition-all duration-300 ${hpPct <= 30 ? 'bg-rose-500 hp-low' : 'bg-gradient-to-r from-rose-400 to-rose-500'}`}
                  style={{ width: `${hpPct}%` }}
                />
              </div>
              <span className="text-xs tabular-nums text-slate-300">{playerHp}/{PLAYER_MAX_HP}</span>
            </div>
            {combo >= 2 && (
              <span className="text-sm font-bold text-orange-400">
                <span className="animate-flame">🔥</span> ×{combo}
                {combo >= 3 && <span className="ml-1 text-xs text-orange-300">暴击中!</span>}
              </span>
            )}
            <div className="flex gap-2">
              <button
                onClick={useGinseng}
                disabled={adventure.items.ginseng <= 0 || playerHp >= PLAYER_MAX_HP || phase !== 'fight'}
                className="text-xs bg-emerald-600/80 hover:bg-emerald-500 disabled:opacity-30 rounded-lg px-2.5 py-1.5 transition"
                title="百年参汤：回复 30 心力"
              >
                🧪 ×{adventure.items.ginseng}
              </button>
              <button
                onClick={useExclude}
                disabled={adventure.items.exclude <= 0 || picked !== null || excluded.length > 0 || phase !== 'fight'}
                className="text-xs bg-violet-600/80 hover:bg-violet-500 disabled:opacity-30 rounded-lg px-2.5 py-1.5 transition"
                title="锦囊妙计：排除两个错误选项"
              >
                📜 ×{adventure.items.exclude}
              </button>
            </div>
          </div>
        </div>

        {/* 出题区 */}
        {q && (
          <div className="mt-3 bg-white rounded-2xl border border-slate-200 p-5">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
              <span className="flex items-center gap-2">
                <SubjectBadge subject={q.subject} small />
                {q.realId ? '真题一击' : '快问快答'}
              </span>
              <span>答对出招 · 答错挨打{enemy.kind === 'boss' ? ' · Boss 攻击更痛' : ''}</span>
            </div>
            <p className="text-slate-900 font-medium leading-relaxed text-[15px]">{q.question}</p>
            <div className="mt-3 space-y-2">
              {q.options.map((opt, i) => {
                if (excluded.includes(i)) {
                  return (
                    <div key={i} className="w-full px-4 py-2.5 rounded-xl border border-slate-100 text-sm text-slate-300 line-through select-none">
                      {'ABCD'[i]}. {opt}
                    </div>
                  );
                }
                let cls = 'border-slate-200 hover:border-amber-400 hover:bg-amber-50/50 active:scale-[0.99]';
                if (picked !== null) {
                  if (i === q.answer) cls = 'border-emerald-400 bg-emerald-50';
                  else if (i === picked) cls = 'border-rose-400 bg-rose-50';
                  else cls = 'border-slate-200 opacity-60';
                }
                return (
                  <button
                    key={i}
                    onClick={() => pick(i)}
                    disabled={picked !== null}
                    className={`w-full text-left px-4 py-2.5 rounded-xl border text-sm transition flex items-start gap-2 ${cls}`}
                  >
                    <span className="font-semibold text-slate-400">{'ABCD'[i]}.</span>
                    <span className="text-slate-700">{opt}</span>
                  </button>
                );
              })}
            </div>
            {phase === 'resolve' && (
              <>
                <div className="mt-3 bg-slate-50 rounded-xl p-3.5 text-sm text-slate-600">
                  <strong className="text-slate-800">💡 拆招要诀：</strong>
                  <span className="block mt-1 leading-relaxed">{q.explanation}</span>
                </div>
                <button
                  onClick={() => {
                    setPhase('fight');
                    nextQuestion(enemy.kind);
                  }}
                  className="mt-3 w-full py-2.5 bg-slate-800 text-white rounded-xl text-sm font-medium hover:bg-slate-700 transition"
                >
                  ⚔️ 记住了，再战！
                </button>
              </>
            )}
          </div>
        )}
        {!q && (
          <div className="mt-3 bg-white rounded-2xl border border-slate-200 p-8 text-center text-sm text-slate-500">
            这一关的题池空了——去「知识库」用 AI 出题扩充题库，或先攻其他关卡。
            <button onClick={onExit} className="block mx-auto mt-3 px-4 py-2 bg-slate-800 text-white rounded-xl text-sm">返回地图</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Adventure;
