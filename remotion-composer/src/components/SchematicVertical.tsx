import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { AMBER, Draw, GREY, INK, SchematicSpec, TEAL, Txt, WHITE, font, prog } from "./Schematic";

/**
 * Vertical (1080x1920) versions of the schematic line graphics, laid out for a phone:
 * the time / temperature axis runs top to bottom, labels sit beside the axis, every label is >= 36 px
 * and everything stays inside x 60..900 and y 230..1120 (clear of the caption zone and of the app UI).
 */

const LEFT = 60;

const Kicker: React.FC<{ lines: string[]; opacity: number; y?: number }> = ({ lines, opacity, y = 290 }) => (
  <>
    {lines.map((l, i) => (
      <Txt key={i} x={LEFT} y={y + i * 46} fill={AMBER} tracking={5} opacity={opacity}>
        {l}
      </Txt>
    ))}
  </>
);

const Svg: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <svg width={1080} height={1920} viewBox="0 0 1080 1920">
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
  const AX = 170, Y0 = 430, Y1 = 1050;
  const py = (off: number) => Y0 + (off / 9) * (Y1 - Y0);
  const axisP = step === 1 ? prog(frame, 0, 28) : 1;
  const k = prog(frame, 0, 18);
  const playhead = interpolate(frame, [10, durationInFrames - 6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <Svg>
      <Kicker lines={["THREE-PHASE PLAN"]} opacity={k} />
      <Draw x1={AX} y1={Y0} x2={AX} y2={Y1} p={axisP} color={GREY} width={2} opacity={0.55} />
      {([[0, "NOW"], [3, "2029"], [6, "2032"]] as [number, string][]).map(([off, label]) => (
        <g key={label} opacity={axisP}>
          <line x1={AX - 14} y1={py(off)} x2={AX + 14} y2={py(off)} stroke={GREY} strokeWidth={2} />
          <Txt x={AX - 28} y={py(off) + 13} anchor="end" tracking={2}>{label}</Txt>
        </g>
      ))}
      {PHASES.map((ph, i) => {
        const idx = i + 1;
        const done = idx < step, active = idx === step, future = idx > step;
        const bar = done ? 1 : active ? prog(frame, 14, 40) : 0;
        const label = done ? 1 : active ? prog(frame, 20, 22) : 0;
        const colour = active ? TEAL : GREY;
        const a = py(ph.a), b = py(ph.b);
        const alpha = done ? 0.5 : active ? 1 : 0.28;
        return (
          <g key={ph.n}>
            <Draw x1={AX} y1={a + 6} x2={AX} y2={b - 6} p={bar} color={colour} width={8} opacity={done ? 0.55 : 1} />
            {future ? <line x1={AX} y1={a + 6} x2={AX} y2={b - 6} stroke={GREY} strokeWidth={3} strokeDasharray="4 14" opacity={0.35} /> : null}
            <g opacity={alpha * (future ? 1 : Math.max(label, done ? 1 : 0))} transform={`translate(0 ${(1 - label) * 18})`}>
              <text x={AX + 50} y={a + 112} fill={active ? WHITE : GREY} style={font(110, 300, -2)}>{ph.n}</text>
              <Txt x={AX + 54} y={a + 160} weight={400} tracking={1} fill={active ? WHITE : GREY}>{ph.l1}</Txt>
              <Txt x={AX + 54} y={a + 204} weight={400} tracking={1} fill={active ? WHITE : GREY}>{ph.l2}</Txt>
            </g>
            {active ? <circle cx={AX} cy={a + 6 + (b - a - 12) * playhead} r={13} fill={AMBER} opacity={bar > 0.2 ? 1 : 0} /> : null}
          </g>
        );
      })}
    </Svg>
  );
};

