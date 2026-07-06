import React, { useMemo, useState } from 'react';
import { LayoutDashboard, BookOpen, Library as LibraryIcon, PencilRuler, NotebookPen, GraduationCap } from 'lucide-react';
import { KnowledgePoint, MasteryRecord, QuizQuestion, ReviewGrade, WrongRecord } from './types';
import { STORAGE_KEYS, SUBJECTS } from './constants';
import { SEED_KPS, SEED_QUESTIONS } from './data';
import { useLocalStorage } from './services/storage';
import { rateCard, todayKey, weakTopics } from './services/srs';
import Dashboard from './components/Dashboard';
import ReviewSession from './components/ReviewSession';
import Library from './components/Library';
import QuizView from './components/QuizView';
import WrongBook from './components/WrongBook';
import AICoach from './components/AICoach';

type Tab = 'dashboard' | 'review' | 'library' | 'quiz' | 'wrong' | 'coach';

const TABS: { id: Tab; label: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'dashboard', label: '仪表盘', icon: LayoutDashboard },
  { id: 'review', label: '今日复习', icon: BookOpen },
  { id: 'library', label: '知识库', icon: LibraryIcon },
  { id: 'quiz', label: '智能刷题', icon: PencilRuler },
  { id: 'wrong', label: '错题本', icon: NotebookPen },
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

  // 知识库 = 种子 + AI 迭代生成（自我生长的部分）
  const allKps = useMemo(() => [...SEED_KPS, ...aiKps], [aiKps]);
  const allQuestions = useMemo(() => [...SEED_QUESTIONS, ...aiQuestions], [aiQuestions]);

  const handleRate = (kpId: string, grade: ReviewGrade) => {
    setMastery((m) => ({ ...m, [kpId]: rateCard(m[kpId], kpId, grade) }));
    setStudyLog((log) => ({ ...log, [todayKey()]: (log[todayKey()] ?? 0) + 1 }));
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
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 shrink-0">
            <span className="w-9 h-9 rounded-xl bg-slate-800 text-white flex items-center justify-center font-bold">文</span>
            <div>
              <div className="font-bold text-slate-900 leading-tight">京华文考</div>
              <div className="text-[11px] text-slate-400 leading-tight">北京高考文科智能突破 · 史地政</div>
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
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {tab === 'dashboard' && (
          <Dashboard
            kps={allKps}
            mastery={mastery}
            wrong={wrong}
            studyLog={studyLog}
            aiKpCount={aiKps.length}
            onGoReview={() => setTab('review')}
            onGoWrong={() => setTab('wrong')}
          />
        )}
        {tab === 'review' && <ReviewSession kps={allKps} mastery={mastery} onRate={handleRate} />}
        {tab === 'library' && <Library kps={allKps} mastery={mastery} onAddKps={(kps) => setAiKps((prev) => [...prev, ...kps])} />}
        {tab === 'quiz' && (
          <QuizView
            questions={allQuestions}
            kps={allKps}
            onWrong={handleWrong}
            onAddQuestions={(qs) => setAiQuestions((prev) => [...prev, ...qs])}
          />
        )}
        {tab === 'wrong' && <WrongBook wrong={wrong} questions={allQuestions} onResolve={handleResolve} onWrongAgain={handleWrong} />}
        {tab === 'coach' && <AICoach weakContext={weakContext} />}
      </main>
    </div>
  );
};

export default App;
