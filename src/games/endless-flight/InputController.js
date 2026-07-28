export class InputController {
  constructor(canvas, callbacks) {
    this.canvas = canvas;
    this.callbacks = callbacks;
    this.pointerY = 0.5;
    this.pointerActive = false;
    this.keys = new Set();
    this.touch = false;
    this.bind();
  }

  bind() {
    const setPointer = (event) => {
      const rect = this.canvas.getBoundingClientRect();
      this.pointerY = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
      this.touch = event.pointerType === "touch";
    };
    this.canvas.addEventListener("pointerdown", (event) => {
      setPointer(event);
      this.pointerActive = true;
      this.canvas.setPointerCapture?.(event.pointerId);
      this.callbacks.interact();
    });
    this.canvas.addEventListener("pointermove", (event) => { if (event.pointerType === "mouse" || this.pointerActive) setPointer(event); });
    window.addEventListener("pointerup", () => { this.pointerActive = false; });
    this.canvas.addEventListener("wheel", (event) => {
      event.preventDefault();
      this.callbacks.speed(event.deltaY < 0 ? 1 : -1);
    }, { passive: false });
    window.addEventListener("keydown", (event) => {
      if (["ArrowUp", "ArrowDown", "KeyW", "KeyS", "Space"].includes(event.code)) event.preventDefault();
      this.keys.add(event.code);
      if (event.code === "Escape") this.callbacks.pause();
      if (event.code === "Space") this.callbacks.interact();
    });
    window.addEventListener("keyup", (event) => this.keys.delete(event.code));
  }

  get liftHeld() { return this.pointerActive || this.keys.has("Space") || this.keys.has("ArrowUp") || this.keys.has("KeyW"); }
  get downHeld() { return this.keys.has("ArrowDown") || this.keys.has("KeyS"); }
}
