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
import { ProceduralScene, ProceduralVariant } from "./components/ProceduralScene";
import { Schematic, SchematicOverlay, SchematicSpec } from "./components/Schematic";
import {
  CornerLabel,
  Credit,
  EvidenceTracker,
  KineticHeadline,
  KineticNumber,
  LowerThird,
  NAVY,
  StarDust,
} from "./components/Kinetic";

/**
 * Rebel Minds: Cosmos episode renderer.
 * Props are produced from a board package (production.json) by tools/kurul_render_props.py.
 *
 *  - scenes sit in a TransitionSeries (fade / wipe / whip / zoom-through); each scene is
 *    extended by the next transition's length so the cut points stay locked to the narration
 *  - every photo moves: Ken Burns + a counter-moving blurred depth layer; a star/dust layer
 *    drifts over everything (denser on cutaways)
 *  - look follows the channel's earlier episodes: near-black ground, Inter Light numerals, hairline rules,
 *    letter-spaced captions, teal accent, small grey source credit bottom-right
 *  - overlays animate in and out (kinetic numbers, word-by-word headlines, lower thirds);
 *    the evidence tracker unfolds, counts up and folds away
 */

export interface EpisodeOverlay {
  text: string;
  position: "top" | "center" | "bottom" | "lower-third" | "top-right" | string;
  style: "headline" | "number" | "label" | string;
  in_s: number;
  out_s: number;
  size_px?: number;
  /** For style "number": the big token (e.g. "$20B"); `caption` is the small line. */
  hero?: string;
  caption?: string;
}

export interface EpisodeTracker {
  count: number;
  label: string;
}

export interface EpisodeScene {
  id: number;
  start_s: number;
  duration_s: number;
  /** Path under the public dir (images/..), or null for video/procedural scenes. */
  src: string | null;
  /** Selected video clip (video/scene_XXX.mp4, already cut and muted). Loops invisibly if shorter than the scene. */
  video?: { src: string; clip_s: number } | null;
  procedural?: ProceduralVariant | null;
  /** Schematic line graphic: full-screen (phases, slips, thermal) or an inset over the photo (thermal_inset). */
  graphic?: SchematicSpec | null;
  purpose?: string;
  /** "contain": show the photo whole, centred on the dark ground (e.g. a planet disc). Default "cover". */
  fit?: "cover" | "contain";
  /** 0..1: extra dark layer over the visual (e.g. behind an end card). */
  dim?: number;
  /** Short image credit shown bottom-right (e.g. "Image: NASA/JSC"). */
  credit?: string;
  motion: string;
  transition: string;
  overlays: EpisodeOverlay[];
  evidence_tracker: EpisodeTracker | null;
}

export type EpisodeProps = {
  fps: number;
  totalSeconds: number;
  scenes: EpisodeScene[];
  /** Path under the public dir (audio/...). Narration, or the narration + music mix. Omit for a silent render. */
  narration?: string;
  /** Seconds into the full episode where this cut starts (only set for partial renders / Shorts). */
  sourceStartS?: number;
};

/** Slow camera move derived from the director's motion text. Deterministic. */
const cameraFor = (motion: string, t: number, id: number) => {
  const m = motion.toLowerCase();
  const dir = id % 2 === 0 ? 1 : -1;
  let scale = 1.04 + 0.12 * t; // never static: default is a push-in
  let x = dir * (t - 0.5) * 26;
  let y = (t - 0.5) * -14;
  let rot = 0;
  if (/pull-out|pull-down|crane up|reveal/.test(m)) scale = 1.16 - 0.12 * t;
  if (/pan|dolly|lateral|tracking|parallax|drift|scanning/.test(m)) {
    scale = 1.14;
    x = dir * (t - 0.5) * 110;
  }
  if (/tilt up|crane up/.test(m)) {
    scale = 1.14;
    y = -(t - 0.5) * 90;
  }
  if (/descent|tilt down/.test(m)) {
    scale = 1.14;
    y = (t - 0.5) * 90;
  }
  if (/rotation|orbit/.test(m)) {
    scale = 1.1 + 0.07 * t;
    rot = dir * (t - 0.5) * 2.6;
  }
  return { scale, x, y, rot };
};

