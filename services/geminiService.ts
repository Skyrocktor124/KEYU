import { GoogleGenAI, Type } from '@google/genai';
import { KnowledgePoint, QuizQuestion, SubjectId, ChatMessage } from '../types';
import { SUBJECTS, GEMINI_MODEL } from '../constants';

/**
 * AI 进化引擎：让知识库「自我更新迭代」的核心。
 * 需要在 .env.local 中配置 GEMINI_API_KEY；未配置时相关按钮自动隐藏，
 * 内置知识库与复习引擎完全可离线使用。
 */

const apiKey = process.env.API_KEY || '';
export const aiAvailable = !!apiKey;
const ai = aiAvailable ? new GoogleGenAI({ apiKey }) : null;

const TUTOR_PERSONA =
  '你是一位深耕北京高考文科命题研究的特级教师，精通统编版历史、地理、政治教材与北京卷（等级考）命题风格。' +
  '回答精炼、直击得分点，使用规范的学科术语，并主动指出常见失分陷阱。';

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** 基于某考点生成新的仿真选择题（知识库出题能力的自我扩展） */
export async function generateQuestions(kp: KnowledgePoint, count = 3): Promise<QuizQuestion[]> {
  if (!ai) throw new Error('未配置 GEMINI_API_KEY');
  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents:
      `请围绕以下北京高考${SUBJECTS[kp.subject].name}考点，命制 ${count} 道仿北京卷风格的单项选择题（4个选项，干扰项要有迷惑性，体现真实情境与逻辑推理）。\n\n` +
      `考点标题：${kp.title}\n考点内容：${kp.content}\n高频关键词：${kp.keywords.join('、')}`,
    config: {
      systemInstruction: TUTOR_PERSONA,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            question: { type: Type.STRING, description: '题干' },
            options: { type: Type.ARRAY, items: { type: Type.STRING }, description: '4个选项，不带ABCD前缀' },
            answer: { type: Type.INTEGER, description: '正确选项下标 0-3' },
            explanation: { type: Type.STRING, description: '解析：为何选它、其他选项错在哪' },
          },
          required: ['question', 'options', 'answer', 'explanation'],
        },
      },
    },
  });
  const raw = JSON.parse(response.text ?? '[]') as Omit<QuizQuestion, 'id' | 'subject' | 'kpId' | 'source'>[];
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
  if (!ai) throw new Error('未配置 GEMINI_API_KEY');
  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents:
      `请为北京高考${SUBJECTS[subject].name}「${unit} / ${topic}」专题补充 2 张新的考点卡片，` +
      `深挖该专题下尚未覆盖的高频考点或易错细节。已有卡片（不要重复）：${existingTitles.join('、')}。\n` +
      `内容要求：浓缩得分点（200字以内），可用 **加粗** 标记核心术语，用 \\n 分段。`,
    config: {
      systemInstruction: TUTOR_PERSONA,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            content: { type: Type.STRING },
            keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
            examTip: { type: Type.STRING, description: '北京卷考法提示' },
          },
          required: ['title', 'content', 'keywords'],
        },
      },
    },
  });
  const raw = JSON.parse(response.text ?? '[]') as { title: string; content: string; keywords: string[]; examTip?: string }[];
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
  if (!ai) throw new Error('未配置 GEMINI_API_KEY');
  const year = new Date().getFullYear();
  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents:
      `请梳理 ${year - 1} 年至 ${year} 年与北京高考政治相关度最高的 3 个时政热点，为每个热点生成一张考点卡片：` +
      `说明热点内容概要、应挂钩的教材原理（经济/政治/哲学/文化分别列出）、可能的命题角度。` +
      `已有卡片（不要重复）：${existingTitles.join('、')}。内容浓缩在250字以内，可用 **加粗** 与 \\n 分段。` +
      `注意在卡片末尾提醒学生核对最新时政表述。`,
    config: {
      systemInstruction: TUTOR_PERSONA,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            content: { type: Type.STRING },
            keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
            examTip: { type: Type.STRING },
          },
          required: ['title', 'content', 'keywords'],
        },
      },
    },
  });
  const raw = JSON.parse(response.text ?? '[]') as { title: string; content: string; keywords: string[]; examTip?: string }[];
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
  if (!ai) throw new Error('未配置 GEMINI_API_KEY');
  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: history.map((m) => ({ role: m.role, parts: [{ text: m.text }] })),
    config: {
      systemInstruction:
        TUTOR_PERSONA +
        (weakContext ? `\n该学生当前的薄弱专题：${weakContext}。回答时可结合其薄弱点给出针对性建议。` : ''),
    },
  });
  return response.text ?? '（AI 暂时没有返回内容，请重试）';
}
