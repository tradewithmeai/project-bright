// SampleCapture — a neutral, fictional product interface, drawn in DOM.
//
// This stands in for the screenshot you would normally take of your own product. It is drawn
// rather than committed as a PNG for three reasons: a clean clone renders it with no assets at
// all, it stays crisp at any zoom, and nobody has to wonder whose product it is.
//
// It is authored at CAPTURE_SIZE (2560x1440), deliberately NOT the composition size, because
// that is the real case: you capture at your display's resolution and the video is 1080p.
// <Capture> handles the fit.
//
// ── Replacing this with your own product ──────────────────────────────────────────────────────
//
// Swap the whole component for an <Img>, and set CAPTURE_SIZE to the screenshot's real pixels:
//
//     import { Img, staticFile } from "remotion";
//     export const CAPTURE_SIZE = { width: 2560, height: 1440 };  // your screenshot's real size
//     export const SampleCapture = () => (
//       <Img src={staticFile("captures/my-product.png")}
//            style={{ width: "100%", height: "100%", display: "block" }} />
//     );
//
// Nothing else changes. The focus regions in stages.ts are fractions of the capture, so they keep
// meaning the same thing — though you will want to re-aim them at your own features.

import React from "react";

/** The size this interface is authored at. Change it if you swap in a real screenshot. */
export const CAPTURE_SIZE = { width: 2560, height: 1440 };

/** A fictional product. Nothing here refers to a real service. */
export const SAMPLE_PRODUCT = "Demo Console";

const UI = {
  bg: "#0d1420",
  panel: "#141d2c",
  panelHi: "#1b2637",
  line: "#243247",
  text: "#e8edf5",
  dim: "#8ea0b8",
  accent: "#38bdf8",
  good: "#3ddc97",
  warn: "#f5b455",
  font: "'Segoe UI', system-ui, -apple-system, 'Helvetica Neue', Arial, sans-serif",
  mono: "'Cascadia Mono', Consolas, 'SF Mono', ui-monospace, monospace",
};

const NAV = ["Overview", "Requests", "Pipelines", "Artifacts", "Schedules", "Settings"];

const ROWS = [
  { id: "RQ-4471", name: "Nightly export", state: "Passing", ms: "1,204", when: "2 min ago" },
  { id: "RQ-4470", name: "Ingest: eu-west", state: "Passing", ms: "868", when: "14 min ago" },
  { id: "RQ-4469", name: "Rebuild search index", state: "Slow", ms: "9,530", when: "38 min ago" },
  { id: "RQ-4468", name: "Purge stale drafts", state: "Passing", ms: "412", when: "1 hr ago" },
  { id: "RQ-4467", name: "Weekly digest", state: "Passing", ms: "2,041", when: "3 hr ago" },
];

