import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

/**
 * Schematic line graphics in the channel's look: near-black ground, hairline strokes in
 * teal and a muted amber, Inter labels (>= 36 px on a 1080p frame for phone legibility).
 * Everything draws itself in; nothing is a static image.
 */

export const TEAL = "#62C2CF";
export const AMBER = "#D9A25B";
export const GREY = "#8A93A6";
export const WHITE = "#F2F5FF";
export const INK = "#05070C";
const X0 = 192;
const X1 = 1728;
const W = X1 - X0;

export type SchematicKind = "phases" | "slips" | "thermal" | "thermal_inset";

export interface SchematicSpec {
  kind: SchematicKind;
  /** phases: 1..3 (which phase is active) */
  step?: number;
  /** slips: "three" | "I" | "III" */
  which?: string;
}

const ease = (t: number) => 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3);
export const prog = (frame: number, start: number, len: number) => ease((frame - start) / len);

export const font = (size: number, weight = 500, tracking = 0): React.CSSProperties => ({
  fontFamily: "Inter, sans-serif",
  fontWeight: weight,
  fontSize: size,
  letterSpacing: tracking,
});

/** Hairline that draws itself from (x1,y1) to (x2,y2). */
export const Draw: React.FC<{
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  p: number;
  color?: string;
  width?: number;
  dash?: string;
  opacity?: number;
}> = ({ x1, y1, x2, y2, p, color = TEAL, width = 2, dash, opacity = 1 }) => {
  const len = Math.hypot(x2 - x1, y2 - y1);
  return (
    <line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke={color}
      strokeWidth={width}
      opacity={opacity}
      strokeDasharray={dash ?? `${len}`}
      strokeDashoffset={dash ? 0 : len * (1 - p)}
      strokeLinecap="round"
      style={dash ? { clipPath: `inset(0 ${(1 - p) * 100}% 0 0)` } : undefined}
    />
  );
};

export const Txt: React.FC<{
  x: number;
  y: number;
  size?: number;
  weight?: number;
  tracking?: number;
  fill?: string;
  anchor?: "start" | "middle" | "end";
  opacity?: number;
  dy?: number;
  children: React.ReactNode;
}> = ({ x, y, size = 36, weight = 500, tracking = 3, fill = GREY, anchor = "start", opacity = 1, dy = 0, children }) => (
  <text
    x={x}
    y={y + dy}
    fill={fill}
    textAnchor={anchor}
    opacity={opacity}
    style={font(size, weight, tracking)}
  >
    {children}
  </text>
);

const Kicker: React.FC<{ text: string; opacity: number; y?: number }> = ({ text, opacity, y = 235 }) => (
  <Txt x={X0} y={y} fill={AMBER} tracking={9} opacity={opacity}>
    {text}
  </Txt>
);

// ---------------------------------------------------------------------------
// 1) Three-phase timeline
// ---------------------------------------------------------------------------
const PHASES = [
  { n: "01", a: 0, b: 3, l1: "Robots, tech demos,", l2: "scouting" },
  { n: "02", a: 3, b: 6, l1: "Early power, cargo,", l2: "communications" },
  { n: "03", a: 6, b: 9, l1: "Permanent outpost,", l2: "habitats" },
];
const px = (off: number) => X0 + (off / 9) * W; // 2026 .. 2035

