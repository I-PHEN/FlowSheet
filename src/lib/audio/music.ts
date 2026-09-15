/**
 * Tour music — a procedural lo-fi instrumental bed, explainer-video style.
 *
 * Requirements it answers: pure instrumental, no vocals, no lyrics, just a
 * calm beat that keeps focus. Rather than shipping a licensed audio file,
 * the whole track is synthesized in the browser with the Web Audio API:
 * nothing to download, loops seamlessly, and can duck under narration.
 *
 * Sound: ~82 BPM boom-bap groove — soft kick, rim-ish snare, swung hats,
 * warm seventh chords (Rhodes-like detuned triangles through a lowpass),
 * a sine bass on chord roots, and a whisper of filtered noise for warmth.
 * Chord loop: Cmaj7 → Am7 → Fmaj7 → G7, with a higher voicing every other
 * cycle so it never feels like a 4-second sample on repeat.
 *
 * Architecture: the classic lookahead scheduler — a setInterval clock
 * schedules 16th-notes ~0.2 s ahead of the audio clock, so timing is
 * sample-accurate even if the main thread stutters.
 */

export type MusicState = 'stopped' | 'running';

const BPM = 82;
const SIXTEENTH = 60 / BPM / 4; // seconds per 16th note
const SCHEDULE_AHEAD = 0.22; // s of lookahead
const TICK_MS = 30;

/** MIDI → Hz */
const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

// chord loop: [chord tones, bass root] — all diatonic, jazzy-sevenths
const CHORDS: { tones: number[]; root: number }[] = [
  { tones: [60, 64, 67, 71], root: 36 }, // Cmaj7
  { tones: [57, 60, 64, 67], root: 33 }, // Am7
  { tones: [53, 57, 60, 64], root: 41 }, // Fmaj7
  { tones: [55, 59, 62, 65], root: 43 }, // G7
];

class TourMusic {
  private ctx: AudioContext | null = null;
  private out: GainNode | null = null; // fade in/out envelope (master level)
  private duck: GainNode | null = null; // narration ducking (1 ↔ 0.3)
  private comp: DynamicsCompressorNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private noise: AudioBufferSourceNode | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private nextTime = 0; // audio-clock time of the next 16th
  private step = 0; // 16th-note counter within the 4-bar loop (0..63)
  private cycle = 0; // which pass through the loop (for voicing variation)
  private ducked = false;
  private baseVolume = 0.5;
  state: MusicState = 'stopped';

  /** the shared AudioContext (created lazily, resumed on user gesture) */
  context(): AudioContext | null {
    return this.ctx;
  }

