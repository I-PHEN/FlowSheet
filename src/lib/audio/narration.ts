/**
 * Narration controller — fetches, caches, and plays tour-step voice-overs
 * from /api/tts.
 *
 * - One HTMLAudioElement for the whole app; a token counter invalidates
 *   stale loads when the user advances quickly between steps.
 * - Blob URLs are cached per narration text, so going Back in a tour (or
 *   replaying a step) is instant and costs no TTS quota.
 * - State is broadcast to a SET of listeners: the tour panel renders twice
 *   (desktop aside + mobile sheet, one hidden by CSS), and both instances
 *   stay in sync; double-mounting a step dedupes to a single voice-over
 *   ("same text already loading/speaking" is a no-op).
 * - The tour layer wires "speaking" to music ducking.
 */

export type NarrationState = 'idle' | 'loading' | 'speaking' | 'blocked' | 'error';

const CACHE_MAX = 48;

class Narrator {
  private audio: HTMLAudioElement | null = null;
  private cache = new Map<string, string>(); // text → blob URL
  private inflight = new Map<string, Promise<string>>();
  private token = 0;
  private currentText: string | null = null; // text being loaded/spoken
  private listeners = new Set<(s: NarrationState) => void>();
  state: NarrationState = 'idle';

  subscribe(fn: (s: NarrationState) => void): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private setState(s: NarrationState) {
    this.state = s;
    for (const fn of this.listeners) {
      try {
        fn(s);
      } catch {
        /* a dead listener must not break the rest */
      }
    }
  }

  private el(): HTMLAudioElement {
    if (!this.audio) {
      this.audio = new Audio();
      this.audio.preload = 'auto';
      this.audio.volume = 0.95;
    }
    return this.audio;
  }

  /** warm the cache for a step the user is likely to open next */
  prefetch(text: string): void {
    if (!text || this.cache.has(text) || this.inflight.has(text)) return;
    void this.load(text).catch(() => {
      /* prefetch failures are non-fatal */
    });
  }

  private async load(text: string): Promise<string> {
    const hit = this.cache.get(text);
    if (hit) return hit;
    const pending = this.inflight.get(text);
    if (pending) return pending;
    const p = (async () => {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error(`tts ${res.status}`);
      const blob = await res.blob();
      if (blob.size < 200) throw new Error('empty audio');
      const url = URL.createObjectURL(blob);
      if (this.cache.has(text)) URL.revokeObjectURL(url); // raced someone
      else {
        this.cache.set(text, url);
        while (this.cache.size > CACHE_MAX) {
          const oldest = this.cache.keys().next().value;
          if (oldest === undefined) break;
          const stale = this.cache.get(oldest);
          this.cache.delete(oldest);
          if (stale) URL.revokeObjectURL(stale);
        }
      }
      return url;
    })().finally(() => {
      this.inflight.delete(text);
    });
    this.inflight.set(text, p);
    return p;
  }

  /**
   * Speak `text`. Idempotent while the same text is loading or playing, so
   * a component that mounts twice (desktop + mobile panels) still produces
   * exactly one voice-over; `force` restarts (the replay button).
   */
  async speak(text: string, opts?: { force?: boolean }): Promise<void> {
    if (!text) return;
    if (!opts?.force && this.currentText === text && (this.state === 'loading' || this.state === 'speaking')) {
      return;
    }
    const my = ++this.token;
    this.currentText = text;
    this.stopPlayback();
    this.setState('loading');
    let url: string;
    try {
      url = await this.load(text);
    } catch {
      if (my === this.token) {
        this.currentText = null;
        this.setState('error');
      }
      return;
    }
    if (my !== this.token) return; // user moved on while loading
    const el = this.el();
    el.src = url;
    el.onended = () => {
      if (my === this.token) {
        this.currentText = null;
        this.setState('idle');
      }
    };
    try {
      await el.play();
      if (my === this.token) this.setState('speaking');
    } catch {
      // autoplay policy or decode failure — offer a manual tap instead
      if (my === this.token) {
        this.currentText = null;
        this.setState('blocked');
      }
    }
  }

  /** replay button — a genuine user gesture just happened */
  async replay(text: string): Promise<void> {
    await this.speak(text, { force: true });
  }

  private stopPlayback(): void {
    if (this.audio) {
      this.audio.pause();
      this.audio.onended = null;
      this.audio.currentTime = 0;
    }
  }

  stop(): void {
    this.token++;
    this.currentText = null;
    this.stopPlayback();
    this.setState('idle');
  }
}

/** singleton — one narrator voice for the whole app */
export const narrator = new Narrator();
