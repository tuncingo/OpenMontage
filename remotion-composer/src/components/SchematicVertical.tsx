import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { AMBER, Draw, GREY, INK, SchematicSpec, TEAL, Txt, WHITE, font, prog } from "./Schematic";

/**
 * Vertical (1080x1920) versions of the schematic line graphics, laid out for a phone and drawn ON TOP of a darkened
 * photo/clip (the Short composition supplies the backdrop; these components are transparent):
 *  - strokes >= 3 px, axis and label text >= 48 px, big numerals 1.3x the 16:9 size
 *  - the time / temperature axis runs top to bottom and the graphic fills the safe zone y 230..1150
 *  - everything stays inside x 60..900 (clear of the app UI on the right)
 */

const LEFT = 60;
const LABEL = 48;

/** 48 px label. */
const T: React.FC<React.ComponentProps<typeof Txt>> = (p) => <Txt size={LABEL} tracking={2} {...p} />;

const Kicker: React.FC<{ lines: string[]; opacity: number; y?: number }> = ({ lines, opacity, y = 285 }) => (
  <>
    {lines.map((l, i) => (
      <T key={i} x={LEFT} y={y + i * 56} fill={AMBER} tracking={5} opacity={opacity}>
        {l}
      </T>
    ))}
  </>
);

const Svg: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{ filter: "drop-shadow(0 0 14px rgba(5,7,12,0.85))" }}>
    {children}
  </svg>
);

// ---------------------------------------------------------------- phases
const PHASES = [
  { n: "01", a: 0, b: 3, l1: "Robots, tech demos,", l2: "scouting" },
  { n: "02", a: 3, b: 6, l1: "Early power, cargo,", l2: "communications" },
  { n: "03", a: 6, b: 9, l1: "Permanent outpost,", l2: "habitats" },
];

