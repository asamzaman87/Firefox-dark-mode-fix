import confetti from "canvas-confetti";

const randomInRange = (min: number, max: number) => {
  return Math.random() * (max - min) + min;
};

const heartRed = confetti.shapeFromText({ text: "❤️", scalar: 2 });
const heartWhite = confetti.shapeFromText({ text: "🤍", scalar: 2 });

const useConfetti = () => {
  const duration = 10 * 1000;
  const animationEnd = Date.now() + duration;
  let skew = 1;

  const shoot = () => {
    const timeLeft = animationEnd - Date.now();
    const ticks = Math.max(200, 500 * (timeLeft / duration));
    skew = Math.max(0.8, skew - 0.001);
    confetti({
      particleCount: 1,
      startVelocity: 0,
      ticks: ticks,
      origin: {
        x: Math.random(),
        y: Math.random() * skew - 0.2,
      },
      colors: ["#ffffff"],
      shapes: [heartRed, heartWhite],
      gravity: randomInRange(0.4, 0.6),
      scalar: randomInRange(0.4, 2),
      drift: randomInRange(-0.4, 0.4),
    });
    if (timeLeft > 0) {
      requestAnimationFrame(shoot);
    }
  };

  return shoot;
};
export default useConfetti;
