export type SubjectId = 'history' | 'geography' | 'politics';

/** 一条考点卡片。source 标记来源：seed = 内置知识库，ai = AI 自我迭代生成 */
export interface KnowledgePoint {
  id: string;
  subject: SubjectId;
  unit: string; // 模块，如「中国古代史」「自然地理」
  topic: string; // 专题，如「秦汉大一统」
  title: string;
  content: string; // 核心考点，支持 **加粗** 与换行
  keywords: string[]; // 高频术语 / 得分点
  examTip?: string; // 北京卷考法提示
  source: 'seed' | 'ai';
  createdAt?: number;
}

export interface QuizQuestion {
  id: string;
  subject: SubjectId;
  kpId?: string; // 关联考点
  question: string;
  options: string[];
  answer: number; // 正确选项下标
  explanation: string;
  source: 'seed' | 'ai';
}

/** 答题模板（主观题万能思路） */
export interface AnswerTemplate {
  id: string;
  subject: SubjectId;
  name: string; // 如「原因背景类」
  pattern: string; // 思路框架
  example?: string; // 示例
}

/** 间隔重复记录：level 0-5，level >= 4 视为掌握 */
export interface MasteryRecord {
  kpId: string;
  level: number;
  lastReview: number;
  nextReview: number;
  reviews: number;
  lapses: number;
}

export interface WrongRecord {
  questionId: string;
  times: number;
  lastWrong: number;
  resolved: boolean;
}

export type ReviewGrade = 'again' | 'good' | 'easy';

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}
