export class UIManager {
  constructor(storage, handlers) {
    this.storage = storage;
    this.handlers = handlers;
    this.elements = Object.fromEntries([
      "loadingScreen", "loadingBar", "menuScreen", "menuBest", "hud", "starCount", "distanceCount",
      "controlHint", "pauseScreen", "gameOverScreen", "resultDistance", "resultStars",
      "resultBest", "recordBadge"
    ].map((id) => [id, document.getElementById(id)]));
    this.bind();
  }

  bind() {
    document.getElementById("playButton").addEventListener("click", this.handlers.play);
    document.getElementById("resumeButton").addEventListener("click", this.handlers.resume);
    document.getElementById("restartButton").addEventListener("click", this.handlers.play);
    document.getElementById("playAgainButton").addEventListener("click", this.handlers.play);
    document.getElementById("pauseButton").addEventListener("click", this.handlers.pause);
    document.querySelectorAll(".menu-button").forEach((button) => button.addEventListener("click", this.handlers.menu));
    document.querySelectorAll(".sound-toggle").forEach((button) => button.addEventListener("click", this.handlers.sound));
    this.updateSound(this.storage.data.sound);
  }

  loading(progress) {
    this.elements.loadingBar.style.width = `${Math.round(progress * 100)}%`;
    if (progress >= 1) setTimeout(() => this.elements.loadingScreen.classList.add("hidden"), 320);
  }

  state(name) {
    document.body.dataset.gameState = name;
    const active = (element, value) => element.classList.toggle("visible", value);
    active(this.elements.menuScreen, name === "MENU");
    active(this.elements.pauseScreen, name === "PAUSED");
    active(this.elements.gameOverScreen, name === "GAME_OVER");
    active(this.elements.hud, name === "PLAYING");
    if (name === "MENU") this.elements.menuBest.textContent = `${this.storage.data.bestDistance} м`;
  }

  startHint() {
    this.elements.controlHint.classList.add("visible");
    clearTimeout(this.hintTimer);
    this.hintTimer = setTimeout(() => this.elements.controlHint.classList.remove("visible"), 4300);
  }

  score(stars, distance) {
    this.elements.starCount.textContent = stars;
    this.elements.distanceCount.textContent = Math.floor(distance);
  }

  starPulse() {
    this.elements.starCount.parentElement.classList.remove("pulse");
    requestAnimationFrame(() => this.elements.starCount.parentElement.classList.add("pulse"));
  }

  results(distance, stars, best, isRecord) {
    this.elements.resultDistance.textContent = Math.floor(distance);
    this.elements.resultStars.textContent = stars;
    this.elements.resultBest.textContent = best;
    this.elements.recordBadge.hidden = !isRecord;
  }

  updateSound(enabled) {
    document.querySelectorAll(".sound-toggle").forEach((button) => {
      button.classList.toggle("muted", !enabled);
      button.setAttribute("aria-label", enabled ? "Выключить звук" : "Включить звук");
    });
  }
}
