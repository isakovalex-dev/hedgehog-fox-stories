export class ParticleSystem {
  constructor(size = 80) {
    this.items = Array.from({ length: size }, () => ({ active: false }));
  }

  reset() { for (const item of this.items) item.active = false; }

  burst(x, y, color = "#f5bd42", count = 12) {
    let made = 0;
    for (const item of this.items) {
      if (item.active) continue;
      const angle = Math.random() * Math.PI * 2;
      const speed = 35 + Math.random() * 90;
      Object.assign(item, {
        active: true, x, y, color,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        life: 0.55 + Math.random() * 0.35, maxLife: 0.9, size: 2 + Math.random() * 5
      });
      made += 1;
      if (made >= count) break;
    }
  }

  update(dt) {
    for (const item of this.items) {
      if (!item.active) continue;
      item.life -= dt;
      if (item.life <= 0) { item.active = false; continue; }
      item.x += item.vx * dt;
      item.y += item.vy * dt;
      item.vy += 35 * dt;
    }
  }

  draw(ctx) {
    ctx.save();
    for (const item of this.items) {
      if (!item.active) continue;
      ctx.globalAlpha = Math.max(0, item.life / item.maxLife);
      ctx.fillStyle = item.color;
      ctx.beginPath();
      ctx.arc(item.x, item.y, item.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}
