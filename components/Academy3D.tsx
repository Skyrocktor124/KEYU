import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Stars, Html, Sparkles } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { KnowledgePoint, QuizQuestion, SubjectId } from '../types';
import { BattleQuestion, makeIntruderQuestion, toBattleQuestion } from '../services/adventure';
import { AdventureData } from '../services/adventure';
import { sfx, confetti } from '../services/effects';
import { SubjectBadge } from './ui';

/**
 * 文华魔法学院：3D 沉浸模式（Bloom 辉光渲染 + 全动画巫师主人公）。
 * 你是入学新生，在星夜与极光下的魔法城堡校园自由行走，
 * 靠近游荡的魔法生物触发咒语对决——答对即施法，答错被诅咒反噬。
 */

export interface AcademyData {
  house: string | null;
  duelsWon: number;
}

export const DEFAULT_ACADEMY: AcademyData = { house: null, duelsWon: 0 };

const HOUSES = [
  { id: 'qilin', name: '麟趾院', emoji: '🦌', motto: '以史为鉴，勇毅笃行', color: '#f59e0b', robe: '#c2410c' },
  { id: 'kunpeng', name: '鲲鹏院', emoji: '🐋', motto: '扶摇九万里，俯瞰山与海', color: '#10b981', robe: '#047857' },
  { id: 'baize', name: '白泽院', emoji: '🦄', motto: '知天下事，辨万物理', color: '#f43f5e', robe: '#be123c' },
  { id: 'xingshu', name: '星枢院', emoji: '✨', motto: '博采三科，执星辰为笔', color: '#8b5cf6', robe: '#4f46e5' },
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
      pos: [tx + (Math.random() - 0.5) * 10, 0.9, tz + (Math.random() - 0.5) * 10] as [number, number, number],
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

/* ============ 程序化贴图 ============ */

function makeGrassTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#152b1b';
  ctx.fillRect(0, 0, 256, 256);
  const shades = ['#1d3b26', '#204327', '#122417', '#26502f', '#183321'];
  for (let i = 0; i < 1200; i++) {
    ctx.fillStyle = shades[i % shades.length];
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 1 + Math.random() * 4);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(9, 9);
  return t;
}

function makeAuroraTexture(hue1: string, hue2: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(0.35, hue1);
  g.addColorStop(0.65, hue2);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 256);
  return new THREE.CanvasTexture(c);
}

/* ============ 3D 场景组件 ============ */

const keys: Record<string, boolean> = {};

