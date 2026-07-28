import { random } from "./config.js";

export class ObstacleManager {
  constructor(images, onHit) {
    this.images = images;
    this.onHit = onHit;
    this.pool = Array.from({ length: 24 }, () => ({ active: false }));
    this.timer = 2.4;
  }

  reset() { this.timer = 2.4; for (const item of this.pool) item.active = false; }

  spawn(width, height, elapsed, difficulty) {
    const item = this.pool.find((entry) => !entry.active);
    if (!item) return;
    const roll = Math.random();
    const type = roll < 0.43 ? "bird" : roll < 0.74 ? "balloon" : roll < 0.93 ? "cloud" : "wind";
    const sizes = { bird: 72, balloon: 128, cloud: 145, wind: 110 };
    Object.assign(item, {
      active: true, type, x: width + sizes[type], y: random(height * 0.18, height * 0.7),
      size: sizes[type] * (height > width ? 0.82 : 1), phase: Math.random() * Math.PI * 2,
      speedFactor: type === "bird" ? 1.35 + difficulty * 0.12 : type === "balloon" ? 0.82 : 1,
      collided: false
    });
    if (type === "bird" && elapsed > 18 && Math.random() < 0.28) {
      for (let i = 1; i < 3; i += 1) {
        const bird = this.pool.find((entry) => !entry.active);
        if (!bird) break;
        Object.assign(bird, { ...item, active: true, x: item.x + i * 76, y: item.y + (i % 2 ? 52 : -30), phase: item.phase + i });
      }
    }
  }

  update(dt, speed, width, height, elapsed, difficulty, planeBounds, pushPlane) {
    this.timer -= dt;
    if (this.timer <= 0) {
      this.spawn(width, height, elapsed, difficulty);
      const easy = elapsed < 24 ? 1.35 : 1;
      this.timer = random(1.65, 2.7) * easy / Math.min(1.45, difficulty);
    }
    for (const item of this.pool) {
      if (!item.active) continue;
      item.x -= speed * item.speedFactor * dt;
      item.phase += dt * 3;
      item.y += Math.sin(item.phase) * (item.type === "bird" ? 18 : 5) * dt;
      if (item.x < -item.size * 1.5) { item.active = false; continue; }
      const scale = item.type === "balloon" ? 0.62 : item.type === "cloud" ? 0.6 : 0.52;
      const box = { x: item.x - item.size * scale / 2, y: item.y - item.size * scale / 2, w: item.size * scale, h: item.size * scale };
      const overlap = box.x < planeBounds.x + planeBounds.w && box.x + box.w > planeBounds.x &&
        box.y < planeBounds.y + planeBounds.h && box.y + box.h > planeBounds.y;
      if (overlap && !item.collided) {
        item.collided = true;
        if (item.type === "wind") pushPlane(Math.sin(item.phase) > 0 ? 160 : -160);
        else this.onHit(item.x, item.y);
      }
    }
  }

  draw(ctx) {
    for (const item of this.pool) {
      if (!item.active) continue;
      if (item.type === "wind") {
        ctx.save();
        ctx.strokeStyle = "rgba(246,250,231,.72)";
        ctx.lineWidth = 5;
        ctx.lineCap = "round";
        for (let i = -1; i <= 1; i += 1) {
          ctx.beginPath();
          ctx.moveTo(item.x - 48, item.y + i * 19);
          ctx.bezierCurveTo(item.x - 15, item.y - 17 + i * 19, item.x + 18, item.y + 19 + i * 19, item.x + 52, item.y + i * 19);
          ctx.stroke();
        }
        ctx.restore();
        continue;
      }
      const image = this.images[item.type];
      const aspect = image.width / image.height;
      const w = item.size * Math.max(0.8, aspect);
      const h = item.size;
      ctx.save();
      if (item.type === "cloud") {
        ctx.globalAlpha = 0.92;
        ctx.filter = "grayscale(.24) brightness(.82) sepia(.08)";
      }
      ctx.drawImage(image, item.x - w / 2, item.y - h / 2, w, h);
      ctx.restore();
    }
  }
}
