(function (window, document) {
  "use strict";

  const BEST_SCORE_KEY = "hedgehogFoxCatchBestScore";
  const MAX_MISSES = 3;
  const LANE_POINTS = [
    { startX: 0.12, startY: 0.235, endX: 0.415, endY: 0.477 },
    { startX: 0.095, startY: 0.58, endX: 0.415, endY: 0.679 },
    { startX: 0.88, startY: 0.235, endX: 0.585, endY: 0.477 },
    { startX: 0.905, startY: 0.58, endX: 0.585, endY: 0.679 }
  ];

  class CatchGame {
    constructor(root) {
      this.root = root;
      this.playfield = document.querySelector("#catchPlayfield");
      this.checkersLayer = document.querySelector("#catchCheckers");
      this.scoreElement = document.querySelector("#catchScore");
      this.bestElement = document.querySelector("#catchBest");
      this.missesElement = document.querySelector("#catchMisses");
      this.announcement = document.querySelector("#catchAnnouncement");
      this.startOverlay = document.querySelector("#catchStartOverlay");
      this.gameOverOverlay = document.querySelector("#catchGameOver");
      this.gameOverTitle = document.querySelector("#catchGameOverTitle");
      this.gameOverText = document.querySelector("#catchGameOverText");
      this.startButton = document.querySelector("#catchStartButton");
      this.playAgainButton = document.querySelector("#catchPlayAgain");
      this.pauseButton = document.querySelector("#catchPauseButton");
      this.soundButton = document.querySelector("#catchSoundButton");
      this.controlButtons = Array.from(root.querySelectorAll("[data-catch-position]"));

      this.score = 0;
      this.bestScore = this.readBestScore();
      this.misses = 0;
      this.currentPosition = 1;
      this.lastLane = -1;
      this.running = false;
      this.paused = false;
      this.gameOver = false;
      this.soundEnabled = true;
      this.spawnTimer = null;
      this.audioContext = null;
      this.initialized = false;

      this.onKeyDown = this.onKeyDown.bind(this);
      this.onVisibilityChange = this.onVisibilityChange.bind(this);
    }

    initialize() {
      if (this.initialized) return;
      this.initialized = true;
      this.renderScore();
      this.moveTo(1, false);

      this.startButton?.addEventListener("click", () => this.start());
      this.playAgainButton?.addEventListener("click", () => this.start());
      this.pauseButton?.addEventListener("click", () => this.togglePause());
      this.soundButton?.addEventListener("click", () => this.toggleSound());
      this.controlButtons.forEach((button) => {
        button.addEventListener("click", () => {
          this.unlockAudio();
          this.moveTo(Number(button.dataset.catchPosition));
        });
      });
      this.playfield?.addEventListener("keydown", this.onKeyDown);
      document.addEventListener("visibilitychange", this.onVisibilityChange);
    }

    readBestScore() {
      try {
        return Math.max(0, Number.parseInt(window.localStorage.getItem(BEST_SCORE_KEY), 10) || 0);
      } catch (error) {
        return 0;
      }
    }

    saveBestScore() {
      try {
        window.localStorage.setItem(BEST_SCORE_KEY, String(this.bestScore));
      } catch (error) {
        // Игра остаётся полностью рабочей, даже если браузер запретил localStorage.
      }
    }

    start() {
      this.clearSpawnTimer();
      this.removeAllCheckers();
      this.score = 0;
      this.misses = 0;
      this.lastLane = -1;
      this.running = true;
      this.paused = false;
      this.gameOver = false;
      this.unlockAudio();
      this.startOverlay?.classList.add("hidden");
      this.gameOverOverlay?.classList.add("hidden");
      this.playfield?.classList.add("is-playing");
      this.playfield?.classList.remove("is-paused");
      this.pauseButton.disabled = false;
      this.pauseButton.textContent = "Пауза";
      this.renderScore();
      this.announcement.textContent = "Игра началась. Лови шашки из четырёх дупел.";
      this.playfield?.focus({ preventScroll: true });
      this.spawnChecker();
      this.scheduleNextChecker();
    }

    chooseLane() {
      let lane = Math.floor(Math.random() * LANE_POINTS.length);
      if (lane === this.lastLane) {
        lane = (lane + 1 + Math.floor(Math.random() * (LANE_POINTS.length - 1))) % LANE_POINTS.length;
      }
      this.lastLane = lane;
      return lane;
    }

    getTravelDuration() {
      return Math.max(1900, 5200 - this.score * 65);
    }

    getSpawnDelay() {
      const baseDelay = Math.max(820, 2250 - this.score * 32);
      return baseDelay + Math.floor(Math.random() * 300);
    }

    spawnChecker() {
      if (!this.running || this.paused || !this.playfield) return;

      const lane = this.chooseLane();
      const lanePoints = LANE_POINTS[lane];
      const bounds = this.playfield.getBoundingClientRect();
      const checker = document.createElement("span");
      const isLightChecker = Math.random() > 0.5;
      checker.className = `catch-checker catch-checker--${isLightChecker ? "light" : "dark"}`;
      checker.dataset.lane = String(lane);
      checker.style.left = `${lanePoints.startX * bounds.width}px`;
      checker.style.top = `${lanePoints.startY * bounds.height}px`;
      checker.style.setProperty("--checker-dx", `${(lanePoints.endX - lanePoints.startX) * bounds.width}px`);
      checker.style.setProperty("--checker-dy", `${(lanePoints.endY - lanePoints.startY) * bounds.height}px`);
      checker.style.setProperty("--checker-spin", lane < 2 ? "640deg" : "-640deg");
      checker.style.setProperty("--checker-duration", `${this.getTravelDuration()}ms`);
      checker.addEventListener("animationend", () => this.resolveChecker(checker, lane), { once: true });
      this.checkersLayer.append(checker);
    }

    scheduleNextChecker() {
      this.clearSpawnTimer();
      if (!this.running || this.paused) return;
      this.spawnTimer = window.setTimeout(() => {
        this.spawnChecker();
        this.scheduleNextChecker();
      }, this.getSpawnDelay());
    }

    resolveChecker(checker, lane) {
      if (!checker.isConnected) return;
      checker.remove();
      if (!this.running || this.paused) return;

      if (lane === this.currentPosition) {
        this.score += 1;
        if (this.score > this.bestScore) {
          this.bestScore = this.score;
          this.saveBestScore();
        }
        this.playfield?.classList.add("caught-checker");
        window.setTimeout(() => this.playfield?.classList.remove("caught-checker"), 180);
        this.playTone("catch");
        this.announcement.textContent = `Шашка поймана. Счёт: ${this.score}.`;
      } else {
        this.misses += 1;
        this.playfield?.classList.add("missed-checker");
        window.setTimeout(() => this.playfield?.classList.remove("missed-checker"), 260);
        this.playTone("miss");
        this.announcement.textContent = `Промах. Осталось попыток: ${Math.max(0, MAX_MISSES - this.misses)}.`;
      }

      this.renderScore();
      if (this.misses >= MAX_MISSES) this.finish();
    }

    finish() {
      this.running = false;
      this.paused = false;
      this.gameOver = true;
      this.clearSpawnTimer();
      this.removeAllCheckers();
      this.playfield?.classList.remove("is-playing", "is-paused");
      this.pauseButton.disabled = true;
      this.pauseButton.textContent = "Пауза";
      this.gameOverTitle.textContent = `Поймано: ${this.score}`;
      this.gameOverText.textContent = this.score === this.bestScore && this.score > 0
        ? "Новый рекорд! Лисёнок готов к следующему раунду."
        : "Лисёнок уже готов попробовать ещё раз.";
      this.gameOverOverlay?.classList.remove("hidden");
      this.announcement.textContent = `Раунд окончен. Поймано шашек: ${this.score}.`;
      window.setTimeout(() => this.gameOverOverlay?.focus({ preventScroll: true }), 120);
    }

    moveTo(position, announce = true) {
      if (!Number.isInteger(position) || position < 0 || position > 3) return;
      this.currentPosition = position;
      this.playfield?.classList.remove("position-0", "position-1", "position-2", "position-3");
      this.playfield?.classList.add(`position-${position}`);
      this.controlButtons.forEach((button) => {
        const isSelected = Number(button.dataset.catchPosition) === position;
        button.classList.toggle("is-selected", isSelected);
        button.setAttribute("aria-pressed", String(isSelected));
      });

      if (announce && this.running) {
        const labels = ["левая верхняя", "левая нижняя", "правая верхняя", "правая нижняя"];
        this.announcement.textContent = `Выбрана ${labels[position]} корзинка.`;
        this.playTone("move");
      }
    }

    onKeyDown(event) {
      const directPositions = { q: 0, a: 1, e: 2, d: 3, й: 0, ф: 1, у: 2, в: 3 };
      const key = String(event.key || "").toLowerCase();
      let nextPosition = directPositions[key];

      if (event.key === "ArrowLeft") nextPosition = this.currentPosition >= 2 ? this.currentPosition - 2 : this.currentPosition;
      if (event.key === "ArrowRight") nextPosition = this.currentPosition <= 1 ? this.currentPosition + 2 : this.currentPosition;
      if (event.key === "ArrowUp") nextPosition = this.currentPosition % 2 === 1 ? this.currentPosition - 1 : this.currentPosition;
      if (event.key === "ArrowDown") nextPosition = this.currentPosition % 2 === 0 ? this.currentPosition + 1 : this.currentPosition;

      if (Number.isInteger(nextPosition)) {
        event.preventDefault();
        this.unlockAudio();
        this.moveTo(nextPosition);
      }

      if (event.key === " " && (this.running || this.paused)) {
        event.preventDefault();
        this.togglePause();
      }
    }

    togglePause(silent = false) {
      if (!this.running || this.gameOver) return;
      this.paused = !this.paused;
      this.playfield?.classList.toggle("is-paused", this.paused);
      this.pauseButton.textContent = this.paused ? "Продолжить" : "Пауза";

      if (this.paused) {
        this.clearSpawnTimer();
        if (!silent) this.announcement.textContent = "Игра на паузе.";
      } else {
        this.scheduleNextChecker();
        this.playfield?.focus({ preventScroll: true });
        this.announcement.textContent = "Игра продолжается.";
      }
    }

    deactivate() {
      if (this.running && !this.paused) this.togglePause(true);
    }

    onVisibilityChange() {
      if (document.hidden && this.running && !this.paused) this.togglePause(true);
    }

    toggleSound() {
      this.soundEnabled = !this.soundEnabled;
      this.soundButton.setAttribute("aria-pressed", String(this.soundEnabled));
      this.soundButton.textContent = this.soundEnabled ? "Звук: вкл" : "Звук: выкл";
      if (this.soundEnabled) {
        this.unlockAudio();
        this.playTone("move");
      }
    }

    unlockAudio() {
      if (!this.soundEnabled || this.audioContext) return;
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      try {
        this.audioContext = new AudioContext();
      } catch (error) {
        this.audioContext = null;
      }
    }

    playTone(kind) {
      if (!this.soundEnabled || !this.audioContext) return;
      const context = this.audioContext;
      const now = context.currentTime;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const tones = {
        move: { start: 260, end: 300, duration: 0.045, volume: 0.025 },
        catch: { start: 520, end: 760, duration: 0.11, volume: 0.055 },
        miss: { start: 170, end: 95, duration: 0.18, volume: 0.05 }
      };
      const tone = tones[kind] || tones.move;
      oscillator.type = kind === "miss" ? "sawtooth" : "sine";
      oscillator.frequency.setValueAtTime(tone.start, now);
      oscillator.frequency.exponentialRampToValueAtTime(tone.end, now + tone.duration);
      gain.gain.setValueAtTime(tone.volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + tone.duration);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(now);
      oscillator.stop(now + tone.duration);
    }

    renderScore() {
      this.scoreElement.textContent = String(this.score).padStart(3, "0");
      this.bestElement.textContent = String(this.bestScore).padStart(3, "0");
      const missMarks = Array.from({ length: MAX_MISSES }, (_, index) => index < this.misses ? "●" : "○");
      this.missesElement.textContent = missMarks.join(" ");
      this.missesElement.setAttribute("aria-label", `Промахов: ${this.misses} из ${MAX_MISSES}`);
    }

    clearSpawnTimer() {
      window.clearTimeout(this.spawnTimer);
      this.spawnTimer = null;
    }

    removeAllCheckers() {
      this.checkersLayer?.replaceChildren();
    }

    getState() {
      return {
        score: this.score,
        bestScore: this.bestScore,
        misses: this.misses,
        currentPosition: this.currentPosition,
        running: this.running,
        paused: this.paused,
        gameOver: this.gameOver,
        checkerCount: this.checkersLayer?.children.length || 0
      };
    }
  }

  const root = document.querySelector("#catchGame");
  if (!root) return;

  const game = new CatchGame(root);
  window.HFCatchGame = {
    initialize: () => game.initialize(),
    start: () => game.start(),
    deactivate: () => game.deactivate(),
    getState: () => game.getState()
  };
})(window, document);