// ---------------------------------------------------------------- slips
const Slips: React.FC<{ which: string }> = ({ which }) => {
  const frame = useCurrentFrame();
  const AX = 330, Y0 = 440, Y1 = 1040, BX = AX + 50;
  const my = (m: number) => Y0 + (m / 24) * (Y1 - Y0);
  const axisP = prog(frame, 0, 26);
  const slide = prog(frame, which === "three" ? 54 : 44, 44);
  const k = prog(frame, 0, 18);
  const t = which === "I" ? [12, 18] : which === "III" ? [12, 15] : [12, 24];
  const targetLabel = which === "I" ? "FIRST HALF OF 2027" : which === "III" ? "Q1 2027" : "NOW: 2027";
  const title = which === "I" ? ["MOON BASE I", "BLUE MOON MK1"] : which === "III" ? ["MOON BASE III", "NOVA-C"] : ["THE FIRST THREE LANDERS"];
  const MX = AX - 80;
  const startC = my(6), endC = (my(t[0]) + my(t[1])) / 2;
  const cy = startC + (endC - startC) * slide;
  const dots = which === "three" ? [-40, 0, 40] : [0];
  const Bracket = (m0: number, m1: number, p: number, color: string, label: string, extra?: string[]) => {
    const a = my(m0) + 4, b = my(m1) - 4;
    return (
      <g opacity={Math.min(1, p * 1.4)}>
        <Draw x1={BX} y1={a} x2={BX} y2={b} p={p} color={color} width={3} />
        <Draw x1={BX} y1={a} x2={BX + 22} y2={a} p={p} color={color} width={3} />
        <Draw x1={BX} y1={b} x2={BX + 22} y2={b} p={p} color={color} width={3} />
        <Txt x={BX + 40} y={a + 44} fill={color} tracking={3}>{label}</Txt>
        {(extra ?? []).map((e, i) => (
          <Txt key={i} x={BX + 40} y={a + 92 + i * 44} fill="#D5DBE9" tracking={3} opacity={prog(frame, 90, 20)}>{e}</Txt>
        ))}
      </g>
    );
  };
  return (
    <Svg>
      <Kicker lines={title} opacity={k} />
      <rect x={AX - 160} y={my(12)} width={320} height={my(24) - my(12)} fill={TEAL} opacity={0.06 * axisP} />
      <Draw x1={AX} y1={Y0} x2={AX} y2={Y1} p={axisP} color={GREY} width={2} opacity={0.6} />
      {([[0, "2026"], [12, "2027"]] as [number, string][]).map(([m, lbl]) => (
        <g key={lbl} opacity={axisP}>
          <line x1={AX - 20} y1={my(m)} x2={AX + 20} y2={my(m)} stroke={GREY} strokeWidth={2} />
          <Txt x={AX - 34} y={my(m) + 14} anchor="end" fill={TEAL} tracking={4}>{lbl}</Txt>
        </g>
      ))}
      {which !== "three"
        ? [3, 6, 9, 15, 18, 21].map((m) => (
            <line key={m} x1={AX - 9} y1={my(m)} x2={AX + 9} y2={my(m)} stroke={GREY} strokeWidth={2} opacity={0.5 * axisP} />
          ))
        : null}
      {Bracket(0, 12, prog(frame, 14, 26), GREY, "PLANNED 2026")}
      {Bracket(t[0], t[1], prog(frame, which === "three" ? 80 : 70, 26), AMBER, targetLabel,
        which === "III" ? ["ACCORDING TO", "ITS MAKER"] : undefined)}
      {which === "three" ? (
        <text x={BX + 40} y={my(12) + 250} fill={WHITE} opacity={prog(frame, 92, 24)} style={font(170, 300, -3)}>2027</text>
      ) : null}
      {dots.map((d, i) => (
        <circle key={"g" + i} cx={MX} cy={startC + d} r={15} fill="none" stroke={GREY} strokeWidth={2} strokeDasharray="4 6" opacity={0.7 * axisP} />
      ))}
      <line x1={MX} y1={startC + 40} x2={MX} y2={cy - 24} stroke={AMBER} strokeWidth={2} strokeDasharray="3 10" opacity={slide > 0.02 ? 0.8 : 0} />
      {dots.map((d, i) => (
        <circle key={"m" + i} cx={MX} cy={cy + d} r={15} fill={slide > 0.98 ? AMBER : TEAL} opacity={axisP} />
      ))}
      {which === "I" ? (
        <g opacity={prog(frame, 30, 20)}>
          <circle cx={AX} cy={my(4.9)} r={11} fill={INK} stroke={AMBER} strokeWidth={3} />
          <Txt x={BX + 40} y={my(4.9) + 22} fill={AMBER} tracking={2}>NEW GLENN EXPLOSION</Txt>
          <Txt x={BX + 40} y={my(4.9) + 66} fill={AMBER} tracking={2}>28 MAY 2026</Txt>
        </g>
      ) : null}
    </Svg>
  );
};

