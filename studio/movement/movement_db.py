#!/usr/bin/env python3
"""movement_db.py — read the movement sheets, and make the scaling law impossible to break.

  from movement_db import MovementDB
  db = MovementDB()
  stance = db.get("walk_spatiotemporal", "phase_structure.stance_pct")      # 60.0
  stride = db.length("walk_spatiotemporal", "...stride...", leg_length_m)   # scaled by LEG length

WHY A READER AND NOT JUST json.load
-----------------------------------
Three project rules are easy to break by accident and expensive to break silently. Each is
enforced here rather than left to the caller remembering:

1. THE SCALING LAW (L07). Every value carries a `scaling` field. Angles never scale. Lengths
   scale by LEG LENGTH, never by stature — a 1.74 m robot has a different leg-to-stature ratio
   than a human, so scaling a stride by height is wrong exactly where it matters. Dimensionless
   values transfer untouched. `get()` refuses to return a length without a leg length, and
   `length()` refuses to scale an angle.

2. NOT_YET_SOURCED MEANS ABSENT, NOT ZERO. A null in the sheet is a gap the project has
   deliberately declined to invent. Reading one raises. Code that needs it must either derive it
   or stop — never quietly substitute 0.0 and carry on looking plausible.

3. PROVENANCE TRAVELS WITH THE VALUE. `cite()` returns the source and confidence, so a number
   can always be traced back out of an animation to the paper it came from.
"""
import json
import math
import os

HERE = os.path.dirname(os.path.abspath(__file__))


class NotSourced(KeyError):
    """Raised when code asks for a value the project has deliberately left unsourced."""


class ScalingError(ValueError):
    """Raised on any attempt to scale a quantity the wrong way (an angle, or by stature)."""


class MovementDB:
    def __init__(self, root=HERE):
        self.root = root
        self._sheets = {}

    def sheet(self, name):
        if name not in self._sheets:
            p = os.path.join(self.root, f"{name}.json")
            with open(p, encoding="utf-8") as f:
                self._sheets[name] = json.load(f)
        return self._sheets[name]

    # -- lookup ---------------------------------------------------------------
    def _node(self, name, path):
        node = self.sheet(name)
        for part in path.split("."):
            if not isinstance(node, dict) or part not in node:
                raise KeyError(f"{name}: no such path {path!r} (stopped at {part!r})")
            node = node[part]
        return node

    def _unsourced(self, name):
        return self.sheet(name).get("NOT_YET_SOURCED", {})

    def get(self, name, path, leg_length_m=None):
        """A value with its scaling law applied. Raises on anything unsourced."""
        head = path.split(".")[0]
        if head == "NOT_YET_SOURCED" or path in self._unsourced(name):
            raise NotSourced(
                f"{name}.{path} is in NOT_YET_SOURCED — deliberately not guessed. "
                f"Derive it, or stop; do not substitute a default.")
        node = self._node(name, path)
        if isinstance(node, dict):
            if node.get("value", "missing") is None:
                raise NotSourced(f"{name}.{path} has a null value — treat as absent, not zero.")
            val, scaling = node.get("value"), node.get("scaling", "dimensionless")
        else:
            return node
        if scaling == "leg_length":
            if leg_length_m is None:
                raise ScalingError(
                    f"{name}.{path} scales by LEG LENGTH — pass leg_length_m. "
                    f"(Never scale it by stature: L07.)")
            return val * leg_length_m
        return val

    def angle(self, name, path):
        """An angle, in degrees. Refuses to apply any scaling — angles never scale, ever."""
        node = self._node(name, path)
        if isinstance(node, dict):
            if node.get("scaling") not in (None, "none"):
                raise ScalingError(f"{name}.{path} is not declared scaling:none — not an angle?")
            if node.get("value") is None:
                raise NotSourced(f"{name}.{path} is null")
            return node["value"]
        return node

    def cite(self, name, path):
        node = self._node(name, path)
        if not isinstance(node, dict):
            raise KeyError(f"{name}.{path} is a bare value with no provenance block")
        return {"source": node.get("source"), "confidence": node.get("confidence"),
                "population": node.get("population"), "note": node.get("note")}

    def missing(self, name):
        """Everything the sheet declares it has NOT sourced. Report this; never fill it in."""
        return sorted(self._unsourced(name))


