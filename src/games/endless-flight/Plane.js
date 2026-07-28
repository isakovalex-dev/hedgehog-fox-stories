import { CONFIG, clamp } from "./config.js";

export class Plane {
  constructor(image) { this.image = image; this.reset(800, 500); }

  reset(width, height) {
    this.x = width * CONFIG.plane.xRatio;
    this.y = height * CONFIG.plane.startYRatio;
    this.vy = 0;
    this.rotation = 0;
    this.bumpTimer = 0;
  }

  update(dt, input, width, height) {
    const portrait = height > width;
    this.x = width * (portrait ? CONFIG.plane.portraitXRatio : CONFIG.plane.xRatio);
    const margin = Math.max(62, height * 0.11);
    if (input.touch) {
      this.vy += (input.liftHeld ? -CONFIG.plane.lift : CONFIG.plane.gravity * 0.72) * dt;
    } else {
      const targetY = input.pointerY * height;
      const mouseForce = (targetY - this.y) * CONFIG.plane.pointerSpring;
      this.vy += mouseForce * dt;
      if (input.liftHeld) this.vy -= CONFIG.plane.lift * dt;
      if (input.downHeld) this.vy += CONFIG.plane.lift * 0.7 * dt;
    }
    this.vy += CONFIG.plane.gravity * dt * (input.touch ? 0.22 : 0.08);
    this.vy *= Math.pow(CONFIG.plane.damping, dt * 60);
    this.vy = clamp(this.vy, -CONFIG.plane.maxVelocity, CONFIG.plane.maxVelocity);
    this.y = clamp(this.y + this.vy * dt, margin, height - margin);
    this.rotation += ((clamp(this.vy / 850, -0.17, 0.17)) - this.rotation) * Math.min(1, dt * 7);
    if (this.bumpTimer > 0) this.bumpTimer -= dt;
  }

  bump() { this.bumpTimer = 0.72; }

  getSize(width, height) {
    const portrait = height > width;
    const w = portrait ? width * CONFIG.plane.portraitWidthRatio : Math.min(CONFIG.plane.visualWidth, width * 0.25);
    return { w, h: w * (this.image.height / this.image.width) };
  }

  bounds(width, height) {
    const { w, h } = this.getSize(width, height);
    return { x: this.x - w * 0.42, y: this.y - h * 0.31, w: w * CONFIG.plane.collisionScale, h: h * CONFIG.plane.collisionScale };
  }

  draw(ctx, time, width, height) {
    const { w, h } = this.getSize(width, height);
    const bob = Math.sin(time * 3.1) * 3;
    const bump = this.bumpTimer > 0 ? Math.sin(this.bumpTimer * 36) * this.bumpTimer * 7 : 0;
    ctx.save();
    ctx.translate(this.x, this.y + bob + bump);
    ctx.rotate(this.rotation);
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = "#f8fbef";
    for (let i = 0; i < 3; i += 1) ctx.fillRect(-w * (0.64 + i * 0.13), i * 5 - 6, w * 0.25, 4);
    ctx.globalAlpha = 1;
    ctx.drawImage(this.image, -w / 2, -h / 2, w, h);
    ctx.restore();
  }
}
