import { CONFIG, clamp } from "./config.js";
import { Plane } from "./Plane.js";
import { InputController } from "./InputController.js";
import { ParallaxBackground } from "./ParallaxBackground.js";
import { ObstacleManager } from "./ObstacleManager.js";
import { CollectibleManager } from "./CollectibleManager.js";
import { ParticleSystem } from "./ParticleSystem.js";
import { AudioManager } from "./AudioManager.js";
import { UIManager } from "./UIManager.js";
import { StorageManager } from "./StorageManager.js";

export class Game {
  constructor(canvas, assets) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });
    this.assets = assets;
    this.storage = new StorageManager();
    this.audio = new AudioManager(this.storage.data.sound);
    this.background = new ParallaxBackground(assets.background);
    this.particles = new ParticleSystem();
    this.plane = new Plane(assets.plane);
    this.input = new InputController(canvas, {
      interact: () => this.interact(),
      pause: () => this.togglePause(),
      speed: (direction) => this.adjustSpeed(direction)
    });
    this.collectibles = new CollectibleManager(assets.star, this.particles, () => this.collectStar());
    this.obstacles = new ObstacleManager(assets, (x, y) => this.hit(x, y));
    this.ui = new UIManager(this.storage, {
      play: () => this.start(),
      resume: () => this.resume(),
      pause: () => this.pause(),
      menu: () => this.menu(),
      sound: () => this.toggleSound()
    });
    this.state = CONFIG.state.MENU;
    this.lastTime = performance.now();
    this.resize();
    this.menu();
    this.bindLifecycle();
    requestAnimationFrame((time) => this.frame(time));
  }

  bindLifecycle() {
    window.addEventListener("resize", () => this.resize());
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && this.state === CONFIG.state.PLAYING) this.pause();
    });
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = Math.max(320, rect.width);
    this.height = Math.max(420, rect.height);
    this.canvas.width = Math.round(this.width * dpr);
    this.canvas.height = Math.round(this.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.plane.x = this.width * CONFIG.plane.xRatio;
    this.plane.y = clamp(this.plane.y || this.height / 2, 60, this.height - 60);
  }

  reset() {
    this.elapsed = 0;
    this.distance = 0;
    this.stars = 0;
    this.speed = CONFIG.world.baseSpeed;
    this.difficulty = 1;
    this.ending = false;
    this.endTimer = 0;
    this.background.reset();
    this.particles.reset();
    this.collectibles.reset();
    this.obstacles.reset();
    this.plane.reset(this.width, this.height);
    this.ui.score(0, 0);
  }

  start() {
    this.audio.unlock();
    this.audio.button();
    this.reset();
    this.storage.beginRun();
    this.state = CONFIG.state.PLAYING;
    this.ui.state(this.state);
    this.ui.startHint();
    this.audio.startEngine();
  }

  menu() {
    this.audio.button();
    this.audio.stopEngine();
    this.state = CONFIG.state.MENU;
    this.ui.state(this.state);
  }

  pause() {
    if (this.state !== CONFIG.state.PLAYING || this.ending) return;
    this.audio.button();
    this.state = CONFIG.state.PAUSED;
    this.audio.stopEngine();
    this.ui.state(this.state);
  }

  resume() {
    if (this.state !== CONFIG.state.PAUSED) return;
    this.audio.unlock();
    this.audio.button();
    this.state = CONFIG.state.PLAYING;
    this.lastTime = performance.now();
    this.audio.startEngine();
    this.ui.state(this.state);
  }

  togglePause() {
    if (this.state === CONFIG.state.PLAYING) this.pause();
    else if (this.state === CONFIG.state.PAUSED) this.resume();
  }

  interact() {
    this.audio.unlock();
    if (this.state === CONFIG.state.PLAYING) this.plane.vy -= 38;
  }

  adjustSpeed(direction) {
    if (this.state !== CONFIG.state.PLAYING) return;
    this.speed = clamp(this.speed + direction * CONFIG.world.speedStep, CONFIG.world.minSpeed, CONFIG.world.maxSpeed);
  }

  toggleSound() {
    this.audio.unlock();
    const enabled = !this.storage.data.sound;
    this.storage.setSound(enabled);
    this.audio.setEnabled(enabled);
    this.ui.updateSound(enabled);
    if (enabled) { this.audio.button(); if (this.state === CONFIG.state.PLAYING) this.audio.startEngine(); }
  }

  collectStar() {
    if (this.ending) return;
    this.stars += 1;
    this.audio.collect();
    this.ui.starPulse();
  }

  hit(x, y) {
    if (this.ending) return;
    this.ending = true;
    this.endTimer = 0.9;
    this.plane.bump();
    this.particles.burst(x, y, "#f7f0da", 20);
    this.audio.bump();
  }

  finish() {
    const isRecord = this.storage.finishRun(this.distance, this.stars);
    this.audio.stopEngine();
    this.state = CONFIG.state.GAME_OVER;
    this.ui.results(this.distance, this.stars, this.storage.data.bestDistance, isRecord);
    this.ui.state(this.state);
  }

  update(dt) {
    if (this.state !== CONFIG.state.PLAYING) return;
    if (this.ending) {
      this.endTimer -= dt;
      this.plane.update(dt * 0.35, this.input, this.width, this.height);
      this.particles.update(dt);
      if (this.endTimer <= 0) this.finish();
      return;
    }
    this.elapsed += dt;
    this.difficulty = 1 + Math.max(0, this.elapsed - CONFIG.world.easySeconds) * CONFIG.world.difficultyPerSecond;
    const targetSpeed = Math.min(CONFIG.world.maxSpeed, CONFIG.world.baseSpeed * this.difficulty);
    this.speed += (targetSpeed - this.speed) * dt * 0.35;
    this.distance += this.speed * CONFIG.world.distanceFactor * dt;
    this.background.update(dt, this.speed);
    this.plane.update(dt, this.input, this.width, this.height);
    const bounds = this.plane.bounds(this.width, this.height);
    this.collectibles.update(dt, this.speed, this.width, this.height, this.difficulty, bounds);
    this.obstacles.update(dt, this.speed, this.width, this.height, this.elapsed, this.difficulty, bounds, (force) => { this.plane.vy += force; });
    this.particles.update(dt);
    this.ui.score(this.stars, this.distance);
  }

  draw(time) {
    this.background.draw(this.ctx, this.width, this.height, time);
    this.collectibles.draw(this.ctx);
    this.obstacles.draw(this.ctx);
    this.plane.draw(this.ctx, time, this.width, this.height);
    this.particles.draw(this.ctx);
    const wash = this.ctx.createRadialGradient(this.width / 2, this.height / 2, this.height * 0.2, this.width / 2, this.height / 2, this.width * 0.75);
    wash.addColorStop(0, "rgba(255,255,255,0)");
    wash.addColorStop(1, "rgba(99,76,46,.08)");
    this.ctx.fillStyle = wash;
    this.ctx.fillRect(0, 0, this.width, this.height);
  }

  frame(timeMs) {
    const dt = Math.min(CONFIG.maxDelta, Math.max(0, (timeMs - this.lastTime) / 1000));
    this.lastTime = timeMs;
    this.update(dt);
    this.draw(timeMs / 1000);
    requestAnimationFrame((time) => this.frame(time));
  }
}