# ── shape-preserving interpolation between event points ─────────────────────
def pchip(xs, ys):
    """Monotone cubic (Fritsch-Carlson). A natural cubic spline through gait event points
    OVERSHOOTS — it would invent a knee angle larger than the sourced 70 deg peak, and that
    invented value is exactly the kind of number this whole exercise exists to stop producing.
    PCHIP cannot overshoot its knots."""
    n = len(xs)
    h = [xs[i + 1] - xs[i] for i in range(n - 1)]
    d = [(ys[i + 1] - ys[i]) / h[i] for i in range(n - 1)]
    m = [0.0] * n
    m[0], m[-1] = d[0], d[-1]
    for i in range(1, n - 1):
        if d[i - 1] * d[i] <= 0:
            m[i] = 0.0                      # a local extremum: flat, so no overshoot
        else:
            w1, w2 = 2 * h[i] + h[i - 1], h[i] + 2 * h[i - 1]
            m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i])

    def f(x):
        x = min(max(x, xs[0]), xs[-1])
        i = max(j for j in range(n - 1) if xs[j] <= x)
        t, hi = x - xs[i], h[i]
        s = t / hi
        h00 = 2 * s ** 3 - 3 * s ** 2 + 1
        h10 = s ** 3 - 2 * s ** 2 + s
        h01 = -2 * s ** 3 + 3 * s ** 2
        h11 = s ** 3 - s ** 2
        return h00 * ys[i] + h10 * hi * m[i] + h01 * ys[i + 1] + h11 * hi * m[i + 1]

    return f


SHEET_VERSIONS = {
    # what each sheet revision actually changed about the CURVES. v0.3 added Froude speed
    # calibration, which is a validation and not a curve, so v0.3 and v0.2 are kinematically
    # identical — stating that is the difference between an honest comparison and a fake one.
    "0.1": dict(swing=False, stance=False, mtp=False),
    "0.2": dict(swing=True, stance=False, mtp=False),
    "0.3": dict(swing=True, stance=False, mtp=False),
    "0.4": dict(swing=True, stance=True, mtp=False),
    # v0.5 adds the FOREFOOT ROCKER (G05). No earlier sheet has an mtp curve, so emulating one
    # must leave the toes flat — a rigid plate from heel to tip is precisely the defect under
    # comparison, and quietly back-porting the fix would erase the before/after.
    "0.5": dict(swing=True, stance=True, mtp=True),
}