/** 全动画巫师主人公：摆臂走路、呼吸待机、对决时举杖施法 */
const Wizard: React.FC<{
  frozen: boolean;
  robeColor: string;
  sprites: SpriteDef[];
  onEncounter: (s: SpriteDef) => void;
}> = ({ frozen, robeColor, sprites, onEncounter }) => {
  const group = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const hat = useRef<THREE.Mesh>(null);
  const crystal = useRef<THREE.Mesh>(null);
  const crystalLight = useRef<THREE.PointLight>(null);
  const { camera } = useThree();
  const encounterLock = useRef(false);
  const movingRef = useRef(false);

  useEffect(() => {
    encounterLock.current = false;
  });

  useFrame((state, dt) => {
    const g = group.current;
    if (!g) return;
    const t = state.clock.elapsedTime;
    let moving = false;

    if (!frozen) {
      const speed = 7.5 * dt;
      let dx = 0;
      let dz = 0;
      if (keys['ArrowUp'] || keys['w']) dz -= 1;
      if (keys['ArrowDown'] || keys['s']) dz += 1;
      if (keys['ArrowLeft'] || keys['a']) dx -= 1;
      if (keys['ArrowRight'] || keys['d']) dx += 1;
      if (dx !== 0 || dz !== 0) {
        moving = true;
        const len = Math.hypot(dx, dz);
        g.position.x += (dx / len) * speed;
        g.position.z += (dz / len) * speed;
        const targetRot = Math.atan2(dx, dz);
        // 平滑转身
        let diff = targetRot - g.rotation.y;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        g.rotation.y += diff * Math.min(1, dt * 12);
        g.position.y = Math.abs(Math.sin(t * 9)) * 0.14;
        const r = Math.hypot(g.position.x, g.position.z);
        if (r > 26) {
          g.position.x *= 26 / r;
          g.position.z *= 26 / r;
        }
        const cr = Math.hypot(g.position.x, g.position.z + 2);
        if (cr < 5.4) {
          g.position.x *= 5.4 / cr;
          g.position.z = (g.position.z + 2) * (5.4 / cr) - 2;
        }
      } else {
        g.position.y = Math.sin(t * 2) * 0.05;
      }
      if (!encounterLock.current) {
        for (const s of sprites) {
          const d = Math.hypot(g.position.x - s.pos[0], g.position.z - s.pos[2]);
          if (d < 1.7) {
            encounterLock.current = true;
            onEncounter(s);
            break;
          }
        }
      }
    }
    movingRef.current = moving;

    // ---- 肢体动画 ----
    const walk = moving ? Math.sin(t * 9) : Math.sin(t * 1.8) * 0.12;
    if (armL.current) armL.current.rotation.x = moving ? walk * 0.8 : walk;
    if (armR.current) {
      // 对决中举杖施法
      armR.current.rotation.x = frozen ? -2.1 : moving ? -walk * 0.8 : -walk;
      armR.current.rotation.z = frozen ? -0.35 : -0.15;
    }
    if (hat.current) hat.current.rotation.z = Math.sin(t * 2.4) * 0.05;
    if (crystal.current) {
      crystal.current.rotation.y = t * 2.2;
      const s = 1 + Math.sin(t * 5) * 0.12;
      crystal.current.scale.setScalar(frozen ? 1.5 : s);
    }
    if (crystalLight.current) crystalLight.current.intensity = frozen ? 8 : 3 + Math.sin(t * 5) * 1.2;

    // 第三人称跟随镜头
    const target = new THREE.Vector3(g.position.x, g.position.y + 8, g.position.z + 13);
    camera.position.lerp(target, 0.07);
    camera.lookAt(g.position.x, g.position.y + 1.6, g.position.z - 1.5);
  });

  return (
    <group ref={group} position={[0, 0, 8]}>
      {/* 主角追光：保证人物在夜色中清晰可读 */}
      <pointLight position={[0, 3.6, 1.6]} intensity={9} distance={9} color="#ffe8c2" />
      {/* 长袍（学院色）+ 下摆 */}
      <mesh position={[0, 0.85, 0]} castShadow>
        <coneGeometry args={[0.62, 1.7, 14]} />
        <meshStandardMaterial color={robeColor} roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.12, 0]}>
        <cylinderGeometry args={[0.62, 0.7, 0.22, 14]} />
        <meshStandardMaterial color={robeColor} roughness={0.9} />
      </mesh>
      {/* 腰带 */}
      <mesh position={[0, 1.05, 0]}>
        <cylinderGeometry args={[0.47, 0.5, 0.12, 14]} />
        <meshStandardMaterial color="#fbbf24" emissive="#b45309" emissiveIntensity={0.4} metalness={0.6} />
      </mesh>
      {/* 左臂 */}
      <group ref={armL} position={[-0.55, 1.45, 0]}>
        <mesh position={[0, -0.32, 0]} castShadow>
          <cylinderGeometry args={[0.11, 0.14, 0.72, 8]} />
          <meshStandardMaterial color={robeColor} roughness={0.8} />
        </mesh>
        <mesh position={[0, -0.72, 0]}>
          <sphereGeometry args={[0.12, 10, 10]} />
          <meshStandardMaterial color="#fcd9b8" />
        </mesh>
      </group>
      {/* 右臂 + 魔杖 */}
      <group ref={armR} position={[0.55, 1.45, 0]}>
        <mesh position={[0, -0.32, 0]} castShadow>
          <cylinderGeometry args={[0.11, 0.14, 0.72, 8]} />
          <meshStandardMaterial color={robeColor} roughness={0.8} />
        </mesh>
        <mesh position={[0, -0.72, 0]}>
          <sphereGeometry args={[0.12, 10, 10]} />
          <meshStandardMaterial color="#fcd9b8" />
        </mesh>
        <mesh position={[0, -0.72, 0.12]} rotation={[1.3, 0, 0]}>
          <cylinderGeometry args={[0.035, 0.045, 1.15, 8]} />
          <meshStandardMaterial color="#78350f" roughness={0.7} />
        </mesh>
        <mesh ref={crystal} position={[0, -0.62, 0.75]}>
          <octahedronGeometry args={[0.14]} />
          <meshStandardMaterial color="#fde68a" emissive="#f59e0b" emissiveIntensity={3.5} />
        </mesh>
        <pointLight ref={crystalLight} position={[0, -0.6, 0.75]} intensity={3} distance={6} color="#fbbf24" />
      </group>
      {/* 围巾 */}
      <mesh position={[0, 1.62, 0]}>
        <torusGeometry args={[0.26, 0.09, 8, 16]} />
        <meshStandardMaterial color="#dc2626" roughness={0.9} />
      </mesh>
      {/* 头 + 眼睛 */}
      <mesh position={[0, 1.95, 0]} castShadow>
        <sphereGeometry args={[0.34, 18, 18]} />
        <meshStandardMaterial color="#fcd9b8" roughness={0.6} />
      </mesh>
      <mesh position={[-0.12, 2.0, 0.29]}>
        <sphereGeometry args={[0.045, 8, 8]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
      <mesh position={[0.12, 2.0, 0.29]}>
        <sphereGeometry args={[0.045, 8, 8]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
      {/* 魔法帽（带弯尖） */}
      <mesh position={[0, 2.28, 0]}>
        <torusGeometry args={[0.42, 0.09, 8, 20]} />
        <meshStandardMaterial color={robeColor} roughness={0.85} />
      </mesh>
      <mesh ref={hat} position={[0, 2.62, 0]} castShadow>
        <coneGeometry args={[0.36, 0.95, 12]} />
        <meshStandardMaterial color={robeColor} roughness={0.85} />
      </mesh>
      <mesh position={[0, 3.02, 0.1]} rotation={[0.5, 0, 0]}>
        <coneGeometry args={[0.1, 0.35, 8]} />
        <meshStandardMaterial color={robeColor} roughness={0.85} />
      </mesh>
      <mesh position={[0, 2.3, 0.4]}>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshStandardMaterial color="#fde68a" emissive="#f59e0b" emissiveIntensity={2.5} />
      </mesh>
      {/* 杖头星尘 */}
      <Sparkles count={16} scale={[1.2, 1.6, 1.2]} size={2.5} speed={0.5} color="#fde68a" position={[0.55, 1, 0.6]} />
    </group>
  );
};

