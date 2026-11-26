import React from "react";
import {
  AbsoluteFill,
  Audio,
  CalculateMetadataFunction,
  Img,
  Loop,
  OffthreadVideo,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { loadInterFamily } from "./lib/localFonts";
import { presentationFor, transitionFrames } from "./lib/episodeTransitions";
import { ProceduralScene } from "./components/ProceduralScene";
import type { SchematicSpec } from "./components/Schematic";
import { DiagramVertical, DiagramSpec } from "./components/Diagram";
import { SchematicVertical, SchematicVerticalOverlay } from "./components/SchematicVertical";
import { AMBER, GREY, ICE, NAVY, TEAL } from "./components/Kinetic";
import { EpisodeOverlay, EpisodeProps, EpisodeScene } from "./RebelEpisode";

/**
 * Rebel Minds: Cosmos — vertical Short, composed natively at 1080x1920 (built by tools/kurul_shorts.py).
 *
 *  - every photo and clip FILLS the frame (cover); there is no 16:9 box and no blurred band
 *  - the slow Ken Burns move is a horizontal pan that travels across the scene's focus point (`focus_x`, 0-1,
 *    chosen by the image selector) plus a gentle push-in
 *  - schematic graphics, numbers, headlines and the evidence tracker are laid out for the vertical frame
 *  - captions: centred on y 1250, nothing below y 1320 and nothing right of x 900, at most 2 lines
 *  - first 2 s: a big hook on a dark panel at the top of the picture; last 2 s: "Full episode on the channel"
 */

export interface ShortCaption {
  from_s: number;
  to_s: number;
  /** Already broken into at most 2 lines with "\n". */
  text: string;
}

export type ShortProps = EpisodeProps & {
  hook: { text: string; sub?: string };
  captions: ShortCaption[];
  endCard?: string;
  hookSeconds?: number;
  endSeconds?: number;
};

const W = 1080;
const H = 1920;
const CAPTION_CENTER_Y = 1250;
const CAPTION_LEFT = 180; // text box x 180..900: 180 px stay free on the right
const CAPTION_W = W - 2 * 180;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const CL = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Cover box for a w x h picture in the 1080x1920 frame, panning horizontally across the focus point. */
const coverBox = (w: number, h: number, focus: number, t: number, id: number) => {
  const s = Math.max(W / w, H / h) * (1 + 0.06 * t);
  const Wp = w * s;
  const Hp = h * s;
  const top = (H - Hp) / 2;
  if (Wp <= W + 1) return { left: (W - Wp) / 2, top, width: Wp, height: Hp };
  const travel = 0.1 * Wp;
  const lo = W / 2;
  const hi = Wp - W / 2;
  const fx = clamp(focus, 0, 1) * Wp;
  let c0 = clamp(fx - travel / 2, lo, hi);
  let c1 = clamp(fx + travel / 2, lo, hi);
  if (Math.abs(c1 - c0) < travel * 0.5) {
    // focus near an edge: still move, toward the inside
    if (fx < Wp / 2) {
      c0 = lo;
      c1 = Math.min(hi, lo + travel);
    } else {
      c1 = hi;
      c0 = Math.max(lo, hi - travel);
    }
  }
  if (id % 2 === 0) [c0, c1] = [c1, c0];
  const c = c0 + (c1 - c0) * t;
  return { left: W / 2 - c, top, width: Wp, height: Hp };
};

/** Drifting star / dust layer sized for the vertical frame. */
const rng = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const VStarDust: React.FC<{ seed: number; count: number; opacity: number }> = ({ seed, count, opacity }) => {
  const frame = useCurrentFrame();
  const r = rng(seed * 101 + 7);
  const parts = Array.from({ length: count }, () => ({ x: r() * W, y: r() * H, d: 0.15 + r() * 0.85, ph: r() * 6.28, warm: r() > 0.88 }));
  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        {parts.map((p, i) => {
          const x = ((((p.x + frame * p.d * 0.9) % (W + 40)) + (W + 40)) % (W + 40)) - 20;
          const y = p.y + Math.sin(frame / 70 + p.ph) * 10 * p.d;
          const tw = 0.45 + 0.5 * Math.sin(frame / (14 + p.d * 14) + p.ph);
          return <circle key={i} cx={x} cy={y} r={0.6 + p.d * 2.0} fill={p.warm ? "#E8C58F" : "#E8EEFF"} opacity={Math.max(0.08, tw) * (0.3 + p.d * 0.6)} />;
        })}
      </svg>
    </AbsoluteFill>
  );
};

