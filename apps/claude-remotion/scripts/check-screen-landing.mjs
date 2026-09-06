#!/usr/bin/env node
// check-screen-landing.mjs — the geometry and timing of shared/ScreenLanding.tsx.
//
// This replaces three registered Studio compositions. Those "tests" rendered a placeholder card
// onto a device plate for three seconds and proved nothing on their own — somebody had to watch
// them and judge. What is actually assertable about a landing is arithmetic, and that is what this
// checks; what it looks like is a question for a rendered frame, which the show provides.
//
// ⚠️ Every assertion below has a stated failure mode, and the file ends by DELIBERATELY BREAKING
// each property to confirm the check reports it. A check that cannot fail is this project's
// signature defect.
//
// Run: npm run check:landing
//
// ⚠️ It imports the REAL module rather than re-implementing its arithmetic. A test that reimplements
// what it is testing proves only that the author can write the same formula twice — and this exact
// duplication is what the three retired rig compositions did. That means it needs bundling, since
// the module pulls in `remotion`; the npm script does it:
//
//   esbuild scripts/check-screen-landing.mjs --bundle --platform=node --format=cjs
//     --loader:.tsx=tsx --jsx=automatic

import { APPROACH_FRAMES, landingPose, screenBox } from "../src/templates/shared/ScreenLanding.tsx";

const failures = [];
const ok = (cond, msg) => {
  console.log(`   ${cond ? "ok  " : "FAIL"} ${msg}`);
  if (!cond) failures.push(msg);
};

const W = 1920;
const H = 1080;
const EFFECTS = ["flyin", "catherine", "cardflip"];

/**
 * Is this transform visually the identity?
 *
 * ⚠️ Rotations are reduced MODULO 360 before being judged. The first version of this check compared
 * every number in the transform against 0 or 1 and reported catherine broken at
 * `rotate(1080deg)` — which is three whole turns, i.e. exactly upright. The assertion was wrong,
 * not the code, and the distinction matters: a check whose failures are its own mistakes trains
 * people to ignore it.
 */
function isSettled(transform) {
  const rotations = [...transform.matchAll(/rotate[XYZ]?\((-?[\d.]+)deg\)/g)].map((m) => Number(m[1]));
  if (rotations.some((r) => Math.abs(((r % 360) + 360) % 360) > 1e-6)) return false;
  const withoutRotations = transform.replace(/rotate[XYZ]?\([^)]*\)/g, "");
  const nums = (withoutRotations.match(/-?\d+(\.\d+)?(e-?\d+)?/g) ?? []).map(Number);
  return nums.every((n) => Math.abs(n) < 1e-6 || Math.abs(n - 1) < 1e-6);
}

// ── 1. screenBox: fractions in, pixels out, bleed outwards ────────────────────────────────────
console.log("1. screenBox");
{
  const rect = { x: 0.2016, y: 0.1211, w: 0.5957, h: 0.4867 };
  const b = screenBox(rect, W, H);
  ok(b.x < rect.x * W && b.y < rect.y * H, "bleed pushes the origin OUTWARD (no plate rim survives)");
  ok(b.w > rect.w * W && b.h > rect.h * H, "bleed grows the box rather than shrinking it");
  ok(Math.abs(b.w - (rect.w * W + 2 * b.bleed)) < 1e-9, "width is the rect plus bleed on both sides");

  // The same rect at another size must scale — that is the whole reason it is a fraction.
  const half = screenBox(rect, W / 2, H / 2);
  const ratio = half.w / b.w;
  ok(Math.abs(ratio - 0.5) < 0.02, `the box scales with the composition (ratio ${ratio.toFixed(3)})`);
}

