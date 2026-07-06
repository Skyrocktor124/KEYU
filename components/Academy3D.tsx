import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Stars, Html } from '@react-three/drei';
import * as THREE from 'three';
import { KnowledgePoint, QuizQuestion, SubjectId } from '../types';
import { SUBJECTS } from '../constants';
import { BattleQuestion, makeIntruderQuestion, toBattleQuestion } from '../services/adventure';
import { AdventureData } from '../services/adventure';
import { sfx, confetti } from '../services/effects';
import { SubjectBadge } from './ui';

/**
 * 文华魔法学院：3D 沉浸模式。
 * 你是入学新生（主人公），在星夜下的魔法城堡校园自由行走，
 * 靠近游荡的魔法生物触发咒语对决——答对即施法，答错被诅咒反噬。
 */

export interface AcademyData {
  house: string | null;
  duelsWon: number;
}

export const DEFAULT_ACADEMY: AcademyData = { house: null, duelsWon: 0 };

const HOUSES = [
  { id: 'qilin', name: '麟趾院', emoji: '🦌', motto: '以史为鉴，勇毅笃行', color: '#f59e0b' },
  { id: 'kunpeng', name: '鲲鹏院', emoji: '🐋', motto: '扶摇九万里，俯瞰山与海', color: '#10b981' },
  { id: 'baize', name: '白泽院', emoji: '🦄', motto: '知天下事，辨万物理', color: '#f43f5e' },
  { id: 'xingshu', name: '星枢院', emoji: '✨', motto: '博采三科，执星辰为笔', color: '#8b5cf6' },
];

const SPELLS: Record<SubjectId, string> = {
  history: '时光回溯咒 · 烛照千年',
  geography: '风水唤灵咒 · 山河听令',
  politics: '明心见性咒 · 拨云见日',
};

interface SpriteDef {
  id: number;
  pos: [number, number, number];
  subject: SubjectId;
  emoji: string;
  name: string;
}

const CREATURE_POOL: { emoji: string; name: string }[] = [
  { emoji: '👻', name: '遗忘幽灵' },
  { emoji: '📖', name: '狂乱书灵' },
  { emoji: '🦇', name: '咒文蝠' },
  { emoji: '🫠', name: '混沌史莱姆' },
  { emoji: '🕯️', name: '夜烛精' },
  { emoji: '🐍', name: '谬误之蛇' },
];

const TOWER_POS: Record<SubjectId, [number, number]> = {
  history: [-14, -10],
  geography: [14, -10],
  politics: [0, 14],
};

function randSprites(): SpriteDef[] {
  const subjects: SubjectId[] = ['history', 'geography', 'politics'];
  return Array.from({ length: 7 }, (_, i) => {
    const subject = subjects[i % 3];
    const [tx, tz] = TOWER_POS[subject];
    const c = CREATURE_POOL[Math.floor(Math.random() * CREATURE_POOL.length)];
    return {
      id: i + Math.random(),
      pos: [tx + (Math.random() - 0.5) * 10, 0.8, tz + (Math.random() - 0.5) * 10] as [number, number, number],
      subject,
      emoji: c.emoji,
      name: c.name,
    };
  });
}

function drawQ(subject: SubjectId, questions: QuizQuestion[], kps: KnowledgePoint[]): BattleQuestion | null {
  const pool = kps.filter((k) => k.subject === subject);
  const reals = questions.filter((q) => q.subject === subject);
  if (Math.random() < 0.55 && reals.length > 0) return toBattleQuestion(reals[Math.floor(Math.random() * reals.length)]);
  return makeIntruderQuestion(pool, kps) ?? (reals.length > 0 ? toBattleQuestion(reals[Math.floor(Math.random() * reals.length)]) : null);
}

/* ============ 3D 场景组件 ============ */

const keys: Record<string, boolean> = {};

