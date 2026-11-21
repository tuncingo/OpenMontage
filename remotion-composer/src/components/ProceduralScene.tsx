import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

/**
 * Code-drawn lunar illustrations for abstract scenes (no image model involved).
 * Five variants, all deterministic: the same frame always renders the same pixels.
 */
export type ProceduralVariant = "crater" | "thermal" | "radar" | "ridge" | "descent";

const W = 1920;
const H = 1080;

// Small deterministic PRNG (mulberry32).
const rng = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const Stars: React.FC<{ seed: number; count: number; maxY?: number }> = ({ seed, count, maxY = H }) => {
  const frame = useCurrentFrame();
  const r = rng(seed);
  const stars = Array.from({ length: count }, () => ({
    x: r() * W,
    y: r() * maxY,
    s: 0.6 + r() * 1.8,
    p: r() * Math.PI * 2,
  }));
  return (
    <g>
      {stars.map((st, i) => (
        <circle
          key={i}
          cx={st.x}
          cy={st.y}
          r={st.s}
          fill="#F2F5FF"
          opacity={0.45 + 0.4 * Math.sin(frame / 22 + st.p)}
        />
      ))}
    </g>
  );
};

/** Ridge line as a smooth polyline from seeded noise. */
const ridgePath = (seed: number, baseY: number, amp: number, steps = 48): string => {
  const r = rng(seed);
  const pts: [number, number][] = [];
  let y = baseY;
  for (let i = 0; i <= steps; i++) {
    y += (r() - 0.5) * amp;
    y = Math.max(baseY - amp * 2.2, Math.min(baseY + amp * 2.2, y));
    pts.push([(i / steps) * (W + 40) - 20, y]);
  }
  return "M -20 " + H + " L " + pts.map((p) => p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" L ") + " L " + (W + 20) + " " + H + " Z";
};

const Crater: React.FC<{ t: number; deep?: boolean }> = ({ t, deep }) => {
  // t: 0..1 progress; slow push-in toward the crater
  const scale = 1 + t * 0.18;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H}>
      <defs>
        <radialGradient id="cr-bg" cx="50%" cy="35%" r="90%">
          <stop offset="0%" stopColor="#1B2146" />
          <stop offset="100%" stopColor="#05070F" />
        </radialGradient>
        <radialGradient id="cr-floor" cx="50%" cy="52%" r="50%">
          <stop offset="0%" stopColor="#000000" />
          <stop offset="70%" stopColor="#03040A" />
          <stop offset="100%" stopColor="#10142B" />
        </radialGradient>
        <linearGradient id="cr-rim" x1="0" y1="0" x2="1" y2="0.2">
          <stop offset="0%" stopColor="#FFB020" stopOpacity="0.95" />
          <stop offset="55%" stopColor="#FFD58A" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#6C3BFF" stopOpacity="0.15" />
        </linearGradient>
      </defs>
      <rect width={W} height={H} fill="url(#cr-bg)" />
      <Stars seed={11} count={120} maxY={420} />
      <g transform={`translate(${W / 2} ${H * 0.58}) scale(${scale}) translate(${-W / 2} ${-H * 0.58})`}>
        <path d={ridgePath(3, 640, 26)} fill="#2A2F4F" />
        <ellipse cx={W / 2} cy={H * 0.6} rx={760} ry={250} fill="#3A3F63" />
        <ellipse cx={W / 2} cy={H * 0.62} rx={700} ry={218} fill="none" stroke="url(#cr-rim)" strokeWidth={deep ? 16 : 10} />
        <ellipse cx={W / 2} cy={H * 0.64} rx={660} ry={190} fill="url(#cr-floor)" />
        <ellipse cx={W / 2 - 40} cy={H * 0.55} rx={620} ry={60} fill="#FFD58A" opacity={0.18} />
      </g>
    </svg>
  );
};