  /** create/resume the context — safe to call from any click handler */
  async unlock(): Promise<AudioContext | null> {
    try {
      if (!this.ctx) {
        const AC: typeof AudioContext =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AC) return null;
        this.ctx = new AC();
      }
      if (this.ctx.state === 'suspended') await this.ctx.resume();
      return this.ctx;
    } catch {
      return null;
    }
  }

  async start(): Promise<void> {
    const ctx = await this.unlock();
    if (!ctx) return;
    if (this.state === 'running') return;

    if (!this.out || !this.duck || !this.comp) this.buildGraph(ctx);

    // fresh loop, gentle 1.4 s fade-in
    this.step = 0;
    this.cycle = 0;
    this.nextTime = ctx.currentTime + 0.08;
    this.out!.gain.cancelScheduledValues(ctx.currentTime);
    this.out!.gain.setValueAtTime(0.0001, ctx.currentTime);
    this.out!.gain.linearRampToValueAtTime(this.baseVolume, ctx.currentTime + 1.4);

    this.startNoiseBed(ctx);
    this.timer = setInterval(() => this.schedule(), TICK_MS);
    this.state = 'running';
  }

  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.state = 'stopped';
    const ctx = this.ctx;
    if (ctx && this.out) {
      // 0.8 s fade-out, then silence the graph
      this.out.gain.cancelScheduledValues(ctx.currentTime);
      this.out.gain.setValueAtTime(Math.max(this.out.gain.value, 0.0001), ctx.currentTime);
      this.out.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.8);
      const out = this.out;
      setTimeout(() => {
        try {
          out.gain.value = 0.0001;
        } catch {
          /* context may be gone */
        }
      }, 900);
    }
    this.stopNoiseBed();
  }

  /** smooth dip while the narrator speaks, release when they finish */
  setDuck(ducked: boolean): void {
    if (this.ducked === ducked) return;
    this.ducked = ducked;
    const ctx = this.ctx;
    if (!ctx || !this.duck) return;
    const now = ctx.currentTime;
    const target = ducked ? 0.3 : 1;
    this.duck.gain.cancelScheduledValues(now);
    this.duck.gain.setValueAtTime(Math.max(this.duck.gain.value, 0.0001), now);
    this.duck.gain.linearRampToValueAtTime(target, now + (ducked ? 0.35 : 0.9));
  }

  // ------------------------------------------------------------------
  // graph + voices
  // ------------------------------------------------------------------

  private buildGraph(ctx: AudioContext) {
    this.duck = ctx.createGain();
    this.out = ctx.createGain();
    this.comp = ctx.createDynamicsCompressor();
    this.comp.threshold.value = -18;
    this.comp.knee.value = 24;
    this.comp.ratio.value = 4;
    this.comp.attack.value = 0.004;
    this.comp.release.value = 0.24;
    this.duck.connect(this.out);
    this.out.connect(this.comp);
    this.comp.connect(ctx.destination);
    this.out.gain.value = 0.0001;
    this.duck.gain.value = 1;
    if (this.ducked) this.duck.gain.value = 0.3;
    // one shared noise buffer for hats, snare body, and the warmth bed
    const len = Math.floor(ctx.sampleRate * 2);
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  }

  private noiseBuffer(ctx: AudioContext): AudioBuffer {
    if (!this.noiseBuf) this.buildGraph(ctx);
    return this.noiseBuf!;
  }

  /** barely-audible filtered noise = vinyl-room warmth */
  private startNoiseBed(ctx: AudioContext) {
    this.stopNoiseBed();
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(ctx);
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 3600;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 300;
    const g = ctx.createGain();
    g.gain.value = 0.012;
    src.connect(hp);
    hp.connect(lp);
    lp.connect(g);
    g.connect(this.duck!);
    src.start();
    this.noise = src;
  }

  private stopNoiseBed() {
    try {
      this.noise?.stop();
    } catch {
      /* already stopped */
    }
    this.noise = null;
  }

  /** lookahead clock: schedule every 16th that is due */
  private schedule() {
    const ctx = this.ctx;
    if (!ctx || this.state !== 'running') return;
    while (this.nextTime < ctx.currentTime + SCHEDULE_AHEAD) {
      this.playStep(this.step, this.nextTime);
      this.nextTime += SIXTEENTH;
      this.step = (this.step + 1) % 64;
      if (this.step === 0) this.cycle++;
    }
  }

  /** one 16th note of the groove */
  private playStep(step: number, t: number) {
    const bar = Math.floor(step / 16); // 0..3 → chord index
    const s = step % 16; // position within the bar
    const chord = CHORDS[bar];

    // swing: delay the off-8ths slightly
    const swing = s % 4 === 2 ? SIXTEENTH * 0.16 : 0;
    const ts = t + swing;

    // kick: 1 and the "and" of 3
    if (s === 0 || s === 10) this.kick(ts, s === 0 ? 1 : 0.82);
    // snare: 2 and 4
    if (s === 4 || s === 12) this.snare(ts, s === 12 ? 0.9 : 1);
    // hats: steady 8ths, ghost 16th before beat 3, open hat end of loop
    if (s % 2 === 0) this.hat(ts, s % 4 === 0 ? 0.72 : 0.5, false);
    if (s === 7 && bar % 2 === 1) this.hat(ts, 0.3, false);
    if (s === 14 && bar === 3) this.hat(ts, 0.55, true);

    // chords: warm stab on the "and" of 1, softer one on the "and" of 3
    const highVoicing = this.cycle % 2 === 1;
    if (s === 2) this.chord(chord.tones, ts, 1.5, 0.115, highVoicing);
    if (s === 10) this.chord(chord.tones, ts, 0.9, 0.075, highVoicing);

    // bass: root on 1, fifth-ish re-pluck on the "and" of 2
    if (s === 0) this.bass(chord.root, ts, 1.3, 0.26);
    if (s === 6 && bar !== 1) this.bass(chord.root + 7, ts, 0.6, 0.17);
  }

  private kick(t: number, vel: number) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(44, t + 0.11);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.9 * vel, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
    osc.connect(g);
    g.connect(this.duck!);
    osc.start(t);
    osc.stop(t + 0.26);
  }

  private snare(t: number, vel: number) {
    const ctx = this.ctx!;
    // noise body
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(ctx);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1900;
    bp.Q.value = 0.9;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.3 * vel, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    src.connect(bp);
    bp.connect(g);
    g.connect(this.duck!);
    src.start(t);
    src.stop(t + 0.2);
    // rim click
    const osc = ctx.createOscillator();
    const og = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(240, t);
    og.gain.setValueAtTime(0.0001, t);
    og.gain.linearRampToValueAtTime(0.12 * vel, t + 0.002);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    osc.connect(og);
    og.connect(this.duck!);
    osc.start(t);
    osc.stop(t + 0.08);
  }

  private hat(t: number, vel: number, open: boolean) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(ctx);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 8200;
    const g = ctx.createGain();
    const dur = open ? 0.22 : 0.05;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.11 * vel, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(hp);
    hp.connect(g);
    g.connect(this.duck!);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  /** Rhodes-ish chord: detuned triangles → lowpass, soft attack */
  private chord(tones: number[], t: number, dur: number, level: number, highVoicing: boolean) {
    const ctx = this.ctx!;
    const notes = highVoicing ? tones.map((n) => n + 12) : tones;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(700, t);
    lp.frequency.linearRampToValueAtTime(1600, t + 0.25);
    lp.frequency.linearRampToValueAtTime(900, t + dur);
    lp.Q.value = 0.4;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(level, t + 0.05);
    g.gain.setValueAtTime(level, t + dur * 0.55);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    lp.connect(g);
    g.connect(this.duck!);
    for (const note of notes) {
      for (const detune of [-4, 4]) {
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = hz(note);
        osc.detune.value = detune;
        osc.connect(lp);
        osc.start(t);
        osc.stop(t + dur + 0.05);
      }
    }
  }

  private bass(root: number, t: number, dur: number, level: number) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const harm = ctx.createOscillator();
    const g = ctx.createGain();
    const hg = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = hz(root);
    harm.type = 'triangle';
    harm.frequency.value = hz(root + 12);
    hg.gain.value = 0.18;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(level, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    harm.connect(hg);
    hg.connect(g);
    osc.connect(g);
    g.connect(this.duck!);
    osc.start(t);
    harm.start(t);
    osc.stop(t + dur + 0.05);
    harm.stop(t + dur + 0.05);
  }
}

/** singleton — one music bed for the whole app */
export const tourMusic = new TourMusic();