const SceneVisual: React.FC<{ scene: EpisodeScene; durationInFrames: number }> = ({ scene, durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps: vfps } = useVideoConfig();
  const t = interpolate(frame, [0, Math.max(1, durationInFrames - 1)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const cam = cameraFor(scene.motion, t, scene.id);
  const cosmic = scene.purpose === "cutaway" || !!scene.procedural || !!scene.graphic || !!scene.video;
  return (
    <AbsoluteFill style={{ backgroundColor: NAVY }}>
      {scene.graphic && scene.graphic.kind !== "thermal_inset" ? (
        <Schematic spec={scene.graphic} />
      ) : scene.video ? (
        <AbsoluteFill style={{ transform: `scale(${1.0 + 0.05 * t})` }}>
          <Loop durationInFrames={Math.max(1, Math.floor(scene.video.clip_s * vfps) - 1)}>
            <OffthreadVideo src={staticFile(scene.video.src)} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </Loop>
        </AbsoluteFill>
      ) : scene.procedural ? (
        <ProceduralScene variant={scene.procedural} seed={scene.id} />
      ) : scene.src && scene.fit === "contain" ? (
        <AbsoluteFill>
          <div
            style={{
              position: "absolute",
              left: 960 - 370,
              top: 640 - 370,
              width: 740,
              height: 740,
              transform: `translate(${(t - 0.5) * -24}px, ${(t - 0.5) * -10}px) scale(${1.0 + 0.07 * t}) rotate(${(t - 0.5) * 1.2}deg)`,
              WebkitMaskImage: "radial-gradient(circle closest-side, #000 90%, rgba(0,0,0,0) 100%)",
              maskImage: "radial-gradient(circle closest-side, #000 90%, rgba(0,0,0,0) 100%)",
            }}
          >
            <Img src={staticFile(scene.src)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
        </AbsoluteFill>
      ) : scene.src ? (
        <>
          {/* depth layer: blurred copy drifting against the camera */}
          <AbsoluteFill
            style={{
              transform: `translate(${-cam.x * 1.6}px, ${-cam.y * 1.6}px) scale(${1.32 - 0.1 * t})`,
              filter: "blur(26px) brightness(0.75) saturate(1.1)",
            }}
          >
            <Img src={staticFile(scene.src)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </AbsoluteFill>
          {/* main photo: Ken Burns, feathered at the corners so the depth layer shows through */}
          <AbsoluteFill
            style={{
              transform: `translate(${cam.x}px, ${cam.y}px) scale(${cam.scale}) rotate(${cam.rot}deg)`,
              WebkitMaskImage: "radial-gradient(ellipse 92% 96% at 50% 50%, #000 78%, rgba(0,0,0,0) 100%)",
              maskImage: "radial-gradient(ellipse 92% 96% at 50% 50%, #000 78%, rgba(0,0,0,0) 100%)",
            }}
          >
            <Img src={staticFile(scene.src)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </AbsoluteFill>
        </>
      ) : null}
      {scene.dim ? <AbsoluteFill style={{ backgroundColor: `rgba(5,7,12,${scene.dim})` }} /> : null}
      {scene.graphic && scene.graphic.kind === "thermal_inset" ? <SchematicOverlay spec={scene.graphic} /> : null}
      <StarDust seed={scene.id} count={cosmic ? 120 : 50} opacity={cosmic ? 0.9 : 0.5} />
    </AbsoluteFill>
  );
};

/** One overlay, animated by its own Sequence (frame 0 = when it appears). */
const OverlayItem: React.FC<{ o: EpisodeOverlay }> = ({ o }) => {
  if (o.size_px !== undefined && o.size_px < 64) {
    return <CornerLabel text={o.text} sizePx={o.size_px} />;
  }
  if (o.style === "number") {
    return <KineticNumber hero={o.hero ?? o.text} caption={o.hero ? o.caption : undefined} />;
  }
  if (o.style === "label" && (o.position === "lower-third" || o.position === "bottom")) {
    return <LowerThird text={o.text} />;
  }
  return <KineticHeadline text={o.text} position={o.position} size={Math.max(64, o.size_px ?? 76)} />;
};

/** The scene series with transitions (no overlays, no audio). Reused by the vertical Short composition. */
export const EpisodeVisuals: React.FC<{ fps: number; scenes: EpisodeScene[] }> = ({ fps, scenes }) => {
  // Each scene is stretched by the length of the transition INTO the next scene, so every
  // cut point still lands on start_s of the next scene (the overlap is subtracted by the series).
  const items: React.ReactNode[] = [];
  scenes.forEach((s, i) => {
    const own = Math.max(1, Math.round(s.duration_s * fps));
    const next = scenes[i + 1];
    const tf = next ? transitionFrames(next.transition, fps) : 0;
    const pres = next ? presentationFor(next.transition, next.id) : null;
    const len = own + (pres ? tf : 0);
    items.push(
      <TransitionSeries.Sequence key={`s${s.id}`} durationInFrames={len}>
        <SceneVisual scene={s} durationInFrames={len} />
      </TransitionSeries.Sequence>
    );
    if (pres && next) {
      items.push(
        <TransitionSeries.Transition
          key={`t${s.id}`}
          presentation={pres}
          timing={linearTiming({ durationInFrames: tf })}
        />
      );
    }
  });

  return <TransitionSeries>{items}</TransitionSeries>;
};

export const RebelEpisode: React.FC<EpisodeProps> = ({ fps, scenes, narration }) => {
  loadInterFamily();

  return (
    <AbsoluteFill style={{ backgroundColor: NAVY }}>
      <EpisodeVisuals fps={fps} scenes={scenes} />

      {/* overlays and tracker sit above the series so transitions never smear the text */}
      {scenes.map((s) => {
        const from = Math.round(s.start_s * fps);
        const own = Math.max(1, Math.round(s.duration_s * fps));
        return (
          <React.Fragment key={`o${s.id}`}>
            {s.overlays.map((o, k) => {
              const a = from + Math.round(o.in_s * fps);
              const b = from + Math.min(own, Math.round(o.out_s * fps));
              if (b - a < 6) return null;
              return (
                <Sequence key={k} from={a} durationInFrames={b - a} layout="none">
                  <OverlayItem o={o} />
                </Sequence>
              );
            })}
            {s.credit ? (
              <Sequence from={from + Math.round(0.4 * fps)} durationInFrames={Math.max(12, own - Math.round(0.6 * fps))} layout="none">
                <Credit text={s.credit} />
              </Sequence>
            ) : null}
            {s.evidence_tracker ? (
              <Sequence
                from={from + 6}
                durationInFrames={Math.max(30, Math.min(own - 6, Math.round(6.5 * fps)))}
                layout="none"
              >
                <EvidenceTracker count={s.evidence_tracker.count} label={s.evidence_tracker.label} />
              </Sequence>
            ) : null}
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
