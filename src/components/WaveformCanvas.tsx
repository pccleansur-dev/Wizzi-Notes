import { useEffect, useRef } from 'react';

interface WaveformCanvasProps {
  analyser: AnalyserNode | null;
  isRecording: boolean;
}

export default function WaveformCanvas({ analyser, isRecording }: WaveformCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number>(0);
  const idlePhase = useRef(0);
  // Smoothed points buffer for interpolation
  const smoothRef = useRef<number[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Hi-DPI
    let W = 0, H = 0;
    const resize = () => {
      const dpr  = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      W = rect.width;
      H = rect.height;
      canvas.width  = rect.width  * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const POINTS  = 120;
    const PRIMARY = '#7c3aed';
    const ACCENT  = '#06b6d4';
    const LERP    = 0.18; // smoothing factor (lower = smoother but laggy)

    const drawCurve = (pts: number[], alpha: number, flipY: boolean) => {
      if (pts.length < 2) return;
      const MID = H / 2;

      // Gradient along X
      const grad = ctx.createLinearGradient(0, 0, W, 0);
      grad.addColorStop(0,    PRIMARY + '00');
      grad.addColorStop(0.15, PRIMARY);
      grad.addColorStop(0.5,  ACCENT);
      grad.addColorStop(0.85, PRIMARY);
      grad.addColorStop(1,    PRIMARY + '00');

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = grad;
      ctx.lineWidth   = 2.2;
      ctx.shadowColor = isRecording ? PRIMARY : PRIMARY + '60';
      ctx.shadowBlur  = isRecording ? 16 : 8;
      ctx.lineJoin    = 'round';
      ctx.lineCap     = 'round';

      ctx.beginPath();
      for (let i = 0; i < pts.length; i++) {
        const x = (i / (pts.length - 1)) * W;
        const amp = flipY ? -pts[i] : pts[i];
        const y = MID + amp * (MID * 0.82);

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          // Catmull-Rom-ish via cardinal spline
          const x0 = ((i - 1) / (pts.length - 1)) * W;
          const a0 = flipY ? -pts[i - 1] : pts[i - 1];
          const y0 = MID + a0 * (MID * 0.82);
          const cpx = (x0 + x) / 2;
          ctx.bezierCurveTo(cpx, y0, cpx, y, x, y);
        }
      }
      ctx.stroke();
      ctx.restore();
    };

    // Soft fill under the top wave
    const drawFill = (pts: number[]) => {
      const MID = H / 2;
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0,   PRIMARY + '30');
      grad.addColorStop(0.5, PRIMARY + '08');
      grad.addColorStop(1,   'transparent');

      ctx.save();
      ctx.globalAlpha = isRecording ? 0.7 : 0.3;
      ctx.fillStyle   = grad;
      ctx.beginPath();
      ctx.moveTo(0, MID);
      for (let i = 0; i < pts.length; i++) {
        const x = (i / (pts.length - 1)) * W;
        const y = MID + pts[i] * (MID * 0.82);
        if (i === 0) ctx.lineTo(x, y);
        else {
          const x0 = ((i - 1) / (pts.length - 1)) * W;
          const y0 = MID + pts[i - 1] * (MID * 0.82);
          ctx.bezierCurveTo((x0 + x) / 2, y0, (x0 + x) / 2, y, x, y);
        }
      }
      ctx.lineTo(W, MID);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw);
      if (!W || !H) return;
      ctx.clearRect(0, 0, W, H);

      let raw: number[];

      if (analyser && isRecording) {
        const buf = new Uint8Array(analyser.fftSize);
        analyser.getByteTimeDomainData(buf);

        // Downsample fftSize → POINTS + apply soft-clip gain
        raw = Array.from({ length: POINTS }, (_, i) => {
          const idx = Math.floor(i * buf.length / POINTS);
          const v = buf[idx] / 128.0 - 1; // -1..1
          // Non-linear gain: amplify quiet signals, soft-clip loud ones
          const gained = v * 3.5;
          return Math.tanh(gained); // tanh keeps it in -1..1 smoothly
        });
      } else {
        // Idle: slow multi-frequency breathing wave
        idlePhase.current += 0.018;
        const ph = idlePhase.current;
        raw = Array.from({ length: POINTS }, (_, i) => {
          const t   = i / (POINTS - 1);
          const env = Math.sin(t * Math.PI); // fade at edges
          return env * (
            0.08 * Math.sin(t * Math.PI * 2 + ph) +
            0.04 * Math.sin(t * Math.PI * 5 + ph * 1.3) +
            0.02 * Math.sin(t * Math.PI * 9 + ph * 0.7)
          );
        });
      }

      // Initialize smooth buffer
      if (smoothRef.current.length !== POINTS) {
        smoothRef.current = [...raw];
      }
      // Lerp toward raw
      smoothRef.current = smoothRef.current.map((v, i) => v + (raw[i] - v) * LERP);
      const pts = smoothRef.current;

      drawFill(pts);
      drawCurve(pts, 1,    false); // top wave
      drawCurve(pts, 0.28, true);  // mirror below — subtle

      // Center hairline
      const axisGrad = ctx.createLinearGradient(0, 0, W, 0);
      axisGrad.addColorStop(0,    'transparent');
      axisGrad.addColorStop(0.5,  PRIMARY + (isRecording ? '50' : '25'));
      axisGrad.addColorStop(1,    'transparent');
      ctx.save();
      ctx.strokeStyle = axisGrad;
      ctx.lineWidth   = 0.8;
      ctx.beginPath();
      ctx.moveTo(0, H / 2);
      ctx.lineTo(W, H / 2);
      ctx.stroke();
      ctx.restore();
    };

    draw();
    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, [analyser, isRecording]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-28 md:h-32"
      style={{ display: 'block' }}
    />
  );
}
