// DeviceFrame — a phone or tablet drawn in CSS, holding whatever you put in it.
//
// Why this is worth having: a screen shown inside a device reads as "a product someone is using",
// where the same screen full-bleed reads as "a slide". The frame is chrome, not content.
//
// ⚠️ Put a REAL capture inside it. This project's most costly recorded failure was recreating
// capturable product screens as styled divs — the cut read as a mockup of the product rather than
// the product, and was rejected outright. The frame around a real screenshot is legitimate; the
// screen itself should come from the product. See the `judge-video` skill's
// `fail-recreated-not-real` entry.
//
// Drawn rather than committed as a PNG: it stays crisp at any size, costs no bytes, and can take
// the composition's accent colour.

import React from "react";
import { useVideoConfig } from "remotion";

export type DeviceKind = "phone" | "tablet";

/** Aspect and chrome proportions per device, in units of the device's own width. */
const SPEC: Record<DeviceKind, { aspect: number; radius: number; bezel: number; notch: boolean }> = {
  // 19.5:9-ish, the shape a modern handset actually is.
  phone: { aspect: 2.0, radius: 0.155, bezel: 0.035, notch: true },
  tablet: { aspect: 1.4, radius: 0.055, bezel: 0.032, notch: false },
};

export type DeviceFrameProps = {
  kind?: DeviceKind;
  /** Device width as a fraction of the composition's SHORTER side, so it scales with the frame. */
  width?: number;
  /** Body colour. */
  body?: string;
  /** Screen colour, seen only where children do not cover. */
  screen?: string;
  /** A faint edge highlight, e.g. the composition accent. */
  rim?: string;
  /** Rotation in degrees, for a device held at a slight angle. */
  rotation?: number;
  /** Content for the screen area — ideally a real capture. */
  children?: React.ReactNode;
};

export const DeviceFrame: React.FC<DeviceFrameProps> = ({
  kind = "phone",
  width = 0.42,
  body = "#0a0c14",
  screen = "#05070c",
  rim,
  rotation = 0,
  children,
}) => {
  const { width: cw, height: ch } = useVideoConfig();
  const spec = SPEC[kind];

  const w = Math.round(Math.min(cw, ch) * width);
  const h = Math.round(w * spec.aspect);
  const bezel = Math.max(3, Math.round(w * spec.bezel));
  const radius = Math.round(w * spec.radius);

  return (
    <div
      style={{
        width: w,
        height: h,
        background: body,
        borderRadius: radius,
        padding: bezel,
        boxSizing: "border-box",
        position: "relative",
        transform: rotation ? `rotate(${rotation}deg)` : undefined,
        boxShadow: rim
          ? `0 0 0 1px ${rim}55, 0 ${Math.round(h * 0.05)}px ${Math.round(h * 0.12)}px rgba(0,0,0,0.6)`
          : `0 ${Math.round(h * 0.05)}px ${Math.round(h * 0.12)}px rgba(0,0,0,0.6)`,
      }}
    >
      {/* Screen. Children are clipped to it, so a capture cannot bleed over the bezel. */}
      <div
        style={{
          width: "100%",
          height: "100%",
          background: screen,
          borderRadius: Math.max(2, radius - bezel),
          overflow: "hidden",
          position: "relative",
        }}
      >
        {children}
      </div>

      {spec.notch ? (
        <div
          style={{
            position: "absolute",
            top: bezel + Math.round(h * 0.012),
            left: "50%",
            transform: "translateX(-50%)",
            width: Math.round(w * 0.26),
            height: Math.round(w * 0.055),
            background: body,
            borderRadius: 999,
          }}
        />
      ) : null}

      {/* Side buttons — small, but their absence is what makes a frame look like a rounded box. */}
      <div
        style={{
          position: "absolute",
          right: -Math.max(2, Math.round(w * 0.008)),
          top: Math.round(h * 0.22),
          width: Math.max(2, Math.round(w * 0.008)),
          height: Math.round(h * 0.09),
          background: body,
          borderRadius: 2,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: -Math.max(2, Math.round(w * 0.008)),
          top: Math.round(h * 0.18),
          width: Math.max(2, Math.round(w * 0.008)),
          height: Math.round(h * 0.05),
          background: body,
          borderRadius: 2,
        }}
      />
    </div>
  );
};
