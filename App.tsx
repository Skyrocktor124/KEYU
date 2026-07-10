import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LayoutDashboard, BookOpen, Library as LibraryIcon, PencilRuler, NotebookPen, GraduationCap, Zap, Swords, Compass, Wand2 } from 'lucide-react';
import { KnowledgePoint, MasteryRecord, QuizQuestion, ReviewGrade, SubjectId, WrongRecord } from './types';
import { STORAGE_KEYS, SUBJECTS } from './constants';
import { SEED_KPS, SEED_QUESTIONS } from './data';
import { useLocalStorage } from './services/storage';
import { rateCard, todayKey, weakTopics } from './services/srs';
import { GameData, DEFAULT_GAME, GameEvent, applyEvent, computeStreak, LevelInfo } from './services/game';
import { AdventureData, DEFAULT_ADVENTURE } from './services/adventure';
import { WorldData, DEFAULT_WORLD } from './services/world';
import { confetti, floatText, setSoundMuted, sfx } from './services/effects';
import Adventure from './components/Adventure';
import World from './components/World';
import Academy3D, { AcademyData, DEFAULT_ACADEMY } from './components/Academy3D';
import Dashboard from './components/Dashboard';
import ReviewSession from './components/ReviewSession';
import Library from './components/Library';
import QuizView from './components/QuizView';
import WrongBook from './components/WrongBook';
import AICoach from './components/AICoach';
import Sprint from './components/Sprint';
import GameHud from './components/GameHud';

type Tab = 'dashboard' | 'academy' | 'world' | 'adventure' | 'review' | 'sprint' | 'library' | 'quiz' | 'wrong' | 'coach';

const TABS: { id: Tab; label: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'dashboard', label: '仪表盘', icon: LayoutDashboard },
  { id: 'academy', label: '魔法学院', icon: Wand2 },
  { id: 'world', label: '文灵世界', icon: Compass },
  { id: 'adventure', label: '赶考之路', icon: Swords },
  { id: 'review', label: '今日复习', icon: BookOpen },
  { id: 'sprint', label: '极速挑战', icon: Zap },
  { id: 'quiz', label: '智能刷题', icon: PencilRuler },
  { id: 'wrong', label: '错题本', icon: NotebookPen },
  { id: 'library', label: '知识库', icon: LibraryIcon },
  { id: 'coach', label: 'AI 教练', icon: GraduationCap },
];

