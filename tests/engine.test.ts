import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG, type Grade } from '../src/config.ts';
import { GameEngine, speedMultiplierAt } from '../src/engine.ts';
import { makeQuestion } from '../src/questions.ts';

function rng(seed = 1357) { return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }; }
function advance(game: GameEngine, seconds: number, fps = 60) { for (let i = 0; i < Math.round(seconds * fps); i++) game.update(1 / fps); }

for (const grade of [1, 2, 3] as Grade[]) test(`grade ${grade}: 10,000 valid, non-repeating problems and unbiased lanes`, () => {
  const random = rng(grade); let previous = '', left = 0;
  for (let i = 0; i < 10000; i++) {
    const q = makeQuestion(grade, previous, random);
    assert.notEqual(q.key, previous); previous = q.key;
    assert.equal(q.options.length, 2); assert.notEqual(q.options[0], q.options[1]);
    assert.equal(q.options.filter(value => value === q.answer).length, 1);
    assert.equal(q.options[q.correctLane], q.answer);
    assert.ok(q.options.every(value => Number.isInteger(value) && value >= 0));
    if (q.correctLane === 0) left++;
    if (grade < 3) {
      const max = grade === 1 ? 20 : 100;
      assert.ok(q.a <= max && q.b <= max && q.answer <= max && q.answer >= 0);
      assert.equal(q.answer, q.operator === '+' ? q.a + q.b : q.a - q.b);
    } else if (q.operator === '×') {
      assert.ok(q.a >= 1 && q.a <= 10 && q.b >= 1 && q.b <= 10); assert.equal(q.answer, q.a * q.b);
    } else {
      assert.equal(q.a % q.b, 0); assert.equal(q.answer, q.a / q.b); assert.ok(q.answer <= 10 && q.b <= 10);
    }
  }
  assert.ok(left > 4750 && left < 5250, `left count ${left}`);
});

test('a constant RNG cannot hang or repeat the previous problem', () => {
  for (const grade of [1, 2, 3] as Grade[]) {
    const q = makeQuestion(grade, '', () => .5);
    assert.notEqual(makeQuestion(grade, q.key, () => .5).key, q.key);
  }
});

test('correct gate opens before contact, choice locks, and score is awarded exactly once after passage', () => {
  const game = new GameEngine(rng()); const events: string[] = [];
  game.onEvent = event => events.push(event.type); game.start(1);
  const wall = game.activeWall, correct = wall.question!.correctLane;
  assert.equal(wall.open, 0); game.select(correct);
  while (!game.locked) game.update(1 / 60);
  assert.equal(game.score, 0); assert.equal(game.select(correct === 0 ? 1 : 0), false);
  advance(game, .5); assert.equal(wall.open, 1); assert.ok(wall.distance > CONFIG.collisionDistance);
  while (game.score === 0) game.update(1 / 60);
  assert.ok(wall.distance <= CONFIG.passedDistance); assert.equal(game.score, 1);
  advance(game, .5); assert.equal(game.score, 1); assert.equal(game.state, 'playing');
  assert.equal(events.filter(e => e === 'score').length, 1); assert.equal(events.filter(e => e === 'collision').length, 0);
});

test('wrong gate stays closed, collisions cannot be skipped, and the player falls then ends', () => {
  const game = new GameEngine(rng()); game.start(3); game.elapsed = 220;
  const wall = game.activeWall; game.select(wall.question!.correctLane === 0 ? 1 : 0);
  wall.distance = CONFIG.decisionDistance + .1;
  while (game.state === 'playing') game.update(.1);
  assert.equal(game.state, 'falling'); assert.equal(game.score, 0); assert.equal(wall.open, 0);
  assert.equal(wall.distance, CONFIG.collisionDistance); assert.deepEqual(game.missed, wall.question);
  advance(game, 1.2); assert.equal(game.state, 'gameover');
});

test('speed steps every 20 seconds, caps at 1.8, and leaves at least 4 seconds to think', () => {
  assert.equal(speedMultiplierAt(0), 1); assert.equal(speedMultiplierAt(19.99), 1);
  assert.equal(speedMultiplierAt(20), 1.08); assert.equal(speedMultiplierAt(40), 1.16);
  assert.equal(speedMultiplierAt(200), 1.8); assert.equal(speedMultiplierAt(1e6), 1.8);
  const initial = (CONFIG.revealDistance - CONFIG.decisionDistance) / CONFIG.baseSpeed;
  assert.ok(initial >= 7 && initial <= 8); assert.ok(initial / CONFIG.maxSpeedMultiplier >= 4);
  // New problems must be visible for >=4s after the previous gate is cleared too.
  const next = Math.min(CONFIG.revealDistance, CONFIG.wallSpacing + CONFIG.passedDistance);
  assert.ok((next - CONFIG.decisionDistance) / (CONFIG.baseSpeed * CONFIG.maxSpeedMultiplier) >= 4);
});

test('pausing freezes time, wall positions, and falling; restart clears every simulation field', () => {
  const game = new GameEngine(rng()); game.start(2); advance(game, 2); game.pause();
  const frozen = JSON.stringify({ elapsed: game.elapsed, distance: game.distance, walls: game.walls });
  advance(game, 120); assert.equal(JSON.stringify({ elapsed: game.elapsed, distance: game.distance, walls: game.walls }), frozen);
  assert.equal(game.select(1), false); game.resume(); advance(game, .5); assert.ok(game.elapsed > 2);
  game.state = 'falling'; advance(game, .3); game.pause(); const fall = game.fallTime;
  advance(game, 2); assert.equal(game.fallTime, fall); game.resume(); assert.equal(game.state, 'falling');
  game.start(3); assert.equal(game.score, 0); assert.equal(game.elapsed, 0); assert.equal(game.distance, 0);
  assert.equal(game.lane, 0); assert.equal(game.fallTime, 0); assert.equal(game.multiplier, 1); assert.equal(game.missed, null);
  assert.equal(game.walls[0].distance, CONFIG.revealDistance); assert.equal(game.walls.length, CONFIG.wallPoolSize);
  assert.ok(game.walls.every(w => !w.scored && !w.correct && !w.open && w.lockedLane === null));
});

test('movement and scoring are equivalent at 30, 60, and 144 FPS', () => {
  const games = [30, 60, 144].map(fps => {
    const game = new GameEngine(rng(88)); game.start(1); game.select(game.activeWall.question!.correctLane);
    advance(game, 9.5, fps); return game;
  });
  for (const game of games) {
    assert.equal(game.score, 1); assert.ok(Math.abs(game.elapsed - games[0].elapsed) < 1e-8);
    assert.ok(Math.abs(game.distance - games[0].distance) < 1e-8);
  }
});

test('a long perfect run reuses the same wall objects and never exposes two problems ahead', () => {
  const game = new GameEngine(rng(7)); game.start(1); const references = [...game.walls];
  for (let i = 0; i < 60 * 600; i++) {
    const wall = game.activeWall;
    if (wall.question && !game.locked) game.select(wall.question.correctLane);
    game.update(1 / 60);
    assert.equal(game.walls.filter(w => !w.scored && w.question).length, 1);
  }
  assert.equal(game.state, 'playing'); assert.ok(game.score > 90); assert.equal(game.multiplier, 1.8);
  assert.equal(game.walls.length, 3); game.walls.forEach((wall, i) => assert.equal(wall, references[i]));
});
