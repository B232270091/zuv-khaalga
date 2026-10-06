import { CONFIG, type Grade, type Lane } from './config';
import { makeQuestion, type Question } from './questions';

export type GameState = 'menu' | 'playing' | 'paused' | 'falling' | 'gameover';
export interface Wall {
  id: number; distance: number; question: Question | null;
  lockedLane: Lane | null; correct: boolean; scored: boolean; open: number;
}
export type GameEvent = { type: 'question' | 'lock' | 'score' | 'collision' | 'gameover'; wall: Wall };
export const speedMultiplierAt = (seconds: number) => Math.min(CONFIG.maxSpeedMultiplier, 1 + Math.floor(seconds / CONFIG.speedStepSeconds) * CONFIG.speedStep);

/** Pure simulation: Three.js and the DOM never decide answers, collisions, or scoring. */
export class GameEngine {
  state: GameState = 'menu';
  grade: Grade = 1;
  lane: Lane = 0;
  score = 0;
  elapsed = 0;
  distance = 0;
  fallTime = 0;
  walls: Wall[] = [];
  missed: Question | null = null;
  private previousKey = '';
  private accumulator = 0;
  private pausedState: 'playing' | 'falling' = 'playing';
  onEvent: (event: GameEvent) => void = () => {};
  constructor(private random = Math.random) {}
  get multiplier() { return speedMultiplierAt(this.elapsed); }
  get speed() { return CONFIG.baseSpeed * this.multiplier; }
  get activeWall() { return this.walls.filter(w => !w.scored).sort((a, b) => a.distance - b.distance)[0]; }
  get locked() { return this.activeWall?.lockedLane !== null && this.activeWall?.lockedLane !== undefined; }
  get secondsLeft() { return Math.max(0, ((this.activeWall?.distance ?? CONFIG.decisionDistance) - CONFIG.decisionDistance) / this.speed); }

  start(grade: Grade) {
    this.grade = grade; this.lane = 0; this.score = 0; this.elapsed = 0; this.distance = 0;
    this.fallTime = 0; this.accumulator = 0; this.previousKey = ''; this.missed = null;
    this.state = 'playing';
    this.walls = Array.from({ length: CONFIG.wallPoolSize }, (_, id) => ({
      id, distance: CONFIG.revealDistance + id * CONFIG.wallSpacing,
      question: null, lockedLane: null, correct: false, scored: false, open: 0,
    }));
    this.reveal();
  }
  select(lane: Lane) {
    if (this.state !== 'playing' || this.locked) return false;
    this.lane = lane; return true;
  }
  pause() {
    if (this.state !== 'playing' && this.state !== 'falling') return;
    this.pausedState = this.state; this.state = 'paused'; this.accumulator = 0;
  }
  resume() { if (this.state === 'paused') { this.state = this.pausedState; this.accumulator = 0; } }
  menu() { this.state = 'menu'; this.accumulator = 0; }

  update(delta: number) {
    if (!Number.isFinite(delta) || delta <= 0 || this.state === 'paused' || this.state === 'menu' || this.state === 'gameover') return;
    // Fixed steps keep collision/order deterministic even if a frame crosses multiple thresholds.
    this.accumulator += Math.min(delta, CONFIG.maxFrameDelta);
    while (this.accumulator + 1e-10 >= CONFIG.fixedStep) {
      this.accumulator -= CONFIG.fixedStep;
      this.step(CONFIG.fixedStep);
      if ((this.state as GameState) === 'gameover') { this.accumulator = 0; break; }
    }
  }
  private reveal() {
    const wall = this.activeWall;
    if (wall && !wall.question && wall.distance <= CONFIG.revealDistance + .001) {
      wall.question = makeQuestion(this.grade, this.previousKey, this.random);
      this.previousKey = wall.question.key;
      this.onEvent({ type: 'question', wall });
    }
  }
  private step(dt: number) {
    if (this.state === 'falling') {
      this.fallTime += dt;
      if (this.fallTime >= CONFIG.fallSeconds) {
        this.state = 'gameover'; this.onEvent({ type: 'gameover', wall: this.activeWall });
      }
      return;
    }
    this.elapsed += dt;
    const movement = this.speed * dt;
    this.distance += movement;
    for (const wall of this.walls) wall.distance -= movement;
    this.reveal();
    const wall = this.activeWall;
    if (wall?.question) {
      if (wall.lockedLane === null && wall.distance <= CONFIG.decisionDistance) {
        wall.lockedLane = this.lane;
        wall.correct = wall.question.options[this.lane] === wall.question.answer;
        this.onEvent({ type: 'lock', wall });
      }
      if (wall.correct && wall.lockedLane !== null) wall.open = Math.min(1, wall.open + dt / CONFIG.doorOpenSeconds);
      if (!wall.correct && wall.lockedLane !== null && wall.distance <= CONFIG.collisionDistance) {
        wall.distance = CONFIG.collisionDistance;
        this.missed = wall.question; this.state = 'falling'; this.fallTime = 0;
        this.onEvent({ type: 'collision', wall }); return;
      }
      if (!wall.scored && wall.correct && wall.distance <= CONFIG.passedDistance) {
        wall.scored = true; this.score++;
        this.onEvent({ type: 'score', wall });
        this.reveal();
      }
    }
    for (const old of this.walls) {
      if (old.distance < CONFIG.recycleDistance) {
        old.distance = Math.max(...this.walls.map(w => w.distance)) + CONFIG.wallSpacing;
        old.question = null; old.lockedLane = null; old.correct = false; old.scored = false; old.open = 0;
      }
    }
  }
}
