(function (window, document) {
  "use strict";

  const PAIR_COUNT = 6;
  const MISMATCH_DELAY_MS = 850;

  class MemoryCard {
    constructor(card, onSelect) {
      this.card = card;
      this.onSelect = onSelect;
      this.isRevealed = false;
      this.isMatched = false;
      this.element = this.render();
    }

    render() {
      const button = document.createElement("button");
      button.className = "memory-card";
      button.type = "button";
      button.dataset.cardId = this.card.instanceId;
      button.setAttribute("aria-label", "Открыть карточку");
      button.innerHTML = `
        <span class="memory-card__inner">
          <span class="memory-card__face memory-card__back" aria-hidden="true">
            <span class="memory-card__back-pattern">❧</span>
          </span>
          <span class="memory-card__face memory-card__front">
            <picture>
              ${this.card.optimizedImageUrl ? `<source srcset="${this.card.optimizedImageUrl}" type="image/avif" />` : ""}
              <img src="${this.card.imageUrl}" alt="${this.card.alt}" width="1536" height="1024" draggable="false" />
            </picture>
            <span class="memory-card__fallback" aria-hidden="true"><span>❧</span>Иллюстрация</span>
          </span>
        </span>
      `;

      const image = button.querySelector("img");
      image.addEventListener("error", () => {
        button.classList.add("has-image-error");
        image.hidden = true;
      });

      button.addEventListener("click", () => this.onSelect(this));
      return button;
    }

    reveal() {
      this.isRevealed = true;
      this.element.classList.add("is-revealed");
      this.element.disabled = true;
      this.element.setAttribute("aria-label", `Открыта карточка: ${this.card.title}`);
    }

    hide() {
      this.isRevealed = false;
      this.element.classList.remove("is-revealed");
      this.element.disabled = false;
      this.element.setAttribute("aria-label", "Открыть карточку");
    }

    match() {
      this.isMatched = true;
      this.element.classList.add("is-matched");
      this.element.disabled = true;
      this.element.setAttribute("aria-label", "Пара найдена");
    }

    setBlocked(isBlocked) {
      if (this.isMatched || this.isRevealed) return;
      this.element.disabled = isBlocked;
    }
  }

  class MemoryGame {
    constructor(root) {
      this.root = root;
      this.loading = document.querySelector("#memoryGameLoading");
      this.content = document.querySelector("#memoryGameContent");
      this.grid = document.querySelector("#memoryGrid");
      this.movesElement = document.querySelector("#memoryMoves");
      this.matchesElement = document.querySelector("#memoryMatches");
      this.announcement = document.querySelector("#memoryAnnouncement");
      this.victory = document.querySelector("#memoryVictory");
      this.victorySummary = document.querySelector("#memoryVictorySummary");
      this.cards = [];
      this.openCards = [];
      this.moves = 0;
      this.matches = 0;
      this.isLocked = false;
      this.isReady = false;
      this.closeTimer = null;
      this.imageLoadState = new Map();
      this.illustrations = this.getIllustrations();

      document.querySelector("#memoryRestartTop")?.addEventListener("click", () => this.restart());
      document.querySelector("#memoryPlayAgain")?.addEventListener("click", () => this.restart());
    }

    getIllustrations() {
      const stories = window.HFStoryService?.getBuiltInStories?.() || [];
      return stories.slice(0, PAIR_COUNT).map((story) => ({
        pairId: story.id,
        title: story.title,
        imageUrl: story.imageUrl,
        optimizedImageUrl: this.getOptimizedImageUrl(story.imageUrl),
        alt: `Иллюстрация из истории «${story.title}»`
      }));
    }

    getOptimizedImageUrl(imageUrl) {
      const builtInAsset = String(imageUrl || "").match(/^assets\/stories\/([a-z0-9-]+)\.png$/i);
      return builtInAsset ? `assets/optimized/${builtInAsset[1]}-480.avif` : "";
    }

    async initialize() {
      if (this.isReady) return;

      await this.preloadIllustrations();
      this.isReady = true;
      this.loading.classList.add("hidden");
      this.content.classList.remove("hidden");
      this.restart({ focusFirstCard: false });
    }

    loadImage(imageUrl) {
      return new Promise((resolve) => {
        const image = new Image();
        image.onload = () => resolve(true);
        image.onerror = () => resolve(false);
        image.src = imageUrl;
      });
    }

    preloadIllustrations() {
      const tasks = this.illustrations.map(async (illustration) => {
        if (illustration.optimizedImageUrl && await this.loadImage(illustration.optimizedImageUrl)) {
          this.imageLoadState.set(illustration.pairId, "optimized");
          return;
        }

        const fallbackLoaded = await this.loadImage(illustration.imageUrl);
        this.imageLoadState.set(illustration.pairId, fallbackLoaded ? "fallback" : "error");
      });

      return Promise.all(tasks);
    }

    createDeck() {
      const pairedCards = this.illustrations.flatMap((illustration) => [0, 1].map((copyIndex) => ({
        ...illustration,
        instanceId: `${illustration.pairId}-${copyIndex}`,
        optimizedImageUrl: this.imageLoadState.get(illustration.pairId) === "optimized"
          ? illustration.optimizedImageUrl
          : "",
        hasImageError: this.imageLoadState.get(illustration.pairId) === "error"
      })));

      for (let index = pairedCards.length - 1; index > 0; index -= 1) {
        const randomIndex = Math.floor(Math.random() * (index + 1));
        [pairedCards[index], pairedCards[randomIndex]] = [pairedCards[randomIndex], pairedCards[index]];
      }

      return pairedCards;
    }

    restart(options = {}) {
      window.clearTimeout(this.closeTimer);
      this.closeTimer = null;
      this.moves = 0;
      this.matches = 0;
      this.isLocked = false;
      this.openCards = [];
      this.victory.classList.add("hidden");
      this.grid.classList.remove("is-complete");
      this.announcement.textContent = "Новая игра началась. Найди 6 пар.";
      this.renderStats();
      this.grid.replaceChildren();

      this.cards = this.createDeck().map((cardData) => {
        const card = new MemoryCard(cardData, (selectedCard) => this.selectCard(selectedCard));
        if (cardData.hasImageError) {
          const image = card.element.querySelector("img");
          card.element.classList.add("has-image-error");
          if (image) image.hidden = true;
        }
        this.grid.append(card.element);
        return card;
      });

      if (options.focusFirstCard !== false) {
        window.setTimeout(() => this.cards[0]?.element.focus({ preventScroll: true }), 0);
      }
    }

    selectCard(card) {
      if (this.isLocked || card.isRevealed || card.isMatched) return;

      card.reveal();
      this.openCards.push(card);

      if (this.openCards.length < 2) {
        this.announcement.textContent = `Открыта карточка: ${card.card.title}.`;
        return;
      }

      this.moves += 1;
      this.renderStats();
      this.checkPair();
    }

    checkPair() {
      const [firstCard, secondCard] = this.openCards;
      const isMatch = firstCard.card.pairId === secondCard.card.pairId;

      if (isMatch) {
        firstCard.match();
        secondCard.match();
        this.matches += 1;
        this.openCards = [];
        this.renderStats();
        this.announcement.textContent = `Пара найдена: ${firstCard.card.title}. Найдено ${this.matches} из ${PAIR_COUNT}.`;

        if (this.matches === PAIR_COUNT) this.complete();
        return;
      }

      this.isLocked = true;
      this.cards.forEach((gameCard) => gameCard.setBlocked(true));
      this.announcement.textContent = "Карточки разные. Запомни их — сейчас они закроются.";
      this.closeTimer = window.setTimeout(() => {
        firstCard.hide();
        secondCard.hide();
        this.openCards = [];
        this.isLocked = false;
        this.cards.forEach((gameCard) => gameCard.setBlocked(false));
        this.announcement.textContent = "Карточки закрыты. Можно продолжать.";
        firstCard.element.focus({ preventScroll: true });
      }, MISMATCH_DELAY_MS);
    }

    renderStats() {
      this.movesElement.textContent = `Ходы: ${this.moves}`;
      this.matchesElement.textContent = `Найдено: ${this.matches} из ${PAIR_COUNT}`;
    }

    complete() {
      this.grid.classList.add("is-complete");
      this.victorySummary.textContent = `Ты нашёл все 6 пар за ${this.moves} ${this.getMoveWord(this.moves)}.`;
      this.victory.classList.remove("hidden");
      this.announcement.textContent = "Ура! Все пары найдены!";
      window.setTimeout(() => this.victory.focus({ preventScroll: true }), 250);
    }

    getMoveWord(count) {
      const lastTwoDigits = count % 100;
      const lastDigit = count % 10;
      if (lastTwoDigits >= 11 && lastTwoDigits <= 14) return "ходов";
      if (lastDigit === 1) return "ход";
      if (lastDigit >= 2 && lastDigit <= 4) return "хода";
      return "ходов";
    }
  }

  const root = document.querySelector("#memoryGame");
  if (!root) return;

  const game = new MemoryGame(root);
  window.HFMemoryGame = {
    initialize: () => game.initialize(),
    restart: () => game.restart(),
    getState: () => ({
      isReady: game.isReady,
      moves: game.moves,
      matches: game.matches,
      isLocked: game.isLocked,
      openCards: game.openCards.length,
      cardCount: game.cards.length
    })
  };
})(window, document);
