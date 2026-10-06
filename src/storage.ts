import type { Grade } from './config';
export const read = (key: string, fallback: string) => { try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; } };
export const write = (key: string, value: string) => { try { localStorage.setItem(key, value); } catch { /* Private mode: keep playing. */ } };
export const bestFor = (grade: Grade) => Math.max(0, Number(read(`zuv-khaalga-best-${grade}`, '0')) || 0);
export const saveBest = (grade: Grade, score: number) => { const best = Math.max(bestFor(grade), score); write(`zuv-khaalga-best-${grade}`, String(best)); return best; };
