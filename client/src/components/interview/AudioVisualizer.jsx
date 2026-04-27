import { useEffect, useRef } from "react";

export default function AudioVisualizer({ stream, isListening, size = 160 }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const analyserRef = useRef(null);
  const dataRef = useRef(null);

  useEffect(() => {
    if (!stream) return;
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;
    source.connect(analyser);
    analyserRef.current = analyser;
    dataRef.current = new Uint8Array(analyser.frequencyBinCount);

    return () => {
      ctx.close().catch(() => {});
    };
  }, [stream]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const c = canvas.getContext("2d");
    const center = size / 2;
    const baseRadius = size * 0.22;

    function draw() {
      animRef.current = requestAnimationFrame(draw);
      c.clearRect(0, 0, size, size);

      let amplitude = 0;
      if (analyserRef.current && dataRef.current && isListening) {
        analyserRef.current.getByteFrequencyData(dataRef.current);
        const sum = dataRef.current.reduce((a, b) => a + b, 0);
        amplitude = sum / dataRef.current.length / 255;
      }

      // Outer glow rings
      for (let i = 3; i > 0; i--) {
        const pulse = baseRadius + amplitude * size * 0.2 * (1 + i * 0.3) + i * 6;
        const alpha = isListening ? 0.08 + amplitude * 0.1 : 0.04;
        c.beginPath();
        c.arc(center, center, pulse, 0, Math.PI * 2);
        c.fillStyle = `rgba(99, 102, 241, ${alpha})`;
        c.fill();
      }

      // Main circle
      const radius = baseRadius + (isListening ? amplitude * size * 0.18 : 0);
      const gradient = c.createRadialGradient(center, center, 0, center, center, radius);
      if (isListening) {
        gradient.addColorStop(0, "rgba(129, 140, 248, 0.95)");
        gradient.addColorStop(1, "rgba(99, 102, 241, 0.85)");
      } else {
        gradient.addColorStop(0, "rgba(100, 116, 139, 0.6)");
        gradient.addColorStop(1, "rgba(71, 85, 105, 0.5)");
      }
      c.beginPath();
      c.arc(center, center, radius, 0, Math.PI * 2);
      c.fillStyle = gradient;
      c.fill();

      // Frequency bars around circle
      if (isListening && analyserRef.current && dataRef.current) {
        const bars = 32;
        for (let i = 0; i < bars; i++) {
          const dataIndex = Math.floor((i / bars) * dataRef.current.length);
          const val = dataRef.current[dataIndex] / 255;
          const angle = (i / bars) * Math.PI * 2 - Math.PI / 2;
          const barLen = val * size * 0.15;
          const x1 = center + Math.cos(angle) * (radius + 4);
          const y1 = center + Math.sin(angle) * (radius + 4);
          const x2 = center + Math.cos(angle) * (radius + 4 + barLen);
          const y2 = center + Math.sin(angle) * (radius + 4 + barLen);
          c.beginPath();
          c.moveTo(x1, y1);
          c.lineTo(x2, y2);
          c.lineWidth = 2.5;
          c.strokeStyle = `rgba(165, 180, 252, ${0.4 + val * 0.5})`;
          c.lineCap = "round";
          c.stroke();
        }
      }
    }

    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [stream, isListening, size]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className="mx-auto block"
      style={{ width: size, height: size }}
    />
  );
}
