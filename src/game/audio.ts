import { RADIO_CATALOG } from './bengaluruData';
import {
  RadioCategoryId,
  RadioRepeatMode,
  RadioState,
  RadioTrack,
  VehicleKind,
  WeatherMode,
} from './types';

export class BengaluruAudio {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private engineOsc: OscillatorNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private engineGain: GainNode | null = null;
  private rainGain: GainNode | null = null;
  private sirenOsc: OscillatorNode | null = null;
  private sirenGain: GainNode | null = null;
  private radioGain: GainNode | null = null;
  private radioTimer: number | null = null;
  private radioStep = 0;

  private sfxEnabled = true;
  private radioEnabled = true;
  private interiorMuffled = false;
  private initialized = false;

  private category: RadioCategoryId = 'kannada_classic';
  private trackIndex = 0;
  private volume = 0.72;
  private shuffle = false;
  private repeat: RadioRepeatMode = 'all';
  private customTracks: RadioTrack[] = [];
  private htmlAudio: HTMLAudioElement | null = null;
  private currentLocalUrl: string | null = null;
  private lastBpm = 96;

  public unlock(): void {
    if (this.initialized) {
      if (this.ctx && this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      return;
    }
    try {
      const AudioCtx =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.45;
      this.masterGain.connect(this.ctx.destination);

      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 55;
      this.engineFilter = this.ctx.createBiquadFilter();
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.value = 280;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      this.engineOsc.connect(this.engineFilter);
      this.engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.masterGain);
      this.engineOsc.start();

      // Rain / ambient noise bed
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
        b2 = 0.95 * b2 + white * 0.048;
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

      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'triangle';
      this.sirenOsc.frequency.value = 650;
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0;
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.masterGain);
      this.sirenOsc.start();

      this.radioGain = this.ctx.createGain();
      this.radioGain.gain.value = 0.14 * this.volume;
      this.radioGain.connect(this.masterGain);

      this.htmlAudio = new Audio();
      this.htmlAudio.crossOrigin = 'anonymous';
      this.htmlAudio.addEventListener('ended', () => {
        if (this.repeat === 'one') {
          if (this.htmlAudio) {
            this.htmlAudio.currentTime = 0;
            void this.htmlAudio.play().catch(() => {});
          }
        } else {
          this.nextTrack();
        }
      });

      this.restartRadioSequencer();
      this.initialized = true;
    } catch {
      // Ignore if AudioContext blocked
    }
  }

  public getActiveTracks(): RadioTrack[] {
    if (this.category === 'custom_local') {
      return this.customTracks.length > 0 ? this.customTracks : RADIO_CATALOG.slice(0, 3);
    }
    const list = RADIO_CATALOG.filter((t) => t.category === this.category);
    return list.length > 0 ? list : RADIO_CATALOG;
  }

  public getCurrentTrack(): RadioTrack {
    const list = this.getActiveTracks();
    const idx = ((this.trackIndex % list.length) + list.length) % list.length;
    return list[idx];
  }

  public getRadioState(): RadioState {
    const tr = this.getCurrentTrack();
    return {
      playing: this.radioEnabled,
      category: this.category,
      trackIndex: this.trackIndex,
      trackTitle: tr.title,
      trackArtist: tr.artist,
      volume: this.volume,
      shuffle: this.shuffle,
      repeat: this.repeat,
      customTracks: this.customTracks,
    };
  }

  public setCategory(cat: RadioCategoryId): void {
    this.category = cat;
    this.trackIndex = 0;
    this.radioStep = 0;
    this.syncPlaybackMode();
  }

  public selectTrack(index: number): void {
    const list = this.getActiveTracks();
    if (list.length === 0) return;
    this.trackIndex = ((index % list.length) + list.length) % list.length;
    this.radioStep = 0;
    this.syncPlaybackMode();
  }

  public nextTrack(): void {
    const list = this.getActiveTracks();
    if (list.length === 0) return;
    if (this.shuffle && list.length > 1) {
      let next = Math.floor(Math.random() * list.length);
      if (next === this.trackIndex) next = (next + 1) % list.length;
      this.trackIndex = next;
    } else {
      this.trackIndex = (this.trackIndex + 1) % list.length;
    }
    this.radioStep = 0;
    this.syncPlaybackMode();
  }

  public prevTrack(): void {
    const list = this.getActiveTracks();
    if (list.length === 0) return;
    this.trackIndex = (this.trackIndex - 1 + list.length) % list.length;
    this.radioStep = 0;
    this.syncPlaybackMode();
  }

  public setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.radioGain && this.ctx) {
      this.radioGain.gain.setTargetAtTime(
        this.radioEnabled && this.sfxEnabled ? 0.16 * this.volume : 0,
        this.ctx.currentTime,
        0.05
      );
    }
    if (this.htmlAudio) {
      this.htmlAudio.volume = this.volume * (this.sfxEnabled ? 0.85 : 0);
    }
  }

  public toggleShuffle(): void {
    this.shuffle = !this.shuffle;
  }

  public cycleRepeat(): void {
    this.repeat = this.repeat === 'off' ? 'all' : this.repeat === 'all' ? 'one' : 'off';
  }

  public addCustomTrack(title: string, objectUrl: string): void {
    const track: RadioTrack = {
      id: `local_${Date.now()}`,
      title,
      artist: 'Local Audio File',
      category: 'custom_local',
      bpm: 110,
      scaleHz: [261.63, 329.63, 392.0, 440.0],
      bassHz: [130.81, 196.0],
      mood: 'Uploaded Track',
      localUrl: objectUrl,
    };
    this.customTracks = [...this.customTracks, track];
    this.category = 'custom_local';
    this.trackIndex = this.customTracks.length - 1;
    this.radioEnabled = true;
    this.syncPlaybackMode();
  }

  private syncPlaybackMode(): void {
    const tr = this.getCurrentTrack();
    if (tr.localUrl && this.htmlAudio) {
      if (this.currentLocalUrl !== tr.localUrl) {
        this.currentLocalUrl = tr.localUrl;
        this.htmlAudio.src = tr.localUrl;
      }
      this.htmlAudio.volume = this.volume * (this.sfxEnabled ? 0.85 : 0);
      if (this.radioEnabled && this.sfxEnabled) {
        void this.htmlAudio.play().catch(() => {});
      } else {
        this.htmlAudio.pause();
      }
    } else if (this.htmlAudio) {
      this.htmlAudio.pause();
      this.currentLocalUrl = null;
    }
    if (tr.bpm !== this.lastBpm) {
      this.lastBpm = tr.bpm;
      this.restartRadioSequencer();
    }
  }

  private restartRadioSequencer(): void {
    if (this.radioTimer !== null) {
      clearInterval(this.radioTimer);
      this.radioTimer = null;
    }
    const intervalMs = Math.max(220, Math.round((60 / Math.max(70, this.lastBpm)) * 500));
    this.radioTimer = window.setInterval(() => {
      if (!this.ctx || !this.radioGain || !this.radioEnabled || !this.sfxEnabled) return;
      if (this.ctx.state !== 'running') return;
      const tr = this.getCurrentTrack();
      if (tr.localUrl) return; // HTMLAudioElement is handling local file playback

      const now = this.ctx.currentTime;
      const scale = tr.scaleHz;
      const bass = tr.bassHz;
      const step = this.radioStep;
      this.radioStep++;

      // Automatic track advance every 32 steps if repeat !== 'one'
      if (step > 0 && step % 32 === 0 && this.repeat !== 'one') {
        if (this.repeat === 'all' || step % 64 === 0) {
          this.nextTrack();
          return;
        }
      }

      const noteIdx = (step + Math.floor(step / 4)) % scale.length;
      const lead = this.ctx.createOscillator();
      const lGain = this.ctx.createGain();
      lead.type =
        tr.category === 'kannada_modern' || tr.category === 'kannada_90s'
          ? 'triangle'
          : tr.category === 'instrumental' || tr.category === 'kannada_classic'
          ? 'sine'
          : 'sine';
      lead.frequency.setValueAtTime(scale[noteIdx], now);
      lGain.gain.setValueAtTime(0.001, now);
      lGain.gain.exponentialRampToValueAtTime(0.11, now + 0.025);
      lGain.gain.exponentialRampToValueAtTime(0.001, now + intervalMs / 1000 * 0.92);
      lead.connect(lGain);
      lGain.connect(this.radioGain);
      lead.start(now);
      lead.stop(now + intervalMs / 1000);

      // Bass + Subtle Percussion Beat (Tabla/Kick pulse)
      if (step % 2 === 0) {
        const bOsc = this.ctx.createOscillator();
        const bGain = this.ctx.createGain();
        bOsc.type = 'triangle';
        bOsc.frequency.setValueAtTime(bass[(step / 2) % bass.length], now);
        bGain.gain.setValueAtTime(0.001, now);
        bGain.gain.exponentialRampToValueAtTime(0.13, now + 0.02);
        bGain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
        bOsc.connect(bGain);
        bGain.connect(this.radioGain);
        bOsc.start(now);
        bOsc.stop(now + 0.4);
      }

      if (step % 4 === 0 || (tr.category === 'kannada_folk' && step % 2 === 1)) {
        const perc = this.ctx.createOscillator();
        const pGain = this.ctx.createGain();
        perc.type = 'sine';
        perc.frequency.setValueAtTime(step % 4 === 0 ? 115 : 210, now);
        perc.frequency.exponentialRampToValueAtTime(48, now + 0.08);
        pGain.gain.setValueAtTime(0.09, now);
        pGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
        perc.connect(pGain);
        pGain.connect(this.radioGain);
        perc.start(now);
        perc.stop(now + 0.1);
      }
    }, intervalMs);
  }

  public setSettings(sfxOn: boolean, radioOn: boolean): void {
    this.sfxEnabled = sfxOn;
    this.radioEnabled = radioOn;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(sfxOn ? 0.45 : 0, this.ctx.currentTime, 0.05);
    }
    if (this.radioGain && this.ctx) {
      this.radioGain.gain.setTargetAtTime(
        radioOn && sfxOn ? 0.16 * this.volume : 0,
        this.ctx.currentTime,
        0.08
      );
    }
    this.syncPlaybackMode();
  }

  public setInteriorMuffled(muffled: boolean): void {
    this.interiorMuffled = muffled;
    if (this.engineFilter && this.ctx) {
      this.engineFilter.frequency.setTargetAtTime(muffled ? 140 : 320, this.ctx.currentTime, 0.08);
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
    const muffFactor = this.interiorMuffled ? 0.55 : 1.0;

    if (this.engineOsc && this.engineGain) {
      if (inVehicle && vehicleKind && this.sfxEnabled) {
        const baseFreq =
          vehicleKind === 'bmtc' || vehicleKind === 'truck'
            ? 42
            : vehicleKind === 'auto'
            ? 74
            : vehicleKind === 'bike' || vehicleKind === 'police_bike' || vehicleKind === 'scooter'
            ? 86
            : 56;
        const span =
          vehicleKind === 'bike'
            ? 175
            : vehicleKind === 'coupe'
            ? 145
            : vehicleKind === 'scooter'
            ? 95
            : 88;
        this.engineOsc.type = vehicleKind === 'auto' ? 'square' : 'sawtooth';
        this.engineOsc.frequency.setTargetAtTime(baseFreq + speedNorm * span, now, 0.06);
        this.engineGain.gain.setTargetAtTime((0.06 + speedNorm * 0.06) * muffFactor, now, 0.06);
      } else {
        this.engineGain.gain.setTargetAtTime(0, now, 0.08);
      }
    }

    if (this.rainGain) {
      const targetRain =
        !this.sfxEnabled
          ? 0
          : weather === 'thunderstorm'
          ? 0.22 * muffFactor
          : weather === 'monsoon'
          ? 0.16 * muffFactor
          : weather === 'light_rain'
          ? 0.08 * muffFactor
          : 0;
      this.rainGain.gain.setTargetAtTime(targetRain, now, 0.25);
    }

    if (this.sirenOsc && this.sirenGain) {
      const activePoliceSiren =
        wantedStars > 0 || vehicleKind === 'police_suv' || vehicleKind === 'police_bike' || vehicleKind === 'ambulance';
      if (activePoliceSiren && this.sfxEnabled) {
        const hiLo = vehicleKind === 'ambulance' ? (Math.sin(elapsedSec * 5.2) > 0 ? 780 : 590) : (Math.sin(elapsedSec * 7.5) > 0 ? 840 : 620);
        this.sirenOsc.frequency.setTargetAtTime(hiLo, now, 0.03);
        this.sirenGain.gain.setTargetAtTime((wantedStars > 0 ? 0.055 : 0.032) * muffFactor, now, 0.08);
      } else {
        this.sirenGain.gain.setTargetAtTime(0, now, 0.1);
      }
    }
  }

  public playThunder(): void {
    if (!this.initialized || !this.ctx || !this.masterGain || !this.sfxEnabled) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(68, now);
    osc.frequency.exponentialRampToValueAtTime(28, now + 1.3);
    g.gain.setValueAtTime(0.24, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 1.55);
  }

  public playFootstep(onGrass: boolean): void {
    if (!this.initialized || !this.ctx || !this.masterGain || !this.sfxEnabled) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(onGrass ? 95 : 145, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.06);
    g.gain.setValueAtTime(0.035, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  public playMetroChime(): void {
    if (!this.initialized || !this.ctx || !this.masterGain || !this.sfxEnabled) return;
    const now = this.ctx.currentTime;
    [587.33, 783.99, 987.77].forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      const g = this.ctx!.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.13);
      g.gain.setValueAtTime(0.12, now + i * 0.13);
      g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.13 + 0.35);
      osc.connect(g);
      g.connect(this.masterGain!);
      osc.start(now + i * 0.13);
      osc.stop(now + i * 0.13 + 0.36);
    });
  }

  public playPhoneRing(): void {
    if (!this.initialized || !this.ctx || !this.masterGain || !this.sfxEnabled) return;
    const now = this.ctx.currentTime;
    [880, 1174.66].forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      const g = this.ctx!.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + i * 0.14);
      g.gain.setValueAtTime(0.11, now + i * 0.14);
      g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.14 + 0.18);
      osc.connect(g);
      g.connect(this.masterGain!);
      osc.start(now + i * 0.14);
      osc.stop(now + i * 0.14 + 0.2);
    });
  }

  public playHorn(kind: VehicleKind | null): void {
    if (!this.initialized || !this.ctx || !this.masterGain || !this.sfxEnabled) return;
    const now = this.ctx.currentTime;

    if (kind === 'bmtc' || kind === 'truck') {
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

  public playScannerBeep(): void {
    if (!this.initialized || !this.ctx || !this.masterGain || !this.sfxEnabled) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1480, now);
    g.gain.setValueAtTime(0.11, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  public playGatePass(): void {
    if (!this.initialized || !this.ctx || !this.masterGain || !this.sfxEnabled) return;
    const now = this.ctx.currentTime;
    [660, 990].forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      const g = this.ctx!.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + i * 0.08);
      g.gain.setValueAtTime(0.1, now + i * 0.08);
      g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.14);
      osc.connect(g);
      g.connect(this.masterGain!);
      osc.start(now + i * 0.08);
      osc.stop(now + i * 0.08 + 0.16);
    });
  }

  public playHandcuffClick(): void {
    if (!this.initialized || !this.ctx || !this.masterGain || !this.sfxEnabled) return;
    const now = this.ctx.currentTime;
    [0, 0.1].forEach((off, idx) => {
      const osc = this.ctx!.createOscillator();
      const g = this.ctx!.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(idx === 0 ? 1100 : 1420, now + off);
      osc.frequency.exponentialRampToValueAtTime(420, now + off + 0.05);
      g.gain.setValueAtTime(0.12, now + off);
      g.gain.exponentialRampToValueAtTime(0.001, now + off + 0.06);
      osc.connect(g);
      g.connect(this.masterGain!);
      osc.start(now + off);
      osc.stop(now + off + 0.07);
    });
  }

  public dispose(): void {
    if (this.radioTimer !== null) {
      clearInterval(this.radioTimer);
      this.radioTimer = null;
    }
    if (this.htmlAudio) {
      this.htmlAudio.pause();
      this.htmlAudio.src = '';
      this.htmlAudio = null;
    }
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
    this.initialized = false;
  }
}