// ---------------------------------------------------------------- thermal
const Thermal: React.FC<{ showPluto: boolean; inset: boolean }> = ({ showPluto, inset }) => {
  const frame = useCurrentFrame();
  const AX = 270, Y0 = 520, Y1 = 1040;
  const ty = (t: number) => Y0 + (-t / 260) * (Y1 - Y0);
  const axisP = prog(frame, 0, 26);
  const move = prog(frame, 16, 52);
  const craterT = -250 * move;
  const cyv = ty(craterT);
  const readout = `${Math.round(craterT) === 0 ? "0" : "−" + Math.abs(Math.round(craterT))}°C`;
  const plutoP = showPluto ? prog(frame, inset ? 36 : 30, 26) : 0;
  const ticks = [0, -50, -100, -150, -200, -250];
  return (
    <Svg>
      {inset ? (
        <rect x={40} y={230} width={1000} height={880} rx={6} fill={INK} opacity={0.74 * Math.min(1, axisP * 1.5)} stroke={GREY} strokeOpacity={0.35} />
      ) : (
        <Kicker lines={["TEMPERATURE SCALE · °C"]} opacity={prog(frame, 0, 18)} y={300} />
      )}
      <text x={LEFT + 20} y={inset ? 440 : 470} fill={WHITE} opacity={axisP} style={font(inset ? 150 : 190, 300, -3)}>{readout}</text>
      <Draw x1={AX} y1={Y0} x2={AX} y2={Y1} p={axisP} color={GREY} width={2} opacity={0.6} />
      {ticks.map((t) => (
        <g key={t} opacity={axisP}>
          <line x1={AX - 12} y1={ty(t)} x2={AX + 12} y2={ty(t)} stroke={GREY} strokeWidth={2} />
          <Txt x={AX - 28} y={ty(t) + 13} anchor="end" tracking={1}>{t === 0 ? "0°" : `−${Math.abs(t)}°`}</Txt>
        </g>
      ))}
      <line x1={AX} y1={Y0} x2={AX} y2={cyv} stroke={TEAL} strokeWidth={8} strokeLinecap="round" />
      <circle cx={AX} cy={cyv} r={15} fill={INK} stroke={TEAL} strokeWidth={4} />
      {move > 0.97 ? (
        <g opacity={prog(frame, 70, 16)}>
          <line x1={AX + 20} y1={ty(-250)} x2={AX + 46} y2={ty(-250)} stroke={TEAL} strokeWidth={2} />
          <Txt x={AX + 58} y={ty(-250) + 40} fill={TEAL} tracking={2}>PERMANENTLY SHADOWED</Txt>
          <Txt x={AX + 58} y={ty(-250) + 84} fill={TEAL} tracking={2}>CRATER</Txt>
        </g>
      ) : null}
      {showPluto ? (
        <g opacity={plutoP}>
          <circle cx={AX} cy={ty(-233)} r={13} fill={AMBER} />
          <line x1={AX + 18} y1={ty(-233)} x2={AX + 46} y2={ty(-233)} stroke={AMBER} strokeWidth={2} />
          <Txt x={AX + 58} y={ty(-233) + 12} fill={AMBER} tracking={2}>PLUTO · −233°C</Txt>
          <Txt x={AX + 58} y={760} fill={WHITE} weight={400} tracking={1}>about 17° colder</Txt>
          <Txt x={AX + 58} y={804} fill={WHITE} weight={400} tracking={1}>than Pluto</Txt>
        </g>
      ) : null}
    </Svg>
  );
};

export const SchematicVertical: React.FC<{ spec: SchematicSpec }> = ({ spec }) => (
  <AbsoluteFill style={{ backgroundColor: INK }}>
    {spec.kind === "phases" ? <Phases step={spec.step ?? 1} /> : null}
    {spec.kind === "slips" ? <Slips which={spec.which ?? "three"} /> : null}
    {spec.kind === "thermal" ? <Thermal showPluto={false} inset={false} /> : null}
  </AbsoluteFill>
);

/** thermal_inset: transparent, drawn over the photograph on a dark panel. */
export const SchematicVerticalOverlay: React.FC<{ spec: SchematicSpec }> = ({ spec }) => (
  <AbsoluteFill>{spec.kind === "thermal_inset" ? <Thermal showPluto inset /> : null}</AbsoluteFill>
);
