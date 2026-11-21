import React from "react";
import { AbsoluteFill, interpolate } from "remotion";
import {
  TransitionPresentation,
  TransitionPresentationComponentProps,
} from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";

/**
 * Scene transitions for the Rebel Minds episode renderer.
 * Stock presentations (fade / wipe) come from @remotion/transitions;
 * "whip" and "zoom-through" are custom presentations built on the same interface.
 */

type ZoomProps = Record<string, never>;

const ZoomThroughComponent: React.FC<TransitionPresentationComponentProps<ZoomProps>> = ({
  children,
  presentationDirection,
  presentationProgress,
}) => {
  const p = presentationProgress;
  const entering = presentationDirection === "entering";
  const scale = entering ? interpolate(p, [0, 1], [0.86, 1]) : interpolate(p, [0, 1], [1, 1.35]);
  const opacity = entering
    ? interpolate(p, [0, 0.7], [0, 1], { extrapolateRight: "clamp" })
    : interpolate(p, [0.4, 1], [1, 0], { extrapolateLeft: "clamp" });
  const blur = entering ? (1 - p) * 8 : p * 10;
  return (
    <AbsoluteFill style={{ opacity, transform: `scale(${scale})`, filter: `blur(${blur}px)` }}>
      {children}
    </AbsoluteFill>
  );
};

export const zoomThrough = (): TransitionPresentation<ZoomProps> => ({
  component: ZoomThroughComponent,
  props: {},
});

type WhipProps = { dir: 1 | -1 };

const WhipComponent: React.FC<TransitionPresentationComponentProps<WhipProps>> = ({
  children,
  presentationDirection,
  presentationProgress,
  passedProps,
}) => {
  const p = presentationProgress;
  const entering = presentationDirection === "entering";
  const dir = passedProps.dir;
  // Enter from one side, exit to the other, with directional motion blur.
  const x = entering ? (1 - p) * 100 * dir : -p * 100 * dir;
  const blur = Math.sin(p * Math.PI) * 22;
  return (
    <AbsoluteFill style={{ transform: `translateX(${x}%)`, filter: `blur(${blur}px)` }}>{children}</AbsoluteFill>
  );
};

export const whip = (dir: 1 | -1): TransitionPresentation<WhipProps> => ({
  component: WhipComponent,
  props: { dir },
});

/** Pick a presentation for a scene's `transition` field. Returns null for a hard cut. */
export const presentationFor = (transition: string, sceneId: number): TransitionPresentation<any> | null => {
  switch ((transition || "").toLowerCase()) {
    case "cut":
    case "none":
      return null;
    case "whip":
      return whip(sceneId % 2 === 0 ? 1 : -1);
    case "zoom-through":
      return zoomThrough();
    case "crossfade":
    default:
      // Mostly dissolves, with an occasional wipe so the rhythm is not uniform.
      return sceneId % 5 === 0 ? wipe({ direction: "from-left" }) : fade();
  }
};

/** Transition length in frames. */
export const transitionFrames = (transition: string, fps: number): number => {
  switch ((transition || "").toLowerCase()) {
    case "cut":
    case "none":
      return 0;
    case "whip":
      return Math.round(0.24 * fps);
    case "zoom-through":
      return Math.round(0.55 * fps);
    default:
      return Math.round(0.5 * fps);
  }
};

// Re-exported so callers need only one import.
export { fade, slide, wipe };