const Player: React.FC<{ frozen: boolean; sprites: SpriteDef[]; onEncounter: (s: SpriteDef) => void; playerRef: React.MutableRefObject<THREE.Group | null> }> = ({
  frozen,
  sprites,
  onEncounter,
  playerRef,
}) => {
  const group = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const encounterLock = useRef(false);

  useEffect(() => {
    playerRef.current = group.current;
    encounterLock.current = false;
  });

  useFrame((state, dt) => {
    const g = group.current;
    if (!g) return;
    if (!frozen) {
      const speed = 7 * dt;
      let dx = 0;
      let dz = 0;
      if (keys['ArrowUp'] || keys['w']) dz -= 1;
      if (keys['ArrowDown'] || keys['s']) dz += 1;
      if (keys['ArrowLeft'] || keys['a']) dx -= 1;
      if (keys['ArrowRight'] || keys['d']) dx += 1;
      if (dx !== 0 || dz !== 0) {
        const len = Math.hypot(dx, dz);
        g.position.x += (dx / len) * speed;
        g.position.z += (dz / len) * speed;
        g.rotation.y = Math.atan2(dx, dz);
        // 行走弹跳
        g.position.y = Math.abs(Math.sin(state.clock.elapsedTime * 10)) * 0.15;
        // 边界
        const r = Math.hypot(g.position.x, g.position.z);
        if (r > 26) {
          g.position.x *= 26 / r;
          g.position.z *= 26 / r;
        }
        // 城堡碰撞（中心）
        const cr = Math.hypot(g.position.x, g.position.z + 2);
        if (cr < 5) {
          g.position.x *= 5 / cr;
          g.position.z = (g.position.z + 2) * (5 / cr) - 2;
        }
      } else {
        g.position.y = Math.sin(state.clock.elapsedTime * 2) * 0.04;
      }
      // 遭遇检测
      if (!encounterLock.current) {
        for (const s of sprites) {
          const d = Math.hypot(g.position.x - s.pos[0], g.position.z - s.pos[2]);
          if (d < 1.6) {
            encounterLock.current = true;
            onEncounter(s);
            break;
          }
        }
      }
    }
    // 第三人称跟随相机
    const target = new THREE.Vector3(g.position.x, g.position.y + 7, g.position.z + 11);
    camera.position.lerp(target, 0.06);
    camera.lookAt(g.position.x, g.position.y + 1.2, g.position.z);
  });

  return (
    <group ref={group} position={[0, 0, 8]}>
      {/* 长袍 */}
      <mesh position={[0, 0.75, 0]} castShadow>
        <coneGeometry args={[0.55, 1.5, 12]} />
        <meshStandardMaterial color="#4c1d95" />
      </mesh>
      {/* 头 */}
      <mesh position={[0, 1.7, 0]} castShadow>
        <sphereGeometry args={[0.32, 16, 16]} />
        <meshStandardMaterial color="#fcd9b8" />
      </mesh>
      {/* 魔法帽 */}
      <mesh position={[0, 2.15, 0]} castShadow>
        <coneGeometry args={[0.4, 0.85, 12]} />
        <meshStandardMaterial color="#312e81" />
      </mesh>
      <mesh position={[0, 1.82, 0]}>
        <torusGeometry args={[0.4, 0.07, 8, 20]} />
        <meshStandardMaterial color="#312e81" />
      </mesh>
      {/* 魔杖（发光杖头） */}
      <mesh position={[0.55, 1.1, 0.2]} rotation={[0, 0, -0.5]}>
        <cylinderGeometry args={[0.03, 0.03, 0.8]} />
        <meshStandardMaterial color="#92400e" />
      </mesh>
      <mesh position={[0.72, 1.45, 0.2]}>
        <sphereGeometry args={[0.09, 8, 8]} />
        <meshStandardMaterial color="#fbbf24" emissive="#f59e0b" emissiveIntensity={2.5} />
      </mesh>
      <pointLight position={[0.72, 1.45, 0.2]} intensity={2} distance={4} color="#fbbf24" />
    </group>
  );
};

const Tower: React.FC<{ x: number; z: number; color: string; label: string; emoji: string }> = ({ x, z, color, label, emoji }) => (
  <group position={[x, 0, z]}>
    <mesh position={[0, 3, 0]} castShadow>
      <cylinderGeometry args={[1.6, 2, 6, 10]} />
      <meshStandardMaterial color="#57534e" />
    </mesh>
    <mesh position={[0, 7, 0]} castShadow>
      <coneGeometry args={[2.2, 2.6, 10]} />
      <meshStandardMaterial color={color} />
    </mesh>
    {/* 发光窗 */}
    {[1.5, 3, 4.5].map((y) => (
      <mesh key={y} position={[0, y, 1.9]}>
        <boxGeometry args={[0.4, 0.6, 0.1]} />
        <meshStandardMaterial color="#fef3c7" emissive="#fbbf24" emissiveIntensity={1.6} />
      </mesh>
    ))}
    <pointLight position={[0, 5, 0]} intensity={6} distance={14} color={color} />
    <Html position={[0, 9, 0]} center distanceFactor={26} style={{ pointerEvents: 'none' }}>
      <div style={{ fontSize: 22, whiteSpace: 'nowrap', textAlign: 'center', textShadow: '0 2px 6px rgba(0,0,0,.7)', color: '#fff', fontWeight: 700 }}>
        {emoji} {label}
      </div>
    </Html>
  </group>
);