const Tower: React.FC<{ x: number; z: number; color: string; label: string; emoji: string }> = ({ x, z, color, label, emoji }) => (
  <group position={[x, 0, z]}>
    <mesh position={[0, 3, 0]} castShadow>
      <cylinderGeometry args={[1.6, 2.1, 6, 12]} />
      <meshStandardMaterial color="#4b4642" roughness={0.9} />
    </mesh>
    <mesh position={[0, 6.4, 0]}>
      <cylinderGeometry args={[1.9, 1.9, 0.5, 12]} />
      <meshStandardMaterial color="#3b3733" />
    </mesh>
    <mesh position={[0, 7.6, 0]} castShadow>
      <coneGeometry args={[2.1, 2.8, 12]} />
      <meshStandardMaterial color={color} roughness={0.5} />
    </mesh>
    <mesh position={[0, 9.3, 0]}>
      <sphereGeometry args={[0.22, 10, 10]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={4} />
    </mesh>
    {[1.6, 3.1, 4.6].map((y, i) => (
      <mesh key={y} position={[Math.sin(i) * 0.5, y, 1.95]}>
        <boxGeometry args={[0.42, 0.65, 0.12]} />
        <meshStandardMaterial color="#fef3c7" emissive="#fbbf24" emissiveIntensity={2.2} />
      </mesh>
    ))}
    <pointLight position={[0, 5, 0]} intensity={7} distance={15} color={color} />
    <Sparkles count={14} scale={[4, 8, 4]} size={2} speed={0.3} color={color} position={[0, 5, 0]} />
    <Html position={[0, 10.6, 0]} center distanceFactor={26} style={{ pointerEvents: 'none' }}>
      <div style={{ fontSize: 22, whiteSpace: 'nowrap', textAlign: 'center', textShadow: '0 2px 6px rgba(0,0,0,.7)', color: '#fff', fontWeight: 700 }}>
        {emoji} {label}
      </div>
    </Html>
  </group>
);

const Castle: React.FC<{ houseColor: string }> = ({ houseColor }) => (
  <group position={[0, 0, -2]}>
    {/* 主堡 */}
    <mesh position={[0, 2.6, 0]} castShadow>
      <boxGeometry args={[6.2, 5.2, 5.2]} />
      <meshStandardMaterial color="#3f3b37" roughness={0.9} />
    </mesh>
    {/* 城垛 */}
    {[-2.6, -1.3, 0, 1.3, 2.6].map((x) => (
      <mesh key={x} position={[x, 5.5, 2.4]}>
        <boxGeometry args={[0.6, 0.6, 0.4]} />
        <meshStandardMaterial color="#4b4642" />
      </mesh>
    ))}
    {/* 双塔 */}
    {[-3, 3].map((x) => (
      <group key={x} position={[x, 0, 0]}>
        <mesh position={[0, 4.2, 0]} castShadow>
          <cylinderGeometry args={[1.05, 1.3, 8.4, 12]} />
          <meshStandardMaterial color="#4b4642" roughness={0.9} />
        </mesh>
        <mesh position={[0, 9.4, 0]} castShadow>
          <coneGeometry args={[1.5, 2.4, 12]} />
          <meshStandardMaterial color="#6d28d9" roughness={0.5} />
        </mesh>
        <mesh position={[0, 10.9, 0]}>
          <sphereGeometry args={[0.2, 10, 10]} />
          <meshStandardMaterial color="#c4b5fd" emissive="#8b5cf6" emissiveIntensity={4} />
        </mesh>
        {/* 学院旗帜 */}
        <mesh position={[1.15, 7.5, 0]}>
          <planeGeometry args={[0.9, 1.4]} />
          <meshStandardMaterial color={houseColor} emissive={houseColor} emissiveIntensity={0.5} side={THREE.DoubleSide} />
        </mesh>
      </group>
    ))}
    {/* 主尖顶 */}
    <mesh position={[0, 7, 0]} castShadow>
      <coneGeometry args={[3.2, 3.6, 4]} />
      <meshStandardMaterial color="#5b21b6" roughness={0.5} />
    </mesh>
    <mesh position={[0, 9.4, 0]}>
      <octahedronGeometry args={[0.5]} />
      <meshStandardMaterial color="#e9d5ff" emissive="#a855f7" emissiveIntensity={3.5} />
    </mesh>
    {/* 大门与窗 */}
    <mesh position={[0, 1.2, 2.65]}>
      <boxGeometry args={[1.7, 2.4, 0.15]} />
      <meshStandardMaterial color="#fbbf24" emissive="#f59e0b" emissiveIntensity={1.6} />
    </mesh>
    {[[-1.7, 3.6], [1.7, 3.6], [0, 4.6]].map(([x, y], i) => (
      <mesh key={i} position={[x, y, 2.65]}>
        <boxGeometry args={[0.55, 0.85, 0.12]} />
        <meshStandardMaterial color="#fef3c7" emissive="#fbbf24" emissiveIntensity={2.2} />
      </mesh>
    ))}
    <pointLight position={[0, 8, 5]} intensity={10} distance={24} color="#c4b5fd" />
    <Sparkles count={24} scale={[10, 12, 10]} size={2.5} speed={0.25} color="#c4b5fd" position={[0, 7, 0]} />
    <Html position={[0, 12.6, 0]} center distanceFactor={30} style={{ pointerEvents: 'none' }}>
      <div style={{ fontSize: 24, whiteSpace: 'nowrap', color: '#e9d5ff', fontWeight: 800, textShadow: '0 2px 8px rgba(0,0,0,.8)' }}>🏰 文华魔法学院</div>
    </Html>
  </group>
);

const Ground: React.FC = () => {
  const grass = useMemo(makeGrassTexture, []);
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[30, 56]} />
        <meshStandardMaterial map={grass} color="#3e6b4a" roughness={1} />
      </mesh>
      {/* 石径与法阵广场 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 5]}>
        <planeGeometry args={[2.6, 15]} />
        <meshStandardMaterial color="#57534e" roughness={0.95} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 8]}>
        <ringGeometry args={[2.2, 2.5, 40]} />
        <meshStandardMaterial color="#a78bfa" emissive="#7c3aed" emissiveIntensity={1.6} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 8]}>
        <ringGeometry args={[1.2, 1.32, 32]} />
        <meshStandardMaterial color="#c4b5fd" emissive="#8b5cf6" emissiveIntensity={1.2} />
      </mesh>
      {/* 缓丘 */}
      {[[-20, 6, 4], [19, 9, 5], [-8, 20, 3.4], [10, 19, 4.2]].map(([x, z, s], i) => (
        <mesh key={i} position={[x, -0.3, z]} scale={[s, s * 0.28, s]}>
          <sphereGeometry args={[1, 14, 10]} />
          <meshStandardMaterial color="#2c5238" roughness={1} />
        </mesh>
      ))}
    </>
  );
};

