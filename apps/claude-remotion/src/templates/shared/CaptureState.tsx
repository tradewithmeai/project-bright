// CaptureState — switch the captured interface between states at a known frame.
//
// The idea worth keeping: a line of narration lands, and the product visibly CHANGES in response.
// The viewer reads it as cause and effect — the words did that — which is far stronger than
// narrating over a still that never reacts.
//
// The mechanism is deliberately dumb, because dumb survives:
//
//   - You supply N states. Each is a complete rendering of the interface, registered under a key.
//   - You supply triggers: "at frame 96, become 'flagged', over 12 frames".
//   - Every state is mounted the whole time and cross-faded by opacity. Nothing mounts or
//     unmounts mid-render, so there is no flash of unstyled or half-laid-out content.
//
// States must be IDENTICALLY REGISTERED — the same layout, same element positions — so the
// crossfade reads as one interface changing rather than two pictures swapping. Change colour,
// emphasis, badges, values. Do not change the layout underneath.
//
// Trigger frames are relative to the stage the switch sits in, and should be shared with whatever
// causes them: give the caption the same frame number, so the words and the change cannot drift
// apart when either is re-timed.

import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export type CaptureStateDef<K extends string = string> = {
  key: K;
  node: React.ReactNode;
};

export type CaptureStateTrigger<K extends string = string> = {
  /** Frame, relative to the enclosing stage, at which the change begins. */
  at: number;
  /** The state to become. */
  to: K;
  /** Frames the crossfade takes. Short reads as a switch; long reads as a dissolve. */
  dur?: number;
};

/**
 * Opacity of each state at a frame, given the trigger list.
 *
 * Exported so a test can assert the switch happens when it should without rendering pixels, and
 * so nothing else has to reimplement the timing.
 */
export function stateOpacities<K extends string>(
  states: CaptureStateDef<K>[],
  triggers: CaptureStateTrigger<K>[],
  frame: number,
  initial?: K
): Record<string, number> {
  const first = initial ?? states[0]?.key;
  const out: Record<string, number> = {};
  for (const s of states) out[s.key] = s.key === first ? 1 : 0;

  // Apply triggers in order. Each one fades its target in and everything else out by the same
  // amount, so the total stays at 1 and the stack never goes transparent mid-crossfade.
  const ordered = [...triggers].sort((a, b) => a.at - b.at);
  for (const t of ordered) {
    const dur = Math.max(1, t.dur ?? 12);
    const p = interpolate(frame, [t.at, t.at + dur], [0, 1], CLAMP);
    if (p <= 0) continue;
    for (const s of states) {
      out[s.key] = s.key === t.to ? out[s.key] + (1 - out[s.key]) * p : out[s.key] * (1 - p);
    }
  }
  return out;
}

/**
 * Cross-fade a captured interface between registered states.
 *
 * Place it INSIDE the virtual camera, wrapped in <Capture>, so the states are part of the
 * interface and ride the camera with it.
 */
export function CaptureStateSwitch<K extends string>({
  states,
  triggers,
  initial,
}: {
  states: CaptureStateDef<K>[];
  triggers: CaptureStateTrigger<K>[];
  initial?: K;
}) {
  const frame = useCurrentFrame();
  const op = stateOpacities(states, triggers, frame, initial);
  return (
    <>
      {states.map((s) => {
        const o = op[s.key] ?? 0;
        // Fully transparent states are still mounted — only their painting is skipped — so no
        // layout work happens at the moment of the switch.
        return (
          <AbsoluteFill key={s.key} style={{ opacity: o }}>
            {s.node}
          </AbsoluteFill>
        );
      })}
    </>
  );
}
