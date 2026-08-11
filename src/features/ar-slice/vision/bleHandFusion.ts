export type HandTrackingObservation = {
  visible: boolean;
  centerY: number;
  confidence: number;
};

/**
 * Complementary 1D fusion:
 * - BNO085 position remains the fast path.
 * - Markerless palm Y supplies a slow absolute correction.
 * Turning this off returns the untouched firmware position.
 */
export class BleHandFusion {
  private enabled = false;
  private sensorPosition = 0;
  private fallbackOffset = 0;
  private fusedPosition = 0;
  private baselineY: number | null = null;
  private baselinePosition = 0;
  private lastVisibleAt = -Infinity;
  private tracking = false;

  setEnabled(enabled: boolean) {
    if (this.enabled === enabled) return;
    this.enabled = enabled;
    this.reset();
  }

  reset() {
    this.sensorPosition = 0;
    this.fallbackOffset = 0;
    this.fusedPosition = 0;
    this.baselineY = null;
    this.baselinePosition = 0;
    this.lastVisibleAt = -Infinity;
    this.tracking = false;
  }

  ingestSensor(positionMeters: number, now = performance.now()) {
    if (!Number.isFinite(positionMeters)) return positionMeters;
    this.sensorPosition = positionMeters;
    if (!this.enabled) {
      this.fusedPosition = this.sensorPosition;
      return this.fusedPosition;
    }
    if (this.tracking && now - this.lastVisibleAt <= 300) {
      // Vision is the absolute source while the palm is visible.
      return this.fusedPosition;
    }
    if (this.tracking) {
      this.tracking = false;
      this.fallbackOffset = this.fusedPosition - this.sensorPosition;
    }
    this.fusedPosition = this.sensorPosition + this.fallbackOffset;
    return this.fusedPosition;
  }

  ingestHand(
    observation: HandTrackingObservation,
    now = performance.now(),
  ) {
    if (
      !this.enabled ||
      !observation.visible ||
      !Number.isFinite(observation.centerY) ||
      observation.confidence < 0.35
    ) {
      if (this.tracking && now - this.lastVisibleAt > 450) {
        this.tracking = false;
        this.fallbackOffset = this.fusedPosition - this.sensorPosition;
      }
      return this.fusedPosition;
    }

    const reacquired = !this.tracking || now - this.lastVisibleAt > 450;
    this.lastVisibleAt = now;
    if (reacquired || this.baselineY == null) {
      this.tracking = true;
      this.baselineY = observation.centerY;
      this.baselinePosition = this.fusedPosition;
      return this.fusedPosition;
    }

    // Roughly 28 cm of controller travel across the camera's vertical field.
    const visualPosition =
      this.baselinePosition + (this.baselineY - observation.centerY) * 0.28;
    const error = visualPosition - this.fusedPosition;
    // Vision is authoritative while visible. Fast blend stays smooth at 15 Hz,
    // and the cap prevents a bad one-frame hand detection from jumping the cut.
    if (Math.abs(error) >= 0.0008) {
      const step = Math.max(-0.018, Math.min(0.018, error * 0.72));
      this.fusedPosition += step;
    }
    this.fallbackOffset = this.fusedPosition - this.sensorPosition;
    return this.fusedPosition;
  }

  getPosition() {
    return this.fusedPosition;
  }

  isTracking() {
    return this.enabled && this.tracking;
  }
}

export const bleHandFusion = new BleHandFusion();
