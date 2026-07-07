import { GoogleGenAI } from '@google/genai';
import { KnowledgePoint, QuizQuestion, SubjectId, ChatMessage } from '../types';
import { SUBJECTS, GEMINI_MODEL } from '../constants';

/**
 * AI 进化引擎（多提供商）：让知识库「自我更新迭代」的核心。
 *
 * 支持两种大模型后端，二选一即可（在 .env.local 中配置）：
 *   1. DeepSeek —— 配置 DEEPSEEK_API_KEY，走 Vite 开发服务器代理 /ds-api（推荐国内使用）
 *   2. Gemini   —— 配置 GEMINI_API_KEY，SDK 直连
 * 都不配置时相关按钮自动隐藏，内置知识库与复习引擎完全可离线使用。
 *
 * 优先级：AI_PROVIDER 强制指定 > DeepSeek（若已配置）> Gemini。
 */

const geminiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || '';
const deepseekEnabled = process.env.DEEPSEEK_ENABLED === '1';
const forced = (process.env.AI_PROVIDER || '').toLowerCase();
const deepseekModel = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

export type AiProvider = 'deepseek' | 'gemini';

export const aiProvider: AiProvider | null =
  forced === 'deepseek'
    ? 'deepseek'
    : forced === 'gemini'
      ? 'gemini'
      : deepseekEnabled
        ? 'deepseek'
        : geminiKey
          ? 'gemini'
          : null;

export const aiAvailable = aiProvider !== null;
export const aiProviderName = aiProvider === 'deepseek' ? 'DeepSeek' : aiProvider === 'gemini' ? 'Gemini' : '';

const ai = geminiKey ? new GoogleGenAI({ apiKey: geminiKey }) : null;

const TUTOR_PERSONA =
  '你是一位深耕北京高考文科命题研究的特级教师，精通统编版历史、地理、政治教材与北京卷（等级考）命题风格。' +
  '回答精炼、直击得分点，使用规范的学科术语，并主动指出常见失分陷阱。';

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** 去掉模型偶尔套上的 ```json ``` 代码块围栏 */
function stripFences(text: string): string {
  return text
    .replace(/^\s*```(?:json)?/i, '')
    .replace(/```\s*$/, '')
    .trim();
}

/* ------------------------- DeepSeek 底层调用 ------------------------- */

interface ChatMsg {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

async function deepseekChat(messages: ChatMsg[], json: boolean): Promise<string> {
  const res = await fetch('/ds-api/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: deepseekModel,
      messages,
      temperature: json ? 1.0 : 1.2,
      ...(json ? { response_format: { type: 'json_object' } } : {}),
    }),
  });
  if (!res.ok) {
    const detail = (await res.text().catch(() => '')).slice(0, 200);
    if (res.status === 404) throw new Error('DeepSeek 代理未生效，请用 `npm run dev` 启动（预览模式不支持 DeepSeek 代理）');
    throw new Error(`DeepSeek 请求失败（${res.status}）：${detail || '请检查 DEEPSEEK_API_KEY 是否有效'}`);
  }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? '';
}

/* ------------------------- 统一的结构化生成 ------------------------- */

/**
 * 让当前提供商生成一个 JSON 对象并取出 items 数组。
 * 为兼容 DeepSeek 的 json_object 模式（根节点必须是对象），统一约定形如 {"items":[...]}。
 */
async function genItems<T>(system: string, prompt: string): Promise<T[]> {
  const wrapped = `${prompt}\n\n请只返回 JSON，形如 {"items":[ ... ]}，不要输出任何解释文字或 Markdown 代码块。`;

  if (aiProvider === 'deepseek') {
    const text = await deepseekChat(
      [
        { role: 'system', content: system },
        { role: 'user', content: wrapped },
      ],
      true,
    );
    const obj = JSON.parse(stripFences(text));
    return Array.isArray(obj) ? (obj as T[]) : ((obj.items ?? []) as T[]);
  }

  if (aiProvider === 'gemini' && ai) {
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: wrapped,
      config: { systemInstruction: system, responseMimeType: 'application/json' },
    });
    const obj = JSON.parse(stripFences(response.text ?? '{}'));
    return Array.isArray(obj) ? (obj as T[]) : ((obj.items ?? []) as T[]);
  }

  throw new Error('未配置 AI 提供商（DEEPSEEK_API_KEY 或 GEMINI_API_KEY）');
}

/* ------------------------- 对外能力 ------------------------- */

