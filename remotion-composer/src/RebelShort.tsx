import React from "react";
import {
  AbsoluteFill,
  Audio,
  CalculateMetadataFunction,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { loadInterFamily } from "./lib/localFonts";
import { EpisodeProps, EpisodeScene, EpisodeVisuals } from "./RebelEpisode";
import { AMBER, GREY, ICE, NAVY, TEAL } from "./components/Kinetic";

/**
 * Rebel Minds: Cosmos — vertical Short (1080x1920), built by tools/kurul_shorts.py.
 *
 * Layout (rules also written in kanal/stil_rehberi.md, "Shorts"):
 *  - the 16:9 picture sits in the middle (1080x608, y 656..1264); above and below it is the SAME picture,
 *    blurred and scaled to fill the frame
 *  - captions: safe area only — centred on y 1250, nothing below y 1320 (600 px free at the bottom),
 *    nothing right of x 900 (180 px free on the right), at most 2 lines
 *  - first 2 s: a big visual hook (a number or a short claim); last 2 s: "Full episode on the channel"
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
const WIN_H = 608;
const WIN_TOP = (H - WIN_H) / 2; // 656
const CAPTION_CENTER_Y = 1250;
const CAPTION_LEFT = 180; // 180 px free on the right as well: text box x 180..900
const CAPTION_W = W - 2 * 180;
const SCALE_WIN = W / 1920;
const SCALE_BG = H / 1080;

const Hook: React.FC<{ text: string; sub?: string; durationInFrames: number }> = ({ text, sub, durationInFrames }) => {
  const frame = useCurrentFrame();
  const inP = interpolate(frame, [0, 9], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const outP = interpolate(frame, [durationInFrames - 8, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // The hook lives in the blurred area above the picture (y < 640). Short tokens (a number) are one big line;
  // longer claims wrap to at most 3 lines.
  const compact = text.length <= 8;
  const size = text.length <= 5 ? 300 : text.length <= 8 ? 190 : text.length <= 16 ? 120 : 96;
  return (
    <AbsoluteFill style={{ justifyContent: "flex-start", alignItems: "center" }}>
      <div
        style={{
          position: "absolute",
          top: compact ? 170 : 130,
          left: 60,
          width: W - 60 - 120, // keeps clear of the right-hand UI column
          textAlign: "center",
          opacity: inP * outP,
          transform: `translateY(${(1 - inP) * 40}px)`,
          filter: `blur(${(1 - inP) * 10}px)`,
        }}
      >
        <div
          style={{
            fontFamily: "Inter, sans-serif",
            fontWeight: compact ? 300 : 500,
            fontSize: size,
            lineHeight: 1.05,
            color: ICE,
            letterSpacing: compact ? -4 : 0,
            textShadow: "0 4px 40px rgba(5,7,12,0.85)",
            whiteSpace: compact ? "nowrap" : "pre-line",
          }}
        >
          {text}
        </div>
        <div style={{ height: 3, width: 220, background: AMBER, margin: "28px auto 0" }} />
        {sub ? (
          <div
            style={{
              marginTop: 24,
              fontFamily: "Inter, sans-serif",
              fontWeight: 500,
              fontSize: 44,
              letterSpacing: 4,
              textTransform: "uppercase",
              color: TEAL,
              textShadow: "0 2px 20px rgba(5,7,12,0.9)",
            }}
          >
            {sub}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

const Caption: React.FC<{ text: string; durationInFrames: number }> = ({ text, durationInFrames }) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [0, 4, durationInFrames - 4, durationInFrames], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        position: "absolute",
        left: CAPTION_LEFT,
        width: CAPTION_W,
        top: CAPTION_CENTER_Y - 90,
        height: 180,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: o,
      }}
    >
      <div
        style={{
          fontFamily: "Inter, sans-serif",
          fontWeight: 500,
          fontSize: 48,
          lineHeight: 1.2,
          textAlign: "center",
          color: ICE,
          whiteSpace: "pre-line",
          padding: "10px 18px",
          borderRadius: 10,
          background: "rgba(5,7,12,0.55)",
          textShadow: "0 2px 12px rgba(5,7,12,0.9)",
        }}
      >
        {text}
      </div>
    </div>
  );
};

const EndCard: React.FC<{ text: string; durationInFrames: number }> = ({ text, durationInFrames }) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [0, 10, durationInFrames - 3, durationInFrames], [0, 1, 1, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill style={{ opacity: o }}>
      <AbsoluteFill style={{ backgroundColor: "rgba(5,7,12,0.62)" }} />
      <div
        style={{
          position: "absolute",
          top: 820,
          left: 60,
          width: W - 60 - 120,
          textAlign: "center",
          fontFamily: "Inter, sans-serif",
        }}
      >
        <div style={{ fontWeight: 500, fontSize: 84, lineHeight: 1.12, color: ICE }}>{text}</div>
        <div style={{ height: 3, width: 220, background: TEAL, margin: "34px auto 26px" }} />
        <div style={{ fontWeight: 500, fontSize: 40, letterSpacing: 6, textTransform: "uppercase", color: GREY }}>
          Rebel Minds: Cosmos
        </div>
      </div>
    </AbsoluteFill>
  );
};

const CreditLine: React.FC<{ text: string }> = ({ text }) => (
  <div
    style={{
      position: "absolute",
      right: 60,
      top: WIN_TOP - 44,
      fontFamily: "Inter, sans-serif",
      fontWeight: 400,
      fontSize: 24,
      color: GREY,
    }}
  >
    {text}
  </div>
);

export const RebelShort: React.FC<ShortProps> = ({
  fps,
  scenes,
  narration,
  hook,
  captions,
  endCard = "Full episode on the channel",
  hookSeconds = 2,
  endSeconds = 2,
  totalSeconds,
}) => {
  loadInterFamily();
  const { durationInFrames } = useVideoConfig();
  const hookF = Math.round(hookSeconds * fps);
  const endF = Math.round(endSeconds * fps);
  const visuals = <EpisodeVisuals fps={fps} scenes={scenes as EpisodeScene[]} />;
  return (
    <AbsoluteFill style={{ backgroundColor: NAVY, overflow: "hidden" }}>
      {/* background: the same picture, blurred, filling the whole 9:16 frame */}
      <div
        style={{
          position: "absolute",
          left: (W - 1920 * SCALE_BG) / 2,
          top: 0,
          width: 1920,
          height: 1080,
          transformOrigin: "0 0",
          transform: `scale(${SCALE_BG})`,
          filter: "blur(22px) brightness(0.62) saturate(1.15)",
        }}
      >
        {visuals}
      </div>
      {/* the 16:9 picture, centred */}
      <div style={{ position: "absolute", left: 0, top: WIN_TOP, width: W, height: WIN_H, overflow: "hidden" }}>
        <div style={{ width: 1920, height: 1080, transformOrigin: "0 0", transform: `scale(${SCALE_WIN})` }}>{visuals}</div>
      </div>

      {scenes.map((s) =>
        s.credit ? (
          <Sequence
            key={`c${s.id}`}
            from={Math.round(s.start_s * fps) + Math.round(0.4 * fps)}
            durationInFrames={Math.max(12, Math.round(s.duration_s * fps) - Math.round(0.6 * fps))}
            layout="none"
          >
            <CreditLine text={s.credit} />
          </Sequence>
        ) : null
      )}

      {captions.map((c, i) => {
        const a = Math.round(c.from_s * fps);
        const b = Math.round(c.to_s * fps);
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
