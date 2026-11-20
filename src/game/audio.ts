import { VehicleKind, WeatherMode } from './types';

export class BengaluruAudio {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private engineOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private rainGain: GainNode | null = null;
  private sirenOsc: OscillatorNode | null = null;
  private sirenGain: GainNode | null = null;
  private radioGain: GainNode | null = null;
  private radioTimer: number | null = null;
  private radioStep = 0;

  private sfxEnabled = true;
  private radioEnabled = true;
  private initialized = false;

  public unlock(): void {
    if (this.initialized) {
      if (this.ctx && this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      return;
    }
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.45;
      this.masterGain.connect(this.ctx.destination);

      // Engine continuous oscillator
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 55;
      const engineFilter = this.ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 280;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      this.engineOsc.connect(engineFilter);
      engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.masterGain);
      this.engineOsc.start();

      // Monsoon rain noise bed
      const bufferSize = this.ctx.sampleRate * 2;
      const noiseBuf = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuf.getChannelData(0);
      let b0 = 0;
      let b1 = 0;
      let b2 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.997 * b0 + white * 0.029;
        b1 = 0.985 * b1 + white * 0.032;
        b2 = 0.950 * b2 + white * 0.048;
        output[i] = (b0 + b1 + b2 + white * 0.08) * 0.35;
      }
      const rainSrc = this.ctx.createBufferSource();
      rainSrc.buffer = noiseBuf;
      rainSrc.loop = true;
      const rainFilter = this.ctx.createBiquadFilter();
      rainFilter.type = 'bandpass';
      rainFilter.frequency.value = 1100;
      this.rainGain = this.ctx.createGain();
      this.rainGain.gain.value = 0;
      rainSrc.connect(rainFilter);
      rainFilter.connect(this.rainGain);
      this.rainGain.connect(this.masterGain);
      rainSrc.start();