const StatTile: React.FC<{ label: string; value: string; note: string; tone?: string }> = ({
  label,
  value,
  note,
  tone = UI.accent,
}) => (
  <div
    style={{
      flex: 1,
      background: UI.panel,
      border: `1px solid ${UI.line}`,
      borderRadius: 14,
      padding: "28px 32px",
    }}
  >
    <div style={{ fontSize: 22, color: UI.dim, letterSpacing: 0.6, textTransform: "uppercase" }}>
      {label}
    </div>
    <div
      style={{
        fontSize: 68,
        fontWeight: 700,
        color: UI.text,
        marginTop: 10,
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {value}
    </div>
    <div style={{ fontSize: 22, color: tone, marginTop: 6 }}>{note}</div>
  </div>
);

/**
 * The two interface states the walkthrough switches between.
 *
 * "default" is the ordinary view. "flagged" is the same screen after the user narrows it to what
 * needs attention: the healthy rows recede and the slow one is emphasised.
 *
 * They are IDENTICALLY REGISTERED on purpose — same rows, same columns, same positions. Only
 * emphasis changes, so the crossfade reads as one interface reacting rather than two pictures
 * swapping.
 */
export type CaptureStateKey = "default" | "flagged";

export const SampleCapture: React.FC<{ state?: CaptureStateKey }> = ({ state = "default" }) => (
  <div
    style={{
      width: CAPTURE_SIZE.width,
      height: CAPTURE_SIZE.height,
      background: UI.bg,
      fontFamily: UI.font,
      display: "flex",
      overflow: "hidden",
    }}
  >
    {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
    <div
      style={{
        width: 380,
        background: UI.panel,
        borderRight: `1px solid ${UI.line}`,
        padding: "36px 28px",
        flexShrink: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 46 }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: UI.accent,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: UI.bg,
            fontWeight: 800,
            fontSize: 24,
          }}
        >
          D
        </div>
        <div style={{ fontSize: 28, fontWeight: 700, color: UI.text }}>{SAMPLE_PRODUCT}</div>
      </div>

      {NAV.map((item, i) => (
        <div
          key={item}
          style={{
            padding: "16px 20px",
            marginBottom: 8,
            borderRadius: 10,
            fontSize: 25,
            color: i === 1 ? UI.text : UI.dim,
            background: i === 1 ? UI.panelHi : "transparent",
            borderLeft: i === 1 ? `3px solid ${UI.accent}` : "3px solid transparent",
          }}
        >
          {item}
        </div>
      ))}
    </div>

    {/* ── Main column ─────────────────────────────────────────────────────── */}
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
      {/* Top bar, with the search field the camera visits first */}
      <div
        style={{
          height: 116,
          borderBottom: `1px solid ${UI.line}`,
          display: "flex",
          alignItems: "center",
          padding: "0 44px",
          gap: 28,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            flex: 1,
            maxWidth: 900,
            height: 60,
            background: UI.panelHi,
            border: `1px solid ${UI.line}`,
            borderRadius: 12,
            display: "flex",
            alignItems: "center",
            padding: "0 22px",
            gap: 14,
            color: UI.dim,
            fontSize: 25,
          }}
        >
          <span style={{ opacity: 0.8 }}>Search requests, pipelines or artifacts</span>
        </div>
        <div style={{ flex: 1 }} />
        <div
          style={{
            padding: "14px 28px",
            borderRadius: 10,
            background: UI.accent,
            color: UI.bg,
            fontWeight: 700,
            fontSize: 24,
          }}
        >
          New request
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: 44, display: "flex", flexDirection: "column", gap: 32, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 18 }}>
          <div style={{ fontSize: 40, fontWeight: 700, color: UI.text }}>Requests</div>
          <div style={{ fontSize: 25, color: state === "flagged" ? UI.warn : UI.dim }}>
            {state === "flagged" ? "filtered to 1 needing attention" : "5 in the last hour"}
          </div>
        </div>

        {/* Stat row — the camera's second stop */}
        <div style={{ display: "flex", gap: 24 }}>
          <StatTile label="Completed today" value="1,284" note="+6.2% on yesterday" tone={UI.good} />
          <StatTile label="Median duration" value="1.9s" note="within budget" tone={UI.good} />
          <StatTile label="Needs attention" value="3" note="1 over 9s" tone={UI.warn} />
        </div>

        {/* Table — the camera's third stop */}
        <div
          style={{
            background: UI.panel,
            border: `1px solid ${UI.line}`,
            borderRadius: 14,
            overflow: "hidden",
            flex: 1,
          }}
        >
          <div
            style={{
              display: "flex",
              padding: "20px 32px",
              borderBottom: `1px solid ${UI.line}`,
              color: UI.dim,
              fontSize: 21,
              letterSpacing: 0.6,
              textTransform: "uppercase",
            }}
          >
            <div style={{ width: 200 }}>Ref</div>
            <div style={{ flex: 1 }}>Request</div>
            <div style={{ width: 200 }}>State</div>
            <div style={{ width: 200, textAlign: "right" }}>Duration</div>
            <div style={{ width: 240, textAlign: "right" }}>Last run</div>
          </div>

          {ROWS.map((r, i) => {
            const slow = r.state === "Slow";
            // In the flagged state the healthy rows recede and the slow one is lifted. Positions
            // and text are untouched, so nothing moves during the crossfade.
            const flagged = state === "flagged";
            const rowOpacity = flagged && !slow ? 0.32 : 1;
            const rowBg = slow
              ? flagged
                ? "rgba(245,180,85,0.16)"
                : "rgba(245,180,85,0.06)"
              : "transparent";
            return (
              <div
                key={r.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "26px 32px",
                  borderBottom: i === ROWS.length - 1 ? "none" : `1px solid ${UI.line}`,
                  background: rowBg,
                  opacity: rowOpacity,
                  fontSize: 25,
                  color: UI.text,
                }}
              >
                <div style={{ width: 200, fontFamily: UI.mono, color: UI.dim }}>{r.id}</div>
                <div style={{ flex: 1 }}>{r.name}</div>
                <div style={{ width: 200 }}>
                  <span
                    style={{
                      padding: "7px 16px",
                      borderRadius: 999,
                      fontSize: 21,
                      fontWeight: 600,
                      color: slow ? UI.warn : UI.good,
                      background: slow ? "rgba(245,180,85,0.14)" : "rgba(61,220,151,0.13)",
                    }}
                  >
                    {r.state}
                  </span>
                </div>
                <div
                  style={{
                    width: 200,
                    textAlign: "right",
                    fontFamily: UI.mono,
                    fontVariantNumeric: "tabular-nums",
                    color: slow ? UI.warn : UI.text,
                  }}
                >
                  {r.ms} ms
                </div>
                <div style={{ width: 240, textAlign: "right", color: UI.dim }}>{r.when}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  </div>
);
