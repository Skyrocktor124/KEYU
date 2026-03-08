import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowUpRight,
  Clock3,
  Filter,
  PlusCircle,
  Search,
  ShieldCheck,
  TrendingUp
} from 'lucide-react';

type InsightCategory = '跨境电商' | 'AI 工具' | '本地生活' | '内容创作' | '求职职场';
type Difficulty = '低' | '中' | '高';
type SourceReliability = '高' | '中';

type Insight = {
  id: number;
  title: string;
  category: InsightCategory;
  summary: string;
  monetization: string;
  difficulty: Difficulty;
  compliance: string;
  keywords: string[];
  source: string;
  reliability: SourceReliability;
  updatedAt: string;
  heat: number;
};

type UserLead = {
  name: string;
  contact: string;
  category: InsightCategory;
  lead: string;
  createdAt: string;
};

const INSIGHTS_STORAGE_KEY = 'info-gap-insights';
const LEADS_STORAGE_KEY = 'info-gap-leads';

const categories: readonly ['全部', InsightCategory, InsightCategory, InsightCategory, InsightCategory, InsightCategory] = [
  '全部',
  '跨境电商',
  'AI 工具',
  '本地生活',
  '内容创作',
  '求职职场'
];

const defaultInsights: Insight[] = [
  {
    id: 1,
    title: '跨境平台“低客单快周转”价格带空档',
    category: '跨境电商',
    summary: '公开榜单显示部分细分类目集中在高客单，低价高复购款存在可切入空间。',
    monetization: '选品咨询、店铺自营、供应链对接服务',
    difficulty: '中',
    compliance: '仅基于公开数据分析，避免侵权图片/品牌词滥用。',
    keywords: ['选品', '复购', '跨境', '价格带'],
    source: '公开热销榜单 + 评论增长趋势',
    reliability: '高',
    updatedAt: '2026-03-07 09:15',
    heat: 95
  },
  {
    id: 2,
    title: '中小商家不会做“短视频 + 到店转化”闭环',
    category: '本地生活',
    summary: '多数商家只追播放量，缺少团购套餐和私域跟进，代运营可直接提升 ROI。',
    monetization: '月服务费 + 转化分成 + 代投放费',
    difficulty: '低',
    compliance: '广告信息需真实，不承诺虚假效果。',
    keywords: ['本地生活', '代运营', '转化', '投流'],
    source: '平台案例复盘 + 商家访谈',
    reliability: '中',
    updatedAt: '2026-03-07 08:40',
    heat: 88
  },
  {
    id: 3,
    title: '企业“知道 AI 但不会落地工作流”',
    category: 'AI 工具',
    summary: '企业普遍卡在“工具多、流程乱”，可交付客服、线索分发、知识检索模块。',
    monetization: '项目交付费 + 订阅运维费 + 培训收入',
    difficulty: '中',
    compliance: '客户数据需脱敏并签署数据处理协议。',
    keywords: ['自动化', '工作流', 'AI', '效率'],
    source: '公开 SaaS 价格页 + 实施访谈',
    reliability: '高',
    updatedAt: '2026-03-07 10:20',
    heat: 92
  }
];

const reliabilityStyles: Record<SourceReliability, string> = {
  高: 'text-emerald-300 border-emerald-400/40 bg-emerald-500/10',
  中: 'text-amber-300 border-amber-400/40 bg-amber-500/10'
};

const nowString = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(
    now.getHours()
  ).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
};

