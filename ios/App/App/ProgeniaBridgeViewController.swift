import UIKit
import Capacitor

/// Registers in-app Capacitor plugins (Capacitor 6+ no longer auto-loads them).
class ProgeniaBridgeViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(ProgeniaArFramePlugin())
    }
}