      // Police siren oscillator
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'triangle';
      this.sirenOsc.frequency.value = 650;
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0;
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.masterGain);
      this.sirenOsc.start();

      // Radio gain + gentle synth-carnatic pentatonic sequence
      this.radioGain = this.ctx.createGain();
      this.radioGain.gain.value = 0.14;
      this.radioGain.connect(this.masterGain);
      this.startRadioSequencer();

      this.initialized = true;
    } catch {
      // AudioContext unavailable in headless environment
    }
  }

  private startRadioSequencer(): void {
    // Raga Hamsadhwani inspired pentatonic notes (C, D, E, G, B)
    const scale = [261.63, 293.66, 329.63, 392.0, 493.88, 523.25, 392.0, 329.63];
    const bass = [130.81, 130.81, 196.0, 146.83];
    this.radioTimer = window.setInterval(() => {
      if (!this.ctx || !this.radioGain || !this.radioEnabled || !this.sfxEnabled) return;
      if (this.ctx.state !== 'running') return;
      const now = this.ctx.currentTime;
      const step = this.radioStep % scale.length;
      this.radioStep++;

      const lead = this.ctx.createOscillator();
      const lGain = this.ctx.createGain();
      lead.type = 'sine';
      lead.frequency.setValueAtTime(scale[step], now);
      lGain.gain.setValueAtTime(0.001, now);
      lGain.gain.exponentialRampToValueAtTime(0.11, now + 0.03);
      lGain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
      lead.connect(lGain);
      lGain.connect(this.radioGain);
      lead.start(now);
      lead.stop(now + 0.4);

      if (step % 2 === 0) {
        const bOsc = this.ctx.createOscillator();
        const bGain = this.ctx.createGain();
        bOsc.type = 'triangle';
        bOsc.frequency.setValueAtTime(bass[(step / 2) % bass.length], now);
        bGain.gain.setValueAtTime(0.001, now);
        bGain.gain.exponentialRampToValueAtTime(0.14, now + 0.02);
        bGain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
        bOsc.connect(bGain);
        bGain.connect(this.radioGain);
        bOsc.start(now);
        bOsc.stop(now + 0.46);
      }
    }, 420);
  }

  public setSettings(sfxOn: boolean, radioOn: boolean): void {
    this.sfxEnabled = sfxOn;
    this.radioEnabled = radioOn;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(sfxOn ? 0.45 : 0, this.ctx.currentTime, 0.05);
    }
    if (this.radioGain && this.ctx) {
      this.radioGain.gain.setTargetAtTime(radioOn && sfxOn ? 0.14 : 0, this.ctx.currentTime, 0.08);
    }
  }

  public updateContinuous(
    inVehicle: boolean,
    vehicleKind: VehicleKind | null,
    speedNorm: number,
    wantedStars: number,
    weather: WeatherMode,
    elapsedSec: number
  ): void {
    if (!this.initialized || !this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;

    if (this.engineOsc && this.engineGain) {
      if (inVehicle && vehicleKind && this.sfxEnabled) {
        const baseFreq =
          vehicleKind === 'bmtc' ? 42 : vehicleKind === 'auto' ? 74 : vehicleKind === 'bike' || vehicleKind === 'police_bike' ? 88 : 56;
        const span = vehicleKind === 'bike' ? 175 : vehicleKind === 'coupe' ? 145 : 85;
        this.engineOsc.type = vehicleKind === 'auto' ? 'square' : 'sawtooth';
        this.engineOsc.frequency.setTargetAtTime(baseFreq + speedNorm * span, now, 0.06);
        this.engineGain.gain.setTargetAtTime(0.06 + speedNorm * 0.06, now, 0.06);
      } else {
        this.engineGain.gain.setTargetAtTime(0, now, 0.08);
      }
    }

    if (this.rainGain) {
      const targetRain = weather === 'monsoon' && this.sfxEnabled ? 0.16 : 0;
      this.rainGain.gain.setTargetAtTime(targetRain, now, 0.25);
    }

    if (this.sirenOsc && this.sirenGain) {
      if (wantedStars > 0 && this.sfxEnabled) {
        const wobble = Math.sin(elapsedSec * 7.5);
        this.sirenOsc.frequency.setTargetAtTime(660 + wobble * 210, now, 0.03);
        this.sirenGain.gain.setTargetAtTime(0.055, now, 0.1);
      } else {
        this.sirenGain.gain.setTargetAtTime(0, now, 0.1);
      }
    }
  }

  public playHorn(kind: VehicleKind | null): void {
    if (!this.initialized || !this.ctx || !this.masterGain || !this.sfxEnabled) return;
    const now = this.ctx.currentTime;

    if (kind === 'bmtc') {
      // Dual-tone BMTC air horn
      [220, 277].forEach((f) => {
        const osc = this.ctx!.createOscillator();
        const g = this.ctx!.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(f, now);
        g.gain.setValueAtTime(0.12, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc.connect(g);
        g.connect(this.masterGain!);
        osc.start(now);
        osc.stop(now + 0.36);
      });
    } else if (kind === 'auto') {
      // Classic Indian auto double-beep
      [0, 0.14].forEach((offset) => {
        const osc = this.ctx!.createOscillator();
        const g = this.ctx!.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(540, now + offset);
        g.gain.setValueAtTime(0.08, now + offset);
        g.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.09);
        osc.connect(g);
        g.connect(this.masterGain!);
        osc.start(now + offset);
        osc.stop(now + offset + 0.1);
      });
    } else {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(415, now);
      g.gain.setValueAtTime(0.11, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.24);
    }
  }

  public playImpact(strength = 0.6): void {
    if (!this.initialized || !this.ctx || !this.masterGain || !this.sfxEnabled) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(125, now);
    osc.frequency.exponentialRampToValueAtTime(34, now + 0.18);
    g.gain.setValueAtTime(Math.min(0.24, 0.08 + strength * 0.16), now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.22);
  }

  public playPickup(): void {
    if (!this.initialized || !this.ctx || !this.masterGain || !this.sfxEnabled) return;
    const now = this.ctx.currentTime;
    [523.25, 659.25, 783.99].forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const g = this.ctx!.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.07);
      g.gain.setValueAtTime(0.11, now + idx * 0.07);
      g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.22);
      osc.connect(g);
      g.connect(this.masterGain!);
      osc.start(now + idx * 0.07);
      osc.stop(now + idx * 0.07 + 0.24);
    });
  }

  public playActionPulse(isEmp: boolean): void {
    if (!this.initialized || !this.ctx || !this.masterGain || !this.sfxEnabled) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = isEmp ? 'sawtooth' : 'square';
    osc.frequency.setValueAtTime(isEmp ? 820 : 320, now);
    osc.frequency.exponentialRampToValueAtTime(isEmp ? 110 : 90, now + 0.16);
    g.gain.setValueAtTime(0.13, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  public dispose(): void {
    if (this.radioTimer !== null) {
      clearInterval(this.radioTimer);
      this.radioTimer = null;
    }
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
    this.initialized = false;
  }
}