/** Darkened (~25 % brightness), slowly moving photo or clip filling the frame behind schematic / code-drawn scenes. */
const Backdrop: React.FC<{ b: NonNullable<EpisodeScene["backdrop"]>; t: number; id: number }> = ({ b, t, id }) => {
  const { fps } = useVideoConfig();
  const box = coverBox(b.w ?? 1920, b.h ?? 1080, b.focus_x ?? 0.5, t, id + 7);
  return (
    <AbsoluteFill style={{ filter: "brightness(0.25)" }}>
      <div style={{ position: "absolute", ...box }}>
        {b.video ? (
          <Loop durationInFrames={Math.max(1, Math.floor(b.video.clip_s * fps) - 1)}>
            <OffthreadVideo src={staticFile(b.video.src)} muted style={{ width: "100%", height: "100%", objectFit: "fill" }} />
          </Loop>
        ) : b.src ? (
          <Img src={staticFile(b.src)} style={{ width: "100%", height: "100%" }} />
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

const ShortVisual: React.FC<{ scene: EpisodeScene; durationInFrames: number }> = ({ scene, durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = interpolate(frame, [0, Math.max(1, durationInFrames - 1)], [0, 1], CL);
  const cosmic = scene.purpose === "cutaway" || !!scene.procedural || !!scene.graphic || !!scene.video;
  const focus = scene.focus_x ?? 0.5;
  const w = scene.w ?? 1920;
  const h = scene.h ?? 1080;
  const full = scene.graphic && scene.graphic.kind !== "thermal_inset" && scene.graphic.kind !== "diagram";
  const inset = scene.graphic?.kind === "thermal_inset";
  const backdrop = scene.backdrop ? <Backdrop b={scene.backdrop} t={t} id={scene.id} /> : null;
  let body: React.ReactNode = null;
  if (full) {
    body = (
      <>
        {backdrop}
        <SchematicVertical spec={scene.graphic as SchematicSpec} />
      </>
    );
  } else if (scene.graphic?.kind === "diagram") {
    body = (
      <>
        {backdrop}
        <DiagramVertical spec={scene.graphic as DiagramSpec} />
      </>
    );
  } else if (scene.procedural) {
    // code-drawn 16:9 scene, scaled to fill the height; the abstract line art loses nothing at the sides
    const S = H / 1080;
    body = (
      <>
        {backdrop}
        <div style={{ position: "absolute", left: (W - 1920 * S) / 2, top: 0, width: 1920, height: 1080, transformOrigin: "0 0", transform: `scale(${S})`, mixBlendMode: backdrop ? "screen" : "normal" }}>
          <ProceduralScene variant={scene.procedural} seed={scene.id} />
        </div>
      </>
    );
  } else if (scene.video) {
    const b = coverBox(w, h, focus, t, scene.id);
    body = (
      <div style={{ position: "absolute", ...b }}>
        <Loop durationInFrames={Math.max(1, Math.floor(scene.video.clip_s * fps) - 1)}>
          <OffthreadVideo src={staticFile(scene.video.src)} muted style={{ width: "100%", height: "100%", objectFit: "fill" }} />
        </Loop>
      </div>
    );
  } else if (scene.src && scene.fit === "contain" && !inset) {
    body = (
      <div
        style={{
          position: "absolute",
          left: W / 2 - 450,
          top: 880 - 450,
          width: 900,
          height: 900,
          transform: `translate(${(t - 0.5) * -24}px, ${(t - 0.5) * -10}px) scale(${1.0 + 0.07 * t}) rotate(${(t - 0.5) * 1.2}deg)`,
          WebkitMaskImage: "radial-gradient(circle closest-side, #000 90%, rgba(0,0,0,0) 100%)",
          maskImage: "radial-gradient(circle closest-side, #000 90%, rgba(0,0,0,0) 100%)",
        }}
      >
        <Img src={staticFile(scene.src)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </div>
    );
  } else if (scene.src) {
    const b = coverBox(w, h, focus, t, scene.id);
    // under the temperature scale the photo fills the screen, darkened, with no mask
    body = <Img src={staticFile(scene.src)} style={{ position: "absolute", ...b, ...(inset ? { filter: "brightness(0.3)" } : {}) }} />;
  }
  return (
    <AbsoluteFill style={{ backgroundColor: NAVY, overflow: "hidden" }}>
      {body}
      {scene.dim ? <AbsoluteFill style={{ backgroundColor: `rgba(5,7,12,${scene.dim})` }} /> : null}
      {scene.graphic && scene.graphic.kind === "thermal_inset" ? <SchematicVerticalOverlay spec={scene.graphic as SchematicSpec} /> : null}
      <VStarDust seed={scene.id} count={cosmic ? 90 : 40} opacity={cosmic ? 0.9 : 0.5} />
    </AbsoluteFill>
  );
};

const ShortVisuals: React.FC<{ fps: number; scenes: EpisodeScene[] }> = ({ fps, scenes }) => {
  const items: React.ReactNode[] = [];
  scenes.forEach((s, i) => {
    const own = Math.max(1, Math.round(s.duration_s * fps));
    const next = scenes[i + 1];
    const tf = next ? transitionFrames(next.transition, fps) : 0;
    const pres = next ? presentationFor(next.transition, next.id) : null;
    const len = own + (pres ? tf : 0);
    items.push(
      <TransitionSeries.Sequence key={`s${s.id}`} durationInFrames={len}>
        <ShortVisual scene={s} durationInFrames={len} />
      </TransitionSeries.Sequence>
    );
    if (pres && next) {
      items.push(<TransitionSeries.Transition key={`t${s.id}`} presentation={pres} timing={linearTiming({ durationInFrames: tf })} />);
    }
  });
  return <TransitionSeries>{items}</TransitionSeries>;
};

// ------------------------------------------------------------------ overlays (vertical layout)
const useFade = (dur: number) => {
  const frame = useCurrentFrame();
  const i = interpolate(frame, [0, 10], [0, 1], CL);
  const o = interpolate(frame, [dur - 10, dur], [1, 0], CL);
  return { frame, i, a: i * o };
};

const SCRIM = "rgba(5,7,12,0.62)";
const SAFE_L = 60;
const SAFE_W = 840; // x 60..900

const VNumber: React.FC<{ hero: string; caption?: string; dur: number }> = ({ hero, caption, dur }) => {
  const { i, a } = useFade(dur);
  const size = Math.min(299, Math.floor(SAFE_W / (hero.length * 0.56))); // 1.3x the 16:9 size, width-limited
  return (
    <div style={{ position: "absolute", left: SAFE_L, width: SAFE_W, top: 430, textAlign: "center", opacity: a, transform: `translateY(${(1 - i) * 30}px)`, fontFamily: "Inter, sans-serif" }}>
      <div style={{ display: "inline-block", padding: "18px 34px 26px", borderRadius: 12, background: SCRIM }}>
        <div style={{ fontWeight: 300, fontSize: size, lineHeight: 1.05, color: ICE, letterSpacing: -3, whiteSpace: "nowrap" }}>{hero}</div>
        <div style={{ height: 2, width: 220, background: TEAL, margin: "14px auto 16px" }} />
        {caption ? <div style={{ fontWeight: 400, fontSize: 44, color: ICE, lineHeight: 1.2 }}>{caption}</div> : null}
      </div>
    </div>
  );
};

const VHeadline: React.FC<{ text: string; position: string; size: number; dur: number }> = ({ text, position, size, dur }) => {
  const { i, a } = useFade(dur);
  const top = position === "top" ? 330 : position === "center" ? 700 : 940;
  return (
    <div style={{ position: "absolute", left: SAFE_L, width: SAFE_W, top, opacity: a, transform: `translateY(${(1 - i) * 30}px)` }}>
      <div style={{ display: "inline-flex", gap: 22, alignItems: "stretch", padding: "14px 28px 14px 18px", borderRadius: 10, background: SCRIM }}>
        <div style={{ width: 6, background: TEAL, borderRadius: 3 }} />
        <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: size, lineHeight: 1.1, color: ICE, textTransform: "none" }}>{text}</div>
      </div>
    </div>
  );
};

const VLabel: React.FC<{ text: string; dur: number; y?: number }> = ({ text, dur, y = 1010 }) => {
  const { a } = useFade(dur);
  return (
    <div style={{ position: "absolute", left: SAFE_L, width: SAFE_W, top: y, opacity: a }}>
      <div style={{ display: "inline-flex", gap: 20, alignItems: "stretch", padding: "10px 24px 10px 16px", borderRadius: 8, background: SCRIM }}>
        <div style={{ width: 5, background: TEAL, borderRadius: 3 }} />
        <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: 44, letterSpacing: 5, textTransform: "uppercase", color: ICE }}>{text}</div>
      </div>
    </div>
  );
};

const VOverlay: React.FC<{ o: EpisodeOverlay; dur: number }> = ({ o, dur }) => {
  if (o.size_px !== undefined && o.size_px < 64) return <VLabel text={o.text} dur={dur} y={800} />;
  if (o.style === "number") return <VNumber hero={o.hero ?? o.text} caption={o.hero ? o.caption : undefined} dur={dur} />;
  if (o.style === "label" && (o.position === "lower-third" || o.position === "bottom")) return <VLabel text={o.text} dur={dur} />;
  return <VHeadline text={o.text} position={o.position} size={Math.min(76, Math.max(64, o.size_px ?? 72))} dur={dur} />;
};

const VTracker: React.FC<{ count: number; label: string; dur: number }> = ({ count, label, dur }) => {
  const { frame, i, a } = useFade(dur);
  const n = Math.round(interpolate(frame, [4, 24], [Math.max(0, count - 1), count], CL));
  const line = interpolate(frame, [8, 30], [0, 1], CL);
  const chars = Math.round(interpolate(frame, [14, 34], [0, label.length], CL));
  return (
    <div style={{ position: "absolute", left: SAFE_L, top: 800, opacity: a, transform: `translateX(${(1 - i) * -30}px)`, fontFamily: "Inter, sans-serif", display: "flex", alignItems: "center", gap: 22, padding: "12px 28px 12px 14px", borderRadius: 14, background: SCRIM }}>
      <div style={{ width: 92, height: 92, borderRadius: 46, border: `3px solid ${TEAL}`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 300, fontSize: 54, color: ICE }}>{n}</div>
      <div>
        <div style={{ fontWeight: 500, fontSize: 36, letterSpacing: 8, color: TEAL }}>EVIDENCE</div>
        <div style={{ height: 2, width: 280 * line, background: TEAL, margin: "6px 0 8px", opacity: 0.7 }} />
        <div style={{ fontWeight: 500, fontSize: 36, color: ICE, whiteSpace: "nowrap" }}>{label.slice(0, chars)}</div>
      </div>
    </div>
  );
};

// ------------------------------------------------------------------ hook, captions, end card, credit
const Hook: React.FC<{ text: string; sub?: string; durationInFrames: number }> = ({ text, sub, durationInFrames }) => {
  const frame = useCurrentFrame();
  const inP = interpolate(frame, [0, 9], [0, 1], CL);
  const outP = interpolate(frame, [durationInFrames - 8, durationInFrames], [1, 0], CL);
  const compact = text.length <= 8; // a number or one very short word
  const size = text.length <= 5 ? 300 : text.length <= 8 ? 190 : text.length <= 16 ? 120 : 96;
  return (
    <AbsoluteFill style={{ opacity: outP }}>
      {/* readable dark ground over the top of the picture */}
      <div style={{ position: "absolute", left: 0, top: 0, width: W, height: 780, opacity: inP, background: "linear-gradient(180deg, rgba(5,7,12,0.96) 0%, rgba(5,7,12,0.93) 70%, rgba(5,7,12,0) 100%)" }} />
      <div
        style={{
          position: "absolute",
          top: compact ? 250 : 230,
          left: SAFE_L,
          width: SAFE_W,
          textAlign: "center",
          opacity: inP,
          transform: `translateY(${(1 - inP) * 40}px)`,
          filter: `blur(${(1 - inP) * 10}px)`,
        }}
      >
        <div style={{ fontFamily: "Inter, sans-serif", fontWeight: compact ? 300 : 500, fontSize: size, lineHeight: 1.05, color: ICE, letterSpacing: compact ? -4 : 0, whiteSpace: compact ? "nowrap" : "pre-line" }}>{text}</div>
        <div style={{ height: 3, width: 220, background: AMBER, margin: "28px auto 0" }} />
        {sub ? (
          <div style={{ marginTop: 24, fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: 44, letterSpacing: 4, textTransform: "uppercase", color: TEAL }}>{sub}</div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

const Caption: React.FC<{ text: string; durationInFrames: number }> = ({ text, durationInFrames }) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [0, 4, durationInFrames - 4, durationInFrames], [0, 1, 1, 0], CL);
  return (
    <div style={{ position: "absolute", left: CAPTION_LEFT, width: CAPTION_W, top: CAPTION_CENTER_Y - 90, height: 180, display: "flex", alignItems: "center", justifyContent: "center", opacity: o }}>
      <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: 48, lineHeight: 1.2, textAlign: "center", color: ICE, whiteSpace: "pre-line", padding: "10px 18px", borderRadius: 10, background: "rgba(5,7,12,0.55)", textShadow: "0 2px 12px rgba(5,7,12,0.9)" }}>{text}</div>
    </div>
  );
};

const EndCard: React.FC<{ text: string; durationInFrames: number }> = ({ text, durationInFrames }) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [0, 10, durationInFrames - 3, durationInFrames], [0, 1, 1, 1], CL);
  return (
    <AbsoluteFill style={{ opacity: o }}>
      <AbsoluteFill style={{ backgroundColor: "rgba(5,7,12,0.62)" }} />
      <div style={{ position: "absolute", top: 820, left: SAFE_L, width: SAFE_W, textAlign: "center", fontFamily: "Inter, sans-serif" }}>
        <div style={{ fontWeight: 500, fontSize: 84, lineHeight: 1.12, color: ICE }}>{text}</div>
        <div style={{ height: 3, width: 220, background: TEAL, margin: "34px auto 26px" }} />
        <div style={{ fontWeight: 500, fontSize: 40, letterSpacing: 6, textTransform: "uppercase", color: GREY }}>Rebel Minds: Cosmos</div>
      </div>
    </AbsoluteFill>
  );
};

