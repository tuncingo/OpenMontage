import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { AMBER, GREY, INK, TEAL, WHITE, Txt as BaseTxt, prog } from "./Schematic";

/** When true (vertical Shorts) the small in-diagram labels are not drawn: the headline is set big by DiagramVertical. */
const QuietCtx = React.createContext(false);
const Txt: React.FC<React.ComponentProps<typeof BaseTxt>> = (p) => (React.useContext(QuietCtx) ? null : <BaseTxt {...p} />);

/**
 * Generic, data-driven line diagrams for episodes without a hand-built schematic (see
 * bolumler/<kod>/diyagramlar.json, read by tools/kurul_render_props.py). Same look as Schematic.tsx:
 * near-black ground, hairline teal for the subject, muted amber for the highlight, grey context, Inter labels
 * of at least 36 px, everything draws itself in. Only facts that are in the script are labelled.
 * Anything that stands in for a real mission carries a small "ILLUSTRATION" tag.
 */

export type DiagramLayout =
  | "arrival" | "sphere" | "crater_streaks" | "crater_section" | "panels" | "orbits_pair" | "fault_rubble"
  | "table" | "orbiter_camera" | "layers" | "orbiters_beside" | "laser" | "outline_compare" | "tick"
  | "hollow_shift" | "orbiters_apart" | "labels3";

export interface DiagramSpec {
  kind: "diagram";
  layout: DiagramLayout;
  /** Amber kicker, top-left (max ~4 words). */
  label?: string;
  /** Smaller white line under the kicker. */
  sub?: string;
  illustration?: boolean;
  [k: string]: unknown;
}

const X0 = 192;
const W = 1536;
const sp = (spec: DiagramSpec, k: string, d: string) => (typeof spec[k] === "string" ? (spec[k] as string) : d);

const Frame: React.FC<{ spec: DiagramSpec; children: React.ReactNode; transparent?: boolean }> = ({ spec, children, transparent }) => {
  const frame = useCurrentFrame();
  const o = prog(frame, 4, 18);
  return (
    <AbsoluteFill style={{ backgroundColor: transparent ? "transparent" : INK }}>
      <svg viewBox="0 0 1920 1080" width="100%" height="100%">
        {spec.label ? (
          <Txt x={X0} y={300} fill={AMBER} tracking={9} opacity={o}>
            {spec.label}
          </Txt>
        ) : null}
        {spec.sub ? (
          <Txt x={X0} y={360} fill={WHITE} weight={400} tracking={1} size={40} opacity={prog(frame, 16, 18)}>
            {spec.sub}
          </Txt>
        ) : null}
        {children}
        {spec.illustration ? (
          <Txt x={X0} y={960} fill="#C3CADB" tracking={6} size={36} opacity={prog(frame, 22, 14)}>
            ILLUSTRATION
          </Txt>
        ) : null}
      </svg>
    </AbsoluteFill>
  );
};

/** A path that draws itself (pathLength normalised to 1). */
const PathDraw: React.FC<{ d: string; p: number; color?: string; width?: number; dash?: string; opacity?: number; fill?: string }> = ({
  d, p, color = TEAL, width = 3, dash, opacity = 1, fill = "none",
}) => (
  <path d={d} pathLength={1} fill={fill} stroke={color} strokeWidth={width} strokeLinecap="round" opacity={opacity}
    strokeDasharray={dash ?? "1 1"} strokeDashoffset={dash ? 0 : 1 - p}
    style={dash ? { clipPath: `inset(0 ${(1 - p) * 100}% 0 0)` } : undefined} />
);

const Planet: React.FC<{ cx: number; cy: number; r: number; p: number; color?: string }> = ({ cx, cy, r, p, color = TEAL }) => (
  <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={3} strokeDasharray={2 * Math.PI * r}
    strokeDashoffset={2 * Math.PI * r * (1 - p)} transform={`rotate(-90 ${cx} ${cy})`} />
);

