/**
 * Probe depth from moldura accelerometer (IMU +Z).
 * Firmware streams an absolute meters position (ZUPT-integrated).
 * This unwraps the int16 wire value and maps it 1:1 * gain → scene depth.
 */
export class LinearSliceDrive {
  private lastRaw: number | null = null;
  private unwrappedMeters = 0;
  private committedMeters = 0;
  private targetDepth = 0;
  private smoothedDepth = 0;
  private lastGestureAt = 0;

  reset() {
    this.lastRaw = null;
    this.unwrappedMeters = 0;
    this.committedMeters = 0;
    this.targetDepth = 0;
    this.smoothedDepth = 0;
    this.lastGestureAt = 0;
  }

  ingest(
    positionMeters: number,
    gain: number,
    maxJumpMeters: number,
    now = performance.now(),
    deadbandMeters = 0.0004,
  ) {
    if (!Number.isFinite(positionMeters)) return false;

    if (this.lastRaw == null) {
      this.lastRaw = positionMeters;
      this.unwrappedMeters = positionMeters;
      this.committedMeters = positionMeters;
      this.targetDepth = positionMeters * gain;
      return false;
    }

    let delta = positionMeters - this.lastRaw;
    // int16 at 0.1 mm wraps every ±3.2768 m.
    if (delta > 3.2768) delta -= 6.5536;
    if (delta < -3.2768) delta += 6.5536;
    this.lastRaw = positionMeters;

    if (Math.abs(delta) > maxJumpMeters) {
      // Glitch / reconnect — resync without jumping the cut.
      this.unwrappedMeters = positionMeters;
      this.committedMeters = positionMeters;
      this.targetDepth = this.unwrappedMeters * gain;
      return false;
    }

    this.unwrappedMeters += delta;

    // Hold the visual target until motion clears the deadband — kills sub-mm jitter.
    if (Math.abs(this.unwrappedMeters - this.committedMeters) < deadbandMeters) {
      return false;
    }

    this.committedMeters = this.unwrappedMeters;
    this.targetDepth = this.committedMeters * gain;
    this.lastGestureAt = now;
    return true;
  }

  tick(smoothing: number) {
    // smoothing ≥ 1 → snap to target (continuous probe wants zero lag).
    if (smoothing >= 0.999) {
      this.smoothedDepth = this.targetDepth;
      return this.smoothedDepth;
    }
    const a = Math.min(1, Math.max(0.45, smoothing));
    const err = this.targetDepth - this.smoothedDepth;
    const absErr = Math.abs(err);
    const boost =
      absErr > 0.008 ? 1 : absErr > 0.002 ? Math.min(1, a + 0.12) : a;
    this.smoothedDepth += err * boost;
    return this.smoothedDepth;
  }

  getLastGestureAt() {
    return this.lastGestureAt;
  }

  getTargetDepth() {
    return this.targetDepth;
  }

  getUnwrappedMeters() {
    return this.unwrappedMeters;
  }
}

export const linearSliceDrive = new LinearSliceDrive();