const Trees: React.FC = () => {
  const trees = useMemo(
    () =>
      Array.from({ length: 30 }, () => {
        const ang = Math.random() * Math.PI * 2;
        const r = 20 + Math.random() * 8;
        return { x: Math.cos(ang) * r, z: Math.sin(ang) * r, s: 0.7 + Math.random() * 1.1 };
      }),
    [],
  );
  return (
    <>
      {trees.map((t, i) => (
        <group key={i} position={[t.x, 0, t.z]} scale={t.s}>
          <mesh position={[0, 0.6, 0]}>
            <cylinderGeometry args={[0.15, 0.24, 1.2]} />
            <meshStandardMaterial color="#3a2c20" roughness={1} />
          </mesh>
          <mesh position={[0, 1.9, 0]} castShadow>
            <coneGeometry args={[1, 2.4, 8]} />
            <meshStandardMaterial color="#12381f" roughness={1} />
          </mesh>
          <mesh position={[0, 3, 0]} castShadow>
            <coneGeometry args={[0.7, 1.8, 8]} />
            <meshStandardMaterial color="#174a29" roughness={1} />
          </mesh>
        </group>
      ))}
    </>
  );
};

const Aurora: React.FC = () => {
  const t1 = useMemo(() => makeAuroraTexture('rgba(52,211,153,0.5)', 'rgba(139,92,246,0.45)'), []);
  const t2 = useMemo(() => makeAuroraTexture('rgba(139,92,246,0.4)', 'rgba(236,72,153,0.3)'), []);
  const a = useRef<THREE.Mesh>(null);
  const b = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (a.current) {
      a.current.position.y = 24 + Math.sin(t * 0.3) * 1.5;
      (a.current.material as THREE.MeshBasicMaterial).opacity = 0.5 + Math.sin(t * 0.5) * 0.15;
    }
    if (b.current) {
      b.current.position.y = 21 + Math.cos(t * 0.24) * 1.5;
      (b.current.material as THREE.MeshBasicMaterial).opacity = 0.4 + Math.cos(t * 0.4) * 0.14;
    }
  });
  return (
    <>
      <mesh ref={a} position={[-12, 24, -42]} rotation={[0, 0.3, 0.12]}>
        <planeGeometry args={[46, 15]} />
        <meshBasicMaterial map={t1} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh ref={b} position={[16, 21, -45]} rotation={[0, -0.25, -0.1]}>
        <planeGeometry args={[38, 12]} />
        <meshBasicMaterial map={t2} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
    </>
  );
};

