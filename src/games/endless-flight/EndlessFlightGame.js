import { CONFIG } from "./config.js";
import { Game } from "./Game.js";

const canvas = document.getElementById("gameCanvas");
const loadingBar = document.getElementById("loadingBar");

function fallbackImage(name) {
  const canvasFallback = document.createElement("canvas");
  canvasFallback.width = 180;
  canvasFallback.height = 120;
  const ctx = canvasFallback.getContext("2d");
  ctx.fillStyle = name === "star" ? "#eeb541" : "#f4ead2";
  ctx.beginPath();
  ctx.ellipse(90, 60, 68, 42, 0, 0, Math.PI * 2);
  ctx.fill();
  return canvasFallback;
}

async function loadAssets() {
  const entries = Object.entries(CONFIG.assets);
  const loaded = {};
  let complete = 0;
  await Promise.all(entries.map(([name, url]) => new Promise((resolve) => {
    const image = new Image();
    image.onload = () => { loaded[name] = image; complete += 1; loadingBar.style.width = `${complete / entries.length * 100}%`; resolve(); };
    image.onerror = () => {
      // Replace the matching file in /public/assets/endless-flight/ with a final transparent PNG or WebP.
      loaded[name] = fallbackImage(name);
      complete += 1;
      loadingBar.style.width = `${complete / entries.length * 100}%`;
      resolve();
    };
    image.src = url;
  })));
  return loaded;
}

loadAssets().then((assets) => {
  const loadingScreen = document.getElementById("loadingScreen");
  setTimeout(() => loadingScreen.classList.add("hidden"), 320);
  new Game(canvas, assets);
});
