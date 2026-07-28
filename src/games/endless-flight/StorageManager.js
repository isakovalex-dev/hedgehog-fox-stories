import { CONFIG } from "./config.js";

const defaults = { bestDistance: 0, bestStars: 0, totalStars: 0, sound: true, launches: 0 };

export class StorageManager {
  constructor() {
    try {
      this.data = { ...defaults, ...JSON.parse(localStorage.getItem(CONFIG.storageKey) || "{}") };
    } catch {
      this.data = { ...defaults };
    }
  }

  save() {
    try { localStorage.setItem(CONFIG.storageKey, JSON.stringify(this.data)); } catch { /* Private browsing may deny storage. */ }
  }

  beginRun() { this.data.launches += 1; this.save(); }

  finishRun(distance, stars) {
    const rounded = Math.floor(distance);
    const isRecord = rounded > this.data.bestDistance;
    this.data.bestDistance = Math.max(this.data.bestDistance, rounded);
    this.data.bestStars = Math.max(this.data.bestStars, stars);
    this.data.totalStars += stars;
    this.save();
    return isRecord;
  }

  setSound(enabled) { this.data.sound = enabled; this.save(); }
}
