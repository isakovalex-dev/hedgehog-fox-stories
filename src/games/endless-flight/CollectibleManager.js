import { random } from "./config.js";

export class CollectibleManager {
  constructor(image, particles, onCollect) {
    this.image = image;
    this.particles = particles;
    this.onCollect = onCollect;
    this.pool = Array.from({ length: 42 }, () => ({ active: false }));
    this.timer = 1.1;
  }

  reset() { this.timer = 1.1; for (const star of this.pool) star.active = false; }

  spawn(width, height, difficulty) {
    const count = Math.random() < 0.58 ? 1 : Math.floor(random(3, 6));
    const center = random(height * 0.22, height * 0.68);
    for (let i = 0; i < count; i += 1) {
      const star = this.pool.find((item) => !item.active);
      if (!star) break;
      Object.assign(star, {
        active: true, x: width + 45 + i * 52, y: center + Math.sin((i / Math.max(1, count - 1)) * Math.PI) * -55,
        size: 40, phase: Math.random() * Math.PI * 2, difficulty
      });
    }
  }

  update(dt, speed, width, height, difficulty, planeBounds) {
    this.timer -= dt;
    if (this.timer <= 0) {
      this.spawn(width, height, difficulty);
      this.timer = random(1.05, 1.7);
    }
    for (const star of this.pool) {
      if (!star.active) continue;
      star.x -= speed * dt;
      star.phase += dt * 4;
      if (star.x < -70) { star.active = false; continue; }
      const r = star.size * 0.3;
      if (star.x + r > planeBounds.x && star.x - r < planeBounds.x + planeBounds.w &&
          star.y + r > planeBounds.y && star.y - r < planeBounds.y + planeBounds.h) {
        star.active = false;
        this.particles.burst(star.x, star.y);
        this.onCollect();
      }
    }
  }

  draw(ctx) {
    for (const star of this.pool) {
      if (!star.active) continue;
      const pulse = 1 + Math.sin(star.phase) * 0.07;
      const size = star.size * pulse;
      ctx.drawImage(this.image, star.x - size / 2, star.y - size / 2, size, size);
    }
  }
}