const App: React.FC = () => {
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<(typeof categories)[number]>('全部');
  const [sortBy, setSortBy] = useState<'最新' | '最热'>('最新');
  const [insights, setInsights] = useState<Insight[]>(defaultInsights);
  const [leads, setLeads] = useState<UserLead[]>([]);
  const [leadSubmitted, setLeadSubmitted] = useState(false);
  const [insightSubmitted, setInsightSubmitted] = useState(false);

  const [leadForm, setLeadForm] = useState<Omit<UserLead, 'createdAt'>>({
    name: '',
    contact: '',
    category: 'AI 工具',
    lead: ''
  });

  const [insightForm, setInsightForm] = useState({
    title: '',
    category: 'AI 工具' as InsightCategory,
    summary: '',
    monetization: '',
    compliance: '',
    source: '',
    difficulty: '中' as Difficulty,
    reliability: '中' as SourceReliability,
    keywords: ''
  });

  useEffect(() => {
    try {
      const localInsights = localStorage.getItem(INSIGHTS_STORAGE_KEY);
      const localLeads = localStorage.getItem(LEADS_STORAGE_KEY);
      if (localInsights) {
        const parsed = JSON.parse(localInsights) as Insight[];
        if (Array.isArray(parsed) && parsed.length > 0) setInsights(parsed);
      }
      if (localLeads) {
        const parsed = JSON.parse(localLeads) as UserLead[];
        if (Array.isArray(parsed)) setLeads(parsed);
      }
    } catch {
      setInsights(defaultInsights);
      setLeads([]);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(INSIGHTS_STORAGE_KEY, JSON.stringify(insights));
  }, [insights]);

  useEffect(() => {
    localStorage.setItem(LEADS_STORAGE_KEY, JSON.stringify(leads));
  }, [leads]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const result = insights.filter((item) => {
      const matchCategory = selectedCategory === '全部' || item.category === selectedCategory;
      const matchQuery =
        q.length === 0 ||
        item.title.toLowerCase().includes(q) ||
        item.summary.toLowerCase().includes(q) ||
        item.keywords.some((keyword) => keyword.toLowerCase().includes(q));
      return matchCategory && matchQuery;
    });

    return result.sort((a, b) => {
      if (sortBy === '最热') return b.heat - a.heat;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [insights, query, selectedCategory, sortBy]);

  const dashboardStats = useMemo(() => {
    const highHeat = insights.filter((item) => item.heat >= 90).length;
    const today = nowString().slice(0, 10);
    const todayUpdates = insights.filter((item) => item.updatedAt.startsWith(today)).length;
    return {
      total: insights.length,
      highHeat,
      leads: leads.length,
      todayUpdates
    };
  }, [insights, leads]);

  const handleLeadSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!leadForm.name.trim() || !leadForm.contact.trim() || !leadForm.lead.trim()) return;
    const nextLead: UserLead = { ...leadForm, createdAt: nowString() };
    setLeads((prev) => [nextLead, ...prev].slice(0, 20));
    setLeadForm({ name: '', contact: '', category: 'AI 工具', lead: '' });
    setLeadSubmitted(true);
    setTimeout(() => setLeadSubmitted(false), 2200);
  };

  const handleInsightSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!insightForm.title.trim() || !insightForm.summary.trim() || !insightForm.monetization.trim()) return;

    const nextInsight: Insight = {
      id: Date.now(),
      title: insightForm.title.trim(),
      category: insightForm.category,
      summary: insightForm.summary.trim(),
      monetization: insightForm.monetization.trim(),
      difficulty: insightForm.difficulty,
      compliance: insightForm.compliance.trim() || '请补充合规边界说明。',
      keywords: insightForm.keywords
        .split(/[，,\s]+/)
        .map((item) => item.trim())
        .filter(Boolean),
      source: insightForm.source.trim() || '用户提交',
      reliability: insightForm.reliability,
      updatedAt: nowString(),
      heat: Math.floor(Math.random() * 21) + 75
    };

    setInsights((prev) => [nextInsight, ...prev]);
    setInsightForm({
      title: '',
      category: 'AI 工具',
      summary: '',
      monetization: '',
      compliance: '',
      source: '',
      difficulty: '中',
      reliability: '中',
      keywords: ''
    });
    setInsightSubmitted(true);
    setTimeout(() => setInsightSubmitted(false), 2200);
  };

  const handleExport = () => {
    const payload = {
      exportedAt: nowString(),
      insights,
      leads
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `info-gap-export-${Date.now()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-8 md:py-10">
        <header className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-cyan-950/30 p-6 md:p-10">
          <div className="flex flex-wrap items-center gap-2 text-xs text-cyan-200">
            <span className="rounded-full border border-cyan-400/40 bg-cyan-500/10 px-3 py-1">信息差雷达站</span>
            <span className="rounded-full border border-fuchsia-400/40 bg-fuchsia-500/10 px-3 py-1">持续更新</span>
            <span className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 py-1">合规优先</span>
          </div>

          <h1 className="mt-4 text-3xl font-black leading-tight md:text-5xl">可搜索、可提交、可沉淀的数据化信息差站点</h1>
          <p className="mt-4 max-w-4xl text-slate-300">
            本版升级为“可发布雏形”：新增情报录入、线索持久化、数据导出与运营看板，
            帮你把信息差从一次性浏览变成持续资产积累。
          </p>

          <div className="mt-6 grid gap-3 md:grid-cols-[2fr_1fr_1fr]">
            <label className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950/80 px-3">
              <Search size={18} className="text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索关键词：选品 / 投流 / 自动化 / 求职"
                className="w-full bg-transparent py-3 outline-none"
              />
            </label>
            <button
              onClick={() => setSortBy((prev) => (prev === '最新' ? '最热' : '最新'))}
              className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-semibold hover:border-cyan-300"
            >
              当前排序：{sortBy}
            </button>
            <button
              onClick={handleExport}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-400 px-4 py-3 font-bold text-slate-950 hover:bg-cyan-300"
            >
              <ArrowDownToLine size={16} /> 导出数据
            </button>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-700 bg-slate-900/80 p-3">
              <p className="text-xs text-slate-400">情报总数</p>
              <p className="mt-1 text-2xl font-bold">{dashboardStats.total}</p>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-900/80 p-3">
              <p className="text-xs text-slate-400">高热机会（90+）</p>
              <p className="mt-1 text-2xl font-bold text-rose-300">{dashboardStats.highHeat}</p>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-900/80 p-3">
              <p className="text-xs text-slate-400">线索总量</p>
              <p className="mt-1 text-2xl font-bold text-emerald-300">{dashboardStats.leads}</p>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-900/80 p-3">
              <p className="text-xs text-slate-400">今日更新</p>
              <p className="mt-1 text-2xl font-bold text-cyan-300">{dashboardStats.todayUpdates}</p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-300">
            <span className="inline-flex items-center gap-1">
              <Clock3 size={14} /> 实时看最新更新
            </span>
            <span className="inline-flex items-center gap-1">
              <TrendingUp size={14} /> 识别高热度机会
            </span>
            <span className="inline-flex items-center gap-1">
              <ShieldCheck size={14} /> 合规策略同步展示
            </span>
          </div>
        </header>

        <section className="mt-8 grid gap-8 lg:grid-cols-[2fr_1fr]">
          <div>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 text-sm text-slate-400">
                <Filter size={14} /> 分类筛选
              </span>
              {categories.map((category) => {
                const active = selectedCategory === category;
                return (
                  <button
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className={`rounded-full border px-3 py-1.5 text-sm transition ${
                      active
                        ? 'border-cyan-300 bg-cyan-400/20 text-cyan-200'
                        : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    {category}
                  </button>
                );
              })}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {filtered.map((item) => (
                <article key={item.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                  <div className="mb-3 flex items-center justify-between text-xs text-slate-400">
                    <span>{item.category}</span>
                    <span>更新于 {item.updatedAt}</span>
                  </div>

                  <h2 className="text-lg font-bold leading-snug">{item.title}</h2>
                  <p className="mt-2 text-sm text-slate-300">{item.summary}</p>

                  <div className="mt-3 flex items-center gap-2 text-xs">
                    <span className="rounded-md border border-rose-400/30 bg-rose-500/10 px-2 py-1 text-rose-200">热度 {item.heat}</span>
                    <span className={`rounded-md border px-2 py-1 ${reliabilityStyles[item.reliability]}`}>来源可信度：{item.reliability}</span>
                  </div>

                  <ul className="mt-4 space-y-1.5 text-sm text-slate-300">
                    <li>
                      <span className="text-slate-400">变现路径：</span>
                      {item.monetization}
                    </li>
                    <li>
                      <span className="text-slate-400">执行难度：</span>
                      {item.difficulty}
                    </li>
                    <li>
                      <span className="text-slate-400">来源说明：</span>
                      {item.source}
                    </li>
                    <li>
                      <span className="text-slate-400">合规提示：</span>
                      {item.compliance}
                    </li>
                  </ul>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {item.keywords.map((keyword) => (
                      <span key={`${item.id}-${keyword}`} className="rounded-md bg-slate-800 px-2 py-1 text-xs text-slate-300">
                        #{keyword}
                      </span>
                    ))}
                  </div>

                  <button className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-cyan-300 hover:text-cyan-200">
                    查看实操拆解 <ArrowUpRight size={14} />
                  </button>
                </article>
              ))}
            </div>

            {filtered.length === 0 && (
              <div className="mt-6 rounded-xl border border-dashed border-slate-700 p-8 text-center text-slate-400">
                没有命中内容，试试更宽泛关键词。
              </div>
            )}
          </div>

          <aside className="space-y-4">
            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <h3 className="text-lg font-bold">提交你的信息差线索</h3>
              <p className="mt-2 text-sm text-slate-400">线索将本地保存，刷新页面不丢失，适合先做运营验证。</p>
              <form className="mt-4 space-y-3" onSubmit={handleLeadSubmit}>
                <input
                  value={leadForm.name}
                  onChange={(event) => setLeadForm((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="你的称呼"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 outline-none focus:border-cyan-400"
                />
                <input
                  value={leadForm.contact}
                  onChange={(event) => setLeadForm((prev) => ({ ...prev, contact: event.target.value }))}
                  placeholder="联系方式（微信/邮箱）"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 outline-none focus:border-cyan-400"
                />
                <select
                  value={leadForm.category}
                  onChange={(event) => setLeadForm((prev) => ({ ...prev, category: event.target.value as InsightCategory }))}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 outline-none focus:border-cyan-400"
                >
                  {categories
                    .filter((category): category is InsightCategory => category !== '全部')
                    .map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                </select>
                <textarea
                  value={leadForm.lead}
                  onChange={(event) => setLeadForm((prev) => ({ ...prev, lead: event.target.value }))}
                  placeholder="描述你观察到的信息差与可变现方向"
                  rows={3}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 outline-none focus:border-cyan-400"
                />
                <button className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-400 px-4 py-2.5 font-bold text-slate-950 hover:bg-cyan-300">
                  <PlusCircle size={16} /> 提交线索
                </button>
              </form>
              {leadSubmitted && <p className="mt-3 text-sm text-emerald-300">线索已保存。</p>}
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <h3 className="text-lg font-bold">新增情报（运营录入）</h3>
              <form className="mt-3 space-y-2" onSubmit={handleInsightSubmit}>
                <input
                  value={insightForm.title}
                  onChange={(event) => setInsightForm((prev) => ({ ...prev, title: event.target.value }))}
                  placeholder="情报标题"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 outline-none focus:border-fuchsia-400"
                />
                <textarea
                  value={insightForm.summary}
                  onChange={(event) => setInsightForm((prev) => ({ ...prev, summary: event.target.value }))}
                  placeholder="情报摘要"
                  rows={2}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 outline-none focus:border-fuchsia-400"
                />
                <input
                  value={insightForm.monetization}
                  onChange={(event) => setInsightForm((prev) => ({ ...prev, monetization: event.target.value }))}
                  placeholder="变现路径"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 outline-none focus:border-fuchsia-400"
                />
                <input
                  value={insightForm.keywords}
                  onChange={(event) => setInsightForm((prev) => ({ ...prev, keywords: event.target.value }))}
                  placeholder="关键词（逗号分隔）"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 outline-none focus:border-fuchsia-400"
                />
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={insightForm.category}
                    onChange={(event) => setInsightForm((prev) => ({ ...prev, category: event.target.value as InsightCategory }))}
                    className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 outline-none"
                  >
                    {categories
                      .filter((category): category is InsightCategory => category !== '全部')
                      .map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                  </select>
                  <select
                    value={insightForm.difficulty}
                    onChange={(event) => setInsightForm((prev) => ({ ...prev, difficulty: event.target.value as Difficulty }))}
                    className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 outline-none"
                  >
                    <option value="低">难度：低</option>
                    <option value="中">难度：中</option>
                    <option value="高">难度：高</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={insightForm.reliability}
                    onChange={(event) => setInsightForm((prev) => ({ ...prev, reliability: event.target.value as SourceReliability }))}
                    className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 outline-none"
                  >
                    <option value="中">可信度：中</option>
                    <option value="高">可信度：高</option>
                  </select>
                  <input
                    value={insightForm.source}
                    onChange={(event) => setInsightForm((prev) => ({ ...prev, source: event.target.value }))}
                    placeholder="来源说明"
                    className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 outline-none"
                  />
                </div>
                <input
                  value={insightForm.compliance}
                  onChange={(event) => setInsightForm((prev) => ({ ...prev, compliance: event.target.value }))}
                  placeholder="合规提示"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 outline-none"
                />
                <button className="w-full rounded-lg bg-fuchsia-500 px-4 py-2.5 font-bold text-white hover:bg-fuchsia-400">保存情报</button>
              </form>
              {insightSubmitted && <p className="mt-2 text-sm text-emerald-300">新情报已加入列表。</p>}
            </section>
          </aside>
        </section>

        <footer className="mt-8 rounded-xl border border-slate-800 bg-slate-900/70 p-4 text-xs text-slate-400">
          免责声明：本站仅用于行业研究与商业信息整理，不提供任何违法、侵权、绕平台规则的建议。
        </footer>
      </div>
    </main>
  );
};

export default App;
