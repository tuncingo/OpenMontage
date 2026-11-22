import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

/**
 * Code-drawn lunar scenes in the channel's schematic language: near-black ground,
 * hairline strokes in teal and a muted amber, slow motion. Deterministic (no image model).
 */
export type ProceduralVariant = "crater" | "thermal" | "radar" | "ridge" | "descent";

const W = 1920;
const H = 1080;
const INK = "#05070C";
const TEAL = "#62C2CF";
const AMBER = "#D9A25B";
const GREY = "#8A93A6";

const rng = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/** Open ridge polyline (stroke only). */
const ridgeLine = (seed: number, baseY: number, amp: number, shift = 0, steps = 60): string => {
  const r = rng(seed);
  const ys: number[] = [];
  let y = baseY;
  for (let i = 0; i <= steps + 8; i++) {
    y += (r() - 0.5) * amp;
    y = Math.max(baseY - amp * 2.4, Math.min(baseY + amp * 2.4, y));
    ys.push(y);
  }
  const step = (W + 120) / steps;
  const pts = ys.slice(0, steps + 1).map((_, i) => {
    const idx = i + Math.floor(shift / step);
    const yy = ys[Math.max(0, Math.min(ys.length - 1, idx % ys.length))];
    return `${(i * step - 60 - (shift % step)).toFixed(1)} ${yy.toFixed(1)}`;
  });
  return "M " + pts.join(" L ");
};

const Frame: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H}>
    <defs>
      <radialGradient id="ps-bg" cx="50%" cy="46%" r="75%">
        <stop offset="0%" stopColor="#0A1020" />
        <stop offset="100%" stopColor={INK} />
      </radialGradient>
    </defs>
    <rect width={W} height={H} fill="url(#ps-bg)" />
    {children}
  </svg>
);

// Concentric crater rims seen in perspective; the camera slowly pushes in.
const Crater: React.FC<{ t: number; frame: number; sd: number }> = ({ t, frame, sd }) => {
  const cx = W / 2;
  const cy = H * 0.56;
  const rings = Array.from({ length: 9 }, (_, i) => {
    const k = (i + t * 0.9 + sd * 0.01) % 9;
    const scale = Math.pow(1.34, k - 3);
    return { rx: 150 * scale, ry: 44 * scale, o: Math.max(0, Math.min(1, 1 - Math.abs(k - 4.2) / 5)) };
  });
  return (
    <Frame>
      {rings.map((r, i) => (
        <ellipse key={i} cx={cx} cy={cy} rx={r.rx} ry={r.ry} fill="none" stroke={i % 3 === 0 ? AMBER : TEAL} strokeWidth={1.8} opacity={0.15 + 0.6 * r.o} />
      ))}
      {Array.from({ length: 18 }, (_, i) => {
        const a = (i / 18) * Math.PI * 2 + frame / 900;
        return <line key={i} x1={cx + Math.cos(a) * 60} y1={cy + Math.sin(a) * 18} x2={cx + Math.cos(a) * 1500} y2={cy + Math.sin(a) * 440} stroke={GREY} strokeWidth={1} opacity={0.12} />;
      })}
      <circle cx={cx} cy={cy} r={5} fill={TEAL} opacity={0.9} />
      <path d={ridgeLine(3 + sd, 330, 14, frame * 0.25)} fill="none" stroke={GREY} strokeWidth={1.6} opacity={0.4} />
    </Frame>
  );
};

// Contour map: concentric hairlines around cold (teal) and warm (amber) spots on a faint grid.
const Thermal: React.FC<{ frame: number; sd: number }> = ({ frame, sd }) => {
  const r = rng(21 + sd);
  const spots = Array.from({ length: 9 }, () => ({ x: 200 + r() * (W - 400), y: 180 + r() * (H - 360), cold: r() > 0.3, ph: r() * 6.28, n: 5 + Math.floor(r() * 3) }));
  return (
    <Frame>
      {Array.from({ length: 11 }, (_, i) => (
        <line key={"v" + i} x1={(i + 1) * (W / 12)} y1={0} x2={(i + 1) * (W / 12)} y2={H} stroke={GREY} strokeOpacity={0.1} />
      ))}
      {Array.from({ length: 6 }, (_, i) => (
        <line key={"h" + i} x1={0} y1={(i + 1) * (H / 7)} x2={W} y2={(i + 1) * (H / 7)} stroke={GREY} strokeOpacity={0.1} />
      ))}
      {spots.map((s, i) => {
        const dx = Math.sin(frame / 120 + s.ph) * 14;
        return (
          <g key={i}>
            {Array.from({ length: s.n }, (_, k) => (
              <circle
                key={k}
                cx={s.x + dx}
                cy={s.y}
                r={26 + k * 30 + Math.sin(frame / 50 + s.ph + k) * 3}
                fill="none"
                stroke={s.cold ? TEAL : AMBER}
                strokeWidth={1.6}
                opacity={0.8 - k * 0.12}
              />
            ))}
          </g>
        );
      })}
    </Frame>
  );
};

