import { CONFIG } from "./config.js";

export class AudioManager {
  constructor(enabled) { this.enabled = enabled; this.context = null; this.engine = null; }

  unlock() {
    if (!this.context) this.context = new (window.AudioContext || window.webkitAudioContext)();
    if (this.context.state === "suspended") this.context.resume();
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled) this.stopEngine();
  }

  tone(frequency, duration, type = "sine", volume = 0.08) {
    if (!this.enabled || !this.context) return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    gain.gain.setValueAtTime(volume * CONFIG.audio.master, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain).connect(this.context.destination);
    oscillator.start(now);
    oscillator.stop(now + duration);
  }

  collect() { this.tone(620, 0.22, "sine", 0.52); setTimeout(() => this.tone(880, 0.18, "sine", 0.35), 55); }
  button() { this.tone(280, 0.08, "triangle", 0.3); }
  bump() { this.tone(115, 0.42, "sine", 0.45); }

  startEngine() {
    if (!this.enabled || !this.context || this.engine) return;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = "sawtooth";
    oscillator.frequency.value = 54;
    gain.gain.value = CONFIG.audio.propeller * CONFIG.audio.master;
    oscillator.connect(gain).connect(this.context.destination);
    oscillator.start();
    this.engine = { oscillator, gain };
  }

  stopEngine() {
    if (!this.engine) return;
    this.engine.oscillator.stop();
    this.engine = null;
  }
}