const Sprite3D: React.FC<{ s: SpriteDef }> = ({ s }) => {
  const ref = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (ref.current) {
      ref.current.position.y = s.pos[1] + Math.sin(state.clock.elapsedTime * 2 + s.id) * 0.3;
      ref.current.rotation.y = state.clock.elapsedTime * 0.8;
    }
  });
  const color = s.subject === 'history' ? '#f59e0b' : s.subject === 'geography' ? '#10b981' : '#f43f5e';
  return (
    <group ref={ref} position={s.pos}>
      <mesh>
        <sphereGeometry args={[0.55, 14, 14]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2} transparent opacity={0.3} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.8, 0.03, 8, 32]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={3} />
      </mesh>
      <pointLight intensity={4} distance={7} color={color} />
      <Sparkles count={10} scale={1.8} size={2} speed={0.6} color={color} />
      <Html center distanceFactor={15} style={{ pointerEvents: 'none' }}>
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

  const houseOfSubject = (s: SubjectId) => (s === 'history' ? 'qilin' : s === 'geography' ? 'kunpeng' : 'baize');

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
    setSprites((list) => {
      const rest = list.filter((x) => x.id !== d.sprite.id);
      return [...rest, ...randSprites().slice(0, 1)];
    });
    setDuel({ ...d, phase: won ? 'won' : 'lost' });
  };

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
        <p className="mt-4 text-xs text-indigo-300">你的长袍与城堡旗帜将染上学院之色 · 方向键 / WASD 行走 · 靠近发光生物触发对决</p>
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
      <div className="relative rounded-2xl overflow-hidden border border-slate-300" style={{ height: 540 }}>
        <Canvas
          shadows
          camera={{ position: [0, 8, 20], fov: 55 }}
          gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
        >
          <color attach="background" args={['#0a0e24']} />
          <fog attach="fog" args={['#0a0e24', 30, 58]} />
          <ambientLight intensity={0.5} color="#8b9fff" />
          <hemisphereLight args={['#7d8fe0', '#233a29', 0.55]} />
          <directionalLight position={[10, 22, 6]} intensity={0.7} color="#94a3ff" castShadow shadow-mapSize={[1024, 1024]} />
          <Stars radius={80} depth={40} count={3000} factor={4} fade speed={0.6} />
          <Aurora />
          {/* 月亮（发光体，Bloom 下会有光晕） */}
          <mesh position={[-20, 24, -34]}>
            <sphereGeometry args={[2.6, 20, 20]} />
            <meshStandardMaterial color="#fef9c3" emissive="#fef08a" emissiveIntensity={1.8} />
          </mesh>
          <Ground />
          <Castle houseColor={house.color} />
          <Tower x={TOWER_POS.history[0]} z={TOWER_POS.history[1]} color="#b45309" label="史学塔" emoji="📜" />
          <Tower x={TOWER_POS.geography[0]} z={TOWER_POS.geography[1]} color="#047857" label="坤舆塔" emoji="🗺️" />
          <Tower x={TOWER_POS.politics[0]} z={TOWER_POS.politics[1]} color="#be123c" label="明德塔" emoji="⚖️" />
          <Trees />
          {sprites.map((s) => (
            <Sprite3D key={s.id} s={s} />
          ))}
          <Wizard frozen={!!duel} robeColor={house.robe} sprites={sprites} onEncounter={startDuel} />
          <EffectComposer>
            <Bloom intensity={1.1} luminanceThreshold={0.55} mipmapBlur radius={0.7} />
            <Vignette eskil={false} offset={0.18} darkness={0.72} />
          </EffectComposer>
        </Canvas>

        {/* 咒语对决覆盖层 */}
        {duel && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-[2px] flex items-center justify-center p-4 overflow-y-auto">
            <div className="w-full max-w-xl">
              <div className="relative flex items-end justify-between px-6">
                <div className="text-center">
                  <div className={`text-5xl ${duel.flash ? 'animate-pop' : ''}`}>🧙</div>
                  <HpBar value={duel.playerHp} max={100} label={`你 · ${house.name}`} />
                </div>
                {/* 施法光束 */}
                {duel.flash && <div className="spell-beam" style={{ top: 34 }} />}
                <div className="text-center">
                  <div className={`text-5xl ${duel.enemyHp === 0 ? 'enemy-die' : duel.flash ? 'enemy-hit' : 'enemy-idle'}`}>{duel.sprite.emoji}</div>
                  <HpBar value={duel.enemyHp} max={60} label={duel.sprite.name} />
                </div>
              </div>
              {duel.flash && <div className="text-center mt-2 text-amber-300 font-bold text-sm animate-pop">✨ {duel.flash}！</div>}

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
