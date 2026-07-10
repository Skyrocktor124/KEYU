import { HISTORY_KPS } from './history';
import { GEOGRAPHY_KPS } from './geography';
import { POLITICS_KPS } from './politics';
import { KnowledgePoint } from '../types';

export { ANSWER_TEMPLATES } from './templates';
export { SEED_QUESTIONS } from './quiz';

export const SEED_KPS: KnowledgePoint[] = [...HISTORY_KPS, ...GEOGRAPHY_KPS, ...POLITICS_KPS];
