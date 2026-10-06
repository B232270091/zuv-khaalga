/** All gameplay tuning lives here. Distances are world units; time is seconds. */
export const CONFIG = Object.freeze({
  baseSpeed: 4.8,
  speedStepSeconds: 20,
  speedStep: 0.08,
  maxSpeedMultiplier: 1.8,
  revealDistance: 42.18,
  decisionDistance: 5.7,
  collisionDistance: 0.55,
  passedDistance: -1.4,
  recycleDistance: -13,
  wallSpacing: 43.5,
  wallPoolSize: 3,
  doorOpenSeconds: 0.36,
  laneX: 2.25,
  laneSmoothing: 17,
  fixedStep: 1 / 120,
  maxFrameDelta: 0.1,
  fallSeconds: 1.1,
  swipeThreshold: 28,
  maxPixelRatio: 1.8,
});

export type Grade = 1 | 2 | 3;
export type Lane = 0 | 1;
export const GRADES = {
  1: { title: '1-р анги', description: '20 дотор нэмэх, хасах', symbol: '+' },
  2: { title: '2-р анги', description: '100 дотор нэмэх, хасах', symbol: '−' },
  3: { title: '3-р анги', description: 'Үржүүлэх, хуваах', symbol: '×' },
} as const;