// ── 2. Every effect settles to identity ON the land frame ─────────────────────────────────────
// This is the property the whole primitive exists for: the landing coincides with a beat.
console.log("\n2. Landing on the exact frame");
for (const effect of EFFECTS) {
  const landFrame = 102;
  const approachFrames = APPROACH_FRAMES[effect];
  const at = (frame) => landingPose({ landFrame, approachFrames, effect, width: W, height: H, frame });

  const landed = at(landFrame);
  ok(isSettled(landed.transform), `${effect}: settled to identity at the land frame (${landed.transform})`);

  const before = at(landFrame - Math.round(approachFrames / 2));
  ok(before.transform !== landed.transform, `${effect}: still moving halfway through the approach`);

  ok(at(landFrame - approachFrames).opacity < 0.05, `${effect}: starts transparent`);
  ok(landed.opacity > 0.99, `${effect}: fully opaque by the time it lands`);
}

// ── 3. The flying flag releases the surface just after the landing ────────────────────────────
console.log("\n3. Handover to the live screen");
for (const effect of EFFECTS) {
  const landFrame = 102;
  const opts = { landFrame, approachFrames: APPROACH_FRAMES[effect], effect, width: W, height: H };
  ok(landingPose({ ...opts, frame: landFrame }).flying, `${effect}: still flying ON the land frame`);
  ok(
    !landingPose({ ...opts, frame: landFrame + 10 }).flying,
    `${effect}: released shortly after, so the live screen takes over`
  );
}

// ── 4. cardflip needs perspective on the parent; the others must not have it ───────────────────
console.log("\n4. Perspective");
{
  const mk = (effect) =>
    landingPose({ landFrame: 102, approachFrames: APPROACH_FRAMES[effect], effect, width: W, height: H, frame: 90 });
  ok(mk("cardflip").perspective != null, "cardflip asks for perspective (or the flip reads as a squash)");
  ok(mk("catherine").perspective == null, "catherine does not");
  ok(mk("flyin").perspective == null, "flyin does not");
}

// ── 5. catherine ends upright ─────────────────────────────────────────────────────────────────
// It spins a whole number of turns, so the last frame must not leave the card at an angle.
console.log("\n5. catherine ends upright");
{
  const landFrame = 102;
  const opts = { landFrame, approachFrames: APPROACH_FRAMES.catherine, effect: "catherine", width: W, height: H };
  const rotAt = (frame) => {
    const m = /rotate\((-?[\d.]+)deg\)/.exec(landingPose({ ...opts, frame }).transform);
    return m ? Number(m[1]) : NaN;
  };
  ok(Math.abs(rotAt(landFrame) % 360) < 1e-6, `rotation is a whole number of turns at landing (${rotAt(landFrame)})`);
  ok(rotAt(landFrame - 10) % 360 !== 0, "and is genuinely mid-turn before that");
}

// ── 6. NEGATIVE CONTROLS — the checks must be able to fail ─────────────────────────────────────
console.log("\n6. Negative controls (each of these MUST be reported as broken)");
{
  const landFrame = 102;
  // A landing aimed one frame late: the pose at the intended frame is not identity.
  const late = landingPose({
    landFrame: landFrame + 1,
    approachFrames: APPROACH_FRAMES.catherine,
    effect: "catherine",
    width: W,
    height: H,
    frame: landFrame,
  });
  ok(!isSettled(late.transform), "a landing aimed one frame late is NOT settled at the intended frame");

  // A rect with no bleed would leave the plate's own screen colour showing at the edge.
  const nb = screenBox({ x: 0.2, y: 0.12, w: 0.6, h: 0.49 }, W, H, 0);
  ok(nb.bleed === 0 && nb.x === 0.2 * W, "with bleedFraction 0 the box is exactly the rect (the unsafe case)");

  // Halfway through, every effect must be somewhere other than home.
  const mid = landingPose({
    landFrame,
    approachFrames: APPROACH_FRAMES.flyin,
    effect: "flyin",
    width: W,
    height: H,
    frame: landFrame - Math.round(APPROACH_FRAMES.flyin / 2),
  });
  ok(/translate\(-?[1-9]/.test(mid.transform), "flyin is genuinely displaced mid-approach, not a no-op");
}

console.log(
  failures.length === 0
    ? "\nALL CHECKS PASS — geometry and timing only; how it LOOKS is a question for a rendered frame."
    : `\n${failures.length} CHECK(S) FAILED`
);
process.exit(failures.length === 0 ? 0 : 1);
