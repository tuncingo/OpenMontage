import React from "react";
import {
  AbsoluteFill,
  Audio,
  CalculateMetadataFunction,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { loadInterSemiBold, loadMontserratExtraBold } from "./lib/localFonts";
import { ProceduralScene, ProceduralVariant } from "./components/ProceduralScene";

/**
 * Rebel Minds: Cosmos episode renderer.
 * Props are produced from a board package (production.json) by tools/kurul_render_props.py.
 *
 * Layout rules (kanal/stil_rehberi.md):
 *  - overlays: Montserrat ExtraBold, >= 64 px, inside 10% safe margins, soft scrim
 *  - evidence tracker: top-left, only on the scene that introduces the evidence
 *  - small "label" overlays (e.g. "Illustration") use `size_px` and sit top-right
 */

export interface EpisodeOverlay {
  text: string;
  position: "top" | "center" | "bottom" | "lower-third" | "top-right";
  style: "headline" | "number" | "label" | string;
  in_s: number;
  out_s: number;
  size_px?: number;
}

export interface EpisodeTracker {
  count: number;
  label: string;
}

export interface EpisodeScene {
  id: number;
  start_s: number;
  duration_s: number;
  /** Path under the public dir (images/..), or null for procedural scenes. */
  src: string | null;
  procedural?: ProceduralVariant | null;
  motion: string;
  transition: string;
  overlays: EpisodeOverlay[];
  evidence_tracker: EpisodeTracker | null;
}

export type EpisodeProps = {
  fps: number;
  totalSeconds: number;
  scenes: EpisodeScene[];
  /** Path under the public dir (audio/...). Omit for a silent render. */
  narration?: string;
};

const NAVY = "#0B1026";
const AMBER = "#FFB020";
const ICE = "#F2F5FF";
const VIOLET = "#6C3BFF";

// Safe margins: 10% of 1920x1080.
const SAFE_X = 192;
const SAFE_Y = 108;

const fadeFrames = (transition: string, fps: number): number => {
  switch (transition) {
    case "cut":
      return 0;
    case "whip":
      return Math.round(0.2 * fps);
    case "zoom-through":
      return Math.round(0.5 * fps);
    default:
      return Math.round(0.45 * fps);
  }
};

/** Slow camera move derived from the director's motion text. Deterministic. */
const cameraFor = (motion: string, t: number, id: number) => {
  const m = motion.toLowerCase();
  const dir = id % 2 === 0 ? 1 : -1;
  let scale = 1.0 + 0.1 * t;
  let x = 0;
  let y = 0;
  let rot = 0;
  if (/pull-out|pull-down|crane up|reveal/.test(m)) {
    scale = 1.12 - 0.1 * t;
  }
  if (/pan|dolly|lateral|tracking|parallax|drift|scanning/.test(m)) {
    scale = 1.1;
    x = dir * (t - 0.5) * 70;
  }
  if (/tilt up|crane up/.test(m)) {
    scale = 1.1;
    y = -(t - 0.5) * 60;
  }
  if (/descent|tilt down/.test(m)) {
    scale = 1.1;
    y = (t - 0.5) * 60;
  }
  if (/rotation|orbit/.test(m)) {
    scale = 1.08 + 0.06 * t;
    rot = dir * (t - 0.5) * 2.4;
  }
  return { scale, x, y, rot };
};

const SceneVisual: React.FC<{ scene: EpisodeScene; fadeIn: number; durationInFrames: number }> = ({
  scene,
  fadeIn,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const t = interpolate(frame, [0, Math.max(1, durationInFrames - 1)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const opacity = fadeIn > 0 ? interpolate(frame, [0, fadeIn], [0, 1], { extrapolateRight: "clamp" }) : 1;
  const zoomIn = scene.transition === "zoom-through" && fadeIn > 0
    ? interpolate(frame, [0, fadeIn], [1.06, 1], { extrapolateRight: "clamp" })
    : 1;
  const cam = cameraFor(scene.motion, t, scene.id);
  return (
    <AbsoluteFill style={{ opacity, backgroundColor: NAVY, transform: `scale(${zoomIn})` }}>
      {scene.procedural ? (
        <ProceduralScene variant={scene.procedural} seed={scene.id} />
      ) : scene.src ? (
        <AbsoluteFill
          style={{
            transform: `translate(${cam.x}px, ${cam.y}px) scale(${cam.scale}) rotate(${cam.rot}deg)`,
          }}
        >
          <Img src={staticFile(scene.src)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
};

const OverlayText: React.FC<{ o: EpisodeOverlay; sceneFrames: number }> = ({ o, sceneFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const inF = Math.round(o.in_s * fps);
  const outF = Math.min(sceneFrames, Math.round(o.out_s * fps));
  if (frame < inF || frame > outF) return null;
  const appear = spring({ frame: frame - inF, fps, config: { damping: 18, stiffness: 120, mass: 0.8 } });
  const fadeOut = interpolate(frame, [outF - 8, outF], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const opacity = Math.min(appear, fadeOut);

  const small = o.size_px !== undefined && o.size_px < 64;
  if (small) {
    // Small corner label (e.g. "Illustration"): top-right inside the safe margins.
    return (
      <div
        style={{
          position: "absolute",
          top: SAFE_Y,
          right: SAFE_X,
          opacity,
          fontFamily: "Inter, sans-serif",
          fontWeight: 600,
          fontSize: o.size_px,
          letterSpacing: 1,
          color: ICE,
          background: "rgba(11,16,38,0.6)",
          padding: "6px 14px",
          borderRadius: 6,
          textTransform: "uppercase",
        }}
      >
        {o.text}
      </div>
    );
  }

  const size = Math.max(64, o.size_px ?? (o.style === "number" ? 104 : 72));
  const color = o.style === "number" ? AMBER : ICE;
  const base: React.CSSProperties = {
    position: "absolute",
    left: SAFE_X,
    right: SAFE_X,
    display: "flex",
    justifyContent: "center",
    opacity,
    transform: `translateY(${(1 - appear) * 24}px)`,
  };
  const pos: React.CSSProperties =
    o.position === "center"
      ? { top: 0, bottom: 0, alignItems: "center" }
      : o.position === "top"
      ? { top: SAFE_Y }
      : o.position === "lower-third"
      ? { bottom: SAFE_Y + 120 }
      : { bottom: SAFE_Y };
  return (
    <div style={{ ...base, ...pos }}>
      <div
        style={{
          fontFamily: "Montserrat, sans-serif",
          fontWeight: 800,
          fontSize: size,
          lineHeight: 1.05,
          color,
          textAlign: "center",
          textTransform: "uppercase",
          padding: "10px 26px",
          borderRadius: 10,
          // soft dark scrim keeps text readable over bright photos
          background: "rgba(11,16,38,0.5)",
          textShadow: "0 3px 18px rgba(5,7,15,0.95), 0 0 6px rgba(5,7,15,0.9)",
        }}
      >
        {o.text}
      </div>
    </div>
  );
};

const Tracker: React.FC<{ tr: EpisodeTracker; sceneFrames: number }> = ({ tr, sceneFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const showFrames = Math.min(sceneFrames, Math.round(6 * fps));
  const appear = spring({ frame: frame - 6, fps, config: { damping: 16, stiffness: 140, mass: 0.7 } });
  const fadeOut = interpolate(frame, [showFrames - 10, showFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  if (frame < 6) return null;
  return (
    <div
      style={{
        position: "absolute",
        top: SAFE_Y,
        left: SAFE_X,
        display: "flex",
        alignItems: "center",
        gap: 16,
        opacity: Math.min(appear, fadeOut),
        transform: `translateX(${(1 - appear) * -40}px)`,
        background: "rgba(11,16,38,0.78)",
        border: `2px solid ${VIOLET}`,
        borderRadius: 14,
        padding: "10px 22px 10px 12px",
        maxWidth: 760,
      }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          background: AMBER,
          color: NAVY,
          fontFamily: "Montserrat, sans-serif",
          fontWeight: 800,
          fontSize: 38,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {tr.count}
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: 22, color: AMBER, letterSpacing: 2 }}>
          EVIDENCE
        </div>
        <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 32, color: ICE, lineHeight: 1.1 }}>
          {tr.label}
        </div>
      </div>
    </div>
  );
};

export const RebelEpisode: React.FC<EpisodeProps> = ({ fps, scenes, narration }) => {
  loadMontserratExtraBold();
  loadInterSemiBold();
  return (
    <AbsoluteFill style={{ backgroundColor: NAVY }}>
      {scenes.map((s, i) => {
        const next = scenes[i + 1];
        const fadeIn = fadeFrames(s.transition, fps);
        const from = Math.round(s.start_s * fps);
        const own = Math.max(1, Math.round(s.duration_s * fps));
        // Extend under the next scene so its crossfade has something to fade over.
        const tail = next ? fadeFrames(next.transition, fps) : 0;
        return (
          <React.Fragment key={s.id}>
            <Sequence from={from} durationInFrames={own + tail} layout="none">
              <SceneVisual scene={s} fadeIn={fadeIn} durationInFrames={own + tail} />
            </Sequence>
            <Sequence from={from} durationInFrames={own} layout="none">
              {s.overlays.map((o, k) => (
                <OverlayText key={k} o={o} sceneFrames={own} />
              ))}
              {s.evidence_tracker ? <Tracker tr={s.evidence_tracker} sceneFrames={own} /> : null}
            </Sequence>
          </React.Fragment>
        );
      })}
      {narration ? <Audio src={staticFile(narration)} /> : null}
    </AbsoluteFill>
  );
};

export const calculateEpisodeMetadata: CalculateMetadataFunction<EpisodeProps> = async ({ props }) => ({
  durationInFrames: Math.max(1, Math.ceil(props.totalSeconds * props.fps)),
  fps: props.fps,
});
