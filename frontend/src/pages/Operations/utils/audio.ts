// Audio feedback utilities for Operations page

const audioContext =
  typeof window !== 'undefined'
    ? new (window.AudioContext || (window as any).webkitAudioContext)()
    : null;

export const playTone = (
  frequency: number,
  duration: number,
  type: OscillatorType = 'sine'
) => {
  if (!audioContext) return;
  try {
    if (audioContext.state === 'suspended') audioContext.resume();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.frequency.value = frequency;
    oscillator.type = type;
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration);
  } catch (e) {
    // Silently fail for audio errors
  }
};

export const playScanSound = {
  mode: () => {
    playTone(440, 0.1);
    setTimeout(() => playTone(880, 0.15), 100);
  },
  location: () => {
    playTone(660, 0.08);
    setTimeout(() => playTone(660, 0.08), 100);
    setTimeout(() => playTone(880, 0.12), 200);
  },
  product: () => {
    playTone(1000, 0.1);
  },
  success: () => {
    playTone(523, 0.1);
    setTimeout(() => playTone(659, 0.1), 80);
    setTimeout(() => playTone(784, 0.2), 160);
  },
  error: () => {
    playTone(300, 0.15, 'square');
    setTimeout(() => playTone(200, 0.2, 'square'), 150);
  },
};
