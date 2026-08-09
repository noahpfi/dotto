import { formatClock } from '../copy';
import { el } from './dom';

export interface PlayHandlers {
  readonly onTap: () => void;
}

// call destroy() before swapping screens
export class PlayView {
  readonly root: HTMLElement;
  private readonly dot: HTMLElement;
  private readonly clock: HTMLElement;
  private readonly onPointerDown: (e: PointerEvent) => void;

  constructor(private readonly handlers: PlayHandlers) {
    this.root = el('div', 'fixed inset-0 flex items-center justify-center overflow-hidden bg-ink');
    this.dot = el('div', 'dot');
    this.clock = el(
      'div',
      'absolute bottom-[max(1.75rem,env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 ' +
        'font-mono text-sm tracking-[0.3em] text-bone/25 tabular-nums select-none',
    );
    this.root.append(this.dot, this.clock);

    this.onPointerDown = (e: PointerEvent) => {
      e.preventDefault();
      this.handlers.onTap();
    };
    this.root.addEventListener('pointerdown', this.onPointerDown);
  }

  setRemaining(ms: number): void {
    const next = formatClock(ms);
    if (this.clock.textContent !== next) this.clock.textContent = next;
  }

  setProbeActive(active: boolean): void {
    this.dot.classList.toggle('is-probe', active);
  }

  destroy(): void {
    this.root.removeEventListener('pointerdown', this.onPointerDown);
    this.root.remove();
  }
}