const App: React.FC = () => {
  const [tab, setTab] = useState<Tab>('dashboard');

  // 学习数据全部本地持久化
  const [mastery, setMastery] = useLocalStorage<Record<string, MasteryRecord>>(STORAGE_KEYS.mastery, {});
  const [wrong, setWrong] = useLocalStorage<WrongRecord[]>(STORAGE_KEYS.wrong, []);
  const [aiKps, setAiKps] = useLocalStorage<KnowledgePoint[]>(STORAGE_KEYS.aiKps, []);
  const [aiQuestions, setAiQuestions] = useLocalStorage<QuizQuestion[]>(STORAGE_KEYS.aiQuestions, []);
  const [studyLog, setStudyLog] = useLocalStorage<Record<string, number>>(STORAGE_KEYS.studyLog, {});
  const [game, setGame] = useLocalStorage<GameData>(STORAGE_KEYS.game, DEFAULT_GAME);
  const [adventure, setAdventure] = useLocalStorage<AdventureData>(STORAGE_KEYS.adventure, DEFAULT_ADVENTURE);
  const [world, setWorld] = useLocalStorage<WorldData>(STORAGE_KEYS.world, DEFAULT_WORLD);
  const [academy, setAcademy] = useLocalStorage<AcademyData>(STORAGE_KEYS.academy, DEFAULT_ACADEMY);

  // 游戏化反馈
  const [toasts, setToasts] = useState<{ id: number; text: string }[]>([]);
  const [levelUp, setLevelUp] = useState<LevelInfo | null>(null);
  const toastId = useRef(0);

  useEffect(() => {
    setSoundMuted(!game.soundOn);
  }, [game.soundOn]);

  const pushToast = (text: string) => {
    const id = ++toastId.current;
    setToasts((t) => [...t, { id, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  };

  /** 所有游戏事件的统一入口：结算 XP / 任务 / 徽章 / 升级，并触发特效 */
  const fireGame = (ev: GameEvent) => {
    const res = applyEvent(game, ev, computeStreak(studyLog));
    setGame(res.data);
    if (res.xpGain > 0) floatText(`+${res.xpGain} XP`);
    if (res.messages.length > 0) sfx.quest();
    res.messages.forEach(pushToast);
    res.newBadges.forEach((b) => pushToast(`🏅 获得徽章「${b.name}」——${b.desc}`));
    if (res.levelUp) {
      setLevelUp(res.levelUp);
      confetti();
      sfx.levelUp();
    }
  };

  // 知识库 = 种子 + AI 迭代生成（自我生长的部分）
  const allKps = useMemo(() => [...SEED_KPS, ...aiKps], [aiKps]);
  const allQuestions = useMemo(() => [...SEED_QUESTIONS, ...aiQuestions], [aiQuestions]);
  const kpSubject = useMemo(() => new Map(allKps.map((k) => [k.id, k.subject])), [allKps]);

  const handleRate = (kpId: string, grade: ReviewGrade) => {
    setMastery((m) => ({ ...m, [kpId]: rateCard(m[kpId], kpId, grade) }));
    setStudyLog((log) => ({ ...log, [todayKey()]: (log[todayKey()] ?? 0) + 1 }));
    fireGame({ type: 'review', grade, subject: kpSubject.get(kpId) ?? 'history' });
  };

  const handleWrong = (questionId: string) => {
    setWrong((list) => {
      const idx = list.findIndex((w) => w.questionId === questionId);
      if (idx === -1) return [...list, { questionId, times: 1, lastWrong: Date.now(), resolved: false }];
      const next = [...list];
      next[idx] = { ...next[idx], times: next[idx].times + 1, lastWrong: Date.now(), resolved: false };
      return next;
    });
  };

  const handleResolve = (questionId: string) => {
    setWrong((list) => list.map((w) => (w.questionId === questionId ? { ...w, resolved: true } : w)));
    fireGame({ type: 'resolve' });
  };

  // 传给 AI 教练的薄弱点摘要
  const weakContext = useMemo(() => {
    return weakTopics(allKps, mastery)
      .filter((t) => t.avg < 3)
      .slice(0, 4)
      .map((t) => `${SUBJECTS[t.subject as keyof typeof SUBJECTS].name}·${t.topic}`)
      .join('；');
  }, [allKps, mastery]);

  return (
    <div className="min-h-screen">
      {/* 顶栏 */}
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 shrink-0">
            <span className="w-9 h-9 rounded-xl bg-slate-800 text-white flex items-center justify-center font-bold">文</span>
            <div className="hidden lg:block">
              <div className="font-bold text-slate-900 leading-tight">京华文考</div>
              <div className="text-[11px] text-slate-400 leading-tight">北京高考文科 · 状元之路</div>
            </div>
          </div>
          <nav className="flex gap-1 overflow-x-auto">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition ${
                  tab === id ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </nav>
          <GameHud game={game} onToggleSound={() => setGame((g) => ({ ...g, soundOn: !g.soundOn }))} />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {tab === 'dashboard' && (
          <Dashboard
            kps={allKps}
            mastery={mastery}
            wrong={wrong}
            studyLog={studyLog}
            game={game}
            aiKpCount={aiKps.length}
            onGoReview={() => setTab('review')}
            onGoSprint={() => setTab('sprint')}
            onGoAdventure={() => setTab('adventure')}
            onGoWrong={() => setTab('wrong')}
          />
        )}
        {tab === 'academy' && (
          <Academy3D
            kps={allKps}
            questions={allQuestions}
            academy={academy}
            setAcademy={setAcademy}
            adventure={adventure}
            setAdventure={setAdventure}
            onWrong={handleWrong}
            onDuelEnd={(victory) => fireGame({ type: 'battleEnd', victory, stars: 1, firstClear: false, finalBoss: false })}
          />
        )}
        {tab === 'world' && (
          <World
            kps={allKps}
            questions={allQuestions}
            mastery={mastery}
            adventure={adventure}
            setAdventure={setAdventure}
            world={world}
            setWorld={setWorld}
            onWrong={handleWrong}
            onBattleResult={(victory, gym) => fireGame({ type: 'battleEnd', victory, stars: gym ? 3 : 1, firstClear: false, finalBoss: false })}
          />
        )}
        {tab === 'adventure' && (
          <Adventure
            kps={allKps}
            questions={allQuestions}
            adventure={adventure}
            setAdventure={setAdventure}
            onWrong={handleWrong}
            onBattleEnd={(victory, stars, firstClear, finalBoss) => fireGame({ type: 'battleEnd', victory, stars, firstClear, finalBoss })}
          />
        )}
        {tab === 'review' && <ReviewSession kps={allKps} mastery={mastery} onRate={handleRate} />}
        {tab === 'sprint' && (
          <Sprint
            questions={allQuestions}
            bestScore={game.bestSprint}
            onWrong={handleWrong}
            onEnd={(score, maxCombo) => fireGame({ type: 'sprintEnd', score, maxCombo })}
          />
        )}
        {tab === 'library' && <Library kps={allKps} mastery={mastery} onAddKps={(kps) => setAiKps((prev) => [...prev, ...kps])} />}
        {tab === 'quiz' && (
          <QuizView
            questions={allQuestions}
            kps={allKps}
            onWrong={handleWrong}
            onAnswer={(subject: SubjectId, correct: boolean, combo: number) => fireGame({ type: 'answer', correct, combo, subject })}
            onRoundEnd={(right: number, total: number) => fireGame({ type: 'roundEnd', right, total })}
            onAddQuestions={(qs) => setAiQuestions((prev) => [...prev, ...qs])}
          />
        )}
        {tab === 'wrong' && <WrongBook wrong={wrong} questions={allQuestions} onResolve={handleResolve} onWrongAgain={handleWrong} />}
        {tab === 'coach' && <AICoach weakContext={weakContext} />}
      </main>

      {/* 任务 / 徽章提示 */}
      <div className="fixed top-16 right-4 z-50 space-y-2 pointer-events-none">
        {toasts.map((t) => (
          <div key={t.id} className="bg-slate-900/95 text-white text-sm rounded-xl px-4 py-2.5 shadow-xl animate-pop max-w-xs">
            {t.text}
          </div>
        ))}
      </div>

      {/* 升级弹窗 */}
      {levelUp && (
        <div className="fixed inset-0 z-[95] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setLevelUp(null)}>
          <div className="bg-white rounded-3xl p-10 text-center max-w-sm w-full animate-pop shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="text-6xl">🎓</div>
            <div className="mt-3 text-sm font-semibold text-amber-600 tracking-widest">功名晋升</div>
            <h2 className="mt-1 text-4xl font-black text-slate-900">{levelUp.title}</h2>
            <p className="mt-3 text-sm text-slate-500">「{levelUp.motto}」</p>
            <button
              onClick={() => setLevelUp(null)}
              className="mt-6 px-8 py-2.5 bg-amber-500 hover:bg-amber-400 text-white font-bold rounded-xl transition"
            >
              继续赶考
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