const Phases: React.FC<{ step: number }> = ({ step }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const AX = 200, Y0 = 370, Y1 = 1128;
  const py = (off: number) => Y0 + (off / 9) * (Y1 - Y0);
  const axisP = step === 1 ? prog(frame, 0, 28) : 1;
  const k = prog(frame, 0, 18);
  const playhead = interpolate(frame, [10, durationInFrames - 6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <Svg>
      <Kicker lines={["THREE-PHASE PLAN"]} opacity={k} />
      <Draw x1={AX} y1={Y0} x2={AX} y2={Y1} p={axisP} color={GREY} width={4} opacity={0.7} />
      {([[0, "NOW"], [3, "2029"], [6, "2032"]] as [number, string][]).map(([off, label]) => (
        <g key={label} opacity={axisP}>
          <line x1={AX - 16} y1={py(off)} x2={AX + 16} y2={py(off)} stroke={GREY} strokeWidth={4} />
          <T x={AX - 30} y={py(off) + 17} anchor="end">{label}</T>
        </g>
      ))}
      {PHASES.map((ph, i) => {
        const idx = i + 1;
        const done = idx < step, active = idx === step, future = idx > step;
        const bar = done ? 1 : active ? prog(frame, 14, 40) : 0;
        const label = done ? 1 : active ? prog(frame, 20, 22) : 0;
        const colour = active ? TEAL : GREY;
        const a = py(ph.a), b = py(ph.b);
        const alpha = done ? 0.55 : active ? 1 : 0.4;
        return (
          <g key={ph.n}>
            <Draw x1={AX} y1={a + 6} x2={AX} y2={b - 6} p={bar} color={colour} width={10} opacity={done ? 0.55 : 1} />
            {future ? <line x1={AX} y1={a + 6} x2={AX} y2={b - 6} stroke={GREY} strokeWidth={4} strokeDasharray="4 14" opacity={0.45} /> : null}
            <g opacity={alpha * (future ? 1 : Math.max(label, done ? 1 : 0))} transform={`translate(0 ${(1 - label) * 18})`}>
              <text x={AX + 50} y={a + 140} fill={active ? WHITE : GREY} style={font(143, 300, -2)}>{ph.n}</text>
              <T x={AX + 54} y={a + 196} weight={400} tracking={1} fill={active ? WHITE : GREY}>{ph.l1}</T>
              <T x={AX + 54} y={a + 248} weight={400} tracking={1} fill={active ? WHITE : GREY}>{ph.l2}</T>
            </g>
            {active ? <circle cx={AX} cy={a + 6 + (b - a - 12) * playhead} r={17} fill={AMBER} opacity={bar > 0.2 ? 1 : 0} /> : null}
          </g>
        );
      })}
    </Svg>
  );
};

// ---------------------------------------------------------------- slips
const Slips: React.FC<{ which: string }> = ({ which }) => {
  const frame = useCurrentFrame();
  const AX = 230, Y0 = 400, Y1 = 1146, BX = AX + 44;
  const my = (m: number) => Y0 + (m / 24) * (Y1 - Y0);
  const axisP = prog(frame, 0, 26);
  const slide = prog(frame, which === "three" ? 54 : 44, 44);
  const k = prog(frame, 0, 18);
  const t = which === "I" ? [12, 18] : which === "III" ? [12, 15] : [12, 24];
  const targetLabel = which === "I" ? "FIRST HALF OF 2027" : which === "III" ? "Q1 2027" : "NOW: 2027";
  const title = which === "I" ? ["MOON BASE I", "BLUE MOON MK1"] : which === "III" ? ["MOON BASE III", "NOVA-C"] : ["THE FIRST THREE LANDERS"];
  const startC = my(6), endC = (my(t[0]) + my(t[1])) / 2;
  const cy = startC + (endC - startC) * slide;
  const dots = which === "three" ? [-50, 0, 50] : [0];
  const Bracket = (m0: number, m1: number, p: number, color: string, label: string, extra?: string[]) => {
    const a = my(m0) + 4, b = my(m1) - 4;
    return (
      <g opacity={Math.min(1, p * 1.4)}>
        <Draw x1={BX} y1={a} x2={BX} y2={b} p={p} color={color} width={4} />
        <Draw x1={BX} y1={a} x2={BX + 24} y2={a} p={p} color={color} width={4} />
        <Draw x1={BX} y1={b} x2={BX + 24} y2={b} p={p} color={color} width={4} />
        <T x={BX + 42} y={a + 54} fill={color} tracking={1}>{label}</T>
        {(extra ?? []).map((e, i) => (
          <T key={i} x={BX + 42} y={a + 108 + i * 54} fill="#D5DBE9" tracking={1} opacity={prog(frame, 90, 20)}>{e}</T>
        ))}
      </g>
    );
  };
  return (
    <Svg>
      <Kicker lines={title} opacity={k} />
      <rect x={AX - 190} y={my(12)} width={380} height={my(24) - my(12)} fill={TEAL} opacity={0.08 * axisP} />
      <Draw x1={AX} y1={Y0} x2={AX} y2={Y1} p={axisP} color={GREY} width={4} opacity={0.7} />
      {([[0, "2026"], [12, "2027"]] as [number, string][]).map(([m, lbl]) => (
        <g key={lbl} opacity={axisP}>
          <line x1={AX - 22} y1={my(m)} x2={AX + 22} y2={my(m)} stroke={GREY} strokeWidth={4} />
          <T x={AX - 36} y={my(m) + 17} anchor="end" fill={TEAL} tracking={3}>{lbl}</T>
        </g>
      ))}
      {which !== "three"
        ? [3, 6, 9, 15, 18, 21].map((m) => (
            <line key={m} x1={AX - 11} y1={my(m)} x2={AX + 11} y2={my(m)} stroke={GREY} strokeWidth={3} opacity={0.6 * axisP} />
          ))
        : null}
      {Bracket(0, 12, prog(frame, 14, 26), GREY, "PLANNED 2026")}
      {Bracket(t[0], t[1], prog(frame, which === "three" ? 80 : 70, 26), AMBER, targetLabel,
        which === "III" ? ["ACCORDING TO", "ITS MAKER"] : undefined)}
      {which === "three" ? (
        <text x={BX + 42} y={my(12) + 330} fill={WHITE} opacity={prog(frame, 92, 24)} style={font(221, 300, -3)}>2027</text>
      ) : null}
      {dots.map((d, i) => (
        <circle key={"g" + i} cx={AX} cy={startC + d} r={19} fill="none" stroke={GREY} strokeWidth={3} strokeDasharray="4 6" opacity={0.8 * axisP} />
      ))}
      <line x1={AX + 36} y1={startC + 40} x2={AX + 36} y2={cy - 24} stroke={AMBER} strokeWidth={3} strokeDasharray="3 10" opacity={slide > 0.02 ? 0.85 : 0} />
      {dots.map((d, i) => (
        <circle key={"m" + i} cx={AX} cy={cy + d} r={19} fill={slide > 0.98 ? AMBER : TEAL} opacity={axisP} />
      ))}
      {which === "I" ? (
        <g opacity={prog(frame, 30, 20)}>
          <circle cx={AX} cy={my(4.9)} r={14} fill={INK} stroke={AMBER} strokeWidth={4} />
          <T x={BX + 42} y={my(4.9) + 16} fill={AMBER} tracking={1}>NEW GLENN</T>
          <T x={BX + 42} y={my(4.9) + 70} fill={AMBER} tracking={1}>EXPLOSION</T>
          <T x={BX + 42} y={my(4.9) + 124} fill={AMBER} tracking={1}>28 MAY 2026</T>
        </g>
      ) : null}
    </Svg>
  );
};

// ---------------------------------------------------------------- thermal
const Thermal: React.FC<{ showPluto: boolean; inset: boolean }> = ({ showPluto, inset }) => {
  const frame = useCurrentFrame();
  const AX = 250, Y0 = 610, Y1 = 960;
  const ty = (t: number) => Y0 + (-t / 260) * (Y1 - Y0);
  const axisP = prog(frame, 0, 26);
  const move = prog(frame, 16, 52);
  const craterT = -250 * move;
  const cyv = ty(craterT);
  const readout = `${Math.round(craterT) === 0 ? "0" : "−" + Math.abs(Math.round(craterT))}°C`;
  const plutoP = showPluto ? prog(frame, inset ? 36 : 30, 26) : 0;
  const ticks = [0, -50, -100, -150, -200, -250];
  const RS = inset ? 195 : 247;
  return (
    <Svg>
      {inset ? null : <Kicker lines={["TEMPERATURE SCALE · °C"]} opacity={prog(frame, 0, 18)} />}
      <text x={LEFT - 4} y={inset ? 470 : 535} fill={WHITE} opacity={axisP} style={font(RS, 300, -3)}>{readout}</text>
      <Draw x1={AX} y1={Y0} x2={AX} y2={Y1} p={axisP} color={GREY} width={4} opacity={0.7} />
      {ticks.map((t) => (
        <g key={t} opacity={axisP}>
          <line x1={AX - 14} y1={ty(t)} x2={AX + 14} y2={ty(t)} stroke={GREY} strokeWidth={3} />
          <T x={AX - 30} y={ty(t) + 17} anchor="end" tracking={1}>{t === 0 ? "0°" : `−${Math.abs(t)}°`}</T>
        </g>
      ))}
      <line x1={AX} y1={Y0} x2={AX} y2={cyv} stroke={TEAL} strokeWidth={10} strokeLinecap="round" />
      <circle cx={AX} cy={cyv} r={19} fill={INK} stroke={TEAL} strokeWidth={5} />
      {move > 0.97 ? (
        <g opacity={prog(frame, 70, 16)}>
          <T x={AX + 60} y={ty(-250) + 68} fill={TEAL} tracking={1}>PERMANENTLY</T>
          <T x={AX + 60} y={ty(-250) + 122} fill={TEAL} tracking={1}>SHADOWED</T>
          <T x={AX + 60} y={ty(-250) + 176} fill={TEAL} tracking={1}>CRATER</T>
        </g>
      ) : null}
      {showPluto ? (
        <g opacity={plutoP}>
          <circle cx={AX} cy={ty(-233)} r={16} fill={AMBER} />
          <line x1={AX + 22} y1={ty(-233) - 6} x2={AX + 50} y2={ty(-233) - 26} stroke={AMBER} strokeWidth={3} />
          <T x={AX + 60} y={ty(-233) - 12} fill={AMBER} tracking={1}>PLUTO · −233°C</T>
          <T x={AX + 60} y={Y0 + 150} fill={WHITE} weight={400} tracking={1}>about 17° colder</T>
          <T x={AX + 60} y={Y0 + 204} fill={WHITE} weight={400} tracking={1}>than Pluto</T>
        </g>
      ) : null}
    </Svg>
  );
};

/** Transparent: drawn over the darkened backdrop supplied by the Short composition. */
export const SchematicVertical: React.FC<{ spec: SchematicSpec }> = ({ spec }) => (
  <AbsoluteFill>
    {spec.kind === "phases" ? <Phases step={spec.step ?? 1} /> : null}
    {spec.kind === "slips" ? <Slips which={spec.which ?? "three"} /> : null}
    {spec.kind === "thermal" ? <Thermal showPluto={false} inset={false} /> : null}
  </AbsoluteFill>
);

/** thermal_inset: drawn over the (darkened, full-screen) photograph of its own scene — no panel, no mask. */
export const SchematicVerticalOverlay: React.FC<{ spec: SchematicSpec }> = ({ spec }) => (
  <AbsoluteFill>{spec.kind === "thermal_inset" ? <Thermal showPluto inset /> : null}</AbsoluteFill>
);
