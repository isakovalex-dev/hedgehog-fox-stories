(function () {
  "use strict";

  const CONFIG = {
    maxDelta: 0.05,
    startLives: 3,
    foxSpeed: 820,
    foxBottom: 34,
    foxWidth: 206,
    foxHeight: 184,
    basketWidth: 90,
    basketHeight: 48,
    firstSafeSeconds: 7,
    reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    modes: {
      easy: { label: "Лёгкий", spawn: 1.34, minimumSpawn: 0.82, fallSpeed: 126, maxItems: 2, badChance: 0.08, freeMisses: 1 },
      normal: { label: "Обычный", spawn: 1.08, minimumSpawn: 0.62, fallSpeed: 154, maxItems: 3, badChance: 0.17, freeMisses: 0 }
    },
    points: { acorn: 10, cone: 15, berries: 20, hazelnut: 25, walnut: 30, golden: 100 },
    itemTypes: ["acorn", "cone", "berries", "hazelnut", "walnut", "golden", "branch", "stone", "mushroom"],
    itemPoolSize: 28,
    particlePoolSize: 72
  };

  const STORAGE_KEY = "hedgehogFoxForestCatcherV1";

  class StorageManager {
    static load() {
      const defaults = { bestScore: 0, maxCombo: 0, games: 0, totalItems: 0, difficulty: "easy", sound: true, music: false };
      try {
        return { ...defaults, ...JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}") };
      } catch (error) {
        return defaults;
      }
    }

    static save(data) {
      try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (error) { /* Private mode can deny storage. */ }
    }
  }

  class AudioManager {
    constructor(enabled) {
      this.enabled = enabled;
      this.context = null;
    }

    unlock() {
      if (!this.enabled || this.context) return;
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) this.context = new AudioContext();
    }

    tone(kind) {
      if (!this.enabled || !this.context) return;
      const values = { catch: [590, .07], bonus: [760, .11], bad: [210, .14], miss: [280, .09], click: [420, .05] };
      const [frequency, duration] = values[kind] || values.click;
      const osc = this.context.createOscillator();
      const gain = this.context.createGain();
      osc.type = kind === "bad" ? "triangle" : "sine";
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(.045, this.context.currentTime);
      gain.gain.exponentialRampToValueAtTime(.001, this.context.currentTime + duration);
      osc.connect(gain).connect(this.context.destination);
      osc.start(); osc.stop(this.context.currentTime + duration);
    }
  }

  class InputController {
    constructor(canvas, onTarget, onPause) {
      this.canvas = canvas;
      this.onTarget = onTarget;
      this.onPause = onPause;
      this.left = false;
      this.right = false;
      this.pointerActive = false;
      this.attach();
    }

    attach() {
      this.canvas.addEventListener("pointerdown", (event) => { this.pointerActive = true; this.canvas.setPointerCapture?.(event.pointerId); this.movePointer(event); });
      this.canvas.addEventListener("pointermove", (event) => { if (this.pointerActive || event.pointerType === "mouse") this.movePointer(event); });
      this.canvas.addEventListener("pointerup", () => { this.pointerActive = false; });
      this.canvas.addEventListener("pointercancel", () => { this.pointerActive = false; });
      this.canvas.addEventListener("keydown", (event) => this.key(event, true));
      this.canvas.addEventListener("keyup", (event) => this.key(event, false));
      window.addEventListener("keydown", (event) => {
        if (event.defaultPrevented) return;
        if ((event.key === "Escape" || event.key === " ") && !event.repeat) this.onPause(event);
      });
    }

    movePointer(event) {
      const rect = this.canvas.getBoundingClientRect();
      this.onTarget(Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)));
      event.preventDefault();
    }

    key(event, pressed) {
      const key = event.key.toLowerCase();
      if (["arrowleft", "arrowright", "a", "d", "ф", "в"].includes(key)) event.preventDefault();
      if (key === "arrowleft" || key === "a" || key === "ф") this.left = pressed;
      if (key === "arrowright" || key === "d" || key === "в") this.right = pressed;
      if ((key === "enter" || key === " ") && pressed && !event.repeat) this.onPause(event);
    }
  }

  class ForestCatcherGame {
    constructor() {
      this.canvas = document.querySelector("#forestCatcherCanvas");
      this.context = this.canvas.getContext("2d");
      this.root = document.querySelector("#forestCatcherRoot");
      this.data = StorageManager.load();
      this.audio = new AudioManager(this.data.sound);
      this.images = {};
      this.items = Array.from({ length: CONFIG.itemPoolSize }, () => ({ active: false }));
      this.particles = Array.from({ length: CONFIG.particlePoolSize }, () => ({ active: false }));
      this.width = 0; this.height = 0; this.dpr = 1;
      this.state = "loading";
      this.selectedDifficulty = this.data.difficulty;
      this.player = { x: .5, target: .5, direction: 1, bounce: 0 };
      this.stats = this.newStats();
      this.lastFrame = 0; this.spawnElapsed = 0; this.elapsed = 0; this.frame = 0;
      this.input = new InputController(this.canvas, (target) => { this.player.target = target; }, (event) => this.handleActionKey(event));
      this.elements = this.getElements();
      this.bindUI();
      this.resize();
      window.addEventListener("resize", () => this.resize());
      document.addEventListener("visibilitychange", () => { if (document.hidden && this.state === "playing") this.pause(); });
      this.preload().then(() => this.ready());
      requestAnimationFrame((time) => this.loop(time));
    }

    newStats() { return { score: 0, lives: CONFIG.startLives, combo: 0, maxCombo: 0, caught: 0, missed: 0, freeMisses: 0, newRecord: false }; }

    getElements() {
      return {
        loading: document.querySelector("#fcLoadingScreen"), menu: document.querySelector("#fcMenuScreen"), help: document.querySelector("#fcHelpScreen"), pause: document.querySelector("#fcPauseScreen"), result: document.querySelector("#fcResultScreen"), hud: document.querySelector("#fcHud"),
        start: document.querySelector("#fcStartButton"), helpOpen: document.querySelector("#fcHelpButton"), helpClose: document.querySelector("#fcHelpCloseButton"), pauseButton: document.querySelector("#fcPauseButton"), resume: document.querySelector("#fcResumeButton"), restart: document.querySelector("#fcRestartButton"), menuButton: document.querySelector("#fcMenuButton"), playAgain: document.querySelector("#fcPlayAgainButton"), resultMenu: document.querySelector("#fcResultMenuButton"),
        score: document.querySelector("#fcScore"), menuBest: document.querySelector("#fcMenuBest"), lives: document.querySelector("#fcLives"), livesText: document.querySelector("#fcLivesText"), combo: document.querySelector("#fcComboCard"), comboText: document.querySelector("#fcComboText"),
        resultKicker: document.querySelector("#fcResultKicker"), resultScore: document.querySelector("#fcResultScore"), resultItems: document.querySelector("#fcResultItems"), resultCombo: document.querySelector("#fcResultCombo"), newRecord: document.querySelector("#fcNewRecord"), live: document.querySelector("#fcLiveRegion"),
        sound: [document.querySelector("#fcSoundButton"), document.querySelector("#fcUnderSoundButton")], music: document.querySelector("#fcMusicButton"), difficulties: Array.from(document.querySelectorAll("[data-fc-difficulty]"))
      };
    }

    bindUI() {
      const click = (handler) => () => { this.audio.unlock(); this.audio.tone("click"); handler(); };
      this.elements.start.addEventListener("click", click(() => this.start()));
      this.elements.helpOpen.addEventListener("click", click(() => this.showHelp()));
      this.elements.helpClose.addEventListener("click", click(() => this.closeHelp()));
      this.elements.pauseButton.addEventListener("click", click(() => this.pause()));
      this.elements.resume.addEventListener("click", click(() => this.resume()));
      this.elements.restart.addEventListener("click", click(() => this.start()));
      this.elements.menuButton.addEventListener("click", click(() => this.showMenu()));
      this.elements.playAgain.addEventListener("click", click(() => this.start()));
      this.elements.resultMenu.addEventListener("click", click(() => this.showMenu()));
      this.elements.difficulties.forEach((button) => button.addEventListener("click", click(() => this.setDifficulty(button.dataset.fcDifficulty))));
      this.elements.sound.forEach((button) => button.addEventListener("click", click(() => this.toggleSound())));
      this.elements.music.addEventListener("click", click(() => this.toggleMusic()));
    }

    async preload() {
      this.images.background = await this.loadImage("assets/forest-catcher/forest-clearing-v2.png");
      this.images.fox = await this.loadImage("assets/forest-catcher/fox-catcher.webp");
    }

    loadImage(source) {
      return new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = source; });
    }

    ready() {
      this.elements.loading.classList.add("is-hidden");
      this.state = "menu";
      this.renderStaticUI();
      this.announce("Игра готова. Выберите сложность и начните игру.");
    }

    resize() {
      const rect = this.canvas.getBoundingClientRect();
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.width = Math.max(1, rect.width); this.height = Math.max(1, rect.height);
      this.canvas.width = Math.round(this.width * this.dpr); this.canvas.height = Math.round(this.height * this.dpr);
      this.context.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    }

    setDifficulty(difficulty) {
      if (!CONFIG.modes[difficulty]) return;
      this.selectedDifficulty = difficulty; this.data.difficulty = difficulty; StorageManager.save(this.data);
      this.elements.difficulties.forEach((button) => { const selected = button.dataset.fcDifficulty === difficulty; button.classList.toggle("is-selected", selected); button.setAttribute("aria-pressed", String(selected)); });
      this.announce(`Выбран ${CONFIG.modes[difficulty].label.toLowerCase()} режим.`);
    }

    toggleSound() {
      this.data.sound = !this.data.sound; this.audio.enabled = this.data.sound; if (this.data.sound) this.audio.unlock();
      this.elements.sound.forEach((button) => { button.textContent = `Звуки: ${this.data.sound ? "вкл" : "выкл"}`; button.setAttribute("aria-pressed", String(this.data.sound)); });
      StorageManager.save(this.data);
    }

    toggleMusic() {
      this.data.music = !this.data.music; this.elements.music.textContent = `Музыка: ${this.data.music ? "вкл" : "выкл"}`; this.elements.music.setAttribute("aria-pressed", String(this.data.music)); StorageManager.save(this.data);
      this.announce(this.data.music ? "Музыка включена. Пока это тихий лес без отдельной мелодии." : "Музыка выключена.");
    }

    showHelp() { this.elements.help.classList.remove("is-hidden"); this.state = "help"; document.querySelector("#fcHelpCloseButton").focus({ preventScroll: true }); }
    closeHelp() { this.elements.help.classList.add("is-hidden"); this.state = "menu"; this.elements.start.focus({ preventScroll: true }); }
    showMenu() {
      this.clearObjects(); this.state = "menu"; this.elements.hud.classList.add("is-hidden"); this.elements.pause.classList.add("is-hidden"); this.elements.result.classList.add("is-hidden"); this.elements.menu.classList.remove("is-hidden"); this.renderStaticUI(); this.elements.start.focus({ preventScroll: true });
    }

    start() {
      this.clearObjects(); this.stats = this.newStats(); this.elapsed = 0; this.spawnElapsed = 0; this.player.x = .5; this.player.target = .5; this.state = "playing";
      this.elements.menu.classList.add("is-hidden"); this.elements.pause.classList.add("is-hidden"); this.elements.result.classList.add("is-hidden"); this.elements.hud.classList.remove("is-hidden"); this.renderStaticUI(); this.canvas.focus({ preventScroll: true }); this.announce("Игра началась. Ловите лесные дары в корзинку.");
    }

    pause() {
      if (this.state !== "playing") return; this.state = "paused"; this.elements.pause.classList.remove("is-hidden"); this.elements.resume.focus({ preventScroll: true }); this.announce("Игра на паузе.");
    }
    resume() { if (this.state !== "paused") return; this.state = "playing"; this.elements.pause.classList.add("is-hidden"); this.canvas.focus({ preventScroll: true }); this.announce("Игра продолжается."); }
    handleActionKey(event) {
      if (this.state === "playing") { event?.preventDefault(); this.pause(); }
      else if (this.state === "paused") { event?.preventDefault(); this.resume(); }
      else if (this.state === "menu" && event?.key !== "Escape") { event?.preventDefault(); this.start(); }
    }

    mode() { return CONFIG.modes[this.selectedDifficulty]; }

    loop(time) {
      const delta = Math.min(CONFIG.maxDelta, (time - this.lastFrame || 0) / 1000); this.lastFrame = time;
      if (this.state === "playing") this.update(delta);
      this.draw();
      requestAnimationFrame((next) => this.loop(next));
    }

    update(delta) {
      this.elapsed += delta; this.frame += delta;
      const keyboardDirection = (this.input.right ? 1 : 0) - (this.input.left ? 1 : 0);
      if (keyboardDirection) this.player.target += keyboardDirection * (CONFIG.foxSpeed / this.width) * delta;
      this.player.target = Math.max(.09, Math.min(.91, this.player.target));
      const before = this.player.x; this.player.x += Math.max(-CONFIG.foxSpeed * delta / this.width, Math.min(CONFIG.foxSpeed * delta / this.width, this.player.target - this.player.x));
      if (Math.abs(this.player.x - before) > .001) this.player.direction = this.player.x > before ? 1 : -1;
      this.player.bounce = Math.max(0, this.player.bounce - delta * 3.8);

      this.spawnElapsed += delta;
      const mode = this.mode(); const difficultly = Math.min(1, Math.max(0, (this.elapsed - 22) / 110));
      const spawnDelay = Math.max(mode.minimumSpawn, mode.spawn - difficultly * .45);
      if (this.spawnElapsed >= spawnDelay && this.activeItemCount() < mode.maxItems) { this.spawnElapsed = 0; this.spawnItem(difficultly); }

      for (const item of this.items) if (item.active) this.updateItem(item, delta, difficultly);
      for (const particle of this.particles) if (particle.active) { particle.life -= delta; particle.x += particle.vx * delta; particle.y += particle.vy * delta; particle.vy += 30 * delta; if (particle.life <= 0) particle.active = false; }
    }

    activeItemCount() { let count = 0; for (const item of this.items) if (item.active) count += 1; return count; }
    getAvailable(pool) { return pool.find((object) => !object.active); }

    spawnItem(difficulty) {
      const item = this.getAvailable(this.items); if (!item) return;
      const mode = this.mode(); const safe = this.elapsed < CONFIG.firstSafeSeconds; const dangerous = !safe && Math.random() < mode.badChance + difficulty * .12;
      let type;
      if (dangerous) type = ["branch", "stone", "mushroom"][Math.floor(Math.random() * 3)];
      else { const useful = ["acorn", "cone", "berries", "hazelnut", "walnut", "golden"]; type = Math.random() < .035 ? "golden" : useful[Math.floor(Math.random() * 5)]; }
      const avoidX = this.player.x; let x = .12 + Math.random() * .76;
      if (Math.abs(x - avoidX) < .12 && this.elapsed < 18) x = x < avoidX ? Math.max(.1, x - .18) : Math.min(.9, x + .18);
      const scale = .82 + Math.random() * .22;
      Object.assign(item, { active: true, type, x, y: -.08, scale, rotation: (Math.random() - .5) * .7, spin: (Math.random() - .5) * 1.4, speed: mode.fallSpeed * (1 + difficulty * .44) * (.88 + Math.random() * .22), bad: ["branch", "stone", "mushroom"].includes(type), caught: false, fade: 1 });
    }

    updateItem(item, delta, difficulty) {
      item.y += item.speed * delta / this.height; item.rotation += item.spin * delta;
      const basket = this.basketBounds();
      const itemX = item.x * this.width; const itemY = item.y * this.height;
      const withinX = itemX > basket.x - basket.w / 2 && itemX < basket.x + basket.w / 2;
      const withinY = itemY > basket.y - basket.h / 2 && itemY < basket.y + basket.h / 2;
      if (withinX && withinY) { this.catchItem(item); return; }
      if (item.y > 1.07) { this.missItem(item); }
    }

    basketBounds() { const foxW = Math.min(CONFIG.foxWidth, this.width * .23); return { x: this.player.x * this.width + this.player.direction * foxW * .16, y: this.height - CONFIG.foxBottom - Math.min(CONFIG.foxHeight, this.height * .31) * .46, w: Math.max(70, foxW * .78), h: Math.max(38, foxW * .38) }; }

    catchItem(item) {
      item.active = false; this.player.bounce = 1;
      if (item.bad) { this.breakCombo(); this.loseLife("В корзинку попал ненужный предмет."); this.audio.tone("bad"); this.makeParticles(item.x * this.width, item.y * this.height, "leaf", 7); return; }
      this.stats.combo += 1; this.stats.maxCombo = Math.max(this.stats.maxCombo, this.stats.combo); this.data.maxCombo = Math.max(this.data.maxCombo, this.stats.maxCombo);
      const multiplier = this.stats.combo >= 10 ? 3 : this.stats.combo >= 5 ? 2 : 1; const earned = CONFIG.points[item.type] * multiplier;
      this.stats.score += earned; this.stats.caught += 1; this.data.totalItems += 1; this.data.bestScore = Math.max(this.data.bestScore, this.stats.score);
      this.audio.tone(item.type === "golden" ? "bonus" : "catch"); this.makeParticles(item.x * this.width, item.y * this.height, item.type === "golden" ? "star" : "spark", item.type === "golden" ? 14 : 8); this.announce(`${this.itemName(item.type)} пойман${this.itemName(item.type).endsWith("а") ? "а" : ""}. Плюс ${earned} очков.`); this.renderStaticUI();
    }

    missItem(item) {
      item.active = false;
      if (item.bad) { this.makeParticles(item.x * this.width, this.height * .89, "leaf", 3); return; }
      this.makeParticles(item.x * this.width, this.height * .89, "leaf", 5); this.breakCombo();
      if (this.stats.freeMisses < this.mode().freeMisses) { this.stats.freeMisses += 1; this.announce("Первый дар упал в траву. В лёгком режиме этот промах не отнимает жизнь."); this.audio.tone("miss"); }
      else { this.loseLife("Лесной дар упал в траву."); this.audio.tone("miss"); }
    }

    loseLife(message) {
      this.stats.lives -= 1; this.announce(`${message} Осталось жизней: ${Math.max(0, this.stats.lives)}.`); this.renderStaticUI();
      if (this.stats.lives <= 0) this.finish();
    }

    breakCombo() { if (this.stats.combo > 0) this.stats.combo = 0; this.renderStaticUI(); }
    finish() {
      this.state = "result"; this.clearObjects(); this.data.games += 1; this.data.maxCombo = Math.max(this.data.maxCombo, this.stats.maxCombo); this.stats.newRecord = this.stats.score >= this.data.bestScore && this.stats.score > 0; StorageManager.save(this.data); this.renderStaticUI();
      this.elements.result.classList.remove("is-hidden"); this.elements.playAgain.focus({ preventScroll: true }); this.announce(`Лесные дары собраны. Набрано ${this.stats.score} очков.`);
    }

    clearObjects() { this.items.forEach((item) => { item.active = false; }); this.particles.forEach((particle) => { particle.active = false; }); }
    itemName(type) { return { acorn: "Жёлудь", cone: "Шишка", berries: "Ягоды", hazelnut: "Орех", walnut: "Грецкий орех", golden: "Золотой дар" }[type] || "Предмет"; }

    makeParticles(x, y, type, count) {
      if (CONFIG.reducedMotion) return;
      for (let index = 0; index < count; index += 1) { const particle = this.getAvailable(this.particles); if (!particle) return; const angle = Math.PI * (1.1 + Math.random() * .8); Object.assign(particle, { active: true, type, x, y, vx: Math.cos(angle) * (28 + Math.random() * 80), vy: Math.sin(angle) * (28 + Math.random() * 84) - 18, life: .45 + Math.random() * .35, size: 3 + Math.random() * 5 }); }
    }

    renderStaticUI() {
      const { score, lives, combo } = this.stats; this.elements.score.textContent = score; this.elements.menuBest.textContent = this.data.bestScore; this.elements.lives.textContent = Array.from({ length: CONFIG.startLives }, (_, index) => index < lives ? "♥" : "♡").join(" "); this.elements.livesText.textContent = `Жизней: ${lives}`; this.elements.lives.parentElement.classList.toggle("is-low", lives === 1);
      const multiplier = combo >= 10 ? 3 : combo >= 5 ? 2 : 1; this.elements.combo.classList.toggle("is-hidden", multiplier === 1); this.elements.comboText.textContent = `Комбо ×${multiplier}`;
      this.elements.resultScore.textContent = score; this.elements.resultItems.textContent = this.stats.caught; this.elements.resultCombo.textContent = this.stats.maxCombo; this.elements.newRecord.classList.toggle("is-hidden", !this.stats.newRecord); this.elements.resultKicker.textContent = this.stats.newRecord ? "Новый рекорд!" : "Лесные дары собраны";
    }

    announce(message) { this.elements.live.textContent = message; }

    draw() {
      const ctx = this.context; const w = this.width; const h = this.height; if (!w || !h) return;
      ctx.clearRect(0, 0, w, h); this.drawBackground(ctx, w, h); this.drawTree(ctx, w, h); this.drawDecor(ctx, w, h); for (const item of this.items) if (item.active) this.drawItem(ctx, item, w, h); this.drawFox(ctx, w, h); this.drawParticles(ctx);
    }

    drawBackground(ctx, w, h) {
      const image = this.images.background;
      if (image) {
        const scale = Math.max(w / image.width, h / image.height);
        const drawWidth = image.width * scale; const drawHeight = image.height * scale;
        ctx.drawImage(image, (w - drawWidth) / 2, (h - drawHeight) / 2, drawWidth, drawHeight);
        const paperWash = ctx.createLinearGradient(0, 0, 0, h);
        paperWash.addColorStop(0, "rgba(255,251,234,.05)"); paperWash.addColorStop(1, "rgba(102,124,69,.09)");
        ctx.fillStyle = paperWash; ctx.fillRect(0, 0, w, h);
        return;
      }
      const sky = ctx.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, "#b9e1e2"); sky.addColorStop(.54, "#e8efd0"); sky.addColorStop(1, "#a6bc78");
      ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);

      // Soft watercolor clouds keep the play area calm and distinct from story artwork.
      ctx.save(); ctx.globalAlpha = .63;
      [[.16,.14,.12],[.43,.1,.09],[.64,.22,.14]].forEach(([cx, cy, r]) => {
        const cloud = ctx.createRadialGradient(cx*w, cy*h, 3, cx*w, cy*h, r*w);
        cloud.addColorStop(0, "rgba(255,253,236,.92)"); cloud.addColorStop(1, "rgba(255,253,236,0)");
        ctx.fillStyle = cloud; ctx.fillRect((cx-r)*w, (cy-r)*h, r*w*2, r*w*1.5);
      });
      ctx.restore();

      const hills = [
        { y: .56, color: "rgba(104,143,101,.32)", height: .12 },
        { y: .64, color: "rgba(73,118,74,.42)", height: .14 },
        { y: .75, color: "rgba(69,105,62,.42)", height: .18 }
      ];
      hills.forEach((hill, layer) => {
        ctx.fillStyle = hill.color; ctx.beginPath(); ctx.moveTo(0, h);
        for (let x = 0; x <= w; x += 28) {
          const wave = Math.sin(x / (92 + layer * 24) + layer * 1.4) * h * .028;
          ctx.lineTo(x, h * hill.y + wave);
        }
        ctx.lineTo(w, h); ctx.closePath(); ctx.fill();
      });

      ctx.save(); ctx.globalAlpha = .26;
      for (let index = 0; index < 20; index += 1) {
        const side = index % 2 === 0 ? .03 : .97;
        const x = side * w + (index % 2 === 0 ? index * 7 : -index * 7);
        const y = h * (.36 + (index % 6) * .07);
        ctx.fillStyle = index % 3 === 0 ? "#839d56" : "#617c51";
        ctx.beginPath(); ctx.ellipse(x, y, w * .09, h * .12, 0, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();

      const clearing = ctx.createRadialGradient(w*.48, h*.73, w*.07, w*.48, h*.73, w*.48);
      clearing.addColorStop(0, "rgba(255,249,225,.82)"); clearing.addColorStop(.67, "rgba(255,249,225,.35)"); clearing.addColorStop(1, "rgba(255,249,225,0)");
      ctx.fillStyle = clearing; ctx.fillRect(0, 0, w, h);
    }

    drawTree(ctx, w, h) {
      if (this.images.background) return;
      const x = w * .87; const trunkW = Math.max(84, w * .095);
      ctx.save(); ctx.globalAlpha = .62;
      const trunk = ctx.createLinearGradient(x - trunkW / 2, 0, x + trunkW / 2, 0);
      trunk.addColorStop(0, "rgba(92,66,40,.42)"); trunk.addColorStop(.5, "rgba(139,100,57,.72)"); trunk.addColorStop(1, "rgba(76,58,34,.48)");
      ctx.fillStyle = trunk; ctx.beginPath(); ctx.moveTo(x - trunkW * .35, h * .94); ctx.bezierCurveTo(x - trunkW * .46, h * .7, x - trunkW * .16, h * .53, x - trunkW * .3, h * .24); ctx.bezierCurveTo(x, h * .17, x + trunkW * .35, h * .22, x + trunkW * .28, h * .47); ctx.bezierCurveTo(x + trunkW * .22, h * .68, x + trunkW * .46, h * .78, x + trunkW * .36, h * .94); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "rgba(76,55,33,.34)"; ctx.lineWidth = Math.max(1.2, w * .0015);
      for (let index = 0; index < 6; index += 1) { const offset = (index - 2.5) * trunkW * .12; ctx.beginPath(); ctx.moveTo(x + offset, h * .9); ctx.bezierCurveTo(x + offset * .75, h * .62, x + offset * 1.4, h * .39, x + offset * .5, h * .24); ctx.stroke(); }
      const canopy = [[-.05,.22,.13],[.12,.18,.14],[-.16,.31,.12],[.18,.32,.13],[.01,.37,.14]];
      for (const [dx, dy, size] of canopy) { const gradient = ctx.createRadialGradient(x + dx*w, dy*h, 8, x + dx*w, dy*h, size*w); gradient.addColorStop(0, "rgba(224,220,144,.36)"); gradient.addColorStop(.58, "rgba(90,129,67,.25)"); gradient.addColorStop(1, "rgba(77,110,61,0)"); ctx.fillStyle = gradient; ctx.beginPath(); ctx.ellipse(x + dx*w, dy*h, size*w, size*w*.68, 0, 0, Math.PI*2); ctx.fill(); }
      ctx.fillStyle = "rgba(64,42,25,.82)"; ctx.beginPath(); ctx.ellipse(x + trunkW*.03, h*.42, trunkW*.19, trunkW*.14, -.18, 0, Math.PI*2); ctx.fill(); ctx.fillStyle = "rgba(169,119,65,.4)"; ctx.beginPath(); ctx.ellipse(x + trunkW*.03, h*.42, trunkW*.13, trunkW*.087, -.18, 0, Math.PI*2); ctx.fill();
      ctx.restore();
    }

    drawDecor(ctx, w, h) {
      ctx.save(); ctx.globalAlpha = .45; ctx.fillStyle = "#5c7c48"; for (let index = 0; index < 14; index += 1) { const x = (index / 13) * w; const y = h * (.88 + ((index % 3) * .02)); ctx.beginPath(); ctx.ellipse(x, y, 18 + (index % 4) * 5, 5, -.4, 0, Math.PI * 2); ctx.fill(); }
      if (!CONFIG.reducedMotion) { const shift = Math.sin(this.frame * .7) * 4; for (let index = 0; index < 5; index += 1) { ctx.fillStyle = index % 2 ? "rgba(128,147,70,.52)" : "rgba(188,154,59,.52)"; ctx.beginPath(); ctx.ellipse(w * (.12 + index * .17) + shift, h * (.25 + (index % 3) * .13), 4, 8, index, 0, Math.PI * 2); ctx.fill(); } }
      ctx.restore();
    }

    drawFox(ctx, w, h) {
      const image = this.images.fox; if (!image) return; const foxW = Math.min(CONFIG.foxWidth, w * .23); const foxH = foxW * (image.height / image.width); const bounce = this.player.bounce * 9 + (!CONFIG.reducedMotion ? Math.sin(this.frame * 3.2) * 1.6 : 0); const x = this.player.x * w - foxW / 2; const y = h - CONFIG.foxBottom - foxH - bounce;
      ctx.save(); if (this.player.direction < 0) { ctx.translate(x + foxW / 2, 0); ctx.scale(-1, 1); ctx.drawImage(image, -foxW / 2, y, foxW, foxH); } else ctx.drawImage(image, x, y, foxW, foxH);
      const basket = this.basketBounds(); this.drawBasket(ctx, basket.x, basket.y, basket.w, basket.h); ctx.restore();
    }

    drawBasket(ctx, x, y, w, h) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(this.player.direction * .045 - this.player.bounce * .04); ctx.fillStyle = "rgba(97, 59, 31, .20)"; ctx.beginPath(); ctx.ellipse(2, h * .63, w * .5, h * .22, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#b8793f"; ctx.strokeStyle = "#6d4529"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-w*.48, -h*.24); ctx.quadraticCurveTo(0, h*.7, w*.48, -h*.24); ctx.lineTo(w*.38, h*.4); ctx.quadraticCurveTo(0, h*.72, -w*.38, h*.4); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = "rgba(83,52,29,.7)"; ctx.lineWidth = 1.4; for (let index = -2; index <= 2; index += 1) { ctx.beginPath(); ctx.moveTo(index*w*.16, -h*.18); ctx.quadraticCurveTo(index*w*.12, h*.35, index*w*.08, h*.54); ctx.stroke(); } for (let index = 0; index < 3; index += 1) { ctx.beginPath(); ctx.moveTo(-w*.38, -h*.05 + index*h*.2); ctx.quadraticCurveTo(0, h*.1 + index*h*.18, w*.38, -h*.05 + index*h*.2); ctx.stroke(); }
      ctx.strokeStyle = "#6d4529"; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, -h*.28, w*.26, Math.PI, 0); ctx.stroke(); ctx.restore();
    }

    drawItem(ctx, item, w, h) {
      const x = item.x*w; const y = item.y*h; const s = 23*item.scale; ctx.save(); ctx.translate(x, y); ctx.rotate(item.rotation); ctx.lineJoin = "round"; ctx.lineCap = "round"; ctx.shadowColor = "rgba(72,51,31,.18)"; ctx.shadowBlur = 5; ctx.shadowOffsetY = 3;
      // TODO: replace the procedural temporary item drawings with final extracted PNG/WebP assets from the supplied references.
      if (item.type === "acorn" || item.type === "golden") { ctx.fillStyle = item.type === "golden" ? "#e7af3c" : "#a66635"; ctx.strokeStyle = item.type === "golden" ? "#a97122" : "#684128"; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, 5, s*.46, s*.62, 0, 0, Math.PI*2); ctx.fill(); ctx.stroke(); ctx.fillStyle = item.type === "golden" ? "#c78f25" : "#755134"; ctx.beginPath(); ctx.ellipse(0, -s*.28, s*.48, s*.2, 0, Math.PI, Math.PI*2); ctx.fill(); ctx.stroke(); ctx.strokeStyle = "#5f7137"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0,-s*.45); ctx.quadraticCurveTo(s*.2,-s*.67,s*.3,-s*.82); ctx.stroke(); }
      if (item.type === "cone") { ctx.fillStyle="#9b6338"; ctx.strokeStyle="#69442b"; ctx.lineWidth=2; ctx.beginPath(); ctx.ellipse(0,0,s*.38,s*.62,0,0,Math.PI*2); ctx.fill(); ctx.stroke(); ctx.strokeStyle="rgba(80,49,28,.72)"; for(let i=-2;i<=2;i+=1){ctx.beginPath();ctx.arc(i*s*.12, i%2?s*.06:-s*.06, s*.19,0,Math.PI);ctx.stroke();} }
      if (item.type === "berries") { ctx.fillStyle="#bd5d51"; ctx.strokeStyle="#783d39"; ctx.lineWidth=1.5; [[-s*.23,0],[s*.08,-s*.13],[s*.23,s*.18],[-s*.08,s*.2]].forEach(([px,py])=>{ctx.beginPath();ctx.arc(px,py,s*.2,0,Math.PI*2);ctx.fill();ctx.stroke();}); ctx.strokeStyle="#61783b";ctx.beginPath();ctx.moveTo(0,-s*.15);ctx.lineTo(s*.22,-s*.48);ctx.stroke(); }
      if (item.type === "hazelnut" || item.type === "walnut") { ctx.fillStyle=item.type==="walnut"?"#9d724f":"#bd8a50";ctx.strokeStyle="#68462f";ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(0,0,s*.52,s*.44,0,0,Math.PI*2);ctx.fill();ctx.stroke();if(item.type==="walnut"){ctx.beginPath();ctx.moveTo(0,-s*.4);ctx.quadraticCurveTo(-s*.12,0,0,s*.4);ctx.quadraticCurveTo(s*.12,0,0,-s*.4);ctx.stroke();} }
      if (item.type === "branch") { ctx.strokeStyle="#795338";ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(-s*.7,s*.3);ctx.lineTo(s*.7,-s*.3);ctx.moveTo(-s*.12,s*.02);ctx.lineTo(-s*.28,-s*.45);ctx.moveTo(s*.2,-s*.14);ctx.lineTo(s*.56,-s*.48);ctx.stroke(); }
      if (item.type === "stone") { ctx.fillStyle="#8d9187";ctx.strokeStyle="#5d615c";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-s*.55,s*.22);ctx.lineTo(-s*.25,-s*.38);ctx.lineTo(s*.35,-s*.36);ctx.lineTo(s*.55,s*.23);ctx.lineTo(s*.12,s*.45);ctx.closePath();ctx.fill();ctx.stroke(); }
      if (item.type === "mushroom") { ctx.fillStyle="#d4c4a1";ctx.strokeStyle="#705441";ctx.lineWidth=2;ctx.fillRect(-s*.12,-s*.02,s*.24,s*.55);ctx.strokeRect(-s*.12,-s*.02,s*.24,s*.55);ctx.fillStyle="#a75c47";ctx.beginPath();ctx.arc(0,-s*.1,s*.48,Math.PI,0);ctx.closePath();ctx.fill();ctx.stroke();ctx.fillStyle="#eee3c8";ctx.beginPath();ctx.arc(-s*.13,-s*.2,s*.06,0,Math.PI*2);ctx.arc(s*.14,-s*.1,s*.05,0,Math.PI*2);ctx.fill(); }
      ctx.restore();
    }

    drawParticles(ctx) { for (const particle of this.particles) if (particle.active) { ctx.save(); ctx.globalAlpha = Math.max(0, particle.life * 1.4); ctx.fillStyle = particle.type === "star" ? "#e7b445" : particle.type === "leaf" ? "#839150" : "#fff0aa"; ctx.translate(particle.x, particle.y); ctx.rotate(particle.life * 5); if (particle.type === "star") { ctx.beginPath(); for (let index=0;index<10;index+=1){const radius=index%2?particle.size*.42:particle.size;const angle=-Math.PI/2+index*Math.PI/5;const px=Math.cos(angle)*radius;const py=Math.sin(angle)*radius;index?ctx.lineTo(px,py):ctx.moveTo(px,py);}ctx.closePath();ctx.fill(); } else { ctx.beginPath();ctx.ellipse(0,0,particle.size*.42,particle.size,0,0,Math.PI*2);ctx.fill(); } ctx.restore(); } }
  }

  window.addEventListener("DOMContentLoaded", () => { window.HFForestCatcher = new ForestCatcherGame(); });
})();
