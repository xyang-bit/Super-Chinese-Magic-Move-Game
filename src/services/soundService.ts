class SoundService {
  private audioCtx: AudioContext | null = null;
  private sounds: { [key: string]: HTMLAudioElement } = {};
  private useSynth: { [key: string]: boolean } = { hit: false, miss: false };

  constructor() {
    this.loadAudio('hit', '/sounds/hit.mp3');
    this.loadAudio('miss', '/sounds/miss.mp3');
  }

  private loadAudio(name: string, path: string) {
    const audio = new Audio(path);
    audio.oncanplaythrough = () => { this.sounds[name] = audio; };
    audio.onerror = () => { this.useSynth[name] = true; };
  }

  private initContext() {
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }

  private playSynth(freq: number, type: OscillatorType, duration: number) {
    this.initContext();
    if (!this.audioCtx) return;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, this.audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(this.audioCtx.destination);
    osc.start();
    osc.stop(this.audioCtx.currentTime + duration);
  }

  public playHit() {
    if (this.sounds['hit'] && !this.useSynth['hit']) {
      this.sounds['hit'].currentTime = 0;
      this.sounds['hit'].play().catch(() => this.playSynth(880, 'sine', 0.1));
    } else {
      this.playSynth(880, 'sine', 0.1);
    }
  }

  public playMiss() {
    if (this.sounds['miss'] && !this.useSynth['miss']) {
      this.sounds['miss'].currentTime = 0;
      this.sounds['miss'].play().catch(() => this.playSynth(110, 'triangle', 0.3));
    } else {
      this.playSynth(110, 'triangle', 0.3);
    }
  }
}

export const soundService = new SoundService();

export const speak = (text: string, lang: 'zh-CN' | 'en-US' = 'zh-CN', rate: number = 0.9, customAudioUrl?: string) => {
    if (customAudioUrl) {
        window.speechSynthesis.cancel();
        try {
            const audio = new Audio(customAudioUrl);
            audio.play().catch(err => console.error("Failed to play custom audio:", err));
            return;
        } catch (e) {
            console.error("Audio playback error", e);
        }
    }

    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = rate;
    utterance.pitch = 1.0;
    utterance.volume = 1;

    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(
        (voice) => voice.lang === lang || voice.lang.replace('_', '-').startsWith(lang.split('-')[0])
    );

    if (preferredVoice) {
        utterance.voice = preferredVoice;
    }

    window.speechSynthesis.speak(utterance);
};

