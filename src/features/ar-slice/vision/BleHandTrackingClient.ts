import { ProgeniaArFrame } from "@/features/ar-slice/vision/ProgeniaArFrame";
import type { HandTrackingObservation } from "@/features/ar-slice/vision/bleHandFusion";

export class BleHandTrackingClient {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private stopped = true;
  private busy = false;

  async start(onObservation: (sample: HandTrackingObservation) => void) {
    await this.stop();
    await ProgeniaArFrame.startHandTracking();
    this.stopped = false;

    const poll = async () => {
      if (this.stopped) return;
      if (!this.busy) {
        this.busy = true;
        try {
          const hand = await ProgeniaArFrame.pollHandTracking();
          onObservation({
            visible: hand.visible,
            centerY: hand.centerY,
            confidence: hand.confidence,
          });
        } catch {
          onObservation({ visible: false, centerY: 0.5, confidence: 0 });
        } finally {
          this.busy = false;
        }
      }
      if (!this.stopped) this.timer = setTimeout(poll, 80);
    };
    this.timer = setTimeout(poll, 80);
  }

  async stop() {
    this.stopped = true;
    this.busy = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    await ProgeniaArFrame.stopHandTracking().catch(() => undefined);
  }
}
