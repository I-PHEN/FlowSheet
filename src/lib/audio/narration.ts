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
 * - The element is lazily routed through an AnalyserNode so the voice can
 *   be SEEN: amplitude() exposes its live loudness (0..1) for the hero
 *   voice card's waveform. If the graph cannot run (no gesture yet, no
 *   WebAudio), playback stays native and amplitude() is null — callers
 *   animate a fallback instead.
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
  // the analyser graph (the hero voice card's waveform):
  // element → analyser → destination, wired once, after the first
  // successful play (a user gesture is on the stack)
  private actx: AudioContext | null = null;
  private elemSrc: MediaElementAudioSourceNode | null = null;
  private analyser: AnalyserNode | null = null;
  private analysBuf: Uint8Array<ArrayBuffer> | null = null;
  private analyserDead = false; // wiring failed once → native playback forever
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

  /**
   * The raw script the voice is currently loading or speaking, else null.
   * The caption bar matches THIS against its stop's script — the reveal
   * tracks the voice only when the voice is actually saying this caption.
   */
  scriptOn(): string | null {
    return this.state === 'loading' || this.state === 'speaking' ? this.currentText : null;
  }

  /**
   * Real playback position, 0..1, while audio is playing — else null.
   * currentTime / duration of the live element: the caption bar polls this
   * every frame and reveals words exactly as they are spoken, so captions
   * can never drift from the voice (any voice, any speed).
   */
  progress(): number | null {
    const el = this.audio;
    if (!el || this.state !== 'speaking') return null;
    const d = el.duration;
    if (!Number.isFinite(d) || d <= 0) return null;
    return Math.min(1, Math.max(0, el.currentTime / d));
  }

  private el(): HTMLAudioElement {
    if (!this.audio) {
      this.audio = new Audio();
      this.audio.preload = 'auto';
      this.audio.volume = 0.95;
    }
    return this.audio;
  }

  /** the listener's level for the voice itself (the hero card's slider) */
  setVolume(v: number): void {
    this.el().volume = Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0.95));
  }

  /** the voice element's current level, 0..1 */
  volume(): number {
    return this.el().volume;
  }

  /**
   * Live loudness of the voice, 0..1, or null when the voice is not
   * speaking or the analyser graph is unavailable. The hero voice card
   * draws its waveform from THIS — the ribbon is Orion's actual voice,
   * not a looping animation.
   */
  amplitude(): number | null {
    if (this.state !== 'speaking' || !this.analyser || !this.analysBuf) return null;
    this.analyser.getByteTimeDomainData(this.analysBuf);
    let sum = 0;
    for (let i = 0; i < this.analysBuf.length; i++) {
      const d = (this.analysBuf[i] - 128) / 128;
      sum += d * d;
    }
    const rms = Math.sqrt(sum / this.analysBuf.length);
    return Math.min(1, rms * 3.4); // speech RMS ≈ 0.03..0.3 → a 0..1 envelope
  }

  /**
   * Wire the analyser graph on the first successful play — from then on
   * the element's sound flows element → analyser → destination (same
   * volume, now readable). Built only when the AudioContext can actually
   * run: routing through a suspended context would SILENCE the element,
   * so no-gesture situations stay on native playback.
   */
  private async attachAnalyser(): Promise<void> {
    if (this.analyser || this.analyserDead) return;
    const el = this.audio;
    if (!el) return;
    try {
      const AC: typeof AudioContext | undefined =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      const ctx = this.actx ?? new AC();
      this.actx = ctx;
      if (ctx.state === 'suspended') await ctx.resume().catch(() => undefined);
      if (ctx.state !== 'running') return;
      if (!this.elemSrc) {
        this.elemSrc = ctx.createMediaElementSource(el);
        this.analyser = ctx.createAnalyser();
        this.analyser.fftSize = 2048;
        this.analyser.smoothingTimeConstant = 0.55;
        this.elemSrc.connect(this.analyser);
        this.analyser.connect(ctx.destination);
        this.analysBuf = new Uint8Array(this.analyser.fftSize);
      }
    } catch {
      this.analyserDead = true; // stay on the native path forever
    }
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
      // let the voice be SEEN — wire the waveform graph on this gesture
      void this.attachAnalyser();
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
