import type { Grade, Lane } from './config';

export interface Question {
  a: number; b: number; operator: '+' | '−' | '×' | '÷';
  answer: number; options: [number, number]; correctLane: Lane; key: string; text: string;
}

export function makeQuestion(grade: Grade, previousKey = '', random = Math.random): Question {
  const int = (min: number, max: number) => min + Math.floor(random() * (max - min + 1));
  let a: number, b: number, answer: number, operator: Question['operator'], key: string;
  let attempts = 0;
  do {
    const first = random() < 0.5;
    if (grade === 3) {
      a = int(1, 10); b = int(1, 10);
      operator = first ? '×' : '÷';
      if (first) answer = a * b;
      else { answer = a; a *= b; }
    } else {
      const max = grade === 1 ? 20 : 100;
      operator = first ? '+' : '−';
      a = int(1, max); b = first ? int(0, max - a) : int(0, a);
      answer = first ? a + b : a - b;
    }
    key = `${a}${operator}${b}`;
    // Also terminates for a pathological injected RNG, without repeating a problem.
    if (++attempts > 50 && key === previousKey) {
      if (grade === 3) { a = a === 1 ? 2 : 1; b = 1; operator = '×'; answer = a; }
      else { a = a === 1 ? 2 : 1; b = 0; operator = '+'; answer = a; }
      key = `${a}${operator}${b}`;
    }
  } while (key === previousKey);
  const maxAnswer = grade === 1 ? 20 : operator === '÷' ? 10 : 100;
  const offsets = operator === '×' ? [a, b, 1, 2] : grade === 2 ? [1, 2, 10] : [1, 2, 3];
  let wrong = answer + offsets[int(0, offsets.length - 1)] * (random() < .5 ? -1 : 1);
  if (wrong < 0 || wrong > maxAnswer || wrong === answer) wrong = answer === maxAnswer ? answer - 1 : answer + 1;
  const correctLane: Lane = random() < 0.5 ? 0 : 1;
  return { a, b, operator, answer, correctLane, key, text: `${a} ${operator} ${b}`, options: correctLane === 0 ? [answer, wrong] : [wrong, answer] };
}
