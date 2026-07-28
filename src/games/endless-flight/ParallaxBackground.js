import { CONFIG } from "./config.js";

export class ParallaxBackground {
  constructor(image) {
    this.image = image;
    this.offsets = [0, 0, 0, 0, 0];
  }

  reset() { this.offsets.fill(0); }

  update(dt, speed) {
    for (let i = 0; i < this.offsets.length; i += 1) this.offsets[i] = (this.offsets[i] + speed * CONFIG.parallax[i] * dt) % 1200;
  }

  draw(ctx, width, height, time) {
    this.drawWatercolorLandscape(ctx, width, height);
    this.drawClouds(ctx, width, height, time);
    this.drawForegroundGlaze(ctx, width, height);
  }

  drawWatercolorLandscape(ctx, width, height) {
    const imageRatio = this.image.width / this.image.height;
    const viewRatio = width / height;
    const drawHeight = viewRatio > imageRatio ? width / imageRatio : height;
    const drawWidth = drawHeight * imageRatio;
    const overflow = Math.max(0, drawWidth - width);
    const drift = overflow > 0
      ? (this.offsets[1] * 0.45) % Math.max(1, overflow)
      : Math.sin(this.offsets[1] * 0.002) * Math.min(45, width * 0.03);
    const x = -overflow * 0.34 - drift;
    const y = height - drawHeight;
    ctx.drawImage(this.image, x, y, drawWidth, drawHeight);
    if (x + drawWidth < width) {
      ctx.save();
      ctx.translate(x + drawWidth * 2, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(this.image, 0, y, drawWidth, drawHeight);
      ctx.restore();
    }
  }

  drawClouds(ctx, width, height, time) {
    ctx.save();
    ctx.globalAlpha = 0.17;
    for (let i = -1; i < 4; i += 1) {
      const x = ((i * 430 - this.offsets[0]) % (width + 650)) - 170;
      const y = height * (0.08 + ((i * 37) % 18) / 100) + Math.sin(time * 0.2 + i) * 3;
      this.cloud(ctx, x, y, 0.55 + (i % 3) * 0.13);
    }
    ctx.restore();
  }

  cloud(ctx, x, y, scale) {
    ctx.fillStyle = "rgba(255,252,237,.78)";
    ctx.beginPath();
    ctx.ellipse(x, y, 78 * scale, 28 * scale, 0, 0, Math.PI * 2);
    ctx.ellipse(x - 35 * scale, y - 17 * scale, 42 * scale, 31 * scale, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 18 * scale, y - 26 * scale, 55 * scale, 43 * scale, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 62 * scale, y - 8 * scale, 40 * scale, 28 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  drawForegroundGlaze(ctx, width, height) {
    const glaze = ctx.createLinearGradient(0, height * 0.7, 0, height);
    glaze.addColorStop(0, "rgba(255,248,220,0)");
    glaze.addColorStop(1, "rgba(74,99,49,.08)");
    ctx.fillStyle = glaze;
    ctx.fillRect(0, height * 0.7, width, height * 0.3);
  }
}
