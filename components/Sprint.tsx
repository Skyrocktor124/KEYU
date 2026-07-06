import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Zap, Trophy, RotateCcw } from 'lucide-react';
import { QuizQuestion } from '../types';
import { sfx } from '../services/effects';
import { SubjectBadge } from './ui';

interface Props {
  questions: QuizQuestion[];
  bestScore: number;
  onWrong: (questionId: string) => void;
  onEnd: (score: number, maxCombo: number) => void;
}

const DURATION = 60; // 秒

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

type Phase = 'idle' | 'running' | 'done';

/**
 * 极速挑战：60 秒三科混答。
 * 答对立即下一题并累积连击加成；答错清空连击并闪现正确答案。
 * 节奏快、反馈密——这是「停不下来」的核心模式。
 */
const Sprint: React.FC<Props> = ({ questions, bestScore, onWrong, onEnd }) => {
  const [phase, setPhase] = useState<Phase>('idle');
  const [order, setOrder] = useState<QuizQuestion[]>([]);
  const [idx, setIdx] = useState(0);
  const [timeLeft, setTimeLeft] = useState(DURATION);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [answered, setAnswered] = useState(0);
  const [right, setRight] = useState(0);
  const [flash, setFlash] = useState<null | { picked: number; correct: number }>(null);
  const maxComboRef = useRef(0);
  const lockRef = useRef(false);

  const current = order[idx % Math.max(order.length, 1)];

  // 计时器
  useEffect(() => {
    if (phase !== 'running') return;
    const t = setInterval(() => {
      setTimeLeft((s) => {
        if (s <= 10 && s > 1) sfx.tick();
        if (s <= 1) {
          clearInterval(t);
          setPhase('done');
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [phase]);

  // 结算只跑一次
  const endedRef = useRef(false);
  useEffect(() => {
    if (phase === 'done' && !endedRef.current) {
      endedRef.current = true;
      onEnd(score, maxComboRef.current);
    }
    if (phase !== 'done') endedRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const start = () => {
    setOrder(shuffle(questions));
    setIdx(0);
    setTimeLeft(DURATION);
    setScore(0);
    setCombo(0);
    setAnswered(0);
    setRight(0);
    setFlash(null);
    maxComboRef.current = 0;
    lockRef.current = false;
    setPhase('running');
  };

  const pick = (i: number) => {
    if (phase !== 'running' || lockRef.current || !current) return;
    lockRef.current = true;
    setAnswered((n) => n + 1);
    const correct = i === current.answer;
    if (correct) {
      const newCombo = combo + 1;
      setCombo(newCombo);
      maxComboRef.current = Math.max(maxComboRef.current, newCombo);
      setScore((s) => s + 10 + Math.min(newCombo - 1, 9)); // 连击每层 +1，上限 +9
      setRight((n) => n + 1);
      newCombo >= 3 ? sfx.combo(newCombo) : sfx.correct();
      setFlash({ picked: i, correct: current.answer });
      setTimeout(() => {
        setFlash(null);
        setIdx((n) => n + 1);
        lockRef.current = false;
      }, 250);
    } else {
      setCombo(0);
      sfx.wrong();
      onWrong(current.id);
      setFlash({ picked: i, correct: current.answer });
      setTimeout(() => {
        setFlash(null);
        setIdx((n) => n + 1);
        lockRef.current = false;
      }, 900);
    }
  };

  const timePct = (timeLeft / DURATION) * 100;

  if (phase === 'idle') {
    return (
      <div className="max-w-2xl mx-auto bg-white rounded-2xl border border-slate-200 p-10 text-center">
        <Zap className="w-14 h-14 text-amber-500 mx-auto" />
        <h2 className="mt-4 text-2xl font-bold text-slate-900">极速挑战</h2>
        <p className="mt-2 text-slate-500 text-sm leading-relaxed">
          60 秒，三科混答，答对立刻下一题。
          <br />
          连对越多，单题得分越高（连击加成最高 +9）；答错连击清零。
        </p>
        <div className="mt-4 inline-flex items-center gap-1.5 text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-full px-4 py-1.5">
          <Trophy className="w-4 h-4 text-amber-500" />
          最高纪录：<strong className="tabular-nums">{bestScore}</strong> 分
        </div>
        <div>
          <button
            onClick={start}
            className="mt-6 px-8 py-3 bg-amber-500 hover:bg-amber-400 text-white text-lg font-bold rounded-2xl shadow-lg shadow-amber-200 transition active:scale-95"
          >
            ⚡ 开始挑战
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'done') {
    const acc = answered > 0 ? Math.round((right / answered) * 100) : 0;
    const isRecord = score > 0 && score >= bestScore;
    return (
      <div className="max-w-2xl mx-auto bg-white rounded-2xl border border-slate-200 p-10 text-center">
        <div className="text-5xl">{isRecord ? '🏆' : score >= 100 ? '🎉' : '⏱️'}</div>
        <h2 className="mt-3 text-2xl font-bold text-slate-900">
          {isRecord ? '新纪录！' : '时间到！'}
        </h2>
        <div className="mt-4 text-5xl font-black text-amber-500 tabular-nums">{score}</div>
        <p className="mt-1 text-sm text-slate-400">分（XP +{Math.round(score / 2)}）</p>
        <div className="mt-4 flex justify-center gap-6 text-sm text-slate-600">
          <span>答题 <strong className="tabular-nums">{answered}</strong></span>
          <span>正确率 <strong className="tabular-nums">{acc}%</strong></span>
          <span>最高连击 <strong className="tabular-nums">{maxComboRef.current}</strong></span>
        </div>
        <button
          onClick={start}
          className="mt-6 inline-flex items-center gap-2 px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl transition"
        >
          <RotateCcw className="w-4 h-4" />
          再来一局
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* 计时条 + 记分 */}
      <div className="flex items-center gap-4 mb-3">
        <div className="flex-1 h-3 bg-slate-200 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-1000 ease-linear ${
              timeLeft <= 10 ? 'animate-urgent bg-rose-500' : 'bg-amber-400'
            }`}
            style={{ width: `${timePct}%` }}
          />
        </div>
        <span className={`text-lg font-black tabular-nums ${timeLeft <= 10 ? 'text-rose-600' : 'text-slate-700'}`}>{timeLeft}s</span>
      </div>
      <div className="flex items-center justify-between mb-3 text-sm">
        <span className="text-2xl font-black text-amber-500 tabular-nums">{score} 分</span>
        {combo >= 2 && (
          <span className="text-lg font-bold text-orange-600">
            <span className="animate-flame">🔥</span> 连击 ×{combo}
          </span>
        )}
      </div>

      {current && (
        <div className={`bg-white rounded-2xl border border-slate-200 p-5 ${flash && flash.picked !== flash.correct ? 'animate-shake' : ''}`}>
          <div className="flex items-center justify-between">
            <SubjectBadge subject={current.subject} small />
            <span className="text-xs text-slate-400">第 {answered + 1} 题</span>
          </div>
          <p className="mt-2 text-slate-900 font-medium leading-relaxed">{current.question}</p>
          <div className="mt-3 space-y-2">
            {current.options.map((opt, i) => {
              let cls = 'border-slate-200 hover:border-amber-400 hover:bg-amber-50/50 active:scale-[0.99]';
              if (flash) {
                if (i === flash.correct) cls = 'border-emerald-400 bg-emerald-50';
                else if (i === flash.picked) cls = 'border-rose-400 bg-rose-50';
                else cls = 'border-slate-200 opacity-50';
              }
              return (
                <button
                  key={i}
                  onClick={() => pick(i)}
                  className={`w-full text-left px-4 py-2.5 rounded-xl border text-sm transition flex items-start gap-2 ${cls}`}
                >
                  <span className="font-semibold text-slate-400">{'ABCD'[i]}.</span>
                  <span className="text-slate-700">{opt}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
      <p className="mt-3 text-center text-xs text-slate-400">错题会自动收进错题本，赛后记得回炉</p>
    </div>
  );
};

export default Sprint;
