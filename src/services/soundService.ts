// Simple audio context singleton
let audioCtx: AudioContext | null = null;

const getAudioContext = () => {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioCtx;
};

export const speak = (text: string, lang: 'zh-CN' | 'en-US' = 'zh-CN', rate: number = 0.9, customAudioUrl?: string) => {
    // 1. If custom audio is provided, play it.
    if (customAudioUrl) {
        window.speechSynthesis.cancel(); // Stop any TTS
        try {
            const audio = new Audio(customAudioUrl);
            audio.play().catch(err => console.error("Failed to play custom audio:", err));
            return;
        } catch (e) {
            console.error("Audio playback error", e);
        }
    }

    // 2. Fallback to Browser TTS
    if (!('speechSynthesis' in window)) return;

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = rate;
    utterance.pitch = 1.0;
    utterance.volume = 1;

    // Try to find a good voice for the requested language
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(
        (voice) =>
            voice.lang === lang ||
            voice.lang.replace('_', '-').startsWith(lang.split('-')[0])
    );

    if (preferredVoice) {
        utterance.voice = preferredVoice;
    }

    window.speechSynthesis.speak(utterance);
};

export const playSoundEffect = (type: 'correct' | 'wrong' | 'pop') => {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
        ctx.resume().catch(() => { });
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;

    if (type === 'correct') {
        // Cheerful major arpeggio (C5 -> E5 -> G5)
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.setValueAtTime(659.25, now + 0.1); // E5
        osc.frequency.setValueAtTime(783.99, now + 0.2); // G5

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.3, now + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);

        osc.start(now);
        osc.stop(now + 0.6);
    } else if (type === 'wrong') {
        // Low Sawtooth "Buzz"
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.linearRampToValueAtTime(100, now + 0.3);

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);

        osc.start(now);
        osc.stop(now + 0.4);
    } else {
        // Pop sound
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.exponentialRampToValueAtTime(800, now + 0.1);

        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

        osc.start(now);
        osc.stop(now + 0.1);
    }
};