/** Source credit: small grey line just above the caption zone (nothing sits below y 1320). */
const CreditLine: React.FC<{ text: string }> = ({ text }) => (
  <div style={{ position: "absolute", left: SAFE_L, top: 1158, fontFamily: "Inter, sans-serif", fontWeight: 400, fontSize: 24, color: GREY, textShadow: "0 1px 8px rgba(5,7,12,0.95)" }}>{text}</div>
);

export const RebelShort: React.FC<ShortProps> = ({ fps, scenes, narration, hook, captions, endCard = "Full episode on the channel", hookSeconds = 2, endSeconds = 2 }) => {
  loadInterFamily();
  const { durationInFrames } = useVideoConfig();
  const hookF = Math.round(hookSeconds * fps);
  const endF = Math.round(endSeconds * fps);
  return (
    <AbsoluteFill style={{ backgroundColor: NAVY, overflow: "hidden" }}>
      <ShortVisuals fps={fps} scenes={scenes} />

      {scenes.map((s) => {
        const from = Math.round(s.start_s * fps);
        const own = Math.max(1, Math.round(s.duration_s * fps));
        return (
          <React.Fragment key={`o${s.id}`}>
            {s.overlays.map((o, k) => {
              // keep the first 2 seconds clear for the hook
              const a = Math.max(from + Math.round(o.in_s * fps), from < hookF ? hookF : 0);
              const b = from + Math.min(own, Math.round(o.out_s * fps));
              if (b - a < 12) return null;
              return (
                <Sequence key={k} from={a} durationInFrames={b - a} layout="none">
                  <VOverlay o={o} dur={b - a} />
                </Sequence>
              );
            })}
            {s.evidence_tracker ? (() => {
              const a = Math.max(from + 6, from < hookF ? hookF : 0);
              const d = Math.max(30, Math.min(from + own - a, Math.round(6.5 * fps)));
              return (
                <Sequence from={a} durationInFrames={d} layout="none">
                  <VTracker count={s.evidence_tracker.count} label={s.evidence_tracker.label} dur={d} />
                </Sequence>
              );
            })() : null}
            {s.credit ? (
              <Sequence from={from + Math.round(0.4 * fps)} durationInFrames={Math.max(12, own - Math.round(0.6 * fps))} layout="none">
                <CreditLine text={s.credit} />
              </Sequence>
            ) : null}
          </React.Fragment>
        );
      })}

      {captions.map((c, i) => {
        const a = Math.round(c.from_s * fps);
        // no captions under the "Full episode" end card: cut every caption at the card's start
        const b = Math.min(Math.round(c.to_s * fps), durationInFrames - endF);
        if (b - a < 6) return null;
        return (
          <Sequence key={`k${i}`} from={a} durationInFrames={b - a} layout="none">
            <Caption text={c.text} durationInFrames={b - a} />
          </Sequence>
        );
      })}

      <Sequence from={0} durationInFrames={hookF} layout="none">
        <Hook text={hook.text} sub={hook.sub} durationInFrames={hookF} />
      </Sequence>
      <Sequence from={Math.max(0, durationInFrames - endF)} durationInFrames={endF} layout="none">
        <EndCard text={endCard} durationInFrames={endF} />
      </Sequence>

      {narration ? <Audio src={staticFile(narration)} /> : null}
    </AbsoluteFill>
  );
};

export const calculateShortMetadata: CalculateMetadataFunction<ShortProps> = async ({ props }) => ({
  durationInFrames: Math.max(1, Math.ceil(props.totalSeconds * props.fps)),
  fps: props.fps,
});