const Radar: React.FC<{ frame: number; sd: number }> = ({ frame, sd }) => {
  const cx = W / 2;
  const cy = H / 2;
  const sweep = (frame * 2.0) % 360;
  const r = rng(5 + sd);
  const craters = Array.from({ length: 22 }, () => ({ x: 200 + r() * (W - 400), y: 160 + r() * (H - 320), rad: 24 + r() * 110 }));
  const rad = (sweep * Math.PI) / 180;
  const R = 900;
  return (
    <Frame>
      {[150, 300, 450, 600, 750].map((rr) => (
        <circle key={rr} cx={cx} cy={cy} r={rr} fill="none" stroke={TEAL} strokeOpacity={0.2} strokeWidth={1.5} />
      ))}
      <line x1={cx - 900} y1={cy} x2={cx + 900} y2={cy} stroke={TEAL} strokeOpacity={0.14} />
      <line x1={cx} y1={cy - 520} x2={cx} y2={cy + 520} stroke={TEAL} strokeOpacity={0.14} />
      {craters.map((c, i) => {
        const ang = ((Math.atan2(c.y - cy, c.x - cx) * 180) / Math.PI + 360) % 360;
        const lit = Math.max(0, 1 - ((sweep - ang + 360) % 360) / 150);
        return <circle key={i} cx={c.x} cy={c.y} r={c.rad} fill="none" stroke={TEAL} strokeWidth={2} strokeOpacity={0.1 + 0.8 * lit} />;
      })}
      <line x1={cx} y1={cy} x2={cx + R * Math.cos(rad)} y2={cy + R * Math.sin(rad)} stroke={TEAL} strokeWidth={2} strokeOpacity={0.8} />
      <line x1={cx} y1={cy} x2={cx + R * Math.cos(rad - 0.18)} y2={cy + R * Math.sin(rad - 0.18)} stroke={TEAL} strokeWidth={1.5} strokeOpacity={0.35} />
    </Frame>
  );
};

// Layered ridgelines drifting at different speeds; a low sun drawn as a ring with one long ray.
const Ridge: React.FC<{ t: number; frame: number; sd: number }> = ({ t, frame, sd }) => {
  const sunX = 1450 - t * 130;
  const sunY = 520 + t * 20;
  const layers = [
    { y: 640, amp: 30, speed: 0.22, c: AMBER, o: 0.85, w: 2.2 },
    { y: 740, amp: 24, speed: 0.4, c: TEAL, o: 0.6, w: 1.8 },
    { y: 840, amp: 20, speed: 0.7, c: TEAL, o: 0.42, w: 1.6 },
    { y: 930, amp: 16, speed: 1.1, c: GREY, o: 0.3, w: 1.4 },
  ];
  return (
    <Frame>
      {Array.from({ length: 9 }, (_, i) => {
        const a = -0.25 + i * 0.07;
        return <line key={i} x1={sunX} y1={sunY} x2={sunX + Math.cos(a) * 1800} y2={sunY + Math.sin(a) * 1800} stroke={AMBER} strokeWidth={1} opacity={0.1} />;
      })}
      <circle cx={sunX} cy={sunY} r={34} fill="none" stroke={AMBER} strokeWidth={2.2} />
      <circle cx={sunX} cy={sunY} r={9} fill={AMBER} />
      <line x1={sunX - 360} y1={sunY} x2={sunX + 360} y2={sunY} stroke={AMBER} strokeWidth={1.5} opacity={0.6} />
      {layers.map((l, i) => (
        <path key={i} d={ridgeLine(8 + i * 5 + sd, l.y, l.amp, frame * l.speed)} fill="none" stroke={l.c} strokeWidth={l.w} opacity={l.o} />
      ))}
    </Frame>
  );
};

// The camera sinks toward a dark rim: ring after ring rushes outward, faint ice motes rise.
const Descent: React.FC<{ t: number; frame: number; sd: number }> = ({ t, frame, sd }) => {
  const cx = W / 2;
  const cy = H * 0.62;
  const r = rng(77 + sd);
  const motes = Array.from({ length: 26 }, () => ({ x: 560 + r() * 800, y: r() * 500, ph: r() * 6.28, s: 0.3 + r() * 0.7 }));
  return (
    <Frame>
      {Array.from({ length: 8 }, (_, i) => {
        const k = (i + t * 3 + frame * 0.004) % 8;
        const s = Math.pow(1.45, k);
        return <ellipse key={i} cx={cx} cy={cy + k * 6} rx={90 * s} ry={26 * s} fill="none" stroke={i % 2 ? TEAL : AMBER} strokeWidth={1.8} opacity={Math.max(0, 0.85 - k * 0.1)} />;
      })}
      <line x1={cx} y1={0} x2={cx} y2={cy - 30} stroke={GREY} strokeWidth={1.4} strokeDasharray="3 12" opacity={0.5} />
      {motes.map((m, i) => (
        <circle key={i} cx={m.x + Math.sin(frame / 60 + m.ph) * 16} cy={cy - 40 - ((m.y + frame * m.s) % 520)} r={2.2} fill={TEAL} opacity={0.55} />
      ))}
      <path d={ridgeLine(2 + sd, 240, 12, frame * 0.3)} fill="none" stroke={GREY} strokeWidth={1.6} opacity={0.4} />
    </Frame>
  );
};

export const ProceduralScene: React.FC<{ variant: ProceduralVariant; seed?: number }> = ({ variant, seed = 0 }) => {
  const frame = useCurrentFrame();
  const sd = seed * 13;
  const { durationInFrames } = useVideoConfig();
  const t = interpolate(frame, [0, Math.max(1, durationInFrames - 1)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ backgroundColor: INK }}>
      {variant === "crater" && <Crater t={t} frame={frame} sd={sd} />}
      {variant === "thermal" && <Thermal frame={frame} sd={sd} />}
      {variant === "radar" && <Radar frame={frame} sd={sd} />}
      {variant === "ridge" && <Ridge t={t} frame={frame} sd={sd} />}
      {variant === "descent" && <Descent t={t} frame={frame} sd={sd} />}
    </AbsoluteFill>
  );
};
