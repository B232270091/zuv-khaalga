import { read, write } from './storage';

/** Original synthesized sounds: no downloads, music files, or paid assets. */
export class GameAudio {
  enabled = read('zuv-khaalga-sound', 'true') === 'true';
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private nextNote = 0;
  private noteIndex = 0;
  async unlock() {
    if (!this.enabled) return;
    try {
      if (!this.context) {
        this.context = new AudioContext(); this.master = this.context.createGain();
        this.master.gain.value = .24; this.master.connect(this.context.destination);
      }
      if (this.context.state === 'suspended') await this.context.resume();
    } catch { /* Audio support is optional. */ }
  }
  toggle() {
    this.enabled = !this.enabled;
    write('zuv-khaalga-sound', String(this.enabled));
    if (this.master && this.context) this.master.gain.setTargetAtTime(this.enabled ? .24 : 0, this.context.currentTime, .03);
    if (this.enabled) void this.unlock();
  }
  private tone(frequency: number, duration: number, delay = 0, volume = .18, type: OscillatorType = 'sine') {
    if (!this.enabled || !this.context || !this.master) return;
    const at = this.context.currentTime + delay;
    const oscillator = this.context.createOscillator(), envelope = this.context.createGain();
    oscillator.type = type; oscillator.frequency.value = frequency;
    envelope.gain.setValueAtTime(0, at);
    envelope.gain.linearRampToValueAtTime(volume, at + .025);
    envelope.gain.exponentialRampToValueAtTime(.0001, at + duration);
    oscillator.connect(envelope); envelope.connect(this.master);
    oscillator.start(at); oscillator.stop(at + duration + .03);
    oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); };
  }
  correct() { [523.25, 659.25, 783.99].forEach((frequency, i) => this.tone(frequency, .4, i * .1, .25, 'triangle')); }
  bump() { this.tone(160, .25, 0, .2, 'triangle'); this.tone(120, .35, .13, .12); }
  move() { this.tone(420, .09, 0, .07); }
  reset() { this.nextNote = 0; this.noteIndex = 0; }
  update(elapsed: number, playing: boolean) {
    if (!playing || !this.enabled || elapsed < this.nextNote) return;
    const melody = [261.63, 329.63, 392, 329.63, 293.66, 349.23, 440, 392];
    this.tone(melody[this.noteIndex++ % melody.length], 1.5, 0, .045);
    this.nextNote = elapsed + 1.8;
  }
  hush() {
    if (this.context && this.master) this.master.gain.setTargetAtTime(0, this.context.currentTime, .05);
  }
  wake() {
    if (this.context && this.master) this.master.gain.setTargetAtTime(this.enabled ? .24 : 0, this.context.currentTime, .05);
  }
}
