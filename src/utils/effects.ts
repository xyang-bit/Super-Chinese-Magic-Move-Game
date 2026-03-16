import confetti from 'canvas-confetti';

export const launchFirework = () => {
  // Firework-style explosion from the bottom-left
  confetti({
    particleCount: 100,
    spread: 70,
    origin: { y: 0.6, x: 0.2 },
    colors: ['#ff0000', '#ffd700', '#22c55e'] // Red, Gold, Green (Magic Move colors)
  });

  // Mirror firework from the bottom-right
  confetti({
    particleCount: 100,
    spread: 70,
    origin: { y: 0.6, x: 0.8 },
    colors: ['#ff0000', '#ffd700', '#22c55e']
  });
};