const Thermal: React.FC<{ t: number; frame: number }> = ({ t, frame }) => {
  const r = rng(21);
  const blobs = Array.from({ length: 14 }, () => ({
    x: 120 + r() * (W - 240),
    y: 120 + r() * (H - 240),
    rad: 90 + r() * 170,
    cold: r() > 0.35,
    p: r() * Math.PI * 2,
  }));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H}>
      <defs>
        <linearGradient id="th-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#7A2E3B" />
          <stop offset="55%" stopColor="#C4663A" />
          <stop offset="100%" stopColor="#E0A24A" />
        </linearGradient>
        {blobs.map((b, i) => (
          <radialGradient key={i} id={`th-b${i}`}>
            <stop offset="0%" stopColor={b.cold ? "#1A1060" : "#FFE08A"} stopOpacity="0.95" />
            <stop offset="60%" stopColor={b.cold ? "#3C2BB8" : "#F59E0B"} stopOpacity="0.5" />
            <stop offset="100%" stopColor={b.cold ? "#6C3BFF" : "#C4663A"} stopOpacity="0" />
          </radialGradient>
        ))}
      </defs>
      <rect width={W} height={H} fill="url(#th-bg)" />
      {blobs.map((b, i) => (
        <circle key={i} cx={b.x + Math.sin(frame / 90 + b.p) * 14} cy={b.y} r={b.rad * (0.9 + 0.1 * Math.sin(frame / 60 + b.p))} fill={`url(#th-b${i})`} />
      ))}
      {/* Faint map grid */}
      {Array.from({ length: 11 }, (_, i) => (
        <line key={"v" + i} x1={(i + 1) * (W / 12)} y1={0} x2={(i + 1) * (W / 12)} y2={H} stroke="#F2F5FF" strokeOpacity={0.08} />
      ))}
      {Array.from({ length: 6 }, (_, i) => (
        <line key={"h" + i} x1={0} y1={(i + 1) * (H / 7)} x2={W} y2={(i + 1) * (H / 7)} stroke="#F2F5FF" strokeOpacity={0.08} />
      ))}
      <rect width={W} height={H} fill="#0B1026" opacity={0.18 * (1 - t)} />
    </svg>
  );
};

const Radar: React.FC<{ frame: number; t: number }> = ({ frame, t }) => {
  const cx = W / 2;
  const cy = H / 2;
  const sweep = (frame * 2.2) % 360;
  const r = rng(5);
  const craters = Array.from({ length: 22 }, () => ({
    x: 200 + r() * (W - 400),
    y: 160 + r() * (H - 320),
    rad: 24 + r() * 110,
  }));
  const rad = (sweep * Math.PI) / 180;
  const R = 900;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H}>
      <defs>
        <radialGradient id="rd-bg" cx="50%" cy="50%" r="75%">
          <stop offset="0%" stopColor="#0E1A3A" />
          <stop offset="100%" stopColor="#060A1A" />
        </radialGradient>
        <linearGradient id="rd-sweep" gradientUnits="userSpaceOnUse" x1={cx} y1={cy} x2={cx + R * Math.cos(rad)} y2={cy + R * Math.sin(rad)}>
          <stop offset="0%" stopColor="#38E8FF" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#38E8FF" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width={W} height={H} fill="url(#rd-bg)" />
      {[150, 300, 450, 600, 750].map((rr) => (
        <circle key={rr} cx={cx} cy={cy} r={rr} fill="none" stroke="#38E8FF" strokeOpacity={0.22} strokeWidth={2} />
      ))}
      <line x1={cx - 900} y1={cy} x2={cx + 900} y2={cy} stroke="#38E8FF" strokeOpacity={0.15} />
      <line x1={cx} y1={cy - 520} x2={cx} y2={cy + 520} stroke="#38E8FF" strokeOpacity={0.15} />
      {craters.map((c, i) => {
        const ang = ((Math.atan2(c.y - cy, c.x - cx) * 180) / Math.PI + 360) % 360;
        const lit = Math.max(0, 1 - ((sweep - ang + 360) % 360) / 140);
        return <circle key={i} cx={c.x} cy={c.y} r={c.rad} fill="none" stroke="#38E8FF" strokeWidth={3} strokeOpacity={0.12 + 0.75 * lit} />;
      })}
      <path d={`M ${cx} ${cy} L ${cx + R * Math.cos(rad - 0.35)} ${cy + R * Math.sin(rad - 0.35)} L ${cx + R * Math.cos(rad)} ${cy + R * Math.sin(rad)} Z`} fill="url(#rd-sweep)" />
      <rect width={W} height={H} fill="#060A1A" opacity={0.25 * (1 - t)} />
    </svg>
  );
};

