export const CONFIG = Object.freeze({
  state: { MENU: "MENU", PLAYING: "PLAYING", PAUSED: "PAUSED", GAME_OVER: "GAME_OVER" },
  plane: {
    xRatio: 0.27, portraitXRatio: 0.24, startYRatio: 0.48,
    gravity: 310, lift: 510, pointerSpring: 7.5, damping: 0.92,
    maxVelocity: 310, visualWidth: 220, portraitWidthRatio: 0.28,
    collisionScale: 0.56
  },
  world: {
    baseSpeed: 190, minSpeed: 145, maxSpeed: 285,
    speedStep: 12, difficultyPerSecond: 0.0055, distanceFactor: 0.055,
    obstacleInterval: [1.65, 2.7], starInterval: [1.05, 1.7],
    easySeconds: 24
  },
  parallax: [0.035, 0.12, 0.24, 0.43, 0.68],
  collision: { star: 0.65, bird: 0.66, balloon: 0.72, cloud: 0.7 },
  audio: { master: 0.18, propeller: 0.035, music: 0.025 },
  storageKey: "ezhik-endless-flight-v1",
  maxDelta: 0.033,
  assets: {
    background: "/public/assets/endless-flight/background-watercolor.png",
    plane: "/public/assets/endless-flight/plane-heroes.png",
    star: "/public/assets/endless-flight/collectible-star.png",
    bird: "/public/assets/endless-flight/obstacle-bird.png",
    balloon: "/public/assets/endless-flight/obstacle-balloon.png",
    cloud: "/public/assets/endless-flight/obstacle-cloud.png"
  }
});

export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export const random = (min, max) => min + Math.random() * (max - min);
