import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  buildOrganicLayerGeometry,
  tissueBoundarySeed,
} from "@/lib/clinicalTissueGeometry";
import {
  applyContactIndent,
  buildDeformedLayerGeometry,
  computeAngleContactFootprint,
  computeApplicatorContactAnchorY,
  computeApplicatorContactPlaneLift,
  computeApplicatorRestY,
  computeContactCenterSink,
  coupleDermisIndentToEpidermis,
  computeContactPressureResponse,
  computeLayerContactIndents,
  concentricContactBasinProfile,
  resetAndApplyContactIndent,
  sampleContactSurfaceSink,
  sampleDeformedSurfaceLift,
  APPLICATOR_CONTACT_PROFILE_R,
  APPLICATOR_SKIN_GAP,
  DERMIS_MAX_INDENT_FRACTION,
  ADIPOSE_MAX_INDENT_FRACTION,
  EPIDERMIS_GRAVITATIONAL_SINK_BOOST,
  EPIDERMIS_MAX_INDENT_FRACTION,
  CONTACT_VERTICAL_DEFORMATION_SCALE,
  CONTACT_LOW_MID_PRESSURE_BOOST,
} from "@/components/labs/photobio/photobioViewerLayout";

describe("photobioViewerLayout contact indent", () => {
  const sizes = {
    width: 8.5,
    depth: 3.4,
    epidermis: 0.135,
    dermis: 0.45,
    adipose: 1.0,
    muscle: 2.0,
  };

  it("boosts deformation ~30% at low and mid contact pressure", () => {
    const at20 = computeLayerContactIndents(0.2, sizes);
    const at50 = computeLayerContactIndents(0.5, sizes);
    const response20 = computeContactPressureResponse(0.2);
    const response50 = computeContactPressureResponse(0.5);
    expect(response20.lowMidBoost).toBeCloseTo(CONTACT_LOW_MID_PRESSURE_BOOST, 2);
    expect(response50.lowMidBoost).toBeCloseTo(CONTACT_LOW_MID_PRESSURE_BOOST, 2);
    expect(at20.epidermis).toBeGreaterThan(sizes.epidermis * 0.14);
    expect(at50.epidermis).toBeGreaterThan(at20.epidermis * 1.15);
    expect(at50.epidermis).toBeLessThan(
      computeLayerContactIndents(0.95, sizes).epidermis * 1.02,
    );
  });

  it("increases indent depth gradually with pressure", () => {
    const low = computeLayerContactIndents(0.2, sizes);
    const mid = computeLayerContactIndents(0.5, sizes);
    const high = computeLayerContactIndents(0.9, sizes);
    expect(mid.epidermis).toBeGreaterThan(low.epidermis);
    expect(high.epidermis).toBeGreaterThan(mid.epidermis);
    expect(high.epidermis).toBeGreaterThan(sizes.epidermis * 0.82);
    expect(high.epidermis).toBeLessThanOrEqual(sizes.epidermis * EPIDERMIS_MAX_INDENT_FRACTION * 1.02);
    expect(high.dermis).toBeLessThanOrEqual(sizes.dermis * DERMIS_MAX_INDENT_FRACTION * 1.02);
    expect(high.adipose).toBeLessThanOrEqual(sizes.adipose * ADIPOSE_MAX_INDENT_FRACTION * 1.02);
  });

  it("couples dermis indent to epidermis compression at high pressure", () => {
    const high = computeLayerContactIndents(0.95, sizes);
    const coupled = coupleDermisIndentToEpidermis(
      high.epidermis,
      high.dermis * 0.4,
      sizes,
      0.95,
    );
    expect(high.dermis).toBeGreaterThan(high.epidermis * 0.25);
    expect(coupled).toBeGreaterThanOrEqual(high.dermis * 0.4);
    expect(high.dermis).toBeLessThanOrEqual(sizes.dermis * DERMIS_MAX_INDENT_FRACTION * 1.02);
  });

  it("still increases sink between medium and maximum pressure", () => {
    const mid = computeLayerContactIndents(0.55, sizes);
    const high = computeLayerContactIndents(0.95, sizes);
    expect(high.epidermis).toBeGreaterThan(mid.epidermis);
    expect(high.dermis).toBeGreaterThanOrEqual(mid.dermis);
    expect(high.adipose).toBeGreaterThan(mid.adipose);
  });

  it("lowers the whole applicator as contact sink grows with pressure", () => {
    const topSurfaceY = 1.25;
    const low = computeLayerContactIndents(0.25, sizes);
    const high = computeLayerContactIndents(0.9, sizes);
    const restLow = computeApplicatorRestY(topSurfaceY, low);
    const restHigh = computeApplicatorRestY(topSurfaceY, high);
    expect(restHigh).toBeLessThan(restLow);
    expect(computeContactCenterSink(high)).toBeGreaterThan(computeContactCenterSink(low));
  });

  it("tracks mean tissue compression under the contact face", () => {
    const indents = computeLayerContactIndents(0.85, sizes);
    const contactLift = computeApplicatorContactPlaneLift(indents);
    const centerLift = sampleDeformedSurfaceLift(indents.epidermis, 0);
    const edgeLift = sampleDeformedSurfaceLift(indents.epidermis, APPLICATOR_CONTACT_PROFILE_R);
    const centerSink = computeContactCenterSink(indents);
    expect(contactLift).toBeLessThan(edgeLift * 0.98);
    expect(contactLift).toBeGreaterThan(centerLift);
    expect(-contactLift).toBeGreaterThan(centerSink * 0.48);
    expect(-contactLift).toBeLessThan(centerSink * 1.05);
  });

  it("aligns applicator rest height with contact plane lift", () => {
    const topSurfaceY = 1.25;
    const indents = computeLayerContactIndents(0.85, sizes);
    const footprint = computeAngleContactFootprint(90, 1.1, 0.9);
    const contactLift = computeApplicatorContactPlaneLift(indents, footprint);
    const restY = computeApplicatorRestY(topSurfaceY, indents, footprint);
    const compressionT = Math.min(1, indents.epidermis / (0.19 * CONTACT_VERTICAL_DEFORMATION_SCALE));
    const gap = APPLICATOR_SKIN_GAP * (1 - compressionT * 0.82);
    expect(restY).toBeCloseTo(topSurfaceY + gap + contactLift, 5);
  });

  it("stretches contact footprint and adds asymmetry when tilted", () => {
    const perpendicular = computeAngleContactFootprint(90, 1, 0.8);
    const tilted = computeAngleContactFootprint(65, 1, 0.8);
    expect(tilted.contactRadiusX).toBeGreaterThan(perpendicular.contactRadiusX);
    expect(tilted.contactRadiusZ).toBeLessThan(perpendicular.contactRadiusZ);
    expect(tilted.asymmetricBias).not.toBeCloseTo(0, 2);
    expect(tilted.incidenceEfficiency).toBeLessThan(perpendicular.incidenceEfficiency);
    expect(tilted.contactSeatOffsetY).toBe(0);
  });

  it("uses zero pivot — skin conforms to centered tilted face", () => {
    const tilted = computeAngleContactFootprint(40, 1.1, 0.9, 0.2);
    expect(tilted.contactPivotOffsetX).toBe(0);
    expect(tilted.contactCenterOffsetX).toBe(0);
  });

  it("lowers contact anchor when tilted so face meets conforming plane", () => {
    const topSurfaceY = 1.25;
    const indents = computeLayerContactIndents(0.85, sizes);
    const footprint = computeAngleContactFootprint(40, 1.1, 0.9, 0.2);
    const centerAnchor = computeApplicatorRestY(topSurfaceY, indents, footprint);
    const tiltedAnchor = computeApplicatorContactAnchorY(
      topSurfaceY,
      indents,
      footprint,
      0.2,
    );
    expect(tiltedAnchor).not.toBeCloseTo(centerAnchor, 4);
  });

  it("deforms asymmetrically along the tilt axis", () => {
    const indents = computeLayerContactIndents(0.8, sizes);
    const footprint = computeAngleContactFootprint(60, 1.1, 0.9);
    const geometry = new THREE.BoxGeometry(8.5, sizes.epidermis, 3.4, 16, 4, 16);
    const base = Float32Array.from(geometry.attributes.position.array as ArrayLike<number>);
    const halfH = sizes.epidermis / 2;

    resetAndApplyContactIndent(geometry, base, {
      height: sizes.epidermis,
      centerX: 0,
      indent: indents.epidermis,
      radiusX: 1.1,
      radiusZ: 0.9,
      radialLimit: 2.5,
      gravitationalField: true,
      tiltRad: footprint.tiltRad,
      asymmetricBias: footprint.asymmetricBias,
      skinConformRadius: 0.2,
    });

    let downstreamY = Infinity;
    let upstreamY = -Infinity;
    const cosT = Math.cos(footprint.tiltRad);
    const sinT = Math.sin(footprint.tiltRad);
    const downstreamSign = footprint.asymmetricBias >= 0 ? 1 : -1;
    for (let i = 0; i < geometry.attributes.position.count; i += 1) {
      const x = geometry.attributes.position.getX(i);
      const yBefore = base[i * 3 + 1];
      const yAfter = geometry.attributes.position.getY(i);
      const z = geometry.attributes.position.getZ(i);
      if (yBefore < halfH - 0.02) continue;
      const u = x * cosT + z * sinT;
      if (u * downstreamSign > 0.15) downstreamY = Math.min(downstreamY, yAfter);
      if (u * downstreamSign < -0.15) upstreamY = Math.max(upstreamY, yAfter);
    }

    expect(Number.isFinite(downstreamY)).toBe(true);
    expect(downstreamY).toBeLessThan(upstreamY);
    geometry.dispose();
  });

  it("sinks more at center than at applicator edge", () => {
    const indents = computeLayerContactIndents(0.8, sizes);
    const centerSink = computeContactCenterSink(indents);
    const edgeSink =
      sampleContactSurfaceSink(indents.epidermis, 1) * EPIDERMIS_GRAVITATIONAL_SINK_BOOST;
    expect(concentricContactBasinProfile(0)).toBeGreaterThan(concentricContactBasinProfile(0.85));
    expect(centerSink).toBeGreaterThan(edgeSink * 1.15);
  });

  it("has a monotonically smooth radial sink gradient", () => {
    const indent = 0.14;
    let prev = sampleContactSurfaceSink(indent, 0);
    for (let i = 1; i <= 24; i += 1) {
      const r = (i / 24) * 1.45;
      const sink = sampleContactSurfaceSink(indent, r);
      expect(sink).toBeLessThanOrEqual(prev + 0.0001);
      expect(Math.abs(sink - prev)).toBeLessThan(0.018);
      prev = sink;
    }
  });

  it("deforms top vertices downward under contact center", () => {
    const indents = computeLayerContactIndents(0.75, sizes);
    const geometry = new THREE.BoxGeometry(8.5, sizes.epidermis, 3.4, 8, 2, 4);
    const base = Float32Array.from(geometry.attributes.position.array as ArrayLike<number>);
    const halfH = sizes.epidermis / 2;

    let topYBefore = -Infinity;
    for (let i = 0; i < geometry.attributes.position.count; i += 1) {
      const x = geometry.attributes.position.getX(i);
      const y = geometry.attributes.position.getY(i);
      const z = geometry.attributes.position.getZ(i);
      if (Math.abs(x) < 0.05 && Math.abs(z) < 0.05 && y >= halfH - 0.02) {
        topYBefore = Math.max(topYBefore, y);
      }
    }

    resetAndApplyContactIndent(geometry, base, {
      height: sizes.epidermis,
      centerX: 0,
      indent: indents.epidermis,
      radiusX: 1.1,
      radiusZ: 0.9,
    });

    let topYAfter = Infinity;
    for (let i = 0; i < geometry.attributes.position.count; i += 1) {
      const x = geometry.attributes.position.getX(i);
      const y = geometry.attributes.position.getY(i);
      const z = geometry.attributes.position.getZ(i);
      if (Math.abs(x) < 0.2 && Math.abs(z) < 0.2) {
        topYAfter = Math.min(topYAfter, y);
      }
    }

    expect(Number.isFinite(topYAfter)).toBe(true);
    expect(topYAfter).toBeLessThan(topYBefore - 0.045 * CONTACT_VERTICAL_DEFORMATION_SCALE);
    geometry.dispose();
  });

  it("applies gravitational field sink with concentric modulation", () => {
    const indents = computeLayerContactIndents(0.8, sizes);
    const geometry = new THREE.BoxGeometry(8.5, sizes.epidermis, 3.4, 16, 4, 10);
    const base = Float32Array.from(geometry.attributes.position.array as ArrayLike<number>);
    const halfH = sizes.epidermis / 2;

    resetAndApplyContactIndent(geometry, base, {
      height: sizes.epidermis,
      centerX: 0,
      indent: indents.epidermis,
      radiusX: 1.2,
      radiusZ: 1.0,
      wellSteepness: 0.58,
      radialLimit: 2.45,
      gravitationalField: true,
    });

    let centerY = Infinity;
    let rimSample = -Infinity;
    for (let i = 0; i < geometry.attributes.position.count; i += 1) {
      const x = geometry.attributes.position.getX(i);
      const y = geometry.attributes.position.getY(i);
      const z = geometry.attributes.position.getZ(i);
      const r = Math.hypot(x / 1.0, z / 0.85);
      if (r < 0.12) centerY = Math.min(centerY, y);
      if (r > 0.5 && r < 0.9) rimSample = Math.max(rimSample, y);
    }

    expect(Number.isFinite(centerY)).toBe(true);
    expect(centerY).toBeLessThan(halfH);
    expect(rimSample).toBeGreaterThan(centerY);
    geometry.dispose();
  });

  it("does not mutate geometry when indent is zero", () => {
    const geometry = new THREE.BoxGeometry(2, 0.2, 1, 4, 2, 2);
    const yBefore = geometry.attributes.position.getY(0);
    applyContactIndent(geometry, {
      height: 0.2,
      centerX: 0,
      indent: 0,
      radiusX: 0.5,
      radiusZ: 0.5,
    });
    expect(geometry.attributes.position.getY(0)).toBe(yBefore);
    geometry.dispose();
  });

  it("deforms organic epidermis mesh under gravitational contact field", () => {
    const stackSeed = 42;
    const sizes = {
      width: 8.5,
      depth: 3.4,
      epidermis: 0.135,
      dermis: 0.45,
      adipose: 1.0,
      muscle: 2.0,
    };
    const indents = computeLayerContactIndents(0.75, sizes);
    const base = buildOrganicLayerGeometry({
      width: sizes.width,
      height: sizes.epidermis,
      depth: sizes.depth,
      boundarySeedTop: tissueBoundarySeed(stackSeed, 0),
      boundarySeedBottom: tissueBoundarySeed(stackSeed, 1),
      kind: "epidermis",
      topAmplitudeScale: 0.018,
      segments: [48, 10, 26],
    });

    const deformed = buildDeformedLayerGeometry(base, {
      height: sizes.epidermis,
      centerX: 0,
      indent: indents.epidermis,
      radiusX: 1.2,
      radiusZ: 1.0,
      wellSteepness: 0.58,
      radialLimit: 2.45,
      gravitationalField: true,
    });

    let maxDepression = 0;
    let radialSpread = 0;
    for (let i = 0; i < deformed.attributes.position.count; i += 1) {
      const x = deformed.attributes.position.getX(i);
      const yBefore = base.attributes.position.getY(i);
      const yAfter = deformed.attributes.position.getY(i);
      const z = deformed.attributes.position.getZ(i);
      const delta = yBefore - yAfter;
      if (delta <= 0) continue;
      maxDepression = Math.max(maxDepression, delta);
      const r = Math.hypot(x / 1.2, z / 1.0);
      if (delta > 0.008) radialSpread = Math.max(radialSpread, r);
    }

    expect(maxDepression).toBeGreaterThan(0.03);
    expect(radialSpread).toBeGreaterThan(0.45);
    base.dispose();
    deformed.dispose();
  });
});