const Castle: React.FC = () => (
  <group position={[0, 0, -2]}>
    <mesh position={[0, 2.5, 0]} castShadow>
      <boxGeometry args={[6, 5, 5]} />
      <meshStandardMaterial color="#44403c" />
    </mesh>
    {[-2.6, 2.6].map((x) => (
      <group key={x} position={[x, 0, 0]}>
        <mesh position={[0, 4, 0]} castShadow>
          <cylinderGeometry args={[1, 1.2, 8, 10]} />
          <meshStandardMaterial color="#57534e" />
        </mesh>
        <mesh position={[0, 9, 0]} castShadow>
          <coneGeometry args={[1.5, 2.2, 10]} />
          <meshStandardMaterial color="#7c3aed" />
        </mesh>
      </group>
    ))}
    <mesh position={[0, 6.2, 0]} castShadow>
      <coneGeometry args={[3.4, 3, 4]} />
      <meshStandardMaterial color="#6d28d9" />
    </mesh>
    {/* 大门 */}
    <mesh position={[0, 1.1, 2.55]}>
      <boxGeometry args={[1.6, 2.2, 0.15]} />
      <meshStandardMaterial color="#fbbf24" emissive="#f59e0b" emissiveIntensity={1.2} />
    </mesh>
    {[[-1.6, 3.4], [1.6, 3.4], [0, 4.6]].map(([x, y], i) => (
      <mesh key={i} position={[x, y, 2.55]}>
        <boxGeometry args={[0.5, 0.8, 0.1]} />
        <meshStandardMaterial color="#fef3c7" emissive="#fbbf24" emissiveIntensity={1.8} />
      </mesh>
    ))}
    <pointLight position={[0, 8, 4]} intensity={8} distance={22} color="#c4b5fd" />
    <Html position={[0, 11.6, 0]} center distanceFactor={30} style={{ pointerEvents: 'none' }}>
      <div style={{ fontSize: 24, whiteSpace: 'nowrap', color: '#e9d5ff', fontWeight: 800, textShadow: '0 2px 8px rgba(0,0,0,.8)' }}>🏰 文华魔法学院</div>
    </Html>
  </group>
);

const Trees: React.FC = () => {
  const trees = useMemo(
    () =>
      Array.from({ length: 26 }, () => {
        const ang = Math.random() * Math.PI * 2;
        const r = 20 + Math.random() * 7;
        return { x: Math.cos(ang) * r, z: Math.sin(ang) * r, s: 0.7 + Math.random() * 0.9 };
      }),
    [],
  );
  return (
    <>
      {trees.map((t, i) => (
        <group key={i} position={[t.x, 0, t.z]} scale={t.s}>
          <mesh position={[0, 0.6, 0]}>
            <cylinderGeometry args={[0.15, 0.22, 1.2]} />
            <meshStandardMaterial color="#3f2f23" />
          </mesh>
          <mesh position={[0, 2, 0]}>
            <coneGeometry args={[1, 2.6, 8]} />
            <meshStandardMaterial color="#14532d" />
          </mesh>
        </group>
      ))}
    </>
  );
};

const Fireflies: React.FC = () => {
  const ref = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const arr = new Float32Array(90 * 3);
    for (let i = 0; i < 90; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 50;
      arr[i * 3 + 1] = 0.5 + Math.random() * 6;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 50;
    }
    return arr;
  }, []);
  useFrame((state) => {
    if (ref.current) ref.current.rotation.y = state.clock.elapsedTime * 0.02;
  });
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.18} color="#fde68a" transparent opacity={0.9} sizeAttenuation />
    </points>
  );
};

