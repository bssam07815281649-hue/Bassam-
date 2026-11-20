class SoundEngine {
  private ctx: AudioContext | null = null;
  private muted = false;
  private volume = 0.55;
  private lastShotTime: Record<string, number> = {};

  private ensureContext(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public unlock(): void {
    this.ensureContext();
  }

  public setMuted(m: boolean): void {
    this.muted = m;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
  }

  public getVolume(): number {
    return this.volume;
  }

  private canPlay(key: string, minGapMs: number): boolean {
    const now = performance.now();
    if (this.lastShotTime[key] && now - this.lastShotTime[key] < minGapMs) {
      return false;
    }
    this.lastShotTime[key] = now;
    return true;
  }

  public playGunShot(): void {
    if (!this.canPlay('gun', 65)) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(340 + Math.random() * 80, t);
    osc.frequency.exponentialRampToValueAtTime(95, t + 0.055);
    gain.gain.setValueAtTime(0.08 * this.volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.065);
  }

  public playCannonShot(): void {
    if (!this.canPlay('cannon', 120)) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(145, t);
    osc.frequency.exponentialRampToValueAtTime(38, t + 0.24);
    gain.gain.setValueAtTime(0.24 * this.volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.26);
  }

  public playExplosion(): void {
    if (!this.canPlay('explosion', 90)) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const t = ctx.currentTime;
    const bufferSize = Math.floor(ctx.sampleRate * 0.22);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.35));
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(480, t);
    filter.frequency.exponentialRampToValueAtTime(90, t + 0.22);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.2 * this.volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    noise.connect(filter).connect(gain).connect(ctx.destination);
    noise.start(t);
  }

  public playSniperShot(): void {
    if (!this.canPlay('sniper', 120)) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(960, t);
    osc.frequency.exponentialRampToValueAtTime(180, t + 0.14);
    gain.gain.setValueAtTime(0.18 * this.volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.16);
  }

  public playLightningZap(): void {
    if (!this.canPlay('lightning', 95)) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(1250 + Math.random() * 350, t);
    osc.frequency.exponentialRampToValueAtTime(420, t + 0.09);
    gain.gain.setValueAtTime(0.09 * this.volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.11);
  }

  public playRicochet(): void {
    if (!this.canPlay('ricochet', 130)) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1800 + Math.random() * 450, t);
    osc.frequency.exponentialRampToValueAtTime(2400, t + 0.06);
    gain.gain.setValueAtTime(0.06 * this.volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.075);
  }

  public playShieldBreak(): void {
    if (!this.canPlay('shield', 120)) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const t = ctx.currentTime;
    [880, 1175, 1568].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t + i * 0.03);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.5, t + i * 0.03 + 0.12);
      gain.gain.setValueAtTime(0.11 * this.volume, t + i * 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.03 + 0.13);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t + i * 0.03);
      osc.stop(t + i * 0.03 + 0.14);
    });
  }

  public playBuild(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const t = ctx.currentTime;
    [260, 390, 520].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t + i * 0.045);
      gain.gain.setValueAtTime(0.14 * this.volume, t + i * 0.045);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.045 + 0.1);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t + i * 0.045);
      osc.stop(t + i * 0.045 + 0.11);
    });
  }

  public playWaveHorn(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const t = ctx.currentTime;
    [220, 277.18, 329.63].forEach((freq) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.06 * this.volume, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.46);
    });
  }

  public playHouseHit(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.linearRampToValueAtTime(70, t + 0.22);
    gain.gain.setValueAtTime(0.22 * this.volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.25);
  }
}

export const soundEngine = new SoundEngine();
