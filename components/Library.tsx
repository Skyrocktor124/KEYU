import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Sparkles, Newspaper, ScrollText, Search } from 'lucide-react';
import { KnowledgePoint, MasteryRecord, SubjectId } from '../types';
import { SUBJECTS, SUBJECT_IDS } from '../constants';
import { ANSWER_TEMPLATES } from '../data';
import { aiAvailable, aiProviderName, expandTopic, updateCurrentAffairs } from '../services/geminiService';
import { RichText, SubjectBadge, LevelDots, AiTag, Spinner } from './ui';

interface Props {
  kps: KnowledgePoint[];
  mastery: Record<string, MasteryRecord>;
  onAddKps: (kps: KnowledgePoint[]) => void;
}

/** 知识库：按 学科 → 模块 → 专题 组织；支持搜索、AI 专题扩展、AI 时政更新、答题模板 */
const Library: React.FC<Props> = ({ kps, mastery, onAddKps }) => {
  const [subject, setSubject] = useState<SubjectId>('history');
  const [showTemplates, setShowTemplates] = useState(false);
  const [query, setQuery] = useState('');
  const [openKp, setOpenKp] = useState<string | null>(null);
  const [busyTopic, setBusyTopic] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const list = useMemo(() => {
    const q = query.trim();
    return kps.filter(
      (k) =>
        k.subject === subject &&
        (q === '' || k.title.includes(q) || k.content.includes(q) || k.keywords.some((kw) => kw.includes(q))),
    );
  }, [kps, subject, query]);

  // 模块 → 专题 分组（保持插入顺序）
  const grouped = useMemo(() => {
    const units = new Map<string, Map<string, KnowledgePoint[]>>();
    for (const kp of list) {
      if (!units.has(kp.unit)) units.set(kp.unit, new Map());
      const topics = units.get(kp.unit)!;
      if (!topics.has(kp.topic)) topics.set(kp.topic, []);
      topics.get(kp.topic)!.push(kp);
    }
    return units;
  }, [list]);

  const runExpand = async (unit: string, topic: string, titles: string[]) => {
    setBusyTopic(topic);
    setError(null);
    try {
      const added = await expandTopic(subject, unit, topic, titles);
      onAddKps(added);
    } catch (e) {
      setError(`AI 扩展失败：${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusyTopic(null);
    }
  };

  const runAffairs = async () => {
    setBusyTopic('__affairs__');
    setError(null);
    try {
      const titles = kps.filter((k) => k.unit === '时政热点').map((k) => k.title);
      const added = await updateCurrentAffairs(titles);
      onAddKps(added);
    } catch (e) {
      setError(`时政更新失败：${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusyTopic(null);
    }
  };

  const templates = ANSWER_TEMPLATES.filter((t) => t.subject === subject);

  return (
    <div className="space-y-4">
      {/* 学科切换 + 工具条 */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex bg-white border border-slate-200 rounded-xl p-1">
          {SUBJECT_IDS.map((sid) => (
            <button
              key={sid}
              onClick={() => setSubject(sid)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
                subject === sid ? `${SUBJECTS[sid].bg} ${SUBJECTS[sid].color}` : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {SUBJECTS[sid].name}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-1.5 flex-1 min-w-[180px]">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索考点 / 关键词…"
            className="outline-none text-sm w-full bg-transparent"
          />
        </div>
        <button
          onClick={() => setShowTemplates((v) => !v)}
          className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-xl border transition ${
            showTemplates ? 'bg-slate-800 text-white border-slate-800' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-400'
          }`}
        >
          <ScrollText className="w-4 h-4" />
          答题模板
        </button>
        {subject === 'politics' && aiAvailable && (
          <button
            onClick={runAffairs}
            disabled={busyTopic !== null}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-xl bg-violet-600 text-white hover:bg-violet-500 disabled:opacity-50 transition"
          >
            {busyTopic === '__affairs__' ? <Spinner /> : <Newspaper className="w-4 h-4" />}
            AI 更新时政热点
          </button>
        )}
      </div>

      {error && <div className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-xl p-3">{error}</div>}

      {/* 答题模板面板 */}
      {showTemplates && (
        <div className="grid md:grid-cols-2 gap-3">
          {templates.map((t) => (
            <div key={t.id} className="bg-white rounded-2xl border border-slate-200 p-4">
              <div className="font-semibold text-slate-800 flex items-center gap-2">
                <ScrollText className="w-4 h-4 text-slate-400" />
                {t.name}
              </div>
              <RichText text={t.pattern} className="mt-2 text-sm text-slate-600" />
              {t.example && <p className="mt-2 text-xs text-slate-500 bg-slate-50 rounded-lg p-2">{t.example}</p>}
            </div>
          ))}
        </div>
      )}

      {/* 考点树 */}
      {[...grouped.entries()].map(([unit, topics]) => (
        <div key={unit}>
          <h3 className="text-sm font-bold text-slate-400 tracking-wide uppercase mt-6 mb-2">{unit}</h3>
          {[...topics.entries()].map(([topic, items]) => (
            <div key={topic} className="mb-3 bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 flex items-center justify-between bg-slate-50/60">
                <span className="font-semibold text-slate-700 text-sm">{topic}</span>
                {aiAvailable && (
                  <button
                    onClick={() => runExpand(unit, topic, items.map((i) => i.title))}
                    disabled={busyTopic !== null}
                    className="flex items-center gap-1 text-xs text-violet-600 hover:text-violet-500 disabled:opacity-50"
                  >
                    {busyTopic === topic ? <Spinner label="生成中…" /> : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        AI 扩展本专题
                      </>
                    )}
                  </button>
                )}
              </div>
              <ul className="divide-y divide-slate-100">
                {items.map((kp) => (
                  <li key={kp.id}>
                    <button
                      onClick={() => setOpenKp(openKp === kp.id ? null : kp.id)}
                      className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-50 transition"
                    >
                      <span className="flex items-center gap-2 text-sm text-slate-800">
                        {openKp === kp.id ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                        {kp.title}
                        {kp.source === 'ai' && <AiTag />}
                      </span>
                      <LevelDots level={mastery[kp.id]?.level ?? 0} />
                    </button>
                    {openKp === kp.id && (
                      <div className="px-11 pb-4">
                        <RichText text={kp.content} className="text-sm text-slate-600" />
                        {kp.examTip && (
                          <div className="mt-3 text-xs bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-amber-800">
                            <strong>考法提示：</strong>
                            {kp.examTip}
                          </div>
                        )}
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {kp.keywords.map((kw) => (
                            <span key={kw} className="text-xs bg-slate-100 text-slate-500 rounded-full px-2 py-0.5">
                              {kw}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ))}

      {list.length === 0 && (
        <div className="text-center text-slate-400 py-12 text-sm">没有匹配「{query}」的考点，换个关键词试试。</div>
      )}

      {!aiAvailable ? (
        <p className="text-xs text-slate-400 text-center pt-4">
          提示：在 .env.local 中配置 <code className="bg-slate-100 px-1 rounded">DEEPSEEK_API_KEY</code> 或{' '}
          <code className="bg-slate-100 px-1 rounded">GEMINI_API_KEY</code>（任选其一）后，可解锁「AI 扩展专题 / 时政更新 / AI 出题 / AI 教练」等自我迭代能力。
        </p>
      ) : (
        <p className="text-xs text-slate-400 text-center pt-4">当前 AI 提供商：{aiProviderName}</p>
      )}
    </div>
  );
};

export default Library;
