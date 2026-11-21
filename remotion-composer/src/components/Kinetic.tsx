import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

/**
 * Animated text / graphics for the Rebel Minds: Cosmos channel.
 * Every component here animates relative to its OWN Sequence (frame 0 = it appears,
 * last frames = it leaves), so wrap each one in a <Sequence> of its on-screen length.
 */

export const NAVY = "#0B1026";
export const AMBER = "#FFB020";
export const ICE = "#F2F5FF";
export const VIOLET = "#6C3BFF";
export const SAFE_X = 192;
export const SAFE_Y = 108;

const EXIT = 12; // frames

const useEnterExit = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const exit = interpolate(frame, [durationInFrames - EXIT, durationInFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return { frame, fps, durationInFrames, exit };
};

// ---------------------------------------------------------------------------
// Kinetic letters: each glyph springs in with scale / rise / rotation / blur.
// ---------------------------------------------------------------------------
const Letters: React.FC<{
  text: string;
  size: number;
  color: string;
  stagger?: number;
  delay?: number;
  glow?: string;
  weight?: number;
}> = ({ text, size, color, stagger = 2, delay = 0, glow, weight = 800 }) => {
  const { frame, fps, durationInFrames, exit } = useEnterExit();
  const chars = Array.from(text);
  return (
    <div style={{ display: "flex", justifyContent: "center", whiteSpace: "pre" }}>
      {chars.map((ch, i) => {
        const p = spring({
          frame: frame - delay - i * stagger,
          fps,
          config: { damping: 13, stiffness: 150, mass: 0.7 },
        });
        // leave in reverse order
        const leave = interpolate(exit, [0, 1], [0, 1]) * (1 + (chars.length - i) * 0.0);
        const y = (1 - p) * 70 - leave * 46;
        const s = 1 + (1 - p) * 0.9 - leave * 0.15;
        const rot = (1 - p) * (i % 2 === 0 ? -9 : 9);
        const blur = (1 - p) * 9 + leave * 6;
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              fontFamily: "Montserrat, sans-serif",
              fontWeight: weight,
              fontSize: size,
              lineHeight: 1.04,
              color,
              opacity: Math.max(0, Math.min(p, 1 - leave)),
              transform: `translateY(${y}px) scale(${s}) rotate(${rot}deg)`,
              filter: `blur(${blur}px)`,
              textShadow: glow
                ? `0 0 ${34 * p}px ${glow}, 0 4px 20px rgba(5,7,15,0.9)`
                : "0 3px 18px rgba(5,7,15,0.95), 0 0 6px rgba(5,7,15,0.9)",
            }}
          >
            {ch === " " ? " " : ch}
          </span>
        );
      })}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Big number / date with kinetic typography and (optional) count-up.
// ---------------------------------------------------------------------------
const parseCount = (hero: string): { prefix: string; value: number; suffix: string } | null => {
  const m = hero.match(/^([^\d]*)(\d+(?:\.\d+)?)(.*)$/);
  if (!m) return null;
  const value = parseFloat(m[2]);
  if (value >= 1900 && value <= 2100) return null; // years: no counting
  return { prefix: m[1], value, suffix: m[3] };
};

