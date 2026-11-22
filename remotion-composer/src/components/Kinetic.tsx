import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

/**
 * Animated text / graphics for Rebel Minds: Cosmos, in the look of the channel's earlier
 * episodes: near-black ground, Inter Light numerals, hairline rules, letter-spaced captions,
 * a teal accent with a muted amber, small grey source credits.
 *
 * Every component animates relative to its OWN Sequence (frame 0 = it appears, the last
 * frames = it leaves), so wrap each one in a <Sequence> of its on-screen length.
 */

export const INK = "#05070C"; // near-black ground
export const NAVY = INK;
export const WHITE = "#F2F5FF";
export const ICE = WHITE;
export const TEAL = "#62C2CF";
export const AMBER = "#D9A25B"; // muted
export const GREY = "#8A93A6";
export const DIM = "#5E6678";
export const VIOLET = TEAL;
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

const SOFT_SHADOW = "0 2px 14px rgba(5,7,12,0.85), 0 0 4px rgba(5,7,12,0.7)";

// ---------------------------------------------------------------------------
// Glyph reveal: each character rises, un-blurs and fades in, staggered; leaves upward.
// ---------------------------------------------------------------------------
const Letters: React.FC<{
  text: string;
  size: number;
  weight: number;
  color: string;
  stagger?: number;
  delay?: number;
  tracking?: number;
  align?: "left" | "center";
}> = ({ text, size, weight, color, stagger = 2, delay = 0, tracking = 0, align = "left" }) => {
  const { frame, fps, exit } = useEnterExit();
  const chars = Array.from(text);
  return (
    <div style={{ display: "flex", justifyContent: align === "left" ? "flex-start" : "center", whiteSpace: "pre" }}>
      {chars.map((ch, i) => {
        const p = spring({ frame: frame - delay - i * stagger, fps, config: { damping: 18, stiffness: 120, mass: 0.8 } });
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              fontFamily: "Inter, sans-serif",
              fontWeight: weight,
              fontSize: size,
              lineHeight: 1.04,
              letterSpacing: tracking,
              color,
              opacity: Math.max(0, Math.min(p, 1 - exit)),
              transform: `translateY(${(1 - p) * 34 - exit * 26}px)`,
              filter: `blur(${(1 - p) * 7 + exit * 4}px)`,
              textShadow: SOFT_SHADOW,
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
// Big number / date: Inter Light numerals, hairline rule, regular caption.
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
    const t = interpolate(frame, [4, 4 + fps * 0.9], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    const v = count.value * (1 - Math.pow(1 - t, 3));
    shown = count.prefix + (Number.isInteger(count.value) ? Math.round(v).toString() : v.toFixed(1)) + count.suffix;
  }
  const size = hero.length <= 5 ? 220 : hero.length <= 8 ? 190 : 150;
  const scrim = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" }) * (1 - exit);
  const rule = spring({ frame: frame - 8, fps, config: { damping: 22, stiffness: 90 } });
  const capP = spring({ frame: frame - 14, fps, config: { damping: 18, stiffness: 110 } });
  return (
    <AbsoluteFill>
      {/* quiet left-weighted scrim keeps the numerals legible over photographs */}
      <AbsoluteFill
        style={{
          opacity: scrim,
          background: "linear-gradient(90deg, rgba(5,7,12,0.82) 0%, rgba(5,7,12,0.55) 42%, rgba(5,7,12,0) 72%)",
        }}
      />
      <div style={{ position: "absolute", left: 270, top: 0, bottom: 0, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <Letters text={shown} size={size} weight={300} color={WHITE} stagger={2} tracking={-2} />
        <div
          style={{
            marginTop: 14,
            height: 2,
            width: Math.min(1, rule) * 560,
            background: "linear-gradient(90deg, rgba(98,194,207,0.9), rgba(138,147,166,0.35))",
            opacity: 1 - exit,
          }}
        />
        {caption ? (
          <div
            style={{
              marginTop: 24,
              fontFamily: "Inter, sans-serif",
              fontWeight: 400,
              fontSize: 46,
              color: "#E4E9F5",
              letterSpacing: 0.4,
              opacity: Math.min(capP, 1 - exit),
              transform: `translateY(${(1 - capP) * 22 - exit * 14}px)`,
              textShadow: SOFT_SHADOW,
            }}
          >
            {caption}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Headline: thin teal bar grows, text rises in word by word (Inter Medium, tracked caps).
// ---------------------------------------------------------------------------
export const KineticHeadline: React.FC<{
  text: string;
  position: "top" | "center" | "bottom" | "lower-third" | string;
  size?: number;
}> = ({ text, position, size = 68 }) => {
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
  const bar = spring({ frame, fps, config: { damping: 20, stiffness: 120 } });
  const scrimIn = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: "clamp" }) * (1 - exit);
  return (
    <div style={{ position: "absolute", left: SAFE_X, right: SAFE_X, display: "flex", justifyContent: "center", ...place }}>
      <div
        style={{
          display: "flex",
          alignItems: "stretch",
          gap: 26,
          padding: "14px 40px 14px 28px",
          borderRadius: 4,
          background: `linear-gradient(90deg, rgba(5,7,12,${0.7 * scrimIn}), rgba(5,7,12,${0.35 * scrimIn}))`,
        }}
      >
        <div style={{ width: 3, background: TEAL, transform: `scaleY(${Math.min(1, bar) * (1 - exit)})`, transformOrigin: "center" }} />
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0 22px" }}>
          {words.map((w, i) => {
            const p = spring({ frame: frame - 4 - i * 4, fps, config: { damping: 18, stiffness: 130, mass: 0.8 } });
            return (
              <span key={i} style={{ display: "inline-block", overflow: "hidden", paddingTop: 4, paddingBottom: 8 }}>
                <span
                  style={{
                    display: "inline-block",
                    fontFamily: "Inter, sans-serif",
                    fontWeight: 500,
                    fontSize: size,
                    lineHeight: 1.06,
                    letterSpacing: 3,
                    color: /\d/.test(w) ? AMBER : WHITE,
                    transform: `translateY(${(1 - p) * 90 - exit * 70}px)`,
                    opacity: Math.min(p, 1 - exit),
                  }}
                >
                  {w}
                </span>
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Lower third: a teal bar draws upward, the text slides out of it, reverses on exit.
// ---------------------------------------------------------------------------
export const LowerThird: React.FC<{ text: string; bottom?: number }> = ({ text, bottom = SAFE_Y + 40 }) => {
  const { frame, fps, exit } = useEnterExit();
  const bar = spring({ frame, fps, config: { damping: 18, stiffness: 150 } });
  const txt = spring({ frame: frame - 6, fps, config: { damping: 18, stiffness: 120, mass: 0.8 } });
  const open = Math.max(0, Math.min(1, spring({ frame: frame - 3, fps, config: { damping: 22, stiffness: 100 } }))) * (1 - exit);
  return (
    <div style={{ position: "absolute", left: SAFE_X, bottom, display: "flex", alignItems: "stretch" }}>
      <div style={{ width: 4, background: TEAL, transform: `scaleY(${Math.min(1, bar) * (1 - exit)})`, transformOrigin: "bottom" }} />
      <div
        style={{
          clipPath: `inset(0 ${(1 - open) * 100}% 0 0)`,
          background: "linear-gradient(90deg, rgba(5,7,12,0.82), rgba(5,7,12,0.0))",
          padding: "12px 90px 12px 26px",
        }}
      >
        <div
          style={{
            fontFamily: "Inter, sans-serif",
            fontWeight: 500,
            fontSize: 60,
            lineHeight: 1.1,
            letterSpacing: 2,
            color: WHITE,
            whiteSpace: "nowrap",
            transform: `translateX(${(1 - txt) * -60 - exit * 30}px)`,
            opacity: Math.min(txt, 1 - exit),
            textShadow: SOFT_SHADOW,
          }}
        >
          {text}
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Small corner label ("Illustration"): quiet, tracked caps.
// ---------------------------------------------------------------------------
export const CornerLabel: React.FC<{ text: string; sizePx: number }> = ({ text, sizePx }) => {
  const { frame, fps, exit } = useEnterExit();
  const p = spring({ frame, fps, config: { damping: 22, stiffness: 100 } });
  return (
    <div
      style={{
        position: "absolute",
        top: SAFE_Y,
        right: SAFE_X,
        opacity: Math.min(p, 1 - exit),
        transform: `translateY(${(1 - p) * -12}px)`,
        fontFamily: "Inter, sans-serif",
        fontWeight: 500,
        fontSize: sizePx,
        letterSpacing: 5,
        color: "#C9D0E0",
        background: "rgba(5,7,12,0.55)",
        padding: "6px 16px",
        borderRadius: 4,
        textTransform: "uppercase",
      }}
    >
      {text}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Source credit, bottom-right, small and grey, like the paper credits in earlier episodes.
// ---------------------------------------------------------------------------
export const Credit: React.FC<{ text: string }> = ({ text }) => {
  const { frame, durationInFrames } = useEnterExit();
  const f = Math.max(1, Math.min(14, Math.floor(durationInFrames / 2) - 1));
  const o = interpolate(frame, [0, f, durationInFrames - f, durationInFrames], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        position: "absolute",
        right: 64,
        bottom: 42,
        opacity: o * 0.9,
        fontFamily: "Inter, sans-serif",
        fontWeight: 400,
        fontSize: 21,
        letterSpacing: 1,
        color: "#A9B1C4",
        background: "rgba(5,7,12,0.5)",
        padding: "4px 12px",
        borderRadius: 4,
        textShadow: SOFT_SHADOW,
      }}
    >
      {text}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Evidence tracker: outlined counter circle, a hairline draws out, caps label types in.
// ---------------------------------------------------------------------------
export const EvidenceTracker: React.FC<{ count: number; label: string }> = ({ count, label }) => {
  const { frame, fps, durationInFrames } = useEnterExit();
  const pop = spring({ frame, fps, config: { damping: 14, stiffness: 150, mass: 0.7 } });
  const unfold = spring({ frame: frame - 8, fps, config: { damping: 22, stiffness: 100 } });
  const roll = spring({ frame: frame - 10, fps, config: { damping: 18, stiffness: 140 } });
  const fold = interpolate(frame, [durationInFrames - 18, durationInFrames - 4], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const gone = interpolate(frame, [durationInFrames - 8, durationInFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const reveal = Math.max(0, Math.min(1, unfold)) * (1 - fold);
  const chars = Array.from(label.toUpperCase());
  const typed = Math.floor(
    interpolate(frame, [12, 12 + chars.length * 1.1], [0, chars.length], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
  );
  return (
    <div
      style={{
        position: "absolute",
        top: SAFE_Y,
        left: SAFE_X,
        display: "flex",
        alignItems: "center",
        gap: 18,
        transform: `scale(${Math.max(0, pop) * (1 - gone)})`,
        transformOrigin: "left center",
      }}
    >
      <div
        style={{
          width: 84,
          height: 84,
          borderRadius: 42,
          border: `2px solid ${TEAL}`,
          background: "rgba(5,7,12,0.7)",
          overflow: "hidden",
          position: "relative",
          flexShrink: 0,
        }}
      >
        {[count - 1, count].map((n, k) => (
          <div
            key={k}
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "Inter, sans-serif",
              fontWeight: 500,
              fontSize: 40,
              color: WHITE,
              transform: `translateY(${k === 0 ? -roll * 84 : (1 - roll) * 84}px)`,
            }}
          >
            {n}
          </div>
        ))}
      </div>
      <div style={{ width: 46 * reveal, height: 2, background: `linear-gradient(90deg, ${TEAL}, rgba(98,194,207,0.2))` }} />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 0,
          minWidth: 640,
          clipPath: `inset(0 ${(1 - reveal) * 100}% 0 0)`,
          background: "linear-gradient(90deg, rgba(5,7,12,0.78), rgba(5,7,12,0))",
          padding: "6px 40px 6px 4px",
        }}
      >
        <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: 36, letterSpacing: 7, color: AMBER }}>
          EVIDENCE
        </div>
        <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: 36, letterSpacing: 3, color: WHITE, whiteSpace: "nowrap" }}>
          {chars.slice(0, typed).join("")}
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
    warm: r() > 0.88,
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
              r={0.6 + p.d * 2.0}
              fill={p.warm ? "#E8C58F" : "#E8EEFF"}
              opacity={Math.max(0.08, tw) * (0.3 + p.d * 0.6)}
            />
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};