const Sprite3D: React.FC<{ s: SpriteDef }> = ({ s }) => {
  const ref = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (ref.current) ref.current.position.y = s.pos[1] + Math.sin(state.clock.elapsedTime * 2 + s.id) * 0.3;
  });
  const color = s.subject === 'history' ? '#f59e0b' : s.subject === 'geography' ? '#10b981' : '#f43f5e';
  return (
    <group ref={ref} position={s.pos}>
      <mesh>
        <sphereGeometry args={[0.5, 12, 12]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.4} transparent opacity={0.35} />
      </mesh>
      <pointLight intensity={3} distance={6} color={color} />
      <Html center distanceFactor={16} style={{ pointerEvents: 'none' }}>
        <div style={{ fontSize: 30, filter: 'drop-shadow(0 2px 6px rgba(0,0,0,.6))' }}>{s.emoji}</div>
      </Html>
    </group>
  );
};

/* ============ 主组件 ============ */

interface DuelState {
  sprite: SpriteDef;
  enemyHp: number;
  playerHp: number;
  q: BattleQuestion | null;
  picked: number | null;
  combo: number;
  phase: 'fight' | 'resolve' | 'won' | 'lost';
  flash: string | null;
}

interface Props {
  kps: KnowledgePoint[];
  questions: QuizQuestion[];
  academy: AcademyData;
  setAcademy: React.Dispatch<React.SetStateAction<AcademyData>>;
  adventure: AdventureData;
  setAdventure: React.Dispatch<React.SetStateAction<AdventureData>>;
  onWrong: (questionId: string) => void;
  onDuelEnd: (victory: boolean) => void;
}