def walk_curves(db, sheet="walk_spatiotemporal", swing_resolution=True, version=None):
    """Build hip / knee / ankle angle-vs-phase curves from the sheet.

    Every knot is a sourced value or arithmetic on sourced values, and the derivations are
    labelled. Nothing is added because a curve "looks better" with it.

    swing_resolution=False reproduces the v0.1 behaviour (endpoints only, no intermediate swing
    control points). It exists so the -45.8 mm through-floor failure can be re-rendered
    deliberately as evidence, not so it can be used.
    """
    A = lambda p: db.angle(sheet, p)                                          # noqa: E731
    ev = lambda p: db.get(sheet, f"events_pct_of_cycle.{p}")                  # noqa: E731
    toe_off = ev("toe_off")                    # 60% - also the stance fraction
    feet_adj = ev("feet_adjacent")             # 73%
    notes = []
    if version is not None:
        cfg = SHEET_VERSIONS[str(version)]
        swing_resolution, stance_allowed, mtp_allowed = cfg["swing"], cfg["stance"], cfg["mtp"]
    else:
        stance_allowed = mtp_allowed = True
    has_swing = swing_resolution and "swing_phase_resolution" in db.sheet(sheet)
    has_stance = stance_allowed and "stance_phase_resolution" in db.sheet(sheet)
    has_mtp = mtp_allowed and "G05_mtp_toe_flexion" in db.sheet(sheet)

    # ── HIP ─────────────────────────────────────────────────────────────────
    hip_x = [0.0, ev("opposite_heel_strike"), toe_off]
    hip_y = [A("joint_angles_at_events_deg.hip_flexion.at_initial_contact"),
             A("joint_angles_at_events_deg.hip_flexion.at_terminal_stance"),
             A("joint_angles_at_events_deg.hip_flexion.at_toe_off")]
    if has_swing:
        S = "swing_phase_resolution.hip_flexion_swing_deg"
        hip_x += [75.0, 87.0, 100.0]
        hip_y += [A(f"{S}.initial_swing_end_75pct"), A(f"{S}.mid_swing_end_87pct"),
                  A(f"{S}.terminal_swing_87_100pct")]
        notes.append("hip: swing profile from the sheet - 10 deg by 75%, 20 deg by 87%, then "
                     "HOLDS. No terminal-swing peak is sourced and none is invented; buying "
                     "clearance with a fake hip peak would repeat LIFT's mistake in angle form")
    else:
        hip_x += [100.0]
        hip_y += [A("joint_angles_at_events_deg.hip_flexion.at_initial_contact")]
        notes.append("hip: v0.1 mode - no swing control points, monotone toe-off to contact")

    # ── KNEE: the double bump ───────────────────────────────────────────────
    lr_phase = ev("opposite_toe_off") / 2.0
    knee_x = [0.0, lr_phase, 40.0, toe_off]
    knee_y = [A("joint_angles_at_events_deg.knee_flexion.at_initial_contact"),
              A("joint_angles_at_events_deg.knee_flexion.loading_response_peak"),
              A("joint_angles_at_events_deg.knee_flexion.at_heel_off"),
              A("joint_angles_at_events_deg.knee_flexion.at_toe_off")]
    if has_swing:
        S = "swing_phase_resolution.knee_flexion_swing_deg"
        pk_phase = db.get(sheet, f"{S}.peak_at_pct_of_cycle")
        knee_x += [pk_phase, 100.0]
        knee_y += [A(f"{S}.peak_value"),
                   A("joint_angles_at_events_deg.knee_flexion.at_initial_contact")]
        notes.append(f"knee: peak {A(f'{S}.peak_value'):.0f} deg at {pk_phase:.0f}% - the "
                     f"initial-swing/mid-swing boundary, which is DEFINED as maximal knee "
                     f"flexion. Placing it late folds the shank through the clearance window "
                     f"and then snaps it out")
    else:
        knee_x += [feet_adj, 100.0]
        knee_y += [A("joint_angles_at_events_deg.knee_flexion.peak_midswing"),
                   A("joint_angles_at_events_deg.knee_flexion.at_initial_contact")]
    notes.append(f"knee: loading-response peak timed at {lr_phase:.0f}% (mid first double "
                 f"support) and heel-off at 40% - both CONVENTIONAL, not sourced "
                 f"(NOT_YET_SOURCED.loading_response_and_heel_off_phases)")

    # ── ANKLE: three rockers in stance, then the clearance mechanism in swing ────
    # v0.4: peak stance dorsiflexion is SOURCED at +10 deg. It used to be derived as
    # total_rom_walking(30) + at_toe_off(-25) = +5, which was wrong not because any of those
    # three numbers was wrong but because the DERIVATION was: total_rom_walking is an aggregate,
    # and its 30 was the MIDPOINT OF A RANGE [20, 40]. Consuming a summary statistic as a
    # measurement over-constrained the system and produced a pathologically stiff ankle -
    # 5 deg is below the literature minimum for normal gait - which made the skeleton toe-walk
    # through the whole of stance. AGGREGATES VALIDATE; THEY DO NOT DRIVE.
    ankle_x, ankle_y = [0.0], [A("joint_angles_at_events_deg.ankle_dorsiflexion.at_initial_contact")]
    if has_stance:
        T = "stance_phase_resolution.ankle_dorsiflexion_stance_deg"
        pk_ph = db.get(sheet, f"{T}.peak_at_pct_of_cycle")
        ankle_x += [8.5, 30.0, pk_ph, toe_off]
        ankle_y += [A(f"{T}.foot_flat_7_10pct"), A(f"{T}.mid_stance_30pct"),
                    A(f"{T}.peak_dorsiflexion"), A(f"{T}.at_toe_off_60pct")]
        notes.append(f"ankle stance: three rockers - heel rocker to "
                     f"{A(f'{T}.foot_flat_7_10pct'):+.0f} deg at foot-flat, ankle rocker to "
                     f"{A(f'{T}.peak_dorsiflexion'):+.0f} deg at {pk_ph:.0f}% over a FLAT foot, "
                     f"forefoot rocker to {A(f'{T}.at_toe_off_60pct'):+.0f} deg at toe-off")
    else:
        # RECONSTRUCTING A KNOWN-BAD DERIVATION ON PURPOSE, for the before/after comparison.
        # v0.4 replaced total_rom_walking in joint_angles_at_events_deg with a string explaining
        # its demotion, so the aggregate can no longer be read as a number by accident — the
        # guard works. Emulating the historical error therefore has to reach into
        # validation_outputs deliberately, which is exactly the friction it should have.
        rom = db._node(sheet, "validation_outputs.ankle_total_rom_walking_deg")["value"]
        df_min = A("joint_angles_at_events_deg.ankle_dorsiflexion.at_toe_off")
        ankle_x += [40.0, toe_off]
        ankle_y += [rom + df_min, df_min]
        notes.append("ankle stance: NO stance_phase_resolution in this sheet - peak "
                     "dorsiflexion DERIVED from an aggregate. This is the toe-walk failure.")
    if has_swing:
        S = "swing_phase_resolution.ankle_dorsiflexion_swing_deg"
        ankle_x += [70.0, 75.0, 85.0, 100.0]
        ankle_y += [A(f"{S}.early_swing_70pct"), A(f"{S}.mid_swing_75_85pct"),
                    A(f"{S}.mid_swing_75_85pct"), A(f"{S}.terminal_swing_to_contact")]
        notes.append("ankle swing: THE clearance mechanism - rapid dorsiflexion in EARLY swing "
                     "(-5 deg by 70%, neutral by 75%) and HELD through the window")
    else:
        ankle_x += [100.0]
        ankle_y += [A("joint_angles_at_events_deg.ankle_dorsiflexion.at_initial_contact")]
        notes.append("ankle swing: v0.1 mode - endpoints only. The -48 mm through-floor failure")

    # ── MTP: the FOREFOOT ROCKER (G05) ──────────────────────────────────────
    # Curve is in the SHEET's convention: positive = DORSIFLEXION (toes up). It is NOT negated
    # here. Which sign the rig uses is a fact about the rig, so it is measured against the rig at
    # the point of application (derive_gait's sign probe) and this file stays rig-agnostic.
    #
    # THE RULE THIS BLOCK EXISTS TO OBEY: capacity sets the LIMIT, measurement sets the CURVE.
    # The literature's 45-60 deg "required for normal gait" and 60-90 deg assisted are CAPACITY.
    # Driving the curve with either is the total_rom_walking error in a new joint, so the peak
    # here comes only from the measured walking peak, and the limit is not consulted at all.
    mtp_curve, mtp_limit, mtp_knots = None, None, []
    if has_mtp:
        Gk = "G05_mtp_toe_flexion.driven_curve_deg"
        blk = db._node(sheet, Gk)
        if blk.get("scaling") not in (None, "none"):
            raise ScalingError("G05 driven_curve_deg is not scaling:none — angles never scale")
        onset = db.get(sheet, f"{Gk}.onset_at_pct")
        pk_ph = db.get(sheet, f"{Gk}.peak_at_pct_of_cycle")
        peak = db.get(sheet, f"{Gk}.peak_deg")
        lo, hi = db.get(sheet, f"{Gk}.peak_range")
        if not lo <= peak <= hi:
            raise ValueError(f"G05 peak {peak} is outside its own declared range [{lo}, {hi}]")
        limit_blk = "G05_mtp_toe_flexion.rom_limit_deg"
        mtp_limit = {"shipped_deg": db.get(sheet, f"{limit_blk}.shipped"),
                     "working_deg": db.get(sheet, f"{limit_blk}.proposed_working_limit"),
                     "basis": db.get(sheet, f"{limit_blk}.basis"),
                     "source": db.get(sheet, f"{limit_blk}.source")}
        if peak >= mtp_limit["working_deg"]:
            raise ValueError(f"G05 curve peak {peak} reaches the ROM limit "
                             f"{mtp_limit['working_deg']} — a capacity has leaked into the curve")
        # Return-to-neutral phase is NOT in the sheet. Rather than invent a new number, the knot
        # is placed on the ankle's existing sourced early-swing landmark (70%), and declared
        # conventional — the same treatment loading-response and heel-off already get.
        SWING_RETURN_PCT = 70.0
        mtp_x = [0.0, 10.0, onset, pk_ph, toe_off, SWING_RETURN_PCT, 100.0]
        mtp_y = [db.get(sheet, f"{Gk}.at_initial_contact_0pct"),
                 db.get(sheet, f"{Gk}.foot_flat_10_40pct"),
                 db.get(sheet, f"{Gk}.foot_flat_10_40pct"),
                 peak,
                 db.get(sheet, f"{Gk}.at_toe_off_60pct"),
                 db.get(sheet, f"{Gk}.swing_60_100pct"),
                 db.get(sheet, f"{Gk}.swing_60_100pct")]
        mtp_knots = list(zip(mtp_x, mtp_y))
        mtp_curve = pchip(mtp_x, mtp_y)
        notes.append(f"mtp (G05): flat 0 deg to {onset:.0f}%, then the FOREFOOT ROCKER - "
                     f"progressive dorsiflexion to {peak:.0f} deg at {pk_ph:.0f}%, "
                     f"{db.get(sheet, f'{Gk}.at_toe_off_60pct'):.0f} deg at toe-off. Limit "
                     f"{mtp_limit['working_deg']:.0f} deg is CAPACITY and never touches the curve")
        if db._node(sheet, Gk).get("peak_at_pct_uncertain"):
            notes.append(f"mtp (G05): peak PHASE is declared uncertain in the sheet - sources "
                         f"disagree between ~43% and ~60%; {pk_ph:.0f}% taken on mechanism. "
                         f"Magnitude confidence medium, phase confidence LOW")
        notes.append(f"mtp (G05): return-to-neutral placed at {SWING_RETURN_PCT:.0f}% - "
                     f"CONVENTIONAL, not sourced. The sheet says 'returns to ~0 during swing' "
                     f"without a phase. Dorsiflexed toes in swing RAISE the toe sole, so this "
                     f"knot flatters minimum toe clearance - check MTC against it, both ways")

    return {"hip": pchip(hip_x, hip_y), "knee": pchip(knee_x, knee_y),
            "ankle": pchip(ankle_x, ankle_y), "stance_pct": toe_off, "notes": notes,
            "mtp": mtp_curve, "mtp_limit": mtp_limit, "has_mtp": has_mtp,
            "sheet_version": db.sheet(sheet).get("version"),
            "emulating_version": str(version) if version is not None else None,
            "has_stance_resolution": has_stance,
            "swing_resolution": has_swing,
            "knots": {"hip": list(zip(hip_x, hip_y)), "knee": list(zip(knee_x, knee_y)),
                      "ankle": list(zip(ankle_x, ankle_y)), "mtp": mtp_knots}}


if __name__ == "__main__":
    db = MovementDB()
    print("sheet: walk_spatiotemporal")
    print(f"  stance      {db.get('walk_spatiotemporal', 'phase_structure.stance_pct')}%")
    print(f"  double sup  {db.get('walk_spatiotemporal', 'phase_structure.double_support_each_pct')}% x2")
    print(f"  toe-off     {db.get('walk_spatiotemporal', 'events_pct_of_cycle.toe_off')}%")
    print(f"  NOT sourced: {db.missing('walk_spatiotemporal')}")
    for k in ("pelvic_list_deg", "foot_soft_tissue_offsets_mm"):
        try:
            db.get("walk_spatiotemporal", k, leg_length_m=0.8)
            print(f"  !! {k} returned a value — the guard is broken")
        except NotSourced as e:
            print(f"  guard OK: {str(e).split('—')[0].strip()}")
    c = walk_curves(db)
    print("\n  curve knots and derivations:")
    for n in c["notes"]:
        print(f"    - {n}")
    print("\n  phase  hip     knee    ankle")
    for p in range(0, 101, 10):
        print(f"  {p:5d}  {c['hip'](p):+6.1f}  {c['knee'](p):+6.1f}  {c['ankle'](p):+6.1f}")
