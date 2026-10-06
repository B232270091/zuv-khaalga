import './style.css';
import { CONFIG, GRADES, type Grade, type Lane } from './config';
import { GameEngine } from './engine';
import { World } from './world';
import { GameAudio } from './audio';
import { bestFor, read, saveBest, write } from './storage';

const icons = {
  door: '<path d="M5 21V3h14v18M10 21V7l9-4M10 21h11M15 12v2"/>',
  sound: '<path d="M11 5 6 9H3v6h3l5 4V5ZM15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14"/>',
  mute: '<path d="M11 5 6 9H3v6h3l5 4V5ZM16 9l5 6M21 9l-5 6"/>',
  trophy: '<path d="M8 3h8v6a4 4 0 0 1-8 0V3ZM8 5H4v3a4 4 0 0 0 5 4M16 5h4v3a4 4 0 0 1-5 4M12 13v5M8 21h8M9 18h6"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z"/>',
  pause: '<path d="M9 5v14M15 5v14"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 4 2c-1.5 1-1.5 1.5-1.5 2M12 16h.01"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
};
const icon = (name: keyof typeof icons, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
  <header class="header">
    <button class="brand" id="brand" aria-label="Зөв хаалга — үндсэн цэс"><span class="brand-mark">${icon('door')}</span><span>Зөв хаалга<span class="brand-sub">БОД. СОНГО. ГҮЙ!</span></span></button>
    <span class="header-note">Жижиг бодлого, том адал явдал.</span>
    <div class="header-actions"><button class="quiet-button" id="help">${icon('help')}<span>Заавар</span></button><span class="header-divider"></span><button class="icon-button" id="sound" aria-label="Дууг унтраах" aria-pressed="true">${icon('sound')}</button></div>
  </header>
  <main>
    <section id="menu" class="menu" aria-labelledby="title">
      <div class="eyebrow"><span class="little-star">✦</span> МАТЕМАТИКИЙН АДАЛ ЯВДАЛ</div>
      <h1 id="title">Зөв бодоод,<br><span>урагшаа гүй!</span></h1>
      <p class="intro">Бодлогоо бод. Зөв хаалгаа сонго.<br>Хөгжилтэй аяллаа эхлүүлэхэд бэлэн үү?</p>
      <div class="grade-label"><h2>Ангиа сонгоорой</h2><span>01 — 03</span></div>
      <div class="grades" role="group" aria-label="Анги сонгох">
        ${([1, 2, 3] as Grade[]).map(grade => `<button class="grade-card" data-grade="${grade}" aria-pressed="${grade === 1}"><span class="grade-symbol grade-${grade}">${GRADES[grade].symbol}</span><span class="grade-copy"><strong>${GRADES[grade].title}</strong><span>${GRADES[grade].description}</span></span><span class="grade-radio">${icon('check')}</span></button>`).join('')}
      </div>
      <button id="play" class="primary-button play-button"><span>Тоглох</span>${icon('arrow')}</button>
      <div class="personal-best">${icon('trophy')}<span>Миний дээд амжилт</span><strong id="menu-best">0</strong><span>оноо</span></div>
    </section>
    <div id="scene-wrap" class="scene-wrap">
      <div class="scene-tag home-only"><span></span> Суралцах хамгийн хөгжилтэй зам</div>
      <div class="scene-spark spark-one home-only">✦</div><div class="scene-spark spark-two home-only">+</div>
      <div class="adventure-note home-only"><span class="note-icon">${icon('star')}</span><span><strong>Хаалга бүр нэг боломж</strong><small>Өөрийгөө сориод үзээрэй!</small></span></div>
      <div id="render-error" class="render-error" hidden><strong>3D дүрслэл ассангүй</strong><p>WebGL 2 дэмждэг браузер ашиглаад, графикийн хурдатгалыг асааж дахин ачаалаарай.</p><button id="reload" class="primary-button">Дахин ачаалах</button></div>
    </div>
    <section id="game-ui" class="game-ui" hidden aria-label="Тоглоомын удирдлага">
      <div class="hud">
        <div class="hud-left"><div class="score-box">${icon('star')}<span><small>ОНОО</small><strong id="score">0</strong></span></div><div class="stat-box">${icon('clock')}<span id="time">00:00</span></div><div class="speed-box"><span class="speed-bars"><i></i><i></i><i></i><i></i></span><span id="speed">1.00×</span></div></div>
        <button id="pause" class="icon-button pause-button" aria-label="Түр зогсоох">${icon('pause')}</button>
      </div>
      <div class="question-card" id="question-card"><div class="question-heading"><span id="question-index">БОДЛОГО 01</span><span id="remaining">7.6 сек</span></div><div id="question" class="equation">7 + 5 <span>= ?</span></div><div class="time-track"><div id="time-fill"></div></div></div>
      <div class="feedback" id="feedback" role="status" aria-live="polite"></div>
      <div class="controls-wrap"><div class="lane-status" id="lane-status">Зөв хариутай хаалгаа сонгоорой</div><div class="lane-controls"><button class="lane-button" id="left" aria-label="Зүүн эгнээ">${icon('arrow', 'left-arrow')}<span id="left-answer">12</span><kbd>← / A</kbd></button><button class="lane-button" id="right" aria-label="Баруун эгнээ"><kbd>→ / D</kbd><span id="right-answer">10</span>${icon('arrow')}</button></div><div class="controls-hint">Сумтай товч • A / D • Дэлгэц дээр шудрах</div></div>
    </section>
  </main>
  <footer class="footer"><span><span class="footer-dot"></span> Тоглонгоо суръя</span><span>1–3-р ангийн бяцхан аялагчдад зориулав</span><span>Өдөр бүр нэг алхам урагш ${icon('arrow')}</span></footer>
  <dialog id="instructions" class="modal"><button class="close-modal" id="close-help" aria-label="Зааврыг хаах">×</button><span class="modal-symbol lavender">${icon('help')}</span><span class="eyebrow">БЭЛЭН, БОДООД, ГҮЙ!</span><h2>Яаж тоглох вэ?</h2><ol class="instructions-list"><li><span>1</span><div><strong>Бодлогоо бодоорой</strong><p>Ханын дээрх бодлогыг бодоод хоёр хариуг хараарай.</p></div></li><li><span>2</span><div><strong>Зөв хаалгаа сонгоорой</strong><p>← → эсвэл A / D дарж эгнээгээ солино. Утсан дээр шудрах эсвэл доод товчийг дараарай.</p></div></li><li><span>3</span><div><strong>Урагшаа гүйгээрэй!</strong><p>Шар шугамд хүрэхэд сонголт түгжинэ. Зөв хаалга нээгдэж, нэг оноо нэмэгдэнэ.</p></div></li></ol><p class="help-footnote">P / Esc — түр зогсоох. Өөр таб руу шилжихэд тоглоом автоматаар түр зогсоно.</p><button id="got-it" class="primary-button">Ойлголоо ${icon('check')}</button></dialog>
  <dialog id="pause-dialog" class="modal compact"><span class="modal-symbol mint">${icon('pause')}</span><span class="eyebrow">ЖААХАН АМРААД АВААРАЙ</span><h2>Түр завсарлага</h2><p>Бэлэн болохоороо аяллаа үргэлжлүүлээрэй.</p><button id="resume" class="primary-button">Үргэлжлүүлэх ${icon('arrow')}</button><button id="pause-menu" class="secondary-button">Үндсэн цэс</button></dialog>
  <dialog id="end-dialog" class="modal compact"><span class="modal-symbol peach">${icon('star')}</span><span class="eyebrow" id="end-eyebrow">ОРОЛДЛОГО БҮР АМЖИЛТ</span><h2>Дахиад оролдоод<br>үзээрэй!</h2><div class="result-stats"><div><span>Авсан оноо</span><strong id="end-score">0</strong></div><div><span>Дээд амжилт</span><strong id="end-best">0</strong></div></div><div class="correction"><span>Хамтдаа бодоод үзье</span><strong id="correction"></strong></div><button id="restart" class="primary-button">Дахин тоглох ${icon('arrow')}</button><button id="end-menu" class="secondary-button">Үндсэн цэс</button></dialog>
`;

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const engine = new GameEngine(), audio = new GameAudio();
let grade: Grade = [1, 2, 3].includes(Number(read('zuv-khaalga-grade', '1'))) ? Number(read('zuv-khaalga-grade', '1')) as Grade : 1;
let world: World | null = null;
try { world = new World($('scene-wrap')); }
catch (error) { console.error('3D initialization failed', error); $('render-error').hidden = false; $<HTMLButtonElement>('play').disabled = true; }
const pauseDialog = $<HTMLDialogElement>('pause-dialog'), endDialog = $<HTMLDialogElement>('end-dialog'), instructions = $<HTMLDialogElement>('instructions');
let feedbackTime = 0;
let helpWasPlaying = false;
const formatTime = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

function selectGrade(value: Grade) {
  grade = value; write('zuv-khaalga-grade', String(grade));
  document.querySelectorAll<HTMLButtonElement>('[data-grade]').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.grade) === grade)));
  $('menu-best').textContent = String(bestFor(grade));
}
function soundUI() {
  $('sound').innerHTML = icon(audio.enabled ? 'sound' : 'mute');
  $('sound').setAttribute('aria-label', audio.enabled ? 'Дууг унтраах' : 'Дууг асаах');
  $('sound').setAttribute('aria-pressed', String(audio.enabled));
}
function start() {
  if (!world) return;
  pauseDialog.close(); endDialog.close(); instructions.close();
  app.dataset.mode = 'game'; $('menu').hidden = true; $('game-ui').hidden = false;
  $('feedback').textContent = ''; feedbackTime = 0;
  world.reset(); audio.reset(); void audio.unlock(); audio.wake();
  engine.start(grade); updateUI();
  // Clear keyboard focus so Space/Enter cannot accidentally restart a running game.
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
}
function menu() {
  engine.menu(); audio.hush(); pauseDialog.close(); endDialog.close(); instructions.close();
  app.dataset.mode = 'menu'; $('menu').hidden = false; $('game-ui').hidden = true;
  selectGrade(grade); world?.reset(); $('play').focus();
}
function pause() {
  if (engine.state !== 'playing' && engine.state !== 'falling') return;
  engine.pause(); audio.hush(); pauseDialog.showModal();
}
function resume() { pauseDialog.close(); engine.resume(); audio.wake(); void audio.unlock(); }
function choose(lane: Lane) { if (engine.select(lane)) { audio.move(); updateUI(); } }
function updateUI() {
  $('score').textContent = String(engine.score); $('time').textContent = formatTime(engine.elapsed);
  $('speed').textContent = `${engine.multiplier.toFixed(2)}×`;
  document.querySelectorAll<HTMLElement>('.speed-bars i').forEach((bar, i) => bar.classList.toggle('lit', i <= Math.floor((engine.multiplier - 1) / .25)));
  const wall = engine.activeWall, question = wall?.question;
  $('question-card').hidden = !question;
  if (question) {
    $('question').innerHTML = `${question.text} <span>= ?</span>`;
    $('question-index').textContent = `БОДЛОГО ${String(engine.score + 1).padStart(2, '0')}`;
    $('remaining').textContent = engine.locked ? 'Сонгосон' : `${engine.secondsLeft.toFixed(1)} сек`;
    $('left-answer').textContent = String(question.options[0]); $('right-answer').textContent = String(question.options[1]);
    $('left').setAttribute('aria-label', `Зүүн эгнээ: ${question.options[0]}`); $('right').setAttribute('aria-label', `Баруун эгнээ: ${question.options[1]}`);
    $('time-fill').style.transform = `scaleX(${Math.max(0, Math.min(1, (wall.distance - CONFIG.decisionDistance) / (CONFIG.revealDistance - CONFIG.decisionDistance)))})`;
  } else { $('left-answer').textContent = '…'; $('right-answer').textContent = '…'; }
  $('lane-status').textContent = engine.locked ? 'Сонголт баталгаажлаа' : 'Зөв хариутай хаалгаа сонгоорой';
  (['left', 'right'] as const).forEach((id, i) => {
    $(id).setAttribute('aria-pressed', String(engine.lane === i));
    $<HTMLButtonElement>(id).disabled = engine.locked || engine.state !== 'playing';
  });
}
engine.onEvent = event => {
  if (event.type === 'score') {
    saveBest(grade, engine.score); audio.correct(); world?.celebrate();
    $('feedback').textContent = ['Мундаг байна! +1', 'Яг зөв! +1', 'Сайн бодлоо! +1'][engine.score % 3]; feedbackTime = 1.4;
    $('score').animate([{ transform: 'scale(1.3)' }, { transform: 'scale(1)' }], { duration: 300 });
  }
  if (event.type === 'collision') { audio.bump(); $('feedback').textContent = 'Зүгээр ээ, хамтдаа бодъё!'; feedbackTime = 2; }
  if (event.type === 'gameover') {
    const oldBest = bestFor(grade), best = saveBest(grade, engine.score);
    $('end-score').textContent = String(engine.score); $('end-best').textContent = String(best);
    $('end-eyebrow').textContent = engine.score > 0 && engine.score >= oldBest ? 'САЙН БАЙНА, БЯЦХАН АЯЛАГЧ АА!' : 'ОРОЛДЛОГО БҮР АМЖИЛТ';
    $('correction').textContent = `${engine.missed!.text} = ${engine.missed!.answer}`;
    audio.hush(); endDialog.showModal();
  }
};

document.querySelectorAll<HTMLButtonElement>('[data-grade]').forEach(button => button.addEventListener('click', () => selectGrade(Number(button.dataset.grade) as Grade)));
$('play').addEventListener('click', start); $('restart').addEventListener('click', start);
$('pause').addEventListener('click', pause); $('resume').addEventListener('click', resume);
$('pause-menu').addEventListener('click', menu); $('end-menu').addEventListener('click', menu);
$('brand').addEventListener('click', () => { if (engine.state === 'playing' || engine.state === 'falling') pause(); else if (engine.state !== 'menu') menu(); });
$('sound').addEventListener('click', () => { audio.toggle(); soundUI(); });
$('reload').addEventListener('click', () => location.reload());
$('help').addEventListener('click', () => {
  helpWasPlaying = engine.state === 'playing' || engine.state === 'falling';
  if (helpWasPlaying) { engine.pause(); audio.hush(); }
  instructions.showModal();
});
const closeHelp = () => instructions.close();
$('close-help').addEventListener('click', closeHelp); $('got-it').addEventListener('click', closeHelp);
instructions.addEventListener('close', () => { if (helpWasPlaying) { helpWasPlaying = false; pauseDialog.showModal(); } });
pauseDialog.addEventListener('cancel', event => { event.preventDefault(); resume(); });
endDialog.addEventListener('cancel', event => event.preventDefault());
$('left').addEventListener('pointerdown', event => { event.preventDefault(); choose(0); });
$('right').addEventListener('pointerdown', event => { event.preventDefault(); choose(1); });
// Keyboard activation for the visible touch buttons (pointerdown handles touch/mouse).
$('left').addEventListener('click', event => { if (event.detail === 0) choose(0); });
$('right').addEventListener('click', event => { if (event.detail === 0) choose(1); });
document.addEventListener('keydown', event => {
  if (instructions.open || endDialog.open || event.ctrlKey || event.altKey || event.metaKey) return;
  const key = event.key.toLowerCase();
  if (key === 'p' || key === 'escape') {
    if (event.repeat) return;
    if (engine.state === 'paused') { event.preventDefault(); resume(); }
    else if (engine.state === 'playing' || engine.state === 'falling') { event.preventDefault(); pause(); }
  }
  if (engine.state !== 'playing') return;
  if (key === 'arrowleft' || key === 'a') { event.preventDefault(); choose(0); }
  if (key === 'arrowright' || key === 'd') { event.preventDefault(); choose(1); }
});
let swipeStart: { x: number; y: number; id: number } | null = null;
$('scene-wrap').addEventListener('pointerdown', event => {
  if (engine.state !== 'playing') return;
  swipeStart = { x: event.clientX, y: event.clientY, id: event.pointerId };
  if (event.isTrusted) $('scene-wrap').setPointerCapture(event.pointerId);
});
$('scene-wrap').addEventListener('pointerup', event => {
  if (!swipeStart || swipeStart.id !== event.pointerId) return;
  const dx = event.clientX - swipeStart.x, dy = event.clientY - swipeStart.y;
  if (Math.abs(dx) >= CONFIG.swipeThreshold && Math.abs(dx) > Math.abs(dy)) choose(dx < 0 ? 0 : 1);
  swipeStart = null;
});
$('scene-wrap').addEventListener('pointercancel', () => { swipeStart = null; });
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
window.addEventListener('blur', pause);
selectGrade(grade); soundUI(); app.dataset.mode = 'menu';
let previousTime = performance.now();
function frame(now: number) {
  const delta = Math.min((now - previousTime) / 1000, CONFIG.maxFrameDelta); previousTime = now;
  engine.update(delta);
  if (engine.state !== 'menu') updateUI();
  if (feedbackTime > 0 && engine.state !== 'paused') { feedbackTime -= delta; if (feedbackTime <= 0) $('feedback').textContent = ''; }
  audio.update(engine.elapsed, engine.state === 'playing'); world?.render(engine, delta);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Read-only diagnostics in development; no answers or state controls in production.
if (import.meta.env.DEV) Object.defineProperty(window, '__gameSnapshot', { value: () => ({
  state: engine.state, grade: engine.grade, lane: engine.lane, score: engine.score,
  elapsed: engine.elapsed, multiplier: engine.multiplier, locked: engine.locked,
  walls: engine.walls.map(w => ({ ...w, question: w.question ? { ...w.question } : null })),
  renderer: world?.stats(),
}) });