const Academy3D: React.FC<Props> = ({ kps, questions, academy, setAcademy, adventure, setAdventure, onWrong, onDuelEnd }) => {
  const [sprites, setSprites] = useState<SpriteDef[]>(() => randSprites());
  const [duel, setDuel] = useState<DuelState | null>(null);
  const playerRef = useRef<THREE.Group | null>(null);

  // 键盘监听（防止方向键滚动页面）
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault();
      keys[e.key.length === 1 ? e.key.toLowerCase() : e.key] = true;
    };
    const up = (e: KeyboardEvent) => {
      keys[e.key.length === 1 ? e.key.toLowerCase() : e.key] = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  const startDuel = (s: SpriteDef) => {
    sfx.flip();
    setDuel({ sprite: s, enemyHp: 60, playerHp: 100, q: drawQ(s.subject, questions, kps), picked: null, combo: 0, phase: 'fight', flash: null });
  };

  const endDuel = (won: boolean, d: DuelState) => {
    if (won) {
      const coins = 25 + (academy.house === houseOfSubject(d.sprite.subject) ? 5 : 0);
      setAdventure((a) => ({ ...a, coins: a.coins + coins }));
      setAcademy((ac) => ({ ...ac, duelsWon: ac.duelsWon + 1 }));
      confetti(90);
      sfx.victory();
    } else {
      sfx.defeat();
    }
    onDuelEnd(won);
    // 打完移除该生物，稍后补充新生物
    setSprites((list) => {
      const rest = list.filter((x) => x.id !== d.sprite.id);
      return [...rest, ...randSprites().slice(0, 1)];
    });
    setDuel({ ...d, phase: won ? 'won' : 'lost' });
  };

  const houseOfSubject = (s: SubjectId) => (s === 'history' ? 'qilin' : s === 'geography' ? 'kunpeng' : 'baize');

  const pick = (i: number) => {
    if (!duel || duel.phase !== 'fight' || duel.picked !== null || !duel.q) return;
    const correct = i === duel.q.answer;
    if (correct) {
      const combo = duel.combo + 1;
      const dmg = combo >= 3 ? 30 : 20;
      combo >= 3 ? sfx.crit() : sfx.hit();
      const newHp = Math.max(0, duel.enemyHp - dmg);
      const flash = SPELLS[duel.q.subject] + (combo >= 3 ? '（暴击）' : '');
      if (newHp <= 0) {
        setDuel({ ...duel, picked: i, enemyHp: 0, combo, flash });
        setTimeout(() => endDuel(true, { ...duel, enemyHp: 0 }), 900);
      } else {
        setDuel({ ...duel, picked: i, enemyHp: newHp, combo, flash });
        setTimeout(() => setDuel((d) => d && { ...d, q: drawQ(d.sprite.subject, questions, kps), picked: null, flash: null }), 850);
      }
    } else {
      if (duel.q.realId) onWrong(duel.q.realId);
      sfx.hurt();
      const newHp = Math.max(0, duel.playerHp - 25);
      if (newHp <= 0) {
        setDuel({ ...duel, picked: i, playerHp: 0 });
        setTimeout(() => endDuel(false, duel), 700);
      } else {
        setDuel({ ...duel, picked: i, playerHp: newHp, combo: 0, phase: 'resolve' });
      }
    }
  };

  /* ---- 分院仪式 ---- */
  if (!academy.house) {
    return (
      <div className="max-w-3xl mx-auto bg-gradient-to-b from-slate-900 to-indigo-950 rounded-2xl p-8 text-center text-white">
        <div className="text-5xl">🎩</div>
        <h2 className="mt-3 text-2xl font-black">分院仪式</h2>
        <p className="mt-2 text-sm text-indigo-200 leading-relaxed">
          破旧的分院帽落在你头上，低声说：<br />
          「嗯……高考文科的挑战者？有意思。你想去哪个学院磨砺自己？」
        </p>
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
          {HOUSES.map((h) => (
            <button
              key={h.id}
              onClick={() => {
                setAcademy((a) => ({ ...a, house: h.id }));
                confetti();
                sfx.levelUp();
              }}
              className="rounded-2xl border-2 border-white/15 hover:border-amber-400 bg-white/5 hover:bg-white/10 p-4 transition group"
            >
              <div className="text-4xl group-hover:scale-110 transition">{h.emoji}</div>
              <div className="mt-2 font-bold" style={{ color: h.color }}>
                {h.name}
              </div>
              <p className="mt-1 text-[11px] text-indigo-200 leading-relaxed">{h.motto}</p>
            </button>
          ))}
        </div>
        <p className="mt-4 text-xs text-indigo-300">进入 3D 校园后：方向键 / WASD 行走，靠近发光的魔法生物即触发咒语对决</p>
      </div>
    );
  }

  const house = HOUSES.find((h) => h.id === academy.house)!;

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <span className="text-sm bg-white border border-slate-200 rounded-xl px-3 py-1.5 font-semibold" style={{ color: house.color }}>
          {house.emoji} {house.name} 新生
        </span>
        <span className="text-sm bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-slate-600">🏆 决斗胜场 {academy.duelsWon} · 💰 {adventure.coins}</span>
        <span className="ml-auto text-xs text-slate-400">方向键 / WASD 行走 · 靠近发光生物触发对决</span>
      </div>

      {/* 3D 校园 */}
      <div className="relative rounded-2xl overflow-hidden border border-slate-300" style={{ height: 520 }}>
        <Canvas shadows camera={{ position: [0, 8, 20], fov: 55 }}>
          <color attach="background" args={['#0b1026']} />
          <fog attach="fog" args={['#0b1026', 28, 55]} />
          <ambientLight intensity={0.35} />
          <directionalLight position={[10, 20, 5]} intensity={0.5} color="#94a3ff" castShadow />
          <Stars radius={80} depth={40} count={2500} factor={4} fade speed={0.6} />
          {/* 月亮 */}
          <mesh position={[-18, 22, -30]}>
            <sphereGeometry args={[3, 16, 16]} />
            <meshBasicMaterial color="#fef9c3" />
          </mesh>
          {/* 地面 */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <circleGeometry args={[30, 48]} />
            <meshStandardMaterial color="#1a2e1f" />
          </mesh>
          {/* 石径 */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 5]}>
            <planeGeometry args={[2.4, 16]} />
            <meshStandardMaterial color="#57534e" />
          </mesh>
          <Castle />
          <Tower x={TOWER_POS.history[0]} z={TOWER_POS.history[1]} color="#b45309" label="史学塔" emoji="📜" />
          <Tower x={TOWER_POS.geography[0]} z={TOWER_POS.geography[1]} color="#047857" label="坤舆塔" emoji="🗺️" />
          <Tower x={TOWER_POS.politics[0]} z={TOWER_POS.politics[1]} color="#be123c" label="明德塔" emoji="⚖️" />
          <Trees />
          <Fireflies />
          {sprites.map((s) => (
            <Sprite3D key={s.id} s={s} />
          ))}
          <Player frozen={!!duel} sprites={sprites} onEncounter={startDuel} playerRef={playerRef} />
        </Canvas>

        {/* 咒语对决覆盖层 */}
        {duel && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-[2px] flex items-center justify-center p-4 overflow-y-auto">
            <div className="w-full max-w-xl">
              {/* 对决舞台 */}
              <div className="flex items-end justify-between px-6">
                <div className="text-center">
                  <div className="text-5xl">🧙</div>
                  <HpBar value={duel.playerHp} max={100} label={`你 · ${house.name}`} />
                </div>
                <div className="text-3xl text-amber-400 font-black pb-8 animate-flame">⚡</div>
                <div className="text-center">
                  <div className={`text-5xl ${duel.enemyHp === 0 ? 'enemy-die' : 'enemy-idle'}`}>{duel.sprite.emoji}</div>
                  <HpBar value={duel.enemyHp} max={60} label={duel.sprite.name} />
                </div>
              </div>
              {duel.flash && (
                <div className="text-center mt-2 text-amber-300 font-bold text-sm animate-pop">✨ {duel.flash}！</div>
              )}

              {(duel.phase === 'won' || duel.phase === 'lost') && (
                <div className="mt-3 bg-white rounded-2xl p-6 text-center">
                  <div className="text-4xl">{duel.phase === 'won' ? '🏆' : '💫'}</div>
                  <h3 className="mt-2 text-lg font-black text-slate-900">
                    {duel.phase === 'won' ? `${duel.sprite.name} 被净化了！+25 金币` : '你被诅咒击倒了……去复习考点再来！'}
                  </h3>
                  <button onClick={() => setDuel(null)} className="mt-3 px-6 py-2 bg-slate-800 text-white rounded-xl text-sm font-semibold hover:bg-slate-700 transition">
                    返回校园
                  </button>
                </div>
              )}

              {(duel.phase === 'fight' || duel.phase === 'resolve') && duel.q && (
                <div className="mt-3 bg-white rounded-2xl p-4">
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
                    <span className="flex items-center gap-2">
                      <SubjectBadge subject={duel.q.subject} small />
                      {duel.q.realId ? '真题咒文' : '快诵咒文'}
                    </span>
                    {duel.combo >= 2 && <span className="font-bold text-orange-500">🔥 ×{duel.combo}</span>}
                  </div>
                  <p className="text-slate-900 text-sm font-medium leading-relaxed">{duel.q.question}</p>
                  <div className="mt-2.5 space-y-1.5">
                    {duel.q.options.map((opt, i) => {
                      let cls = 'border-slate-200 hover:border-violet-400 hover:bg-violet-50/50';
                      if (duel.picked !== null) {
                        if (i === duel.q!.answer) cls = 'border-emerald-400 bg-emerald-50';
                        else if (i === duel.picked) cls = 'border-rose-400 bg-rose-50';
                        else cls = 'border-slate-200 opacity-60';
                      }
                      return (
                        <button key={i} onClick={() => pick(i)} disabled={duel.picked !== null} className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition flex gap-2 ${cls}`}>
                          <span className="font-semibold text-slate-400">{'ABCD'[i]}.</span>
                          <span className="text-slate-700">{opt}</span>
                        </button>
                      );
                    })}
                  </div>
                  {duel.phase === 'resolve' && (
                    <>
                      <div className="mt-2.5 bg-slate-50 rounded-lg p-3 text-xs text-slate-600 leading-relaxed">
                        <strong className="text-slate-800">💡 咒语精要：</strong>
                        {duel.q.explanation}
                      </div>
                      <button
                        onClick={() => setDuel((d) => d && { ...d, q: drawQ(d.sprite.subject, questions, kps), picked: null, phase: 'fight', flash: null })}
                        className="mt-2.5 w-full py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700 transition"
                      >
                        🪄 重整魔杖，再来！
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <p className="mt-2 text-xs text-slate-400 text-center">
        三座学科塔下游荡着对应科目的魔法生物 · 决斗答错的真题自动进错题本 · 胜利金币与全站共享
      </p>
    </div>
  );
};

const HpBar: React.FC<{ value: number; max: number; label: string }> = ({ value, max, label }) => (
  <div className="mt-1">
    <div className="w-32 h-2.5 bg-slate-800 rounded-full overflow-hidden mx-auto border border-slate-600">
      <div
        className={`h-full transition-all duration-300 ${value / max <= 0.3 ? 'bg-rose-500 hp-low' : 'bg-gradient-to-r from-emerald-400 to-lime-400'}`}
        style={{ width: `${(value / max) * 100}%` }}
      />
    </div>
    <div className="text-[11px] text-slate-300 mt-0.5">
      {label} <span className="tabular-nums">{value}/{max}</span>
    </div>
  </div>
);

export default Academy3D;