/** 基于某考点生成新的仿真选择题（知识库出题能力的自我扩展） */
export async function generateQuestions(kp: KnowledgePoint, count = 3): Promise<QuizQuestion[]> {
  const raw = await genItems<Omit<QuizQuestion, 'id' | 'subject' | 'kpId' | 'source'>>(
    TUTOR_PERSONA,
    `请围绕以下北京高考${SUBJECTS[kp.subject].name}考点，命制 ${count} 道仿北京卷风格的单项选择题（每题 4 个选项，干扰项要有迷惑性，体现真实情境与逻辑推理）。\n\n` +
      `考点标题：${kp.title}\n考点内容：${kp.content}\n高频关键词：${kp.keywords.join('、')}\n\n` +
      `每道题的字段：question（题干）、options（含 4 个选项的数组，不带 ABCD 前缀）、answer（正确选项下标 0-3 的整数）、explanation（解析：为何选它、其他选项错在哪）。`,
  );
  return raw
    .filter((q) => Array.isArray(q.options) && q.options.length === 4 && q.answer >= 0 && q.answer <= 3)
    .map((q) => ({ ...q, id: uid('q-ai'), subject: kp.subject, kpId: kp.id, source: 'ai' as const }));
}

/** 针对某专题扩展新考点卡片（知识库内容的自我生长） */
export async function expandTopic(
  subject: SubjectId,
  unit: string,
  topic: string,
  existingTitles: string[],
): Promise<KnowledgePoint[]> {
  const raw = await genItems<{ title: string; content: string; keywords: string[]; examTip?: string }>(
    TUTOR_PERSONA,
    `请为北京高考${SUBJECTS[subject].name}「${unit} / ${topic}」专题补充 2 张新的考点卡片，深挖该专题下尚未覆盖的高频考点或易错细节。已有卡片（不要重复）：${existingTitles.join('、') || '（暂无）'}。\n\n` +
      `每张卡片的字段：title（标题）、content（浓缩得分点，200 字以内，可用 **加粗** 标记核心术语、用 \\n 分段）、keywords（高频关键词数组）、examTip（北京卷考法提示）。`,
  );
  return raw.map((k) => ({
    ...k,
    id: uid('kp-ai'),
    subject,
    unit,
    topic,
    source: 'ai' as const,
    createdAt: Date.now(),
  }));
}

/** 政治时政热点自动更新：生成近一年热点与教材考点的挂钩卡片 */
export async function updateCurrentAffairs(existingTitles: string[]): Promise<KnowledgePoint[]> {
  const year = new Date().getFullYear();
  const raw = await genItems<{ title: string; content: string; keywords: string[]; examTip?: string }>(
    TUTOR_PERSONA,
    `请梳理 ${year - 1} 年至 ${year} 年与北京高考政治相关度最高的 3 个时政热点，为每个热点生成一张考点卡片。已有卡片（不要重复）：${existingTitles.join('、') || '（暂无）'}。\n\n` +
      `每张卡片的字段：title（热点名称）、content（热点概要 + 应挂钩的教材原理，按经济/政治/哲学/文化分别列出 + 可能的命题角度，250 字以内，可用 **加粗** 与 \\n 分段，结尾提醒学生核对最新时政表述）、keywords（关键词数组）、examTip（命题预测提示）。`,
  );
  return raw.map((k) => ({
    ...k,
    id: uid('kp-ai'),
    subject: 'politics' as const,
    unit: '时政热点',
    topic: `AI 时政更新（${year}）`,
    source: 'ai' as const,
    createdAt: Date.now(),
  }));
}

/** AI 教练问答（可携带薄弱点上下文，实现个性化辅导） */
export async function askTutor(history: ChatMessage[], weakContext: string): Promise<string> {
  const system =
    TUTOR_PERSONA + (weakContext ? `\n该学生当前的薄弱专题：${weakContext}。回答时可结合其薄弱点给出针对性建议。` : '');

  if (aiProvider === 'deepseek') {
    const msgs: ChatMsg[] = [
      { role: 'system', content: system },
      ...history.map((m) => ({ role: (m.role === 'model' ? 'assistant' : 'user') as 'assistant' | 'user', content: m.text })),
    ];
    return (await deepseekChat(msgs, false)) || '（AI 暂时没有返回内容，请重试）';
  }

  if (aiProvider === 'gemini' && ai) {
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: history.map((m) => ({ role: m.role, parts: [{ text: m.text }] })),
      config: { systemInstruction: system },
    });
    return response.text ?? '（AI 暂时没有返回内容，请重试）';
  }

  throw new Error('未配置 AI 提供商（DEEPSEEK_API_KEY 或 GEMINI_API_KEY）');
}
