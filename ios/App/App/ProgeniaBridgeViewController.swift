import UIKit
import Capacitor
import WebKit

/// Registers in-app Capacitor plugins (Capacitor 6+ no longer auto-loads them).
class ProgeniaBridgeViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(ProgeniaArFramePlugin())
        // ARKit is inserted behind WKWebView. CSS transparency alone does not
        // clear WKWebView's native backing layer on iOS.
        view.backgroundColor = .clear
        view.isOpaque = false
        webView?.isOpaque = false
        webView?.backgroundColor = .clear
        webView?.scrollView.backgroundColor = .clear
        webView?.scrollView.isOpaque = false
        webView?.layer.isOpaque = false
        webView?.layer.backgroundColor = UIColor.clear.cgColor
        webView?.scrollView.layer.isOpaque = false
        webView?.scrollView.layer.backgroundColor = UIColor.clear.cgColor
        if #available(iOS 15.0, *) {
            webView?.underPageBackgroundColor = .clear
        }
    }
}
