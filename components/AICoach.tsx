import React, { useRef, useState, useEffect } from 'react';
import { Send, GraduationCap } from 'lucide-react';
import { ChatMessage } from '../types';
import { aiAvailable, aiProviderName, askTutor } from '../services/geminiService';
import { RichText, Spinner } from './ui';

interface Props {
  weakContext: string; // 由学习数据自动生成的薄弱专题摘要
}

const SUGGESTIONS = [
  '用 5 分钟给我讲透「矛盾的主次方面 vs 主次矛盾」的区分',
  '帮我列一个距考试 30 天的文综冲刺计划',
  '出一道关于京津冀协同发展的地理大题并给出满分答案',
  '「小论文」题怎么在 10 分钟内搭出高分结构？',
];

/** AI 教练：携带薄弱点上下文的个性化答疑 */
const AICoach: React.FC<Props> = ({ weakContext }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, busy]);

  const send = async (text: string) => {
    const t = text.trim();
    if (!t || busy) return;
    const next: ChatMessage[] = [...messages, { role: 'user', text: t }];
    setMessages(next);
    setInput('');
    setBusy(true);
    setError(null);
    try {
      const reply = await askTutor(next, weakContext);
      setMessages([...next, { role: 'model', text: reply }]);
    } catch (e) {
      setError(`请求失败：${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  if (!aiAvailable) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
        <GraduationCap className="w-12 h-12 text-slate-300 mx-auto" />
        <h2 className="mt-4 text-lg font-bold text-slate-800">AI 教练未启用</h2>
        <p className="mt-2 text-sm text-slate-500 max-w-md mx-auto">
          在项目根目录的 <code className="bg-slate-100 px-1 rounded">.env.local</code> 中配置{' '}
          <code className="bg-slate-100 px-1 rounded">DEEPSEEK_API_KEY</code> 或{' '}
          <code className="bg-slate-100 px-1 rounded">GEMINI_API_KEY</code>（任选其一）后，这里会变成一位随叫随到、
          知道你所有薄弱点的北京文科特级教师。
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto flex flex-col h-[calc(100vh-160px)]">
      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        {messages.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <div className="flex items-center gap-2 font-semibold text-slate-800">
              <GraduationCap className="w-5 h-5 text-slate-500" />
              你的私人特级教师已就位
            </div>
            <p className="mt-2 text-sm text-slate-500">
              我掌握你的复习数据{weakContext ? `（当前薄弱：${weakContext}）` : ''}，可以讲解考点、批改思路、制定冲刺计划。试试：
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-full px-3 py-1.5 hover:border-slate-400 transition text-left"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                m.role === 'user' ? 'bg-slate-800 text-white' : 'bg-white border border-slate-200 text-slate-700'
              }`}
            >
              <RichText text={m.text} />
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex justify-start">
            <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3">
              <Spinner label="老师思考中…" />
            </div>
          </div>
        )}
        {error && <div className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-xl p-3">{error}</div>}
        <div ref={bottomRef} />
      </div>
      <div className="flex gap-2 pt-3 border-t border-slate-200">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send(input)}
          placeholder="问任何文科考点、答题方法、复习规划…"
          className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-slate-400"
        />
        <button
          onClick={() => send(input)}
          disabled={busy || !input.trim()}
          className="px-4 py-2.5 bg-slate-800 text-white rounded-xl hover:bg-slate-700 disabled:opacity-40 transition"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default AICoach;
