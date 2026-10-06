import * as THREE from 'three';
import { CONFIG } from './config';
import type { GameEngine, Wall } from './engine';

const palette = { ink: 0x314748, track: 0xf4ecd9, edge: 0xddc9a9, mint: 0x72bba3, deepMint: 0x499680, door: 0xf2a376, trim: 0xffd0a4, lavender: 0xa598c7, sky: 0xe5efea };
const mat = (color: number, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: .85, flatShading: true, ...extra });
const unitBox = new THREE.BoxGeometry(1, 1, 1);
const ball = new THREE.IcosahedronGeometry(1, 1);
function box(parent: THREE.Object3D, material: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number) {
  const mesh = new THREE.Mesh(unitBox, material); mesh.position.set(x, y, z); mesh.scale.set(w, h, d);
  mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
function orb(parent: THREE.Object3D, material: THREE.Material, x: number, y: number, z: number, sx: number, sy = sx, sz = sx) {
  const mesh = new THREE.Mesh(ball, material); mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz); mesh.castShadow = true; parent.add(mesh); return mesh;
}
function label(width: number, height: number, fontSize: number) {
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width / 160, height / 160), new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }));
  const set = (text: string) => {
    ctx.clearRect(0, 0, width, height); ctx.fillStyle = '#314748';
    ctx.font = `800 ${fontSize}px "Segoe UI", Arial, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, width / 2, height / 2 + 2); texture.needsUpdate = true;
  };
  return { mesh, set };
}

class Gate {
  group = new THREE.Group();
  private pivots: THREE.Group[] = [];
  private equation = label(1024, 220, 135);
  private answers = [label(360, 180, 138), label(360, 180, 138)];
  private textKey = '';
  private line: THREE.Mesh;
  constructor(scene: THREE.Scene) {
    scene.add(this.group);
    const body = mat(palette.mint), trim = mat(palette.trim), door = mat(palette.door), inlay = mat(0xe99467), detail = mat(0xfad8b3), brass = mat(0xffecc5, { metalness: .15 });
    for (const x of [-4.6, 0, 4.6]) {
      box(this.group, body, x, 2.45, 0, x === 0 ? .72 : .8, 4.9, .9);
      box(this.group, mat(palette.deepMint), x, .17, .08, x === 0 ? .86 : .94, .34, 1.05);
    }
    box(this.group, body, 0, 4.72, 0, 10, 1.3, .9);
    box(this.group, mat(0x8dcbb4), 0, 5.42, 0, 10.5, .24, 1.13);
    box(this.group, mat(0xfff8e8), 0, 5.62, .52, 6.55, 1.4, .19);
    this.equation.mesh.position.set(0, 5.62, .63); this.group.add(this.equation.mesh);
    for (let lane = 0; lane < 2; lane++) {
      const x = lane === 0 ? -CONFIG.laneX : CONFIG.laneX;
      box(this.group, trim, x - 1.69, 1.94, .56, .18, 3.88, .2);
      box(this.group, trim, x + 1.69, 1.94, .56, .18, 3.88, .2);
      box(this.group, trim, x, 3.86, .56, 3.56, .18, .2);
      box(this.group, mat(0xfff8e8), x, 4.63, .52, 2.55, 1.06, .18);
      this.answers[lane].mesh.position.set(x, 4.63, .64); this.group.add(this.answers[lane].mesh);
      const pivot = new THREE.Group(); pivot.position.set(x - 1.6, 0, .06);
      box(pivot, door, 1.6, 1.91, 0, 3.2, 3.82, .23);
      for (const y of [1.15, 2.7]) {
        box(pivot, detail, 1.6, y, .135, 2.65, 1.2, .065);
        box(pivot, inlay, 1.6, y, .18, 2.4, .97, .035);
      }
      orb(pivot, brass, 2.91, 1.95, .29, .11);
      this.group.add(pivot); this.pivots.push(pivot);
    }
    this.line = box(this.group, mat(0xebc56a, { transparent: true, opacity: .7 }), 0, .035, CONFIG.decisionDistance, 9.6, .035, .18);
  }
  sync(wall: Wall, active: boolean) {
    // Once behind the runner, remove the wall from view so it cannot occlude the chase camera.
    this.group.visible = !wall.scored;
    this.group.position.z = 4 - wall.distance;
    const key = wall.question?.key ?? '';
    if (key !== this.textKey) {
      this.textKey = key;
      this.equation.set(wall.question ? `${wall.question.text} = ?` : '');
      this.answers.forEach((answer, i) => answer.set(wall.question ? String(wall.question.options[i]) : ''));
    }
    this.line.visible = active && wall.lockedLane === null;
    this.pivots.forEach((pivot, lane) => {
      const amount = lane === wall.lockedLane && wall.correct ? wall.open : 0;
      const eased = 1 - Math.pow(1 - amount, 3);
      pivot.rotation.y = -eased * Math.PI * .53;
    });
  }
}

export class World {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(43, 1, .1, 190);
  private gates: Gate[] = [];
  private runner = new THREE.Group();
  private body = new THREE.Group();
  private legs: THREE.Group[] = [];
  private arms: THREE.Group[] = [];
  private floorMarks: THREE.Mesh[] = [];
  private scenery: THREE.Group[] = [];
  private clouds: THREE.Group[] = [];
  private particles: { mesh: THREE.Mesh; velocity: THREE.Vector3; life: number }[] = [];
  private demoDistance = 0;
  private clock = 0;
  private resizeObserver: ResizeObserver;
  private wasMenu = true;
  constructor(private host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, CONFIG.maxPixelRatio));
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.25;
    this.renderer.domElement.setAttribute('aria-label', 'Хоёр хаалгатай зам дээр гүйж буй 3D дүр');
    this.host.prepend(this.renderer.domElement);
    this.scene.background = new THREE.Color(palette.sky);
    this.scene.fog = new THREE.Fog(palette.sky, 38, 118);
    this.scene.add(new THREE.HemisphereLight(0xfffbeb, 0x739e92, 2.7));
    const sun = new THREE.DirectionalLight(0xffefd7, 3.8); sun.position.set(-14, 30, 15);
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.camera.left = -24; sun.shadow.camera.right = 24;
    sun.shadow.camera.top = 26; sun.shadow.camera.bottom = -40; sun.shadow.camera.far = 90;
    sun.shadow.normalBias = .04; this.scene.add(sun); sun.target.position.set(0, 0, -15); this.scene.add(sun.target);
    this.makeEnvironment(); this.makeRunner();
    this.gates = Array.from({ length: CONFIG.wallPoolSize }, () => new Gate(this.scene));
    const confettiGeometry = new THREE.OctahedronGeometry(.12);
    const colors = [0xf6c65b, 0xf29b78, 0xa698d0, 0x76c5ae];
    for (let i = 0; i < 28; i++) {
      const mesh = new THREE.Mesh(confettiGeometry, mat(colors[i % colors.length])); mesh.visible = false; this.scene.add(mesh);
      this.particles.push({ mesh, velocity: new THREE.Vector3(), life: 0 });
    }
    this.resizeObserver = new ResizeObserver(() => this.resize()); this.resizeObserver.observe(host); this.resize();
  }
  private resize() {
    const w = this.host.clientWidth, h = this.host.clientHeight;
    this.renderer.setSize(w, h); this.camera.aspect = w / Math.max(h, 1);
    this.camera.fov = w / Math.max(h, 1) < .8 ? 57 : 43;
    this.camera.updateProjectionMatrix();
  }
  private makeEnvironment() {
    const track = mat(palette.track), edge = mat(palette.edge), white = mat(0xfffcf0);
    box(this.scene, edge, 0, -.48, -57, 11.2, .9, 142);
    box(this.scene, track, 0, -.05, -57, 10.8, .22, 142);
    for (const x of [-5.15, 5.15]) {
      box(this.scene, white, x, .03, -57, .14, .03, 142);
      box(this.scene, mat(palette.mint), x * 1.075, -.07, -57, .2, .27, 142);
    }
    const laneMark = mat(0xc0ccb1);
    for (let i = 0; i < 40; i++) this.floorMarks.push(box(this.scene, laneMark, 0, .08, -i * 3.5, .095, .018, 1.35));
    const greens = [mat(0x8ec6a0), mat(0xa7ceb0), mat(0x6eaa91)], trunk = mat(0xbc9671), rock = mat(0xc9c8b8);
    for (let i = 0; i < 24; i++) {
      const group = new THREE.Group(), side = i % 2 === 0 ? -1 : 1;
      group.position.set(side * (7.6 + (i % 3) * 2.4), -.15, 10 - i * 6);
      const scale = .85 + (i % 4) * .17; group.scale.setScalar(scale);
      orb(group, greens[(i + 1) % 3], 0, -.35, 0, 2.2, .65, 2.2);
      if (i % 3 !== 1) {
        box(group, trunk, 0, 1.45, 0, .27, 2.8, .3);
        orb(group, greens[i % 3], 0, 3.1, 0, 1.35, 1.6, 1.2);
        orb(group, greens[(i + 1) % 3], -.7, 2.6, .25, .85, 1, .9);
      } else {
        orb(group, rock, .5, .25, 0, .8, .65, .7);
        orb(group, greens[i % 3], -.65, .48, .3, .9, .7, .8);
      }
      if (i % 2 === 0) {
        box(group, greens[0], -1, .35, .6, .045, .7, .045);
        orb(group, mat(0xf6c76b), -1, .75, .6, .18);
      }
      this.scene.add(group); this.scenery.push(group);
    }
    const cloudMat = mat(0xffffff);
    for (let i = 0; i < 9; i++) {
      const cloud = new THREE.Group(); cloud.position.set((i % 2 ? -1 : 1) * (13 + i * 2), 9 + i % 3 * 2, -12 - i * 11);
      orb(cloud, cloudMat, 0, 0, 0, 2.6, .85, 1);
      orb(cloud, cloudMat, -.8, .6, 0, 1.2, 1, .9);
      orb(cloud, cloudMat, 1, .35, 0, 1.5, .9, 1);
      this.scene.add(cloud); this.clouds.push(cloud);
    }
  }
  private makeRunner() {
    const skin = mat(0xffce9c), shirt = mat(0xf4b955), shorts = mat(0x4c7471), shoe = mat(0xfff4de), hair = mat(0x795044), pack = mat(0x809ac5), hat = mat(0xed986c);
    this.scene.add(this.runner); this.runner.add(this.body); this.runner.position.set(-CONFIG.laneX, 0, 4);
    box(this.body, shirt, 0, 1.35, 0, .74, .83, .49);
    orb(this.body, skin, 0, 2.12, -.03, .49, .53, .45);
    orb(this.body, hair, 0, 2.32, .06, .51, .4, .44);
    box(this.body, hair, 0, 2.12, .36, .78, .39, .16);
    orb(this.body, hat, 0, 2.49, .02, .57, .24, .53);
    box(this.body, hat, 0, 2.4, -.34, .85, .08, .55);
    for (const side of [-1, 1]) {
      orb(this.body, skin, side * .49, 2.09, 0, .12, .16, .12);
      const leg = new THREE.Group(); leg.position.set(side * .22, 1.02, 0);
      box(leg, shorts, 0, -.2, 0, .29, .48, .34);
      box(leg, skin, 0, -.51, 0, .22, .35, .23);
      box(leg, shoe, 0, -.74, -.1, .31, .2, .5);
      box(leg, mat(0xdb8c68), 0, -.83, -.1, .32, .07, .51);
      this.body.add(leg); this.legs.push(leg);
      const arm = new THREE.Group(); arm.position.set(side * .48, 1.67, 0);
      box(arm, shirt, 0, -.13, 0, .24, .34, .3);
      box(arm, skin, 0, -.4, 0, .18, .32, .21);
      orb(arm, skin, 0, -.6, -.025, .12);
      this.body.add(arm); this.arms.push(arm);
    }
    box(this.body, pack, 0, 1.4, .38, .61, .66, .3);
    box(this.body, mat(0xa4b6d7), 0, 1.27, .56, .4, .25, .1);
    for (const x of [-.3, .3]) box(this.body, mat(0x647fa7), x, 1.54, .21, .09, .64, .12);
  }
  reset() {
    this.runner.position.set(-CONFIG.laneX, 0, 4); this.runner.rotation.set(0, 0, 0); this.body.rotation.set(0, 0, 0);
    [...this.arms, ...this.legs].forEach(limb => limb.rotation.set(0, 0, 0));
    for (const particle of this.particles) { particle.life = 0; particle.mesh.visible = false; }
  }
  celebrate() {
    for (const particle of this.particles) {
      particle.life = .7 + Math.random() * .6; particle.mesh.visible = true;
      particle.mesh.position.set(this.runner.position.x, 1.6, 3);
      particle.velocity.set((Math.random() - .5) * 6, 2 + Math.random() * 4, (Math.random() - .5) * 5);
    }
  }
  render(engine: GameEngine, dt: number) {
    const menu = engine.state === 'menu', active = engine.state === 'playing', falling = engine.state === 'falling' || engine.state === 'gameover';
    const moving = menu || active;
    if (moving) this.clock += dt * (menu ? 1 : engine.multiplier);
    if (menu) this.demoDistance += dt * 1.4;
    const travel = menu ? this.demoDistance : engine.distance;
    this.floorMarks.forEach((mark, i) => { mark.position.z = 12 - ((i * 3.5 - travel) % 140 + 140) % 140; });
    this.scenery.forEach((group, i) => { group.position.z = 15 - ((i * 6 - travel) % 144 + 144) % 144; });
    this.clouds.forEach((cloud, i) => { cloud.position.y = 10 + i % 3 * 2 + Math.sin(this.clock * .18 + i) * .2; });
    if (menu) {
      this.gates.forEach((gate, i) => gate.sync({ id: i, distance: 16 + i * CONFIG.wallSpacing,
        question: i === 0 ? { a: 7, b: 5, operator: '+', answer: 12, options: [12, 10], correctLane: 0, key: 'demo', text: '7 + 5' } : null,
        lockedLane: null, correct: false, scored: false, open: 0 }, false));
    } else this.gates.forEach((gate, i) => gate.sync(engine.walls[i], engine.activeWall?.id === i));
    if (this.wasMenu !== menu) { this.reset(); this.wasMenu = menu; }
    const targetX = (menu ? -1 : engine.lane === 0 ? -1 : 1) * CONFIG.laneX;
    if (moving) this.runner.position.x = THREE.MathUtils.damp(this.runner.position.x, targetX, CONFIG.laneSmoothing, dt);
    if (moving) {
      const cycle = this.clock * 11;
      this.body.position.y = .04 + Math.abs(Math.sin(cycle)) * .1;
      this.body.rotation.set(-.07, 0, Math.sin(cycle) * .035);
      this.runner.rotation.set(0, 0, (this.runner.position.x - targetX) * .055);
      this.runner.position.y = 0; this.runner.position.z = 4;
      this.legs.forEach((leg, i) => leg.rotation.x = Math.sin(cycle + i * Math.PI) * .68);
      this.arms.forEach((arm, i) => arm.rotation.x = -Math.sin(cycle + i * Math.PI) * .66);
    } else if (falling) {
      const t = Math.min(1, engine.fallTime / .7), ease = 1 - Math.pow(1 - t, 3);
      this.runner.rotation.x = ease * Math.PI * .43;
      this.runner.rotation.z = ease * .2;
      this.runner.position.y = Math.sin(t * Math.PI) * .35 + ease * .24;
      this.runner.position.z = 4 + ease * 1.1;
      this.arms[0].rotation.z = -ease * .8; this.arms[1].rotation.z = ease * .8;
    }
    if (engine.state !== 'paused') for (const particle of this.particles) {
      if (particle.life <= 0) continue;
      particle.life -= dt; particle.mesh.visible = particle.life > 0;
      particle.velocity.y -= dt * 7; particle.mesh.position.addScaledVector(particle.velocity, dt);
      particle.mesh.rotation.x += dt * 3; particle.mesh.rotation.z += dt * 2;
    }
    const portrait = this.camera.aspect < .8;
    this.camera.position.set(menu ? 10 : 0, menu ? 10 : portrait ? 12 : 11, menu ? 23 : portrait ? 22 : 21);
    this.camera.lookAt(0, menu ? 1.5 : portrait ? 1.2 : 0, menu ? -7 : portrait ? -15 : -10);
    this.renderer.render(this.scene, this.camera);
  }
  /** Fixed allocations make the wall/particle pools inspectable in browser acceptance tests. */
  stats() { return { ...this.renderer.info.memory, calls: this.renderer.info.render.calls, gates: this.gates.length, particles: this.particles.length }; }
}