const Orbiter: React.FC<{ x: number; y: number; color: string; s?: number; opacity?: number; rot?: number }> = ({ x, y, color, s = 1, opacity = 1, rot = 0 }) => (
  <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`} opacity={opacity} fill="none" stroke={color} strokeWidth={3}>
    <rect x={-22} y={-16} width={44} height={32} />
    <rect x={-92} y={-12} width={60} height={24} />
    <rect x={32} y={-12} width={60} height={24} />
    <line x1={-92} y1={0} x2={-32} y2={0} />
    <line x1={32} y1={0} x2={92} y2={0} />
  </g>
);

// 1) orbit arrival / safe-mode burn ---------------------------------------------------
const Arrival: React.FC<{ spec: DiagramSpec }> = ({ spec }) => {
  const f = useCurrentFrame();
  const burn = spec.burn === true;
  const cx = burn ? 1300 : 1440, cy = burn ? 600 : 700, R = burn ? 120 : 90;
  const approach = burn
    ? "M 200 430 C 560 430 760 530 1000 560 C 1140 585 1190 640 1270 700"
    : "M 200 880 C 700 880 1000 830 1340 740";
  const orbit = burn
    ? `M ${cx - 360} ${cy + 20} a 360 200 -12 1 0 720 -40 a 360 200 -12 1 0 -720 40`
    : `M ${cx - 270} ${cy + 10} a 270 150 -12 1 0 540 -20 a 270 150 -12 1 0 -540 20`;
  const a = prog(f, 14, 50);
  const o = prog(f, 56, 50);
  const t = (f / 150) % 1;
  const ang = 2 * Math.PI * t - Math.PI / 2;
  const rx = burn ? 360 : 270, ry = burn ? 200 : 150;
  const ex = cx + rx * Math.cos(ang) * Math.cos(-0.21) - ry * Math.sin(ang) * Math.sin(-0.21);
  const ey = cy + 20 + rx * Math.cos(ang) * Math.sin(-0.21) + ry * Math.sin(ang) * Math.cos(-0.21);
  return (
    <>
      <Planet cx={cx} cy={cy} r={R} p={prog(f, 6, 30)} />
      <PathDraw d={approach} p={a} color={AMBER} width={4} />
      {burn ? (
        <>
          <PathDraw d="M 1000 560 C 1140 585 1190 640 1270 700" p={prog(f, 60, 18)} color={AMBER} width={14} />
          <Txt x={900} y={760} fill={AMBER} tracking={3} opacity={prog(f, 70, 16)}>BRAKING BURN ENDED EARLY</Txt>
          <Txt x={900} y={700} fill={WHITE} tracking={3} opacity={prog(f, 84, 16)}>SAFE MODE</Txt>
        </>
      ) : (
        <>
          <PathDraw d={orbit} p={o} color={TEAL} width={3} dash="14 12" />
          {o > 0.98 ? <circle cx={ex} cy={ey} r={10} fill={AMBER} /> : null}
          
        </>
      )}
    </>
  );
};

// 2) rotating sphere ------------------------------------------------------------------
const Sphere: React.FC<{ spec: DiagramSpec }> = ({ spec }) => {
  const f = useCurrentFrame();
  const cx = 960, cy = 600, R = 230;
  const rot = (f / 360) * Math.PI * 2 * 1.4;
  const meridians = [0, 1, 2, 3, 4, 5].map((k) => Math.abs(Math.cos(rot + (k * Math.PI) / 6)));
  const gx = cx + R * 0.78 * Math.sin(rot * 1.0 + 0.8);
  const vis = Math.cos(rot * 1.0 + 0.8) > 0;
  return (
    <>
      <Planet cx={cx} cy={cy} r={R} p={prog(f, 4, 26)} />
      {[-0.6, -0.3, 0, 0.3, 0.6].map((l, i) => (
        <line key={i} x1={cx - R * Math.sqrt(1 - l * l)} x2={cx + R * Math.sqrt(1 - l * l)} y1={cy + R * l} y2={cy + R * l}
          stroke={TEAL} strokeWidth={1.5} opacity={0.45 * prog(f, 12 + i * 3, 20)} />
      ))}
      {meridians.map((m, i) => (
        <ellipse key={i} cx={cx} cy={cy} rx={Math.max(2, R * m)} ry={R} fill="none" stroke={TEAL} strokeWidth={1.5}
          opacity={0.45 * prog(f, 12 + i * 3, 20)} />
      ))}
      {vis ? <circle cx={gx} cy={cy - 60} r={10} fill={AMBER} opacity={prog(f, 40, 14)} /> : null}
    </>
  );
};

// 3) crater with streaks -------------------------------------------------------------
const CraterStreaks: React.FC<{ spec: DiagramSpec }> = ({ spec }) => {
  const f = useCurrentFrame();
  const cx = 1100, cy = 620;
  return (
    <>
      <ellipse cx={cx} cy={cy} rx={300} ry={190} fill="none" stroke={TEAL} strokeWidth={3} strokeDasharray={2000} strokeDashoffset={2000 * (1 - prog(f, 6, 40))} />
      <ellipse cx={cx} cy={cy + 14} rx={252} ry={150} fill="none" stroke={TEAL} strokeWidth={1.5} opacity={0.5 * prog(f, 20, 30)} />
      {[0, 1, 2, 3, 4, 5, 6].map((i) => {
        const x = cx - 230 + i * 78;
        const y0 = cy - 60 + Math.abs(i - 3) * 16;
        return <line key={i} x1={x} y1={y0} x2={x + 26} y2={y0 + 110} stroke={AMBER} strokeWidth={3} strokeLinecap="round"
          strokeDasharray={140} strokeDashoffset={140 * (1 - prog(f, 40 + i * 6, 24))} />;
      })}
      <Txt x={cx} y={cy + 300} anchor="middle" fill={AMBER} tracking={9} size={44} opacity={prog(f, 90, 18)}>UNEXPLAINED ?</Txt>
    </>
  );
};

// 4) crater cross-section with sun ---------------------------------------------------
const CraterSection: React.FC<{ spec: DiagramSpec }> = ({ spec }) => {
  const f = useCurrentFrame();
  const profile = "M 760 620 L 940 640 Q 1010 760 1100 790 Q 1190 760 1260 640 L 1440 620";
  return (
    <>
      <line x1={X0} y1={620} x2={1728} y2={620} stroke={GREY} strokeWidth={1.5} opacity={0.5} />
      <PathDraw d={profile} p={prog(f, 6, 40)} width={4} />
      <line x1={400} y1={420} x2={720} y2={560} stroke={GREY} strokeWidth={3} opacity={prog(f, 20, 20)} markerEnd="url(#a)" />
      <defs><marker id="a" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0 0 L10 5 L0 10 z" fill={GREY} /></marker></defs>
      <Txt x={400} y={390} fill={GREY} tracking={4} opacity={prog(f, 24, 16)}>SUNLIGHT</Txt>
      {[0, 1, 2, 3, 4].map((i) => (
        <line key={i} x1={1010 + i * 42} y1={690 + i * 22} x2={1036 + i * 42} y2={716 + i * 22} stroke={AMBER} strokeWidth={5} strokeLinecap="round"
          opacity={prog(f, 50 + i * 6, 14)} />
      ))}
      {spec.numeral === false ? null : (
        <>
          <Txt x={X0} y={860} fill={WHITE} weight={200} size={120} tracking={0} opacity={prog(f, 40, 24)}>about 400</Txt>
          <Txt x={X0} y={920} fill={AMBER} tracking={9} opacity={prog(f, 54, 20)}>BRIGHT STREAKS</Txt>
        </>
      )}
    </>
  );
};

// 5) two panels: many craters vs almost none ----------------------------------------
const Panels: React.FC<{ spec: DiagramSpec }> = ({ spec }) => {
  const f = useCurrentFrame();
  const dots = [[40, 60, 12], [120, 130, 9], [210, 50, 14], [280, 160, 8], [90, 220, 11], [220, 250, 13], [300, 90, 7], [160, 300, 10], [60, 330, 8], [330, 300, 12], [250, 330, 7], [140, 190, 6]];
  return (
    <>
      <g transform="translate(192 380)">
        <rect width={680} height={440} fill="none" stroke={GREY} strokeWidth={2} opacity={prog(f, 4, 16)} />
        {dots.map(([x, y, r], i) => <circle key={i} cx={x * 1.8 + 20} cy={y * 1.1 + 10} r={r * 1.6} fill="none" stroke={TEAL} strokeWidth={3} opacity={prog(f, 14 + i * 4, 12)} />)}
        <Txt x={0} y={500} fill={TEAL} tracking={6} opacity={prog(f, 40, 16)}>MANY CRATERS</Txt>
      </g>
      <g transform="translate(1048 380)">
        <rect width={680} height={440} fill="none" stroke={AMBER} strokeWidth={4} opacity={prog(f, 40, 20)} />
        <circle cx={230} cy={260} r={16} fill="none" stroke={TEAL} strokeWidth={3} opacity={prog(f, 60, 14)} />
        <circle cx={470} cy={130} r={10} fill="none" stroke={TEAL} strokeWidth={3} opacity={prog(f, 66, 14)} />
        <Txt x={0} y={500} fill={AMBER} tracking={6} opacity={prog(f, 70, 16)}>ALMOST NONE</Txt>
      </g>
    </>
  );
};

// 6) two orbits around a planet + hollow marker -------------------------------------
const OrbitsPair: React.FC<{ spec: DiagramSpec }> = ({ spec }) => {
  const f = useCurrentFrame();
  const cx = 960, cy = 620, R = 130;
  return (
    <>
      <Planet cx={cx} cy={cy} r={R} p={prog(f, 4, 26)} />
      <PathDraw d={`M ${cx - 380} ${cy} a 380 210 0 1 0 760 0 a 380 210 0 1 0 -760 0`} p={prog(f, 20, 40)} width={2.5} />
      <PathDraw d={`M ${cx - 330} ${cy - 40} a 330 180 -18 1 0 660 80 a 330 180 -18 1 0 -660 -80`} p={prog(f, 44, 40)} width={2.5} color={AMBER} />
      <circle cx={cx + 70} cy={cy - R + 18} r={9} fill={AMBER} opacity={prog(f, 70, 12)} />
      <Txt x={cx} y={940} anchor="middle" fill={WHITE} weight={400} tracking={4} opacity={prog(f, 84, 16)}>COME BACK TO THEM</Txt>
    </>
  );
};

// 7) fault line hidden under rubble --------------------------------------------------
const FaultRubble: React.FC<{ spec: DiagramSpec }> = ({ spec }) => {
  const f = useCurrentFrame();
  return (
    <>
      <PathDraw d="M 300 760 L 760 640 L 760 560 L 1100 470 L 1100 400 L 1500 300" p={prog(f, 4, 50)} width={5} />
      <g opacity={prog(f, 40, 30)} stroke={AMBER} strokeWidth={3}>
        <rect x={720} y={380} width={520} height={430} fill="none" strokeDasharray="10 8" />
        {Array.from({ length: 16 }).map((_, i) => (
          <line key={i} x1={720 + i * 36} y1={810} x2={756 + i * 36 > 1240 ? 1240 : 756 + i * 36} y2={810 - (756 + i * 36 > 1240 ? 1240 - 720 - i * 36 : 36) * 1} opacity={0.8} />
        ))}
      </g>
      <Txt x={980} y={900} anchor="middle" fill={AMBER} tracking={9} opacity={prog(f, 70, 18)}>HIDDEN FAULTS</Txt>
    </>
  );
};

// 8) two-column table ---------------------------------------------------------------
const Table: React.FC<{ spec: DiagramSpec }> = ({ spec }) => {
  const f = useCurrentFrame();
  const cols = (spec.columns as { head: string; lines: string[]; color?: string }[]) ?? [];
  const hi = (spec.highlight as number) ?? 0;
  const w = W / Math.max(1, cols.length);
  return (
    <>
      {cols.map((c, i) => {
        const x = X0 + i * w;
        const color = c.color === "amber" ? AMBER : TEAL;
        return (
          <g key={i} opacity={prog(f, 10 + i * 18, 20)}>
            <line x1={x} y1={450} x2={x + w - 60} y2={450} stroke={color} strokeWidth={i === hi ? 5 : 2} />
            <Txt x={x} y={430} fill={color} tracking={7} size={46}>{c.head}</Txt>
            {c.lines.map((ln, j) => <Txt key={j} x={x} y={530 + j * 64} fill={i === hi ? WHITE : GREY} weight={400} tracking={1} size={44}>{ln}</Txt>)}
          </g>
        );
      })}
    </>
  );
};

// 9) orbiter + camera cone -----------------------------------------------------------
const OrbiterCamera: React.FC<{ spec: DiagramSpec }> = ({ spec }) => {
  const f = useCurrentFrame();
  const target = sp(spec, "target", "hollow");
  const cx = 1100, cy = 1250, R = 560; // big planet limb at the bottom
  const tx = cx - 40, ty = cy - R;
  return (
    <>
      <PathDraw d={`M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx + R} ${cy}`} p={prog(f, 4, 40)} width={3} />
      <Orbiter x={cx - 260} y={420} color={TEAL} s={1.7} opacity={prog(f, 14, 20)} />
      <polygon points={`${cx - 260},440 ${tx - 70},${ty - 4} ${tx + 70},${ty - 4}`} fill={AMBER} opacity={0.18 * prog(f, 40, 24)} stroke={AMBER} strokeWidth={2} />
      {target === "trenches"
        ? [0, 1, 2, 3, 4].map((i) => <line key={i} x1={tx - 60 + i * 26} y1={ty + 6} x2={tx - 40 + i * 26} y2={ty + 30} stroke={TEAL} strokeWidth={3} opacity={prog(f, 56 + i * 4, 10)} />)
        : <ellipse cx={tx} cy={ty + 8} rx={46} ry={16} fill="none" stroke={AMBER} strokeWidth={4} opacity={prog(f, 56, 14)} />}
    </>
  );
};

// 10) buried layers + plume ----------------------------------------------------------
const Layers: React.FC<{ spec: DiagramSpec }> = ({ spec }) => {
  const f = useCurrentFrame();
  return (
    <>
      <line x1={X0} y1={620} x2={1728} y2={620} stroke={TEAL} strokeWidth={4} strokeDasharray={W} strokeDashoffset={W * (1 - prog(f, 4, 30))} />
      <rect x={X0} y={680} width={W} height={90} fill={AMBER} opacity={0.22 * prog(f, 26, 24)} stroke={AMBER} strokeWidth={2} />
      <Txt x={X0 + 20} y={742} fill={AMBER} tracking={6} size={40} opacity={prog(f, 40, 16)}>BURIED ASH</Txt>
      <circle cx={1300} cy={606} r={14} fill={AMBER} opacity={prog(f, 56, 12)} />
      {[0, 1, 2, 3].map((i) => <line key={i} x1={1300 + (i - 1.5) * 18} y1={580} x2={1300 + (i - 1.5) * 36} y2={450 - (i % 2) * 40} stroke={AMBER} strokeWidth={3} strokeLinecap="round" opacity={prog(f, 62 + i * 4, 14) * 0.9} />)}
      <Txt x={1300} y={400} anchor="middle" fill={WHITE} weight={400} tracking={4} size={40} opacity={prog(f, 76, 16)}>BRIGHT PATCH</Txt>
    </>
  );
};

// 11) two orbiters beside Mercury ---------------------------------------------------
const OrbitersBeside: React.FC<{ spec: DiagramSpec }> = ({ spec }) => {
  const f = useCurrentFrame();
  return (
    <>
      <Planet cx={1380} cy={620} r={150} p={prog(f, 4, 30)} />
      <Orbiter x={760} y={500} color={TEAL} s={1.6} opacity={prog(f, 20, 18)} />
      <Txt x={760} y={600} anchor="middle" fill={TEAL} tracking={5} opacity={prog(f, 30, 16)}>EUROPEAN</Txt>
      <Orbiter x={760} y={780} color={AMBER} s={1.3} opacity={prog(f, 36, 18)} />
      <Txt x={760} y={860} anchor="middle" fill={AMBER} tracking={5} opacity={prog(f, 46, 16)}>JAPANESE</Txt>
      <Txt x={1380} y={870} anchor="middle" fill={WHITE} weight={400} tracking={5} opacity={prog(f, 70, 16)}>SECOND TO ORBIT</Txt>
    </>
  );
};

// 12) laser altimeter ---------------------------------------------------------------
const Laser: React.FC<{ spec: DiagramSpec }> = ({ spec }) => {
  const f = useCurrentFrame();
  const surf = "M 192 800 L 420 790 L 560 830 L 700 780 L 860 810 L 1000 760 L 1160 800 L 1300 780 L 1460 820 L 1728 790";
  const sx = 400 + ((f * 9) % 1100);
  return (
    <>
      <PathDraw d={surf} p={prog(f, 4, 40)} width={3} />
      <Orbiter x={sx} y={420} color={TEAL} s={1.6} opacity={prog(f, 10, 16)} />
      <line x1={sx} y1={440} x2={sx} y2={790} stroke={AMBER} strokeWidth={3} opacity={prog(f, 40, 12)} />
      <Txt x={X0} y={880} fill={AMBER} tracking={9} opacity={prog(f, 50, 16)}>LASER ALTIMETER</Txt>
    </>
  );
};

// 13) two overlaid outlines ---------------------------------------------------------
const OutlineCompare: React.FC<{ spec: DiagramSpec }> = ({ spec }) => {
  const f = useCurrentFrame();
  const blob = (dx: number, dy: number) => `M ${960 + dx - 280} ${600 + dy} C ${960 + dx - 280} ${600 + dy - 190} ${960 + dx + 280} ${600 + dy - 190} ${960 + dx + 280} ${600 + dy} C ${960 + dx + 280} ${600 + dy + 190} ${960 + dx - 280} ${600 + dy + 190} ${960 + dx - 280} ${600 + dy} Z`;
  return (
    <>
      <PathDraw d={blob(0, 0)} p={prog(f, 4, 40)} width={4} />
      <PathDraw d={blob(14, 8)} p={prog(f, 40, 40)} width={4} color={AMBER} />
      <Txt x={640} y={900} anchor="middle" fill={TEAL} tracking={6} opacity={prog(f, 50, 16)}>MESSENGER</Txt>
      <Txt x={1280} y={900} anchor="middle" fill={AMBER} tracking={6} opacity={prog(f, 70, 16)}>SECOND LOOK</Txt>
    </>
  );
};

// 14) tiny tick moving --------------------------------------------------------------
const Tick: React.FC<{ spec: DiagramSpec }> = ({ spec }) => {
  const f = useCurrentFrame();
  const x = 880 + prog(f, 30, 120) * 14;
  return (
    <>
      <line x1={X0} y1={620} x2={1728} y2={620} stroke={TEAL} strokeWidth={3} strokeDasharray={W} strokeDashoffset={W * (1 - prog(f, 4, 30))} />
      <line x1={880} y1={580} x2={880} y2={660} stroke={GREY} strokeWidth={2} opacity={0.7} />
      <line x1={x} y1={570} x2={x} y2={670} stroke={AMBER} strokeWidth={6} strokeLinecap="round" opacity={prog(f, 24, 12)} />
      <Txt x={960} y={860} anchor="middle" fill={AMBER} tracking={9} opacity={prog(f, 50, 16)}>SMALL AND SLOW</Txt>
    </>
  );
};

// 15) hollow edge shift (+ new streak) ----------------------------------------------
const HollowShift: React.FC<{ spec: DiagramSpec }> = ({ spec }) => {
  const f = useCurrentFrame();
  const streak = spec.streak === true;
  const blob = (dx: number) => `M ${860 + dx} 560 C ${860 + dx} 420 1180 ${420} 1180 ${580 + 0} C 1180 760 ${880 + dx} 760 ${860 + dx} 560 Z`;
  return (
    <>
      <PathDraw d={blob(0)} p={prog(f, 4, 40)} width={4} />
      <PathDraw d={blob(46)} p={prog(f, 40, 36)} width={4} color={AMBER} dash="14 10" />
      {spec.arrow !== false ? <line x1={860} y1={800} x2={910} y2={800} stroke={AMBER} strokeWidth={5} opacity={prog(f, 70, 14)} /> : null}
      {streak ? <line x1={1260} y1={440} x2={1330} y2={640} stroke={AMBER} strokeWidth={5} strokeLinecap="round" strokeDasharray={220} strokeDashoffset={220 * (1 - prog(f, 90, 24))} /> : null}
      {spec.caption ? <Txt x={960} y={940} anchor="middle" fill={AMBER} tracking={9} opacity={prog(f, 70, 16)}>{String(spec.caption)}</Txt> : null}
    </>
  );
};

// 16) orbiters moving apart --------------------------------------------------------
const OrbitersApart: React.FC<{ spec: DiagramSpec }> = ({ spec }) => {
  const f = useCurrentFrame();
  const d = prog(f, 30, 70) * 250;
  return (
    <>
      <Orbiter x={960 - 160 - d} y={560} color={TEAL} s={2} opacity={prog(f, 6, 16)} />
      <Orbiter x={960 + 160 + d} y={560} color={AMBER} s={1.6} opacity={prog(f, 6, 16)} />
      <Txt x={960} y={860} anchor="middle" fill={WHITE} weight={300} size={64} tracking={6} opacity={prog(f, 60, 20)}>9 TO 10 DECEMBER</Txt>
    </>
  );
};

// 17) three labels -----------------------------------------------------------------
const Labels3: React.FC<{ spec: DiagramSpec }> = ({ spec }) => {
  const f = useCurrentFrame();
  const items = (spec.items as string[]) ?? ["DEAD", "QUIET", "UNNAMED"];
  return (
    <>
      {items.map((t, i) => {
        const last = i === items.length - 1;
        return <Txt key={i} x={X0} y={470 + i * 150} fill={last ? AMBER : WHITE} weight={last ? 300 : 200} size={120} tracking={4} opacity={prog(f, 8 + i * 22, 20) * (last ? 1 : 0.9)}>{t}</Txt>;
      })}
    </>
  );
};

export const Diagram: React.FC<{ spec: DiagramSpec; transparent?: boolean }> = ({ spec, transparent }) => {
  useVideoConfig();
  const L = spec.layout;
  return (
    <Frame spec={spec} transparent={transparent}>
      {L === "arrival" ? <Arrival spec={spec} /> : null}
      {L === "sphere" ? <Sphere spec={spec} /> : null}
      {L === "crater_streaks" ? <CraterStreaks spec={spec} /> : null}
      {L === "crater_section" ? <CraterSection spec={spec} /> : null}
      {L === "panels" ? <Panels spec={spec} /> : null}
      {L === "orbits_pair" ? <OrbitsPair spec={spec} /> : null}
      {L === "fault_rubble" ? <FaultRubble spec={spec} /> : null}
      {L === "table" ? <Table spec={spec} /> : null}
      {L === "orbiter_camera" ? <OrbiterCamera spec={spec} /> : null}
      {L === "layers" ? <Layers spec={spec} /> : null}
      {L === "orbiters_beside" ? <OrbitersBeside spec={spec} /> : null}
      {L === "laser" ? <Laser spec={spec} /> : null}
      {L === "outline_compare" ? <OutlineCompare spec={spec} /> : null}
      {L === "tick" ? <Tick spec={spec} /> : null}
      {L === "hollow_shift" ? <HollowShift spec={spec} /> : null}
      {L === "orbiters_apart" ? <OrbitersApart spec={spec} /> : null}
      {L === "labels3" ? <Labels3 spec={spec} /> : null}
    </Frame>
  );
};


const LEFT = 60;
const BIG = 64;

/**
 * Vertical (1080x1920) version for the Shorts: transparent, drawn over the darkened backdrop the Short supplies.
 * Headline at 64 px, the line drawing scaled into the safe zone without its tiny labels; the text-only layouts
 * (table, three labels) are set directly in large type.
 */
export const DiagramVertical: React.FC<{ spec: DiagramSpec }> = ({ spec }) => {
  const f = useCurrentFrame();
  const L = spec.layout;
  const head = (spec.label as string | undefined) ?? "";
  const o = prog(f, 4, 18);
  const shadow: React.CSSProperties = { filter: "drop-shadow(0 0 14px rgba(5,7,12,0.85))" };
  if (L === "table") {
    const cols = (spec.columns as { head: string; lines: string[]; color?: string }[]) ?? [];
    return (
      <AbsoluteFill style={shadow}>
        <svg width={1080} height={1920} viewBox="0 0 1080 1920">
          <BaseTxt x={LEFT} y={300} size={BIG} fill={AMBER} tracking={5} opacity={o}>{head}</BaseTxt>
          {cols.map((c, i) => {
            const y = 480 + i * 330;
            const color = c.color === "amber" ? AMBER : TEAL;
            return (
              <g key={i} opacity={prog(f, 10 + i * 18, 20)}>
                <line x1={LEFT} y1={y + 20} x2={840} y2={y + 20} stroke={color} strokeWidth={4} />
                <BaseTxt x={LEFT} y={y} size={BIG} fill={color} tracking={5}>{c.head}</BaseTxt>
                {c.lines.map((ln, j) => <BaseTxt key={j} x={LEFT} y={y + 100 + j * 64} size={52} weight={400} tracking={1} fill={WHITE}>{ln}</BaseTxt>)}
              </g>
            );
          })}
        </svg>
      </AbsoluteFill>
    );
  }
  if (L === "labels3") {
    const items = (spec.items as string[]) ?? [];
    return (
      <AbsoluteFill style={shadow}>
        <svg width={1080} height={1920} viewBox="0 0 1080 1920">
          {items.map((t, i) => {
            const last = i === items.length - 1;
            return <BaseTxt key={i} x={LEFT} y={560 + i * 190} size={150} weight={last ? 300 : 200} tracking={4} fill={last ? AMBER : WHITE} opacity={prog(f, 8 + i * 22, 20)}>{t}</BaseTxt>;
          })}
        </svg>
      </AbsoluteFill>
    );
  }
  const S = 0.5; // 1920 x 1080 → 960 x 540 band
  return (
    <AbsoluteFill style={shadow}>
      <svg width={1080} height={1920} viewBox="0 0 1080 1920">
        <BaseTxt x={LEFT} y={300} size={BIG} fill={AMBER} tracking={5} opacity={o}>{head}</BaseTxt>
        {spec.illustration ? <BaseTxt x={LEFT} y={1130} size={48} fill={GREY} tracking={5} opacity={prog(f, 30, 20)}>ILLUSTRATION</BaseTxt> : null}
      </svg>
      <div style={{ position: "absolute", left: LEFT, top: 460, width: 1920, height: 1080, transformOrigin: "0 0", transform: `scale(${S})` }}>
        <QuietCtx.Provider value={true}>
          <Diagram spec={{ ...spec, label: undefined, sub: undefined, illustration: false }} transparent />
        </QuietCtx.Provider>
      </div>
    </AbsoluteFill>
  );
};
