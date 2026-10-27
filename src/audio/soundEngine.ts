class SoundEngine {
  private ctx: AudioContext | null = null;
  private muted = false;
  private lastRustleAt = 0;
  private lastServoAt = 0;
  private lastScanTickAt = 0;
  private rainNode: { source: AudioBufferSourceNode; gain: GainNode } | null = null;

  public unlock(): void {
    if (this.muted) return;
    try {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
    } catch {
      // Ignore audio errors on restricted devices
    }
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.rainNode && this.ctx) {
      this.rainNode.gain.gain.setTargetAtTime(muted ? 0 : 0.04, this.ctx.currentTime, 0.15);
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public playLeafRustle(intensity = 0.5): void {
    if (this.muted) return;
    const nowMs = performance.now();
    if (nowMs - this.lastRustleAt < 90) return;
    this.lastRustleAt = nowMs;

    this.unlock();
    if (!this.ctx) return;

    const dur = 0.14 + Math.min(0.18, intensity * 0.15);
    const sampleRate = this.ctx.sampleRate;
    const length = Math.floor(sampleRate * dur);
    const buffer = this.ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      const env = Math.sin((i / length) * Math.PI);
      data[i] = (Math.random() * 2 - 1) * env;
    }

    const src = this.ctx.createBufferSource();
    src.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1800 + intensity * 1400;
    filter.Q.value = 1.6;

    const gain = this.ctx.createGain();
    gain.gain.value = Math.min(0.12, 0.03 + intensity * 0.07);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    src.start();
  }

  public playServoMove(speed = 0.5): void {
    if (this.muted) return;
    const nowMs = performance.now();
    if (nowMs - this.lastServoAt < 75) return;
    this.lastServoAt = nowMs;

    this.unlock();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140 + Math.min(220, speed * 180), t);
    osc.frequency.exponentialRampToValueAtTime(195 + Math.min(260, speed * 210), t + 0.055);

    gain.gain.setValueAtTime(0.018, t);
    gain.gain.exponentialRampToValueAtTime(0.0008, t + 0.06);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.065);
  }

  public playScanTick(progress: number): void {
    if (this.muted) return;
    const nowMs = performance.now();
    if (nowMs - this.lastScanTickAt < 130) return;
    this.lastScanTickAt = nowMs;

    this.unlock();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    const freq = 520 + (progress / 100) * 620;
    osc.frequency.setValueAtTime(freq, t);

    gain.gain.setValueAtTime(0.035, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.075);
  }

  public playDiagnosisComplete(isHealthy: boolean, highSeverity: boolean): void {
    if (this.muted) return;
    this.unlock();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const notes = isHealthy
      ? [523.25, 659.25, 783.99, 1046.5]
      : highSeverity
        ? [587.33, 440.0, 587.33]
        : [440.0, 554.37, 659.25];

    notes.forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = highSeverity ? 'sawtooth' : 'sine';
      const start = t + idx * 0.085;
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(highSeverity ? 0.045 : 0.06, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.22);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(start);
      osc.stop(start + 0.24);
    });
  }

  public playActionSuccess(): void {
    if (this.muted) return;
    this.unlock();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    [587.33, 783.99, 1174.66].forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      const start = t + idx * 0.07;
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.065, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.24);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(start);
      osc.stop(start + 0.26);
    });
  }

  public playWarningBeep(): void {
    if (this.muted) return;
    this.unlock();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(260, t);
    osc.frequency.setValueAtTime(210, t + 0.09);
    gain.gain.setValueAtTime(0.04, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.21);
  }

  public setRainAmbience(active: boolean): void {
    if (!active) {
      if (this.rainNode && this.ctx) {
        try {
          this.rainNode.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2);
          setTimeout(() => {
            try {
              this.rainNode?.source.stop();
            } catch {
              // ignore
            }
            this.rainNode = null;
          }, 350);
        } catch {
          this.rainNode = null;
        }
      }
      return;
    }

    if (this.muted) return;
    this.unlock();
    if (!this.ctx || this.rainNode) return;

    const sampleRate = this.ctx.sampleRate;
    const length = sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      data[i] = (lastOut + 0.04 * white) / 1.04;
      lastOut = data[i];
      data[i] *= 2.5;
    }

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1100;
    filter.Q.value = 0.7;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, this.ctx.currentTime);
    gain.gain.setTargetAtTime(0.035, this.ctx.currentTime, 0.4);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    source.start();
    this.rainNode = { source, gain };
  }
}

export const soundEngine = new SoundEngine();