const Ridge: React.FC<{ t: number }> = ({ t }) => {
  const sunX = 1500 - t * 120;
  const sunY = 560 + t * 18;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H}>
      <defs>
        <linearGradient id="rg-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#03040A" />
          <stop offset="100%" stopColor="#1B1E3D" />
        </linearGradient>
        <radialGradient id="rg-sun" cx={sunX / W} cy={sunY / H} r="0.45">
          <stop offset="0%" stopColor="#FFF3C4" stopOpacity="1" />
          <stop offset="18%" stopColor="#FFB020" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#FFB020" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="rg-lit" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#3A3D5E" />
          <stop offset="100%" stopColor="#E8C98A" />
        </linearGradient>
      </defs>
      <rect width={W} height={H} fill="url(#rg-sky)" />
      <Stars seed={4} count={150} maxY={520} />
      <rect width={W} height={H} fill="url(#rg-sun)" />
      <path d={ridgePath(8, 660, 30)} fill="url(#rg-lit)" />
      {/* Long shadows raking left from the ridge crest */}
      <path d={ridgePath(8, 760, 18)} fill="#05070F" opacity={0.92} />
      <path d={ridgePath(15, 900, 22)} fill="#02030A" />
      <circle cx={sunX} cy={sunY} r={22} fill="#FFF8DC" />
      <ellipse cx={sunX} cy={sunY} rx={340} ry={3.5} fill="#FFF3C4" opacity={0.65} />
    </svg>
  );
};

const Descent: React.FC<{ t: number }> = ({ t }) => {
  const dip = t * 330; // the "camera" drops toward the rim
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H}>
      <defs>
        <linearGradient id="ds-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#02030A" />
          <stop offset="100%" stopColor="#0B1026" />
        </linearGradient>
        <radialGradient id="ds-ice" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#9FD8FF" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#9FD8FF" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width={W} height={H} fill="url(#ds-sky)" />
      <g transform={`translate(0 ${-dip * 0.35})`}>
        <Stars seed={9} count={170} maxY={760} />
      </g>
      <g transform={`translate(0 ${-dip})`}>
        <path d={ridgePath(2, 760, 22)} fill="#33385C" />
        <path d={ridgePath(6, 900, 18)} fill="#1A1E3A" />
        <ellipse cx={W / 2} cy={1180} rx={880} ry={260} fill="#010207" />
        <ellipse cx={W / 2} cy={1180} rx={880} ry={260} fill="none" stroke="#FFD58A" strokeOpacity={0.55} strokeWidth={8} />
        <ellipse cx={W / 2 + 120} cy={1230} rx={260} ry={60} fill="url(#ds-ice)" opacity={0.35 + 0.4 * t} />
      </g>
    </svg>
  );
};

export const ProceduralScene: React.FC<{ variant: ProceduralVariant }> = ({ variant }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const t = interpolate(frame, [0, Math.max(1, durationInFrames - 1)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill style={{ backgroundColor: "#05070F" }}>
      {variant === "crater" && <Crater t={t} deep />}
      {variant === "thermal" && <Thermal t={t} frame={frame} />}
      {variant === "radar" && <Radar t={t} frame={frame} />}
      {variant === "ridge" && <Ridge t={t} />}
      {variant === "descent" && <Descent t={t} />}
    </AbsoluteFill>
  );
};