const Phases: React.FC<{ step: number }> = ({ step }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const AXY = 640;
  const axisP = step === 1 ? prog(frame, 0, 28) : 1;
  const k = prog(frame, 0, 18);
  const playhead = interpolate(frame, [10, durationInFrames - 6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <svg width={1920} height={1080} viewBox="0 0 1920 1080">
      <Kicker text="THREE-PHASE PLAN" opacity={k} />
      <Draw x1={X0} y1={AXY} x2={X1} y2={AXY} p={axisP} color={GREY} width={2} opacity={0.55} />
      {[
        [0, "NOW"],
        [3, "2029"],
        [6, "2032"],
      ].map(([off, label]) => (
        <g key={String(label)} opacity={axisP}>
          <line x1={px(off as number)} y1={AXY - 14} x2={px(off as number)} y2={AXY + 14} stroke={GREY} strokeWidth={2} />
          <Txt x={px(off as number)} y={AXY + 70} anchor="middle" tracking={2}>
            {label as string}
          </Txt>
        </g>
      ))}
      <Txt x={X1} y={AXY + 70} anchor="end" tracking={2} opacity={axisP}>
        →
      </Txt>
      {PHASES.map((ph, i) => {
        const idx = i + 1;
        const done = idx < step;
        const active = idx === step;
        const future = idx > step;
        const bar = done ? 1 : active ? prog(frame, 14, 40) : 0;
        const label = done ? 1 : active ? prog(frame, 20, 22) : 0.0;
        const colour = active ? TEAL : GREY;
        const a = px(ph.a);
        const b = px(ph.b);
        const alpha = done ? 0.5 : active ? 1 : 0.28;
        return (
          <g key={ph.n}>
            {/* segment bar */}
            <Draw x1={a + 6} y1={AXY} x2={b - 6} y2={AXY} p={bar} color={colour} width={8} opacity={done ? 0.55 : 1} />
            {future ? (
              <line x1={a + 6} y1={AXY} x2={b - 6} y2={AXY} stroke={GREY} strokeWidth={3} strokeDasharray="4 14" opacity={0.35} />
            ) : null}
            {/* numeral + descriptor */}
            <g opacity={alpha * (future ? 1 : Math.max(label, done ? 1 : 0))} transform={`translate(0 ${(1 - label) * 18})`}>
              <text x={a + 6} y={AXY - 210} fill={active ? WHITE : GREY} style={font(120, 300, -2)}>
                {ph.n}
              </text>
              <Txt x={a + 10} y={AXY - 120} size={36} weight={400} tracking={1} fill={active ? WHITE : GREY}>
                {ph.l1}
              </Txt>
              <Txt x={a + 10} y={AXY - 74} size={36} weight={400} tracking={1} fill={active ? WHITE : GREY}>
                {ph.l2}
              </Txt>
            </g>
            {/* moving marker on the active phase */}
            {active ? (
              <circle cx={a + 6 + (b - a - 12) * playhead} cy={AXY} r={13} fill={AMBER} opacity={bar > 0.2 ? 1 : 0} />
            ) : null}
          </g>
        );
      })}
    </svg>
  );
};

// ---------------------------------------------------------------------------
// 2) Landers slipping to 2027
// ---------------------------------------------------------------------------
const monthX = (m: number) => X0 + (m / 24) * W; // Jan 2026 .. Dec 2027

const Bracket: React.FC<{ m0: number; m1: number; y: number; p: number; color: string; label: string; labelBelow?: boolean }> = ({
  m0,
  m1,
  y,
  p,
  color,
  label,
  labelBelow,
}) => {
  const a = monthX(m0) + 4;
  const b = monthX(m1) - 4;
  const mid = (a + b) / 2;
  return (
    <g opacity={Math.min(1, p * 1.4)}>
      <Draw x1={a} y1={y} x2={b} y2={y} p={p} color={color} width={3} />
      <Draw x1={a} y1={y} x2={a} y2={y + 22} p={p} color={color} width={3} />
      <Draw x1={b} y1={y} x2={b} y2={y + 22} p={p} color={color} width={3} />
      <Txt x={mid} y={labelBelow ? y + 66 : y - 20} anchor="middle" tracking={3} fill={color}>
        {label}
      </Txt>
    </g>
  );
};

const Slips: React.FC<{ which: string }> = ({ which }) => {
  const frame = useCurrentFrame();
  const AXY = 620;
  const axisP = prog(frame, 0, 26);
  const slide = prog(frame, which === "three" ? 54 : 44, 44);
  const k = prog(frame, 0, 18);
  const targetM = which === "I" ? [12, 18] : which === "III" ? [12, 15] : [12, 24];
  const targetLabel = which === "I" ? "FIRST HALF OF 2027" : which === "III" ? "Q1 2027" : "NOW: 2027";
  const title =
    which === "I" ? "MOON BASE I · BLUE MOON MK1" : which === "III" ? "MOON BASE III · NOVA-C" : "THE FIRST THREE LANDERS";
  const startC = monthX(6); // centre of 2026
  const endC = (monthX(targetM[0]) + monthX(targetM[1])) / 2;
  const cx = startC + (endC - startC) * slide;
  const dots = which === "three" ? [-46, 0, 46] : [0];
  const quarters = which !== "three";
  return (
    <svg width={1920} height={1080} viewBox="0 0 1920 1080">
      <Kicker text={title} opacity={k} />
      {/* 2027 shading */}
      <rect x={monthX(12)} y={AXY - 150} width={monthX(24) - monthX(12)} height={300} fill={TEAL} opacity={0.06 * axisP} />
      <Draw x1={X0} y1={AXY} x2={X1} y2={AXY} p={axisP} color={GREY} width={2} opacity={0.6} />
      {[
        [0, "2026"],
        [12, "2027"],
      ].map(([m, lbl]) => (
        <g key={String(lbl)} opacity={axisP}>
          <line x1={monthX(m as number)} y1={AXY - 20} x2={monthX(m as number)} y2={AXY + 20} stroke={GREY} strokeWidth={2} />
          <Txt x={monthX(m as number) + 12} y={AXY + 66} fill={TEAL} tracking={4}>
            {lbl as string}
          </Txt>
        </g>
      ))}
      {quarters
        ? [3, 6, 9, 15, 18, 21].map((m) => (
            <line key={m} x1={monthX(m)} y1={AXY - 9} x2={monthX(m)} y2={AXY + 9} stroke={GREY} strokeWidth={2} opacity={0.5 * axisP} />
          ))
        : null}
      <Bracket m0={0} m1={12} y={AXY - 150} p={prog(frame, 14, 26)} color={GREY} label="PLANNED 2026" />
      <Bracket
        m0={targetM[0]}
        m1={targetM[1]}
        y={AXY - 150}
        p={prog(frame, which === "three" ? 80 : 70, 26)}
        color={AMBER}
        label={targetLabel}
      />
      {which === "three" ? (
        <text
          x={(monthX(12) + monthX(24)) / 2}
          y={AXY - 262}
          textAnchor="middle"
          fill={WHITE}
          opacity={prog(frame, 92, 24)}
          transform={`translate(0 ${(1 - prog(frame, 92, 24)) * 26})`}
          style={font(170, 300, -3)}
        >
          2027
        </text>
      ) : null}
      {/* ghost markers (planned) */}
      {dots.map((d, i) => (
        <circle key={"g" + i} cx={startC + d} cy={AXY - 70} r={15} fill="none" stroke={GREY} strokeWidth={2} strokeDasharray="4 6" opacity={0.7 * axisP} />
      ))}
      {/* slip trail + moving markers */}
      <line x1={startC + 24} y1={AXY - 70} x2={cx - 24} y2={AXY - 70} stroke={AMBER} strokeWidth={2} strokeDasharray="3 10" opacity={slide > 0.02 ? 0.8 : 0} />
      {dots.map((d, i) => (
        <circle key={"m" + i} cx={cx + d} cy={AXY - 70} r={15} fill={slide > 0.98 ? AMBER : TEAL} opacity={axisP} />
      ))}
      {/* event marker: the New Glenn explosion, 28 May 2026 */}
      {which === "I" ? (
        <g opacity={prog(frame, 30, 20)}>
          <line x1={monthX(4.9)} y1={AXY - 22} x2={monthX(4.9)} y2={AXY + 120} stroke={AMBER} strokeWidth={2} />
          <circle cx={monthX(4.9)} cy={AXY} r={11} fill={INK} stroke={AMBER} strokeWidth={3} />
          <Txt x={monthX(4.9) - 4} y={AXY + 168} fill={AMBER} tracking={2}>
            NEW GLENN EXPLOSION · 28 MAY 2026
          </Txt>
        </g>
      ) : null}
      {which === "III" ? (
        <Txt x={(monthX(12) + monthX(15)) / 2} y={AXY + 126} anchor="middle" fill="#D5DBE9" tracking={3} opacity={prog(frame, 90, 20)}>
          ACCORDING TO ITS MAKER
        </Txt>
      ) : null}
    </svg>
  );
};

// ---------------------------------------------------------------------------
// 3) Temperature scale: shadowed lunar crater vs the surface of Pluto
// ---------------------------------------------------------------------------
const tx = (t: number) => X0 + (-t / 260) * W; // 0 .. -260 degC

const Thermal: React.FC<{ showPluto: boolean; inset: boolean }> = ({ showPluto, inset }) => {
  const frame = useCurrentFrame();
  const AXY = inset ? 380 : 700;
  const axisP = prog(frame, 0, 26);
  const move = prog(frame, 16, 52); // crater marker travels 0 -> -250
  const craterT = -250 * move;
  const craterX = tx(craterT);
  const readout = `${Math.round(craterT) === 0 ? "0" : "−" + Math.abs(Math.round(craterT))}°C`;
  const plutoP = showPluto ? prog(frame, inset ? 36 : 30, 26) : 0;
  const ticks = [0, -50, -100, -150, -200, -250];
  const panelOp = inset ? Math.min(1, axisP * 1.5) : 0;
  return (
    <svg width={1920} height={1080} viewBox="0 0 1920 1080">
      {inset ? (
        <rect x={X0 - 40} y={96} width={W + 80} height={500} rx={6} fill={INK} opacity={0.74 * panelOp} stroke={GREY} strokeOpacity={0.35} />
      ) : (
        <Kicker text="TEMPERATURE SCALE · °C" opacity={prog(frame, 0, 18)} y={310} />
      )}
      {/* big readout */}
      <text x={X0 + (inset ? 0 : 78)} y={inset ? 270 : 480} fill={WHITE} opacity={axisP} style={font(inset ? 130 : 190, 300, -3)}>
        {readout}
      </text>
      <Draw x1={X0} y1={AXY} x2={X1} y2={AXY} p={axisP} color={GREY} width={2} opacity={0.6} />
      {ticks.map((t) => (
        <g key={t} opacity={axisP}>
          <line x1={tx(t)} y1={AXY - 12} x2={tx(t)} y2={AXY + 12} stroke={GREY} strokeWidth={2} />
          <Txt x={tx(t)} y={AXY + 62} anchor="middle" tracking={1} size={36}>
            {t === 0 ? "0°" : `−${Math.abs(t)}°`}
          </Txt>
        </g>
      ))}
      {/* fill from 0 to the crater marker */}
      <line x1={X0} y1={AXY} x2={craterX} y2={AXY} stroke={TEAL} strokeWidth={8} strokeLinecap="round" />
      <circle cx={craterX} cy={AXY} r={15} fill={INK} stroke={TEAL} strokeWidth={4} />
      {move > 0.97 ? (
        <g opacity={prog(frame, 70, 16)}>
          <line x1={craterX} y1={AXY - 20} x2={craterX} y2={AXY - (inset ? 70 : 120)} stroke={TEAL} strokeWidth={2} />
          <Txt x={craterX + 20} y={AXY - (inset ? 80 : 130)} anchor="end" fill={TEAL} tracking={2}>
            PERMANENTLY SHADOWED CRATER
          </Txt>
        </g>
      ) : null}
      {showPluto ? (
        <g opacity={plutoP}>
          <line x1={tx(-233)} y1={AXY + 18} x2={tx(-233)} y2={AXY + (inset ? 118 : 150)} stroke={AMBER} strokeWidth={2} />
          <circle cx={tx(-233)} cy={AXY} r={13} fill={AMBER} />
          <Txt x={tx(-233) + 14} y={AXY + (inset ? 160 : 190)} anchor="end" fill={AMBER} tracking={2}>
            PLUTO SURFACE · −233°C
          </Txt>
          <Txt x={X0} y={inset ? 326 : 540} fill={WHITE} weight={400} tracking={1}>
            about 17° colder than Pluto
          </Txt>
        </g>
      ) : null}
    </svg>
  );
};

export const Schematic: React.FC<{ spec: SchematicSpec }> = ({ spec }) => {
  return (
    <AbsoluteFill style={{ backgroundColor: INK }}>
      {spec.kind === "phases" ? <Phases step={spec.step ?? 1} /> : null}
      {spec.kind === "slips" ? <Slips which={spec.which ?? "three"} /> : null}
      {spec.kind === "thermal" ? <Thermal showPluto={false} inset={false} /> : null}
      {spec.kind === "thermal_inset" ? <Thermal showPluto inset /> : null}
    </AbsoluteFill>
  );
};

/** Transparent variant drawn over a photograph (scene 18's temperature inset). */
export const SchematicOverlay: React.FC<{ spec: SchematicSpec }> = ({ spec }) => (
  <AbsoluteFill>{spec.kind === "thermal_inset" ? <Thermal showPluto inset /> : null}</AbsoluteFill>
);