export const KineticNumber: React.FC<{ hero: string; caption?: string }> = ({ hero, caption }) => {
  const { frame, fps, exit } = useEnterExit();
  const count = parseCount(hero);
  let shown = hero;
  if (count) {
    const t = interpolate(frame, [4, 4 + fps * 0.9], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const eased = 1 - Math.pow(1 - t, 3);
    const v = count.value * eased;
    shown = count.prefix + (Number.isInteger(count.value) ? Math.round(v).toString() : v.toFixed(1)) + count.suffix;
  }
  // Keep the glyph count stable while counting so the layout does not jump.
  const size = hero.length <= 5 ? 230 : hero.length <= 8 ? 190 : 140;
  const scrim = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: "clamp" }) * (1 - exit);
  const line = spring({ frame: frame - 10, fps, config: { damping: 20, stiffness: 120 } });
  const capP = spring({ frame: frame - 14, fps, config: { damping: 16, stiffness: 120 } });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <AbsoluteFill
        style={{
          opacity: scrim,
          background: "radial-gradient(ellipse 60% 48% at 50% 50%, rgba(5,7,15,0.72) 0%, rgba(5,7,15,0.0) 100%)",
        }}
      />
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
        {caption ? (
          <div
            style={{
              marginBottom: 4,
              fontFamily: "Montserrat, sans-serif",
              fontWeight: 800,
              fontSize: 64,
              color: ICE,
              letterSpacing: 2,
              textTransform: "uppercase",
              opacity: Math.min(capP, 1 - exit),
              transform: `translateY(${(1 - capP) * -34 - exit * 20}px)`,
              textShadow: "0 3px 18px rgba(5,7,15,0.95)",
            }}
          >
            {caption}
          </div>
        ) : null}
        <Letters text={shown} size={size} color={AMBER} stagger={2} glow="rgba(255,176,32,0.65)" />
        <div
          style={{
            height: 8,
            width: `${Math.min(1, line) * 62}%`,
            borderRadius: 4,
            background: `linear-gradient(90deg, ${VIOLET}, ${AMBER})`,
            opacity: 1 - exit,
          }}
        />
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Headline: words slide up out of a mask, staggered; leave upward.
// ---------------------------------------------------------------------------
export const KineticHeadline: React.FC<{
  text: string;
  position: "top" | "center" | "bottom" | "lower-third" | string;
  size?: number;
}> = ({ text, position, size = 76 }) => {
  const { frame, fps, exit } = useEnterExit();
  const words = text.split(/\s+/);
  const place: React.CSSProperties =
    position === "center"
      ? { top: 0, bottom: 0, alignItems: "center" }
      : position === "top"
      ? { top: SAFE_Y }
      : position === "lower-third"
      ? { bottom: SAFE_Y + 120 }
      : { bottom: SAFE_Y };
  const scrimIn = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: "clamp" }) * (1 - exit);
  return (
    <div style={{ position: "absolute", left: SAFE_X, right: SAFE_X, display: "flex", justifyContent: "center", ...place }}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: "0 22px",
          padding: "12px 34px",
          borderRadius: 14,
          background: `rgba(11,16,38,${0.5 * scrimIn})`,
        }}
      >
        {words.map((w, i) => {
          const p = spring({ frame: frame - i * 4, fps, config: { damping: 15, stiffness: 140, mass: 0.7 } });
          return (
            <span key={i} style={{ display: "inline-block", overflow: "hidden", paddingTop: 6, paddingBottom: 10 }}>
              <span
                style={{
                  display: "inline-block",
                  fontFamily: "Montserrat, sans-serif",
                  fontWeight: 800,
                  fontSize: size,
                  lineHeight: 1.05,
                  textTransform: "uppercase",
                  color: i === words.length - 1 && /\d/.test(w) ? AMBER : ICE,
                  transform: `translateY(${(1 - p) * 110 - exit * 90}px)`,
                  opacity: Math.min(p, 1 - exit),
                  textShadow: "0 3px 18px rgba(5,7,15,0.95)",
                }}
              >
                {w}
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Lower third: accent bar grows, panel wipes open, text slides in; reverses out.
// ---------------------------------------------------------------------------
export const LowerThird: React.FC<{ text: string; bottom?: number }> = ({ text, bottom = SAFE_Y + 40 }) => {
  const { frame, fps, exit } = useEnterExit();
  const bar = spring({ frame, fps, config: { damping: 18, stiffness: 160 } });
  const panel = spring({ frame: frame - 4, fps, config: { damping: 20, stiffness: 120 } });
  const txt = spring({ frame: frame - 8, fps, config: { damping: 16, stiffness: 130, mass: 0.8 } });
  const open = Math.max(0, Math.min(1, panel)) * (1 - exit);
  return (
    <div style={{ position: "absolute", left: SAFE_X, bottom, display: "flex", alignItems: "stretch" }}>
      <div
        style={{
          width: 10,
          borderRadius: 5,
          background: AMBER,
          transform: `scaleY(${Math.min(1, bar) * (1 - exit)})`,
          transformOrigin: "bottom",
        }}
      />
      <div
        style={{
          clipPath: `inset(0 ${(1 - open) * 100}% 0 0)`,
          background: "linear-gradient(90deg, rgba(11,16,38,0.86), rgba(11,16,38,0.55))",
          padding: "14px 38px 14px 26px",
        }}
      >
        <div
          style={{
            fontFamily: "Montserrat, sans-serif",
            fontWeight: 800,
            fontSize: 64,
            lineHeight: 1.08,
            color: ICE,
            textTransform: "uppercase",
            whiteSpace: "nowrap",
            transform: `translateX(${(1 - txt) * -70 - exit * 40}px)`,
            opacity: Math.min(txt, 1 - exit),
            textShadow: "0 2px 10px rgba(5,7,15,0.8)",
          }}
        >
          {text}
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Small corner label (e.g. "Illustration"): fades and slides a few px.
// ---------------------------------------------------------------------------
export const CornerLabel: React.FC<{ text: string; sizePx: number }> = ({ text, sizePx }) => {
  const { frame, fps, exit } = useEnterExit();
  const p = spring({ frame, fps, config: { damping: 20, stiffness: 120 } });
  return (
    <div
      style={{
        position: "absolute",
        top: SAFE_Y,
        right: SAFE_X,
        opacity: Math.min(p, 1 - exit),
        transform: `translateY(${(1 - p) * -14}px)`,
        fontFamily: "Inter, sans-serif",
        fontWeight: 600,
        fontSize: sizePx,
        letterSpacing: 1,
        color: ICE,
        background: "rgba(11,16,38,0.6)",
        padding: "6px 14px",
        borderRadius: 6,
        textTransform: "uppercase",
      }}
    >
      {text}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Evidence tracker: circle pops, panel unfolds, counter rolls up, then folds away.
// ---------------------------------------------------------------------------
export const EvidenceTracker: React.FC<{ count: number; label: string }> = ({ count, label }) => {
  const { frame, fps, durationInFrames } = useEnterExit();
  const pop = spring({ frame, fps, config: { damping: 11, stiffness: 170, mass: 0.7 } });
  const unfold = spring({ frame: frame - 8, fps, config: { damping: 19, stiffness: 120 } });
  const roll = spring({ frame: frame - 10, fps, config: { damping: 17, stiffness: 150 } });
  const fold = interpolate(frame, [durationInFrames - 18, durationInFrames - 4], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const gone = interpolate(frame, [durationInFrames - 8, durationInFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const reveal = Math.max(0, Math.min(1, unfold)) * (1 - fold);
  const chars = Array.from(label);
  const typed = Math.floor(interpolate(frame, [12, 12 + chars.length * 1.2], [0, chars.length], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  }));
  return (
    <div
      style={{
        position: "absolute",
        top: SAFE_Y,
        left: SAFE_X,
        display: "flex",
        alignItems: "center",
        transform: `scale(${Math.max(0, pop) * (1 - gone)})`,
        transformOrigin: "left center",
      }}
    >
      <div
        style={{
          zIndex: 2,
          width: 68,
          height: 68,
          borderRadius: 34,
          background: AMBER,
          boxShadow: `0 0 ${24 * pop}px rgba(255,176,32,0.7)`,
          overflow: "hidden",
          position: "relative",
          flexShrink: 0,
        }}
      >
        {/* previous number rolls out, new number rolls in */}
        {[count - 1, count].map((n, k) => (
          <div
            key={k}
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "Montserrat, sans-serif",
              fontWeight: 800,
              fontSize: 40,
              color: NAVY,
              transform: `translateY(${k === 0 ? -roll * 70 : (1 - roll) * 70}px)`,
            }}
          >
            {n}
          </div>
        ))}
      </div>
      <div
        style={{
          marginLeft: -26,
          paddingLeft: 40,
          paddingRight: 26,
          height: 68,
          display: "flex",
          alignItems: "center",
          clipPath: `inset(0 ${(1 - reveal) * 100}% 0 0 round 0 14px 14px 0)`,
          background: "rgba(11,16,38,0.82)",
          border: `2px solid ${VIOLET}`,
          borderLeft: "none",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", minWidth: 330 }}>
          <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: 18, color: AMBER, letterSpacing: 3, lineHeight: 1 }}>
            EVIDENCE
          </div>
          <div
            style={{
              fontFamily: "Montserrat, sans-serif",
              fontWeight: 800,
              fontSize: 30,
              color: ICE,
              lineHeight: 1.15,
              whiteSpace: "nowrap",
            }}
          >
            {chars.slice(0, typed).join("")}
          </div>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Star / dust layer with depth: faster particles are bigger and nearer.
// ---------------------------------------------------------------------------
const rng = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

export const StarDust: React.FC<{ seed: number; count?: number; opacity?: number }> = ({
  seed,
  count = 90,
  opacity = 1,
}) => {
  const frame = useCurrentFrame();
  const W = 1920;
  const H = 1080;
  const r = rng(seed * 101 + 7);
  const parts = Array.from({ length: count }, () => ({
    x: r() * W,
    y: r() * H,
    d: 0.15 + r() * 0.85,
    ph: r() * 6.28,
    warm: r() > 0.85,
  }));
  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        {parts.map((p, i) => {
          const x = (((p.x + frame * p.d * 0.9) % (W + 40)) + (W + 40)) % (W + 40) - 20;
          const y = p.y + Math.sin(frame / 70 + p.ph) * 10 * p.d;
          const tw = 0.45 + 0.5 * Math.sin(frame / (14 + p.d * 14) + p.ph);
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={0.7 + p.d * 2.3}
              fill={p.warm ? "#FFD58A" : "#F2F5FF"}
              opacity={Math.max(0.08, tw) * (0.35 + p.d * 0.65)}
            />
          );
        })}
        {/* a few soft bokeh motes drifting slowly in the foreground */}
        {Array.from({ length: 5 }, (_, i) => {
          const rr = rng(seed * 31 + i);
          const x0 = rr() * W;
          const y0 = rr() * H;
          const sp = 0.25 + rr() * 0.4;
          return (
            <circle
              key={"b" + i}
              cx={(((x0 + frame * sp) % (W + 120)) + (W + 120)) % (W + 120) - 60}
              cy={y0 + Math.sin(frame / 90 + i) * 18}
              r={10 + rr() * 16}
              fill="#FFD58A"
              opacity={0.07}
            />
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};
