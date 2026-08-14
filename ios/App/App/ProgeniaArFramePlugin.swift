import Foundation
import Darwin
import Network
import CoreBluetooth
import Capacitor
import Vision
import UIKit
import WebKit
import ARKit
import SceneKit
import CoreMotion

/**
 Vision rectangle detect + native IMU streams (BLE/UDP/TCP).
 All high-rate samples use ProgeniaLocalQuatServer, never one Capacitor bridge call per sample.
 */
@objc(ProgeniaArFramePlugin)
public class ProgeniaArFramePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ProgeniaArFramePlugin"
    public let jsName = "ProgeniaArFrame"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "detectHand", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "detectRectangle", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "startMixedReality", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stopMixedReality", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pollMixedReality", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "recenterMixedReality", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "startUdpStream", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "startTcpStream", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "startBleStream", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "startDeviceMotionStream", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "resetDeviceMotionTranslation", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "startHandTracking", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stopHandTracking", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pollHandTracking", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "startCapacitorImuRelay", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stopCapacitorImuRelay", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "sendBleCommand", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stopStream", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pollOrientation", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pingHost", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "scanFrameHosts", returnType: CAPPluginReturnPromise)
    ]

    private let ioQueue = DispatchQueue(
        label: "com.progenia.frame.stream",
        qos: .userInteractive
    )
    private var udpFd: Int32 = -1
    private var udpSource: DispatchSourceRead?
    private var tcpConnection: NWConnection?
    private var lineBuffer = Data()
    private let localQuatServer = ProgeniaLocalQuatServer()
    private var pendingW = 1.0
    private var pendingX = 0.0
    private var pendingY = 0.0
    private var pendingZ = 0.0
    private var pendingDirty = false
    private var sampleSeq: UInt64 = 0
    private var rxCount: UInt32 = 0
    private var lastRxHz: UInt32 = 0
    private var lastHzTick = Date()
    private var tcpConnectCall: CAPPluginCall?
    private var tcpDidResolve = false
    private var streamMode: String?
    private var bleCentral: CBCentralManager?
    private var blePeripheral: CBPeripheral?
    private var bleOrientationCharacteristic: CBCharacteristic?
    private var bleCommandCharacteristic: CBCharacteristic?
    private var bleStartCall: CAPPluginCall?
    private var bleTargetIdentifier: UUID?
    private var bleTimeout: DispatchWorkItem?
    private var bleScanFallbackWork: DispatchWorkItem?
    private var bleRateProbe: DispatchWorkItem?
    private var bleWarmupRetries = 0
    private var bleReconnectWork: DispatchWorkItem?
    private var bleReconnectAttempt = 0
    private var bleWatchdog: DispatchSourceTimer?
    private var lastBlePacketAt = Date()
    private var bleRecoveryInProgress = false
    private var bleLowRateTicks = 0
    private var bleRateRecoveryCount = 0
    private var capacitorRelayObserver: NSObjectProtocol?
    /// false = scan by service UUID; true = open scan filtered by name (iPad / stale ADV).
    private var bleOpenNameScan = false
    private var bleConnectWatchdog: DispatchWorkItem?
    private var bleConnectAttempts = 0
    private let frameServiceUUID = CBUUID(string: "6FBE1D30-9A2C-4F1E-9C3A-7B2E1A0D4F01")
    private let frameOrientationUUID = CBUUID(string: "6FBE1D31-9A2C-4F1E-9C3A-7B2E1A0D4F01")
    private let frameCommandUUID = CBUUID(string: "6FBE1D32-9A2C-4F1E-9C3A-7B2E1A0D4F01")
    private var mixedRealityView: ARSCNView?
    private var mixedRealityAnchor: simd_float4x4?
    private var hologramNode: SCNNode?
    private let motionManager = CMMotionManager()
    private let motionQueue: OperationQueue = {
        let queue = OperationQueue()
        queue.name = "com.progenia.frame.devicemotion"
        queue.qualityOfService = .userInteractive
        queue.maxConcurrentOperationCount = 1
        return queue
    }()
    private var deviceMotionBias = SIMD3<Double>(repeating: 0)
    private var deviceMotionAccelFiltered = SIMD3<Double>(repeating: 0)
    private var deviceMotionVelocity = 0.0
    private var deviceMotionPosition = 0.0
    private var deviceMotionLastTimestamp = 0.0
    private var deviceMotionQuietSince = 0.0
    private var deviceMotionTranslationResumeAt = 0.0
    private var deviceMotionGestureActive = false
    private var deviceMotionTrackingSession: ARSession?
    private var deviceMotionArBaseline: SIMD3<Float>?
    private var deviceMotionArAxis = SIMD3<Float>(0, 1, 0)
    private var deviceMotionArCommittedDepth = 0.0
    private var deviceMotionArDepth = 0.0
    private var deviceMotionArLastUpdate = Date.distantPast
    private var deviceMotionArTrackingValid = false
    private var deviceMotionDeviceOrientation: UIDeviceOrientation = .portrait
    private var handTrackingSession: ARSession?
    private var handTrackingEnabled = false
    private let handVisionQueue = DispatchQueue(
        label: "com.progenia.frame.handvision",
        qos: .userInteractive
    )
    private var handVisionBusy = false
    private var handLastVisionTimestamp = 0.0
    private var handVisible = false
    private var handCenterX = 0.5
    private var handCenterY = 0.5
    private var handPalmSpan = 0.0
    private var handConfidence = 0.0
    private var handSampleTimestamp = 0.0

    public override func load() {
        // Stale relay flag blocks Capacitor handshake notifications (UserDefaults).
        UserDefaults.standard.set(false, forKey: "ProgeniaBleRelayActive")
        UIDevice.current.beginGeneratingDeviceOrientationNotifications()
        NotificationCenter.default.addObserver(
            forName: UIDevice.orientationDidChangeNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            self?.updateDeviceMotionDeviceOrientation(UIDevice.current.orientation)
        }
        updateDeviceMotionDeviceOrientation(UIDevice.current.orientation)
        let release: (Notification) -> Void = { [weak self] _ in
            self?.ioQueue.async {
                self?.stopStreamInternal()
            }
        }
        NotificationCenter.default.addObserver(
            forName: UIApplication.didEnterBackgroundNotification,
            object: nil,
            queue: nil,
            using: release
        )
        NotificationCenter.default.addObserver(
            forName: UIApplication.willTerminateNotification,
            object: nil,
            queue: nil,
            using: release
        )
    }

    private func updateDeviceMotionDeviceOrientation(_ orientation: UIDeviceOrientation) {
        guard orientation == .portrait ||
              orientation == .portraitUpsideDown ||
              orientation == .landscapeLeft ||
              orientation == .landscapeRight,
              orientation != deviceMotionDeviceOrientation else { return }
        deviceMotionDeviceOrientation = orientation
        ioQueue.async {
            self.deviceMotionArCommittedDepth = self.deviceMotionArDepth
            self.deviceMotionArBaseline = nil
            self.deviceMotionArTrackingValid = false
            self.deviceMotionVelocity = 0
            self.deviceMotionGestureActive = false
            self.deviceMotionAccelFiltered = SIMD3<Double>(repeating: 0)
        }
    }

    // MARK: - Vision

    @objc func startMixedReality(_ call: CAPPluginCall) {
        guard ARWorldTrackingConfiguration.isSupported else {
            call.reject("ARKit não é suportado neste dispositivo")
            return
        }
        DispatchQueue.main.async {
            guard let hostView = self.bridge?.viewController?.view,
                  let webView = self.bridge?.webView else {
                call.reject("Visualização nativa indisponível")
                return
            }
            // ARSCNView becomes the VIO provider while mixed reality is visible.
            self.stopDeviceMotionTrackingSessionInternal(preserveDepth: true)
            self.stopHandTrackingSessionInternal()

            // Restarting an already-running AR session fights AVCapture and
            // floods FigCaptureSourceRemote (-17281) in the Xcode console.
            if let existing = self.mixedRealityView {
                self.applyTransparentWebView(webView, hostView: hostView)
                hostView.insertSubview(existing, belowSubview: webView)
                existing.isHidden = false
                // WebGL over WKWebView does not composite volume shaders reliably.
                // Keep the hologram in SceneKit (proven path — camera + nodes show).
                self.ensureHologram(in: existing)
                call.resolve(["ok": true, "mode": "arkit-world", "reused": true])
                return
            }

            self.applyTransparentWebView(webView, hostView: hostView)

            let arView = ARSCNView(frame: hostView.bounds)
            arView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
            arView.backgroundColor = .black
            arView.automaticallyUpdatesLighting = true
            arView.autoenablesDefaultLighting = true
            arView.rendersContinuously = true
            arView.scene = SCNScene()
            arView.isUserInteractionEnabled = false
            arView.session.delegate = self
            hostView.insertSubview(arView, belowSubview: webView)

            let config = ARWorldTrackingConfiguration()
            config.worldAlignment = .gravity
            config.planeDetection = []
            arView.session.run(config, options: [.resetTracking, .removeExistingAnchors])
            self.mixedRealityView = arView
            self.mixedRealityAnchor = nil
            self.ensureHologram(in: arView)
            call.resolve(["ok": true, "mode": "arkit-world"])
        }
    }

    @objc func stopMixedReality(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.stopMixedRealityInternal()
            call.resolve()
        }
    }

    private func applyTransparentWebView(_ webView: WKWebView, hostView: UIView) {
        hostView.backgroundColor = .clear
        hostView.isOpaque = false
        webView.isOpaque = false
        webView.backgroundColor = .clear
        webView.scrollView.backgroundColor = .clear
        webView.scrollView.isOpaque = false
        webView.layer.isOpaque = false
        webView.layer.backgroundColor = UIColor.clear.cgColor
        webView.scrollView.layer.isOpaque = false
        webView.scrollView.layer.backgroundColor = UIColor.clear.cgColor
        if #available(iOS 15.0, *) {
            webView.underPageBackgroundColor = .clear
        }
    }

    private func stopMixedRealityInternal() {
        guard let arView = mixedRealityView else { return }
        arView.session.delegate = nil
        arView.session.pause()
        arView.removeFromSuperview()
        mixedRealityView = nil
        mixedRealityAnchor = nil
        hologramNode = nil
        if streamMode == "native-device-motion" {
            startDeviceMotionTrackingSessionInternal(preserveDepth: true)
        }
        if handTrackingEnabled {
            startHandTrackingSessionInternal()
        }
    }

    private func makeMixedRealityAnchor(from camera: simd_float4x4) -> simd_float4x4 {
        var translation = matrix_identity_float4x4
        // Place the hologram ~70 cm in front of the phone.
        translation.columns.3.z = -0.70
        return simd_mul(camera, translation)
    }

    private func ensureAnchor(for frame: ARFrame) {
        if mixedRealityAnchor == nil {
            mixedRealityAnchor = makeMixedRealityAnchor(from: frame.camera.transform)
        }
    }

    private func holoMaterial(color: UIColor, opacity: CGFloat) -> SCNMaterial {
        let mat = SCNMaterial()
        mat.diffuse.contents = color.withAlphaComponent(opacity)
        mat.emission.contents = color.withAlphaComponent(min(1, opacity + 0.25))
        mat.transparent.contents = UIColor.white.withAlphaComponent(1 - opacity)
        mat.transparency = 1 - opacity
        mat.lightingModel = .constant
        mat.blendMode = .alpha
        mat.isDoubleSided = true
        mat.writesToDepthBuffer = false
        return mat
    }

    /// Procedural head/brain silhouette in meters — readable as anatomy, not a ring.
    private func makeHologramHeadNode() -> SCNNode {
        let root = SCNNode()
        root.name = "progenia-hologram"

        let head = SCNNode(geometry: SCNSphere(radius: 0.11))
        head.geometry?.materials = [holoMaterial(color: UIColor(red: 0.18, green: 0.85, blue: 1.0, alpha: 1), opacity: 0.42)]
        head.scale = SCNVector3(0.92, 1.12, 0.98)
        head.position = SCNVector3(0, 0.02, 0)
        root.addChildNode(head)

        let brain = SCNNode(geometry: SCNSphere(radius: 0.078))
        brain.geometry?.materials = [holoMaterial(color: UIColor(red: 0.45, green: 0.97, blue: 1.0, alpha: 1), opacity: 0.78)]
        brain.scale = SCNVector3(0.95, 0.88, 1.05)
        brain.position = SCNVector3(0, 0.04, 0.01)
        root.addChildNode(brain)

        let hemisphereL = SCNNode(geometry: SCNSphere(radius: 0.055))
        hemisphereL.geometry?.materials = [holoMaterial(color: UIColor(red: 0.25, green: 0.92, blue: 1.0, alpha: 1), opacity: 0.55)]
        hemisphereL.scale = SCNVector3(0.85, 0.75, 1.1)
        hemisphereL.position = SCNVector3(-0.035, 0.05, 0.015)
        root.addChildNode(hemisphereL)

        let hemisphereR = hemisphereL.clone()
        hemisphereR.position = SCNVector3(0.035, 0.05, 0.015)
        root.addChildNode(hemisphereR)

        let neck = SCNNode(geometry: SCNCylinder(radius: 0.035, height: 0.08))
        neck.geometry?.materials = [holoMaterial(color: UIColor(red: 0.15, green: 0.7, blue: 0.95, alpha: 1), opacity: 0.35)]
        neck.position = SCNVector3(0, -0.12, -0.01)
        root.addChildNode(neck)

        // Subtle scan ring at the cut plane height (visual cue, not the whole hologram).
        let ring = SCNNode(geometry: SCNTorus(ringRadius: 0.095, pipeRadius: 0.004))
        ring.geometry?.materials = [holoMaterial(color: UIColor(red: 0.6, green: 1.0, blue: 1.0, alpha: 1), opacity: 0.9)]
        ring.eulerAngles = SCNVector3(Float.pi / 2, 0, 0)
        ring.position = SCNVector3(0, 0.02, 0)
        root.addChildNode(ring)

        let pulse = SCNAction.repeatForever(
            SCNAction.sequence([
                SCNAction.fadeOpacity(to: 0.75, duration: 1.1),
                SCNAction.fadeOpacity(to: 1.0, duration: 1.1)
            ])
        )
        brain.runAction(pulse)
        return root
    }

    private func ensureHologram(in arView: ARSCNView) {
        if hologramNode?.parent != nil { return }
        hologramNode?.removeFromParentNode()
        let node = makeHologramHeadNode()
        arView.scene.rootNode.addChildNode(node)
        hologramNode = node
        if let anchor = mixedRealityAnchor {
            node.simdWorldTransform = anchor
        } else {
            // Temporary pose until the first ARFrame anchors it in the room.
            node.position = SCNVector3(0, 0, -0.7)
        }
    }

    private func syncHologram(to frame: ARFrame) {
        ensureAnchor(for: frame)
        guard let anchor = mixedRealityAnchor else { return }
        if hologramNode == nil, let arView = mixedRealityView {
            ensureHologram(in: arView)
        }
        hologramNode?.simdWorldTransform = anchor
    }

    @objc func recenterMixedReality(_ call: CAPPluginCall) {
        guard let frame = mixedRealityView?.session.currentFrame else {
            call.reject("ARKit ainda inicializando")
            return
        }
        mixedRealityAnchor = makeMixedRealityAnchor(from: frame.camera.transform)
        hologramNode?.simdWorldTransform = mixedRealityAnchor!
        call.resolve(["ok": true])
    }

    @objc func pollMixedReality(_ call: CAPPluginCall) {
        guard let frame = mixedRealityView?.session.currentFrame else {
            call.resolve(["tracking": false])
            return
        }
        ensureAnchor(for: frame)
        guard let anchor = mixedRealityAnchor else {
            call.resolve(["tracking": false])
            return
        }

        let viewTransform = simd_mul(simd_inverse(frame.camera.transform), anchor)
        let position = viewTransform.columns.3
        let rotation = simd_quatf(viewTransform)
        let tracking: Bool
        switch frame.camera.trackingState {
        case .normal, .limited:
            tracking = true
        case .notAvailable:
            tracking = false
        }
        // Intrinsics → vertical FOV so the WebGL hologram matches ARKit scale.
        let intrinsics = frame.camera.intrinsics
        let imageH = CGFloat(frame.camera.imageResolution.height)
        let fy = CGFloat(intrinsics[1, 1])
        let fovYDeg = 2.0 * atan(Double(imageH) / (2.0 * Double(fy))) * 180.0 / Double.pi
        call.resolve([
            "tracking": tracking,
            "x": Double(position.x),
            "y": Double(position.y),
            "z": Double(position.z),
            "qw": Double(rotation.real),
            "qx": Double(rotation.imag.x),
            "qy": Double(rotation.imag.y),
            "qz": Double(rotation.imag.z),
            "fovY": fovYDeg
        ])
    }

    @objc func detectHand(_ call: CAPPluginCall) {
        guard let base64 = call.getString("base64"), !base64.isEmpty else {
            call.reject("base64 image required")
            return
        }

        let cleaned = base64.replacingOccurrences(of: "data:image/jpeg;base64,", with: "")
            .replacingOccurrences(of: "data:image/png;base64,", with: "")
        guard let data = Data(base64Encoded: cleaned),
              let image = UIImage(data: data),
              let cgImage = image.cgImage else {
            call.resolve(["found": false])
            return
        }

        let request = VNDetectHumanHandPoseRequest()
        request.maximumHandCount = 1
        let handler = VNImageRequestHandler(cgImage: cgImage, orientation: .up, options: [:])
        DispatchQueue.global(qos: .userInitiated).async {
            do {
                try handler.perform([request])
                guard let hand = request.results?.first else {
                    call.resolve(["found": false])
                    return
                }
                let points = try hand.recognizedPoints(.all)
                guard let wrist = points[.wrist],
                      let index = points[.indexMCP],
                      let middle = points[.middleMCP],
                      let ring = points[.ringMCP],
                      let little = points[.littleMCP],
                      [wrist, index, middle, ring, little].allSatisfy({ $0.confidence >= 0.3 }) else {
                    call.resolve(["found": false])
                    return
                }

                // Track only the rigid palm. Fingertips move independently
                // while gripping the sensor and made the previous bounding box
                // jump even when the hand itself was stationary.
                let palmPoints = [wrist.location, index.location, middle.location, ring.location, little.location]
                let center = CGPoint(
                    x: palmPoints.map(\.x).reduce(0, +) / CGFloat(palmPoints.count),
                    y: palmPoints.map(\.y).reduce(0, +) / CGFloat(palmPoints.count)
                )
                var axisX = CGVector(
                    dx: index.location.x - little.location.x,
                    dy: index.location.y - little.location.y
                )
                let width = hypot(axisX.dx, axisX.dy)
                guard width > 0.015 else {
                    call.resolve(["found": false])
                    return
                }
                axisX.dx /= width
                axisX.dy /= width
                var axisY = CGVector(dx: -axisX.dy, dy: axisX.dx)
                let wristToMiddle = CGVector(
                    dx: middle.location.x - wrist.location.x,
                    dy: middle.location.y - wrist.location.y
                )
                if axisY.dx * wristToMiddle.dx + axisY.dy * wristToMiddle.dy < 0 {
                    axisY.dx *= -1
                    axisY.dy *= -1
                }
                let height = max(0.04, hypot(wristToMiddle.dx, wristToMiddle.dy) * 0.78)
                let halfWidth = max(0.035, width * 0.62)

                func corner(_ sx: CGFloat, _ sy: CGFloat) -> [String: Double] {
                    let x = min(1.0, max(0.0, center.x + axisX.dx * halfWidth * sx + axisY.dx * height * sy))
                    let y = min(1.0, max(0.0, center.y + axisX.dy * halfWidth * sx + axisY.dy * height * sy))
                    return ["x": Double(x), "y": Double(1.0 - y)]
                }
                let corners: [[String: Double]] = [
                    corner(-1, 1),
                    corner(1, 1),
                    corner(1, -1),
                    corner(-1, -1)
                ]
                call.resolve([
                    "found": true,
                    "corners": corners,
                    "confidence": Double(hand.confidence),
                    "source": "hand"
                ])
            } catch {
                call.resolve(["found": false])
            }
        }
    }

    // MARK: - Markerless hand tracking

    @objc func startHandTracking(_ call: CAPPluginCall) {
        handTrackingEnabled = true
        ioQueue.async {
            self.handVisible = false
            self.handConfidence = 0
            self.handSampleTimestamp = 0
        }
        startHandTrackingSessionInternal()
        call.resolve(["ok": true, "mode": "vision-hand"])
    }

    @objc func stopHandTracking(_ call: CAPPluginCall) {
        handTrackingEnabled = false
        stopHandTrackingSessionInternal()
        ioQueue.async {
            self.handVisible = false
            self.handConfidence = 0
            self.handSampleTimestamp = 0
        }
        call.resolve(["ok": true])
    }

    @objc func pollHandTracking(_ call: CAPPluginCall) {
        ioQueue.async {
            let payload: [String: Any] = [
                "visible": self.handVisible,
                "centerX": self.handCenterX,
                "centerY": self.handCenterY,
                "palmSpan": self.handPalmSpan,
                "confidence": self.handConfidence,
                "timestamp": self.handSampleTimestamp
            ]
            DispatchQueue.main.async { call.resolve(payload) }
        }
    }

    private func startHandTrackingSessionInternal() {
        let start = { [weak self] in
            guard let self = self,
                  self.handTrackingEnabled,
                  self.mixedRealityView == nil,
                  self.handTrackingSession == nil else { return }
            let session = ARSession()
            session.delegate = self
            let config = ARWorldTrackingConfiguration()
            config.worldAlignment = .gravity
            config.planeDetection = []
            session.run(config, options: [.resetTracking, .removeExistingAnchors])
            self.handTrackingSession = session
        }
        if Thread.isMainThread {
            start()
        } else {
            DispatchQueue.main.async(execute: start)
        }
    }

    private func stopHandTrackingSessionInternal() {
        let stop = { [weak self] in
            guard let self = self else { return }
            self.handTrackingSession?.delegate = nil
            self.handTrackingSession?.pause()
            self.handTrackingSession = nil
        }
        if Thread.isMainThread {
            stop()
        } else {
            DispatchQueue.main.async(execute: stop)
        }
    }

    private func handImageOrientation() -> CGImagePropertyOrientation {
        switch deviceMotionDeviceOrientation {
        case .portraitUpsideDown:
            return .left
        case .landscapeLeft:
            return .up
        case .landscapeRight:
            return .down
        default:
            return .right
        }
    }

    private func processHandTrackingFrame(_ frame: ARFrame) {
        guard handTrackingEnabled,
              !handVisionBusy,
              frame.timestamp - handLastVisionTimestamp >= 1.0 / 15.0 else { return }
        handVisionBusy = true
        handLastVisionTimestamp = frame.timestamp
        let pixelBuffer = frame.capturedImage
        let orientation = handImageOrientation()

        handVisionQueue.async { [weak self] in
            guard let self = self else { return }
            defer { self.handVisionBusy = false }
            let request = VNDetectHumanHandPoseRequest()
            request.maximumHandCount = 1
            let handler = VNImageRequestHandler(
                cvPixelBuffer: pixelBuffer,
                orientation: orientation,
                options: [:]
            )
            do {
                try handler.perform([request])
                guard let hand = request.results?.first else {
                    self.ioQueue.async {
                        self.handVisible = false
                        self.handConfidence = 0
                    }
                    return
                }
                let points = try hand.recognizedPoints(.all)
                guard let wrist = points[.wrist],
                      let index = points[.indexMCP],
                      let middle = points[.middleMCP],
                      let ring = points[.ringMCP],
                      let little = points[.littleMCP] else {
                    self.ioQueue.async { self.handVisible = false }
                    return
                }
                let rigid = [wrist, index, middle, ring, little]
                guard rigid.allSatisfy({ $0.confidence >= 0.25 }) else {
                    self.ioQueue.async { self.handVisible = false }
                    return
                }
                let centerX = rigid.map(\.location.x).reduce(0, +) / CGFloat(rigid.count)
                let centerVisionY = rigid.map(\.location.y).reduce(0, +) / CGFloat(rigid.count)
                let span = hypot(
                    index.location.x - little.location.x,
                    index.location.y - little.location.y
                )
                let confidence =
                    rigid.map { Double($0.confidence) }.reduce(0, +) /
                    Double(rigid.count)
                self.ioQueue.async {
                    guard self.handTrackingEnabled else { return }
                    self.handVisible = true
                    self.handCenterX = Double(centerX)
                    // Vision origin is bottom-left; UI/control origin is top-left.
                    self.handCenterY = Double(1.0 - centerVisionY)
                    self.handPalmSpan = Double(span)
                    self.handConfidence = confidence
                    self.handSampleTimestamp = frame.timestamp
                }
            } catch {
                self.ioQueue.async {
                    self.handVisible = false
                    self.handConfidence = 0
                }
            }
        }
    }

    @objc func isAvailable(_ call: CAPPluginCall) {
        call.resolve([
            "available": true,
            "engine": "vision",
            "stream": true
        ])
    }

    @objc func detectRectangle(_ call: CAPPluginCall) {
        guard let base64 = call.getString("base64"), !base64.isEmpty else {
            call.reject("base64 image required")
            return
        }

        let cleaned = base64.replacingOccurrences(of: "data:image/jpeg;base64,", with: "")
            .replacingOccurrences(of: "data:image/png;base64,", with: "")

        guard let data = Data(base64Encoded: cleaned),
              let image = UIImage(data: data),
              let cgImage = image.cgImage else {
            call.resolve(["found": false])
            return
        }

        let request = VNDetectRectanglesRequest()
        request.minimumAspectRatio = 0.4
        request.maximumAspectRatio = 2.5
        request.minimumSize = 0.12
        request.maximumObservations = 8
        request.quadratureTolerance = 22
        request.minimumConfidence = 0.4

        let handler = VNImageRequestHandler(cgImage: cgImage, orientation: .up, options: [:])
        DispatchQueue.global(qos: .userInitiated).async {
            do {
                try handler.perform([request])
                guard let results = request.results, !results.isEmpty else {
                    call.resolve(["found": false])
                    return
                }

                let best = results.max { a, b in
                    let sa = a.boundingBox.width * a.boundingBox.height * CGFloat(a.confidence)
                    let sb = b.boundingBox.width * b.boundingBox.height * CGFloat(b.confidence)
                    return sa < sb
                }

                guard let rect = best else {
                    call.resolve(["found": false])
                    return
                }

                func flip(_ p: CGPoint) -> [String: Double] {
                    ["x": Double(p.x), "y": Double(1.0 - p.y)]
                }

                let corners: [[String: Double]] = [
                    flip(rect.topLeft),
                    flip(rect.topRight),
                    flip(rect.bottomRight),
                    flip(rect.bottomLeft)
                ]

                call.resolve([
                    "found": true,
                    "corners": corners,
                    "confidence": Double(rect.confidence),
                    "source": "vision"
                ])
            } catch {
                call.resolve(["found": false])
            }
        }
    }

    // MARK: - Stream API

    /**
     * Smartphone/tablet IMU data plane:
     * CoreMotion fuses accelerometer + gyroscope, then uses the same localhost
     * WebSocket frames and JS processing pipeline as the external BLE sensor.
     */
    @objc func startDeviceMotionStream(_ call: CAPPluginCall) {
        stopStreamInternal()
        guard motionManager.isDeviceMotionAvailable else {
            call.reject("Acelerômetro e giroscópio não estão disponíveis neste aparelho.")
            return
        }

        do {
            try localQuatServer.start()
        } catch {
            call.reject("Canal local dos sensores falhou: \(error.localizedDescription)")
            return
        }

        streamMode = "native-device-motion"
        sampleSeq = 0
        rxCount = 0
        lastRxHz = 0
        lastHzTick = Date()
        resetDeviceMotionTranslationInternal()
        startDeviceMotionTrackingSessionInternal(preserveDepth: false)
        motionManager.deviceMotionUpdateInterval = 1.0 / 60.0
        motionManager.showsDeviceMovementDisplay = false

        motionManager.startDeviceMotionUpdates(
            using: .xArbitraryZVertical,
            to: motionQueue
        ) { [weak self] motion, error in
            guard let self = self,
                  self.streamMode == "native-device-motion",
                  let motion = motion,
                  error == nil else { return }

            let q = motion.attitude.quaternion
            let gravity = motion.gravity
            let rotation = motion.rotationRate
            let acceleration = motion.userAcceleration
            let gyroMagnitude = sqrt(
                rotation.x * rotation.x +
                rotation.y * rotation.y +
                rotation.z * rotation.z
            )
            let accelMagnitude = sqrt(
                acceleration.x * acceleration.x +
                acceleration.y * acceleration.y +
                acceleration.z * acceleration.z
            )
            let stationary = gyroMagnitude < 0.045 && accelMagnitude < 0.025

            self.ioQueue.async {
                guard self.streamMode == "native-device-motion" else { return }
                let inertialTranslation = self.updateDeviceMotionTranslation(
                    acceleration: SIMD3(
                        acceleration.x * 9.80665,
                        acceleration.y * 9.80665,
                        acceleration.z * 9.80665
                    ),
                    gyroMagnitude: gyroMagnitude,
                    timestamp: motion.timestamp
                )
                let arFresh =
                    self.deviceMotionArTrackingValid &&
                    Date().timeIntervalSince(self.deviceMotionArLastUpdate) < 0.25
                let translation = arFresh
                    ? self.deviceMotionArDepth
                    : inertialTranslation
                if arFresh {
                    // Keep fallback continuous with VIO if visual tracking drops.
                    self.deviceMotionPosition = translation
                    self.deviceMotionVelocity = 0
                    self.deviceMotionGestureActive = false
                }
                self.pendingW = q.w
                self.pendingX = q.x
                self.pendingY = q.y
                self.pendingZ = q.z
                self.sampleSeq &+= 1
                self.pendingDirty = true
                self.rxCount &+= 1

                let now = Date()
                if now.timeIntervalSince(self.lastHzTick) >= 1.0 {
                    self.lastRxHz = self.rxCount
                    self.rxCount = 0
                    self.lastHzTick = now
                }

                // CoreMotion gravity is expressed in g; scale to the same
                // m/s² convention used by the BNO085 stream.
                let g = 9.80665
                self.localQuatServer.broadcast(
                    w: q.w, x: q.x, y: q.y, z: q.z,
                    gravityX: gravity.x * g,
                    gravityY: gravity.y * g,
                    gravityZ: gravity.z * g,
                    hasGravity: true,
                    seq: self.sampleSeq,
                    accelAccuracy: 3,
                    gyroAccuracy: 3,
                    stationary: stationary,
                    calibrationReady: true,
                    translationPosition: translation,
                    translationX: 0,
                    translationY: 0,
                    translationZ: translation
                )
            }
        }

        call.resolve(["ok": true, "mode": "native-device-motion"])
    }

    @objc func resetDeviceMotionTranslation(_ call: CAPPluginCall) {
        ioQueue.async {
            self.resetDeviceMotionTranslationInternal()
            DispatchQueue.main.async {
                call.resolve(["ok": true])
            }
        }
    }

    private func resetDeviceMotionTranslationInternal() {
        deviceMotionBias = SIMD3<Double>(repeating: 0)
        deviceMotionAccelFiltered = SIMD3<Double>(repeating: 0)
        deviceMotionVelocity = 0
        deviceMotionPosition = 0
        deviceMotionLastTimestamp = 0
        deviceMotionQuietSince = 0
        deviceMotionTranslationResumeAt = 0
        deviceMotionGestureActive = false
        deviceMotionArBaseline = nil
        deviceMotionArCommittedDepth = 0
        deviceMotionArDepth = 0
        deviceMotionArLastUpdate = .distantPast
        deviceMotionArTrackingValid = false
    }

    /** Hidden ARKit VIO session used only as an absolute translation reference. */
    private func startDeviceMotionTrackingSessionInternal(preserveDepth: Bool) {
        guard ARWorldTrackingConfiguration.isSupported,
              mixedRealityView == nil else { return }
        let start = { [weak self] in
            guard let self = self,
                  self.streamMode == "native-device-motion",
                  self.mixedRealityView == nil,
                  self.deviceMotionTrackingSession == nil else { return }
            if preserveDepth {
                self.ioQueue.async {
                    self.deviceMotionArCommittedDepth = self.deviceMotionArDepth
                    self.deviceMotionArBaseline = nil
                    self.deviceMotionArTrackingValid = false
                }
            }
            let session = ARSession()
            session.delegate = self
            let config = ARWorldTrackingConfiguration()
            config.worldAlignment = .gravity
            config.planeDetection = []
            session.run(config, options: [.resetTracking, .removeExistingAnchors])
            self.deviceMotionTrackingSession = session
        }
        if Thread.isMainThread {
            start()
        } else {
            DispatchQueue.main.async(execute: start)
        }
    }

    private func stopDeviceMotionTrackingSessionInternal(preserveDepth: Bool) {
        let stop = { [weak self] in
            guard let self = self else { return }
            self.deviceMotionTrackingSession?.delegate = nil
            self.deviceMotionTrackingSession?.pause()
            self.deviceMotionTrackingSession = nil
            self.ioQueue.async {
                if preserveDepth {
                    self.deviceMotionArCommittedDepth = self.deviceMotionArDepth
                }
                self.deviceMotionArBaseline = nil
                self.deviceMotionArTrackingValid = false
            }
        }
        if Thread.isMainThread {
            stop()
        } else {
            DispatchQueue.main.async(execute: stop)
        }
    }

    private func ingestDeviceMotionArFrame(_ frame: ARFrame) {
        let transform = frame.camera.transform
        let position = SIMD3<Float>(
            transform.columns.3.x,
            transform.columns.3.y,
            transform.columns.3.z
        )
        // ARKit uses landscape-native camera axes. Select the current screen's
        // top/bottom direction and preserve the app's established depth sign.
        let axisColumn: SIMD4<Float>
        let axisSign: Float
        switch deviceMotionDeviceOrientation {
        case .portraitUpsideDown:
            axisColumn = transform.columns.0
            axisSign = 1
        case .landscapeLeft:
            axisColumn = transform.columns.1
            axisSign = 1
        case .landscapeRight:
            axisColumn = transform.columns.1
            axisSign = -1
        default:
            axisColumn = transform.columns.0
            axisSign = -1
        }
        let verticalAxis = simd_normalize(SIMD3<Float>(
            axisColumn.x * axisSign,
            axisColumn.y * axisSign,
            axisColumn.z * axisSign
        ))
        let trackingNormal: Bool
        switch frame.camera.trackingState {
        case .normal:
            trackingNormal = true
        case .limited, .notAvailable:
            trackingNormal = false
        }

        ioQueue.async {
            guard self.streamMode == "native-device-motion" else { return }
            guard trackingNormal else {
                if self.deviceMotionArTrackingValid {
                    self.deviceMotionArCommittedDepth = self.deviceMotionArDepth
                }
                self.deviceMotionArBaseline = nil
                self.deviceMotionArTrackingValid = false
                return
            }

            guard let baseline = self.deviceMotionArBaseline else {
                self.deviceMotionArBaseline = position
                self.deviceMotionArAxis = verticalAxis
                // Continue from the inertial fallback without a source-change jump.
                self.deviceMotionArCommittedDepth = self.deviceMotionPosition
                self.deviceMotionArDepth = self.deviceMotionPosition
                self.deviceMotionArLastUpdate = Date()
                self.deviceMotionArTrackingValid = true
                return
            }

            let displacement = position - baseline
            let projected = Double(simd_dot(displacement, self.deviceMotionArAxis))
            let target = min(
                0.30,
                max(-0.30, self.deviceMotionArCommittedDepth + projected)
            )
            let error = target - self.deviceMotionArDepth
            // Sub-millimeter hold plus a fast correction gives stable precision
            // without making hand movement feel delayed.
            if abs(error) >= 0.0008 {
                self.deviceMotionArDepth += error * 0.68
            }
            self.deviceMotionArLastUpdate = Date()
            self.deviceMotionArTrackingValid = true
        }
    }

    /**
     * Same ZUPT-style push/pull integrator used by the ESP32 firmware.
     * CoreMotion already removes gravity in userAcceleration.
     */
    private func updateDeviceMotionTranslation(
        acceleration: SIMD3<Double>,
        gyroMagnitude: Double,
        timestamp: Double
    ) -> Double {
        guard deviceMotionLastTimestamp > 0 else {
            deviceMotionLastTimestamp = timestamp
            return deviceMotionPosition
        }

        let dt = min(0.04, timestamp - deviceMotionLastTimestamp)
        deviceMotionLastTimestamp = timestamp
        guard dt > 0 else { return deviceMotionPosition }

        // Turning creates acceleration transients without real translation.
        // Ignore them and wait briefly for the device to settle before a
        // push/pull gesture may move the slice again.
        if gyroMagnitude >= 0.12 {
            deviceMotionTranslationResumeAt = timestamp + 0.25
            deviceMotionVelocity = 0
            deviceMotionGestureActive = false
            deviceMotionAccelFiltered = SIMD3<Double>(repeating: 0)
            deviceMotionQuietSince = 0
            return deviceMotionPosition
        }
        if timestamp < deviceMotionTranslationResumeAt {
            deviceMotionVelocity = 0
            deviceMotionGestureActive = false
            deviceMotionAccelFiltered = SIMD3<Double>(repeating: 0)
            return deviceMotionPosition
        }

        var unbiased = acceleration - deviceMotionBias
        let accelMagnitude = simd_length(unbiased)
        let quietCandidate = gyroMagnitude < 0.08 && accelMagnitude < 0.045
        if quietCandidate {
            if deviceMotionQuietSince == 0 {
                deviceMotionQuietSince = timestamp
            }
        } else {
            deviceMotionQuietSince = 0
        }
        let quietDuration =
            deviceMotionQuietSince > 0 ? timestamp - deviceMotionQuietSince : 0

        // Do not absorb a slow intentional push into the bias. Bias learning
        // starts only after the phone has been genuinely quiet for 350 ms.
        if quietDuration >= 0.35 {
            deviceMotionBias += (acceleration - deviceMotionBias) * 0.025
            unbiased = acceleration - deviceMotionBias
        }

        // CoreMotion is cleaner than raw accel: a faster LPF removes latency.
        deviceMotionAccelFiltered +=
            (unbiased - deviceMotionAccelFiltered) * 0.58
        // Screen-vertical acceleration follows the active interface orientation.
        var a: Double
        switch deviceMotionDeviceOrientation {
        case .portraitUpsideDown:
            a = deviceMotionAccelFiltered.y
        case .landscapeLeft:
            a = deviceMotionAccelFiltered.x
        case .landscapeRight:
            a = -deviceMotionAccelFiltered.x
        default:
            a = -deviceMotionAccelFiltered.y
        }
        if abs(a) < 0.022 { a = 0 }

        // Require a clear impulse to start. This prevents idle noise from ever
        // entering the double integrator, while preserving small motion once active.
        if !deviceMotionGestureActive {
            guard abs(a) >= 0.16 else { return deviceMotionPosition }
            deviceMotionGestureActive = true
        }

        // ZUPT after a short sustained rest: stop drift and hold the cut exactly.
        if quietDuration >= 0.12 {
            deviceMotionVelocity = 0
            deviceMotionGestureActive = false
            deviceMotionAccelFiltered = SIMD3<Double>(repeating: 0)
            return deviceMotionPosition
        }

        deviceMotionVelocity += a * dt
        if a * deviceMotionVelocity < 0 {
            deviceMotionVelocity *= exp(-12.0 * dt)
            if abs(deviceMotionVelocity) < 0.012 {
                deviceMotionVelocity = 0
            }
        } else {
            deviceMotionVelocity *= exp(-0.65 * dt)
        }

        deviceMotionVelocity = min(0.90, max(-0.90, deviceMotionVelocity))
        // A phone IMU is noisier than the dedicated probe. Keep push/pull
        // deliberately conservative so an idle device never drifts the slice.
        deviceMotionPosition += deviceMotionVelocity * dt * 1.5
        if deviceMotionPosition > 0.15 {
            deviceMotionPosition = 0.15
            deviceMotionVelocity = 0
        } else if deviceMotionPosition < -0.15 {
            deviceMotionPosition = -0.15
            deviceMotionVelocity = 0
        }
        return deviceMotionPosition
    }

    /**
     * BLE stream without @capacitor-community/bluetooth-le notifications.
     * CoreBluetooth consumes compact 20-byte packets natively and forwards
     * samples through localhost WebSocket, avoiding WKWebView bridge pressure.
     */
    @objc func startBleStream(_ call: CAPPluginCall) {
        stopStreamInternal()
        streamMode = "native-ble"
        call.keepAlive = true
        bleStartCall = call
        bleWarmupRetries = 0
        bleOpenNameScan = false
        bleConnectAttempts = 0
        if let id = call.getString("deviceId") {
            bleTargetIdentifier = UUID(uuidString: id)
        } else {
            bleTargetIdentifier = nil
        }

        do {
            try localQuatServer.start()
        } catch {
            bleStartCall = nil
            call.reject("local ws failed: \(error.localizedDescription)")
            return
        }

        notifyListeners("streamStatus", data: [
            "state": "connecting",
            "message": "Ativando Bluetooth…"
        ])

        // Main queue matches @capacitor-community/bluetooth-le and is required for
        // the iPadOS Bluetooth permission sheet / poweredOn callbacks to fire.
        // High-rate notifies are bounced to ioQueue in didUpdateValueFor.
        let startCentral = { [weak self] in
            guard let self = self else { return }
            let central = CBCentralManager(
                delegate: self,
                queue: .main,
                options: [CBCentralManagerOptionShowPowerAlertKey: true]
            )
            self.bleCentral = central
        }
        if Thread.isMainThread {
            startCentral()
        } else {
            DispatchQueue.main.async(execute: startCentral)
        }

        // iPad / first-pair often needs longer than a warm iPhone reconnect-by-cache.
        let timeout = DispatchWorkItem { [weak self] in
            guard let self = self, let pending = self.bleStartCall else { return }
            self.bleStartCall = nil
            pending.reject(
                "Timeout BLE (45 s). Feche o ProGenia no iPhone (a moldura só aceita 1 aparelho), " +
                "aproxime a moldura do iPad e confira Ajustes → ProGenia → Bluetooth. " +
                "Se ainda falhar, regrave o firmware da moldura."
            )
            self.streamMode = nil
            self.stopBleInternal()
            self.localQuatServer.stop()
        }
        bleTimeout = timeout
        DispatchQueue.main.asyncAfter(deadline: .now() + 45, execute: timeout)
    }

    private func beginBleScan(_ central: CBCentralManager, openNameScan: Bool) {
        bleOpenNameScan = openNameScan
        central.stopScan()
        let services: [CBUUID]? = openNameScan ? nil : [frameServiceUUID]
        let label = openNameScan ? "scan_name" : "scan_service"
        NSLog("ProgeniaBLE \(label)")
        notifyListeners("streamStatus", data: [
            "state": "connecting",
            "message": openNameScan
                ? "Procurando moldura pelo nome…"
                : "Procurando moldura por Bluetooth…"
        ])
        // allowDuplicates helps flaky iPad radios catch the first ADV burst.
        central.scanForPeripherals(
            withServices: services,
            options: [CBCentralManagerScanOptionAllowDuplicatesKey: true]
        )
    }

    private func scheduleBleNameScanFallback(_ central: CBCentralManager) {
        bleScanFallbackWork?.cancel()
        let work = DispatchWorkItem { [weak self] in
            guard let self = self,
                  self.bleStartCall != nil,
                  self.blePeripheral == nil,
                  self.streamMode == "native-ble" else { return }
            self.beginBleScan(central, openNameScan: true)
        }
        bleScanFallbackWork = work
        DispatchQueue.main.asyncAfter(deadline: .now() + 5, execute: work)
    }

    private func scheduleBleServiceScanFallback(_ central: CBCentralManager) {
        bleScanFallbackWork?.cancel()
        let work = DispatchWorkItem { [weak self] in
            guard let self = self,
                  self.bleStartCall != nil,
                  self.blePeripheral == nil,
                  self.streamMode == "native-ble" else { return }
            self.beginBleScan(central, openNameScan: false)
        }
        bleScanFallbackWork = work
        DispatchQueue.main.asyncAfter(deadline: .now() + 6, execute: work)
    }

    private func connectFramePeripheral(
        _ peripheral: CBPeripheral,
        central: CBCentralManager
    ) {
        blePeripheral = peripheral
        peripheral.delegate = self
        // Brief settle after stopScan — iPadOS often drops the first connect()
        // if it races the scan teardown.
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) { [weak self] in
            guard let self = self,
                  self.bleStartCall != nil,
                  self.blePeripheral?.identifier == peripheral.identifier,
                  peripheral.state != .connected else { return }
            NSLog(
                "ProgeniaBLE connect_attempt=%d id=%@",
                self.bleConnectAttempts + 1,
                peripheral.identifier.uuidString
            )
            central.connect(peripheral, options: nil)
            self.scheduleBleConnectWatchdog(peripheral, central: central)
        }
    }

    private func scheduleBleConnectWatchdog(
        _ peripheral: CBPeripheral,
        central: CBCentralManager
    ) {
        bleConnectWatchdog?.cancel()
        let work = DispatchWorkItem { [weak self] in
            guard let self = self,
                  self.bleStartCall != nil,
                  self.streamMode == "native-ble",
                  self.blePeripheral?.identifier == peripheral.identifier,
                  peripheral.state != .connected else { return }

            self.bleConnectAttempts += 1
            if self.bleConnectAttempts < 3 {
                NSLog("ProgeniaBLE connect_timeout → retry %d", self.bleConnectAttempts)
                central.cancelPeripheralConnection(peripheral)
                self.notifyListeners("streamStatus", data: [
                    "state": "connecting",
                    "message": "Tentando conectar de novo…"
                ])
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) {
                    guard self.bleStartCall != nil,
                          self.blePeripheral?.identifier == peripheral.identifier else { return }
                    self.connectFramePeripheral(peripheral, central: central)
                }
                return
            }

            NSLog("ProgeniaBLE connect_timeout → rescan")
            central.cancelPeripheralConnection(peripheral)
            self.blePeripheral = nil
            self.bleConnectAttempts = 0
            self.notifyListeners("streamStatus", data: [
                "state": "connecting",
                "message": "Conexão travou · procurando de novo…"
            ])
            self.beginBleScan(central, openNameScan: false)
            self.scheduleBleNameScanFallback(central)
        }
        bleConnectWatchdog = work
        // iPad ATT can sit in .connecting longer than a phone.
        DispatchQueue.main.asyncAfter(deadline: .now() + 15, execute: work)
    }

    @objc func startUdpStream(_ call: CAPPluginCall) {
        let portValue = call.getInt("port") ?? 9091
        stopStreamInternal()

        let fd = socket(AF_INET, SOCK_DGRAM, IPPROTO_UDP)
        guard fd >= 0 else {
            call.reject("udp socket failed")
            return
        }

        var yes: Int32 = 1
        _ = setsockopt(fd, SOL_SOCKET, SO_REUSEADDR, &yes, socklen_t(MemoryLayout<Int32>.size))
        _ = setsockopt(fd, SOL_SOCKET, SO_REUSEPORT, &yes, socklen_t(MemoryLayout<Int32>.size))

        var addr = sockaddr_in()
        addr.sin_len = UInt8(MemoryLayout<sockaddr_in>.size)
        addr.sin_family = sa_family_t(AF_INET)
        addr.sin_port = in_port_t(UInt16(portValue).bigEndian)
        addr.sin_addr = in_addr(s_addr: INADDR_ANY.bigEndian)

        let bindOk = withUnsafePointer(to: &addr) {
            $0.withMemoryRebound(to: sockaddr.self, capacity: 1) {
                bind(fd, $0, socklen_t(MemoryLayout<sockaddr_in>.size))
            }
        }
        guard bindOk == 0 else {
            close(fd)
            call.reject("udp bind :\(portValue) failed")
            return
        }

        udpFd = fd
        streamMode = "native-udp"
        do {
            try localQuatServer.start()
        } catch {
            close(fd)
            udpFd = -1
            call.reject("local ws failed: \(error.localizedDescription)")
            return
        }

        let source = DispatchSource.makeReadSource(fileDescriptor: fd, queue: ioQueue)
        source.setEventHandler { [weak self] in
            self?.drainUdp()
        }
        source.setCancelHandler {
            close(fd)
        }
        udpSource = source
        source.resume()

        call.resolve(["ok": true, "mode": "native-udp", "port": portValue])
    }

    @objc func startTcpStream(_ call: CAPPluginCall) {
        let host = call.getString("host") ?? "192.168.4.1"
        let portValue = call.getInt("port") ?? 83
        guard let port = NWEndpoint.Port(rawValue: UInt16(portValue)) else {
            call.reject("invalid port")
            return
        }

        stopStreamInternal()
        tcpConnectCall = call
        tcpDidResolve = false
        streamMode = "native-tcp"

        let conn = NWConnection(host: NWEndpoint.Host(host), port: port, using: .tcp)
        tcpConnection = conn

        conn.stateUpdateHandler = { [weak self] state in
            guard let self = self else { return }
            switch state {
            case .ready:
                do {
                    try self.localQuatServer.start()
                } catch {
                    self.rejectTcpOnce("local ws failed: \(error.localizedDescription)")
                    self.stopStreamInternal()
                    return
                }
                self.receiveTcp()
                self.resolveTcpOnce(["ok": true, "mode": "native-tcp", "host": host, "port": portValue])
            case .failed(let error):
                self.rejectTcpOnce("tcp failed: \(error.localizedDescription)")
                self.notifyListeners("streamStatus", data: [
                    "state": "error",
                    "message": error.localizedDescription
                ])
                self.stopStreamInternal()
            case .cancelled:
                self.notifyListeners("streamStatus", data: ["state": "idle"])
            default:
                break
            }
        }
        conn.start(queue: ioQueue)

        ioQueue.asyncAfter(deadline: .now() + 5) { [weak self] in
            guard let self = self, !self.tcpDidResolve else { return }
            self.rejectTcpOnce("timeout abrindo TCP :\(portValue)")
            self.stopStreamInternal()
        }
    }

    @objc func stopStream(_ call: CAPPluginCall) {
        stopStreamInternal()
        call.resolve()
    }

    /**
     * iPad data plane: Capacitor BLE owns connect/GATT; orientation notifies are
     * forwarded natively (NotificationCenter) into localhost WS — not per-sample
     * Capacitor bridge events.
     */
    @objc func startCapacitorImuRelay(_ call: CAPPluginCall) {
        stopCapacitorImuRelayInternal()
        do {
            try localQuatServer.start()
        } catch {
            call.reject("local ws failed: \(error.localizedDescription)")
            return
        }
        UserDefaults.standard.set(true, forKey: "ProgeniaBleRelayActive")
        streamMode = "capacitor-ble-relay"
        NSLog("ProgeniaRelay started")
        sampleSeq = 0
        rxCount = 0
        lastRxHz = 0
        lastHzTick = Date()
        lastBlePacketAt = Date()
        capacitorRelayObserver = NotificationCenter.default.addObserver(
            forName: NSNotification.Name("ProgeniaBleImuPacket"),
            object: nil,
            queue: nil
        ) { [weak self] note in
            guard let self = self,
                  self.streamMode == "capacitor-ble-relay",
                  let data = note.userInfo?["data"] as? Data else { return }
            self.ioQueue.async {
                self.ingestBlePacket(data)
            }
        }
        call.resolve(["ok": true, "mode": "capacitor-ble-relay"])
    }

    @objc func stopCapacitorImuRelay(_ call: CAPPluginCall) {
        stopCapacitorImuRelayInternal()
        call.resolve()
    }

    private func stopCapacitorImuRelayInternal() {
        UserDefaults.standard.set(false, forKey: "ProgeniaBleRelayActive")
        if let observer = capacitorRelayObserver {
            NotificationCenter.default.removeObserver(observer)
            capacitorRelayObserver = nil
        }
        if streamMode == "capacitor-ble-relay" {
            NSLog("ProgeniaRelay stopped")
            streamMode = nil
            localQuatServer.stop()
        }
    }

    @objc func sendBleCommand(_ call: CAPPluginCall) {
        guard streamMode == "native-ble",
              let peripheral = blePeripheral,
              let characteristic = bleCommandCharacteristic,
              let command = call.getString("command"),
              !command.isEmpty else {
            call.reject("Moldura BLE não está pronta para comandos.")
            return
        }
        peripheral.writeValue(Data(command.utf8), for: characteristic, type: .withoutResponse)
        call.resolve(["ok": true])
    }

    /// Latest sample for JS pull (avoids slow notifyListeners bridge).
    @objc func pollOrientation(_ call: CAPPluginCall) {
        ioQueue.async {
            let payload: [String: Any] = [
                "ok": self.sampleSeq > 0,
                "w": self.pendingW,
                "x": self.pendingX,
                "y": self.pendingY,
                "z": self.pendingZ,
                "seq": self.sampleSeq,
                "rxHz": self.lastRxHz,
                "wsTxHz": self.localQuatServer.lastTxHz,
                "wsClients": self.localQuatServer.clientCount
            ]
            DispatchQueue.main.async { call.resolve(payload) }
        }
    }

    /// TCP reachability for LAN discovery (bypasses WKWebView fetch).
    @objc func pingHost(_ call: CAPPluginCall) {
        let host = call.getString("host") ?? ""
        let portValue = call.getInt("port") ?? 80
        let timeoutMs = call.getInt("timeoutMs") ?? 2000
        guard !host.isEmpty, let port = NWEndpoint.Port(rawValue: UInt16(portValue)) else {
            call.reject("host/port required")
            return
        }

        let conn = NWConnection(host: NWEndpoint.Host(host), port: port, using: .tcp)
        var finished = false
        let finish: (Result<Void, Error>) -> Void = { result in
            guard !finished else { return }
            finished = true
            conn.cancel()
            DispatchQueue.main.async {
                switch result {
                case .success:
                    call.resolve(["ok": true, "host": host, "port": portValue])
                case .failure(let error):
                    call.reject(error.localizedDescription)
                }
            }
        }

        conn.stateUpdateHandler = { state in
            switch state {
            case .ready:
                finish(.success(()))
            case .failed(let error):
                finish(.failure(error))
            default:
                break
            }
        }
        conn.start(queue: ioQueue)
        ioQueue.asyncAfter(deadline: .now() + .milliseconds(timeoutMs)) {
            if !finished {
                finish(.failure(NSError(domain: "ProgeniaFrame", code: 408, userInfo: [
                    NSLocalizedDescriptionKey: "timeout \(host):\(portValue)"
                ])))
            }
        }
    }

    /// Scan iPhone Personal Hotspot subnet for frame TCP :83 (HTTP discovery often fails in WKWebView).
    @objc func scanFrameHosts(_ call: CAPPluginCall) {
        let portValue = call.getInt("port") ?? 83
        let timeoutMs = call.getInt("timeoutMs") ?? 600
        let hostFirst = call.getInt("hostFirst") ?? 2
        let hostLast = call.getInt("hostLast") ?? 32
        let subnet = call.getString("subnet") ?? "172.20.10"
        guard let port = NWEndpoint.Port(rawValue: UInt16(portValue)) else {
            call.reject("invalid port")
            return
        }

        var hostnames: [String] = ["progenia-frame.local"]
        if hostLast >= hostFirst {
            for i in hostFirst...hostLast {
                hostnames.append("\(subnet).\(i)")
            }
        }

        var found: [String] = []
        let lock = NSLock()
        let group = DispatchGroup()

        for host in hostnames {
            group.enter()
            let conn = NWConnection(host: NWEndpoint.Host(host), port: port, using: .tcp)
            var finished = false
            let finish: (Bool) -> Void = { ok in
                lock.lock()
                defer { lock.unlock() }
                guard !finished else { return }
                finished = true
                conn.cancel()
                if ok {
                    found.append(host)
                }
                group.leave()
            }
            conn.stateUpdateHandler = { state in
                switch state {
                case .ready:
                    finish(true)
                case .failed:
                    finish(false)
                default:
                    break
                }
            }
            conn.start(queue: ioQueue)
            ioQueue.asyncAfter(deadline: .now() + .milliseconds(timeoutMs)) {
                finish(false)
            }
        }

        group.notify(queue: .main) {
            var seen = Set<String>()
            let ordered = found.filter { seen.insert($0).inserted }
            call.resolve(["hosts": ordered])
        }
    }

    // MARK: - Internals

    private func resolveTcpOnce(_ data: [String: Any]) {
        guard !tcpDidResolve else { return }
        tcpDidResolve = true
        let call = tcpConnectCall
        tcpConnectCall = nil
        DispatchQueue.main.async { call?.resolve(data) }
    }

    private func rejectTcpOnce(_ message: String) {
        guard !tcpDidResolve else { return }
        tcpDidResolve = true
        let call = tcpConnectCall
        tcpConnectCall = nil
        DispatchQueue.main.async { call?.reject(message) }
    }

    private func stopStreamInternal() {
        pendingDirty = false
        lineBuffer.removeAll(keepingCapacity: false)
        sampleSeq = 0
        rxCount = 0
        lastRxHz = 0
        motionManager.stopDeviceMotionUpdates()
        stopDeviceMotionTrackingSessionInternal(preserveDepth: false)
        resetDeviceMotionTranslationInternal()
        stopCapacitorImuRelayInternal()
        localQuatServer.stop()
        stopBleInternal()

        udpSource?.cancel()
        udpSource = nil
        udpFd = -1

        tcpConnection?.stateUpdateHandler = nil
        tcpConnection?.cancel()
        tcpConnection = nil
        streamMode = nil
    }

    private func stopBleInternal() {
        bleTimeout?.cancel()
        bleTimeout = nil
        bleScanFallbackWork?.cancel()
        bleScanFallbackWork = nil
        bleConnectWatchdog?.cancel()
        bleConnectWatchdog = nil
        bleRateProbe?.cancel()
        bleRateProbe = nil
        bleReconnectWork?.cancel()
        bleReconnectWork = nil
        bleWatchdog?.cancel()
        bleWatchdog = nil
        if let central = bleCentral, let peripheral = blePeripheral {
            if let characteristic = bleOrientationCharacteristic {
                peripheral.setNotifyValue(false, for: characteristic)
            }
            central.cancelPeripheralConnection(peripheral)
        }
        bleCentral?.stopScan()
        bleOrientationCharacteristic = nil
        bleCommandCharacteristic = nil
        blePeripheral = nil
        bleCentral = nil
        bleWarmupRetries = 0
        bleReconnectAttempt = 0
        bleRecoveryInProgress = false
        bleLowRateTicks = 0
        bleRateRecoveryCount = 0
        bleConnectAttempts = 0
        bleOpenNameScan = false
        if let pending = bleStartCall {
            bleStartCall = nil
            pending.reject("BLE stream stopped")
        }
    }

    private func drainUdp() {
        var buf = [UInt8](repeating: 0, count: 2048)
        while true {
            let n = recv(udpFd, &buf, buf.count, MSG_DONTWAIT)
            if n <= 0 { break }
            ingest(Data(buf[0..<n]))
        }
    }

    private func receiveTcp() {
        guard let connection = tcpConnection else { return }
        connection.receive(minimumIncompleteLength: 1, maximumLength: 4096) { [weak self] data, _, isComplete, error in
            guard let self = self else { return }
            if let data = data, !data.isEmpty {
                self.ingest(data)
            }
            if let error = error {
                self.notifyListeners("streamStatus", data: [
                    "state": "error",
                    "message": error.localizedDescription
                ])
                self.stopStreamInternal()
                return
            }
            if isComplete {
                self.notifyListeners("streamStatus", data: ["state": "closed"])
                self.stopStreamInternal()
                return
            }
            self.receiveTcp()
        }
    }

    private func ingest(_ data: Data) {
        lineBuffer.append(data)
        while let range = lineBuffer.range(of: Data([0x0A])) {
            let lineData = lineBuffer.subdata(in: lineBuffer.startIndex..<range.lowerBound)
            lineBuffer.removeSubrange(lineBuffer.startIndex..<range.upperBound)
            guard let line = String(data: lineData, encoding: .utf8)?
                .trimmingCharacters(in: .whitespacesAndNewlines),
                  line.hasPrefix("{"),
                  let payload = line.data(using: .utf8),
                  let json = try? JSONSerialization.jsonObject(with: payload) as? [String: Any],
                  let w = Self.asDouble(json["w"]),
                  let x = Self.asDouble(json["x"]),
                  let y = Self.asDouble(json["y"]),
                  let z = Self.asDouble(json["z"])
            else { continue }
            let gx = Self.asDouble(json["gx"])
            let gy = Self.asDouble(json["gy"])
            let gz = Self.asDouble(json["gz"])
            let translationPosition = Self.asDouble(json["dp"]) ?? 0
            let translationX = Self.asDouble(json["dpx"]) ?? 0
            let translationY = Self.asDouble(json["dpy"]) ?? 0
            let translationZ = Self.asDouble(json["dpz"]) ?? translationPosition
            let hasGravity = gx != nil && gy != nil && gz != nil
            pendingW = w
            pendingX = x
            pendingY = y
            pendingZ = z
            sampleSeq &+= 1
            pendingDirty = true
            rxCount &+= 1
            let now = Date()
            if now.timeIntervalSince(lastHzTick) >= 1.0 {
                lastRxHz = rxCount
                rxCount = 0
                lastHzTick = now
            }
            localQuatServer.broadcast(
                w: w, x: x, y: y, z: z,
                gravityX: gx ?? 0, gravityY: gy ?? 0, gravityZ: gz ?? 0,
                hasGravity: hasGravity, seq: sampleSeq,
                translationPosition: translationPosition,
                translationX: translationX,
                translationY: translationY,
                translationZ: translationZ
            )
        }
        if lineBuffer.count > 8192 {
            lineBuffer.removeAll(keepingCapacity: false)
        }
    }

    private static func asDouble(_ value: Any?) -> Double? {
        if let d = value as? Double { return d }
        if let n = value as? NSNumber { return n.doubleValue }
        return nil
    }

    private func ingestBlePacket(_ data: Data) {
        let bytes = [UInt8](data)
        guard bytes.first == 0xB2 else { return }
        let version = bytes[1] & 0x03
        let isV3 = version == 0x03 && data.count >= 26
        let isV2 = version == 0x02 && data.count >= 20
        guard isV2 || isV3 else { return }
        lastBlePacketAt = Date()
        bleRecoveryInProgress = false

        func int16LE(_ offset: Int) -> Int16 {
            let raw = UInt16(bytes[offset]) | (UInt16(bytes[offset + 1]) << 8)
            return Int16(bitPattern: raw)
        }

        let qOff = isV3 ? 10 : 6
        let gOff = isV3 ? 18 : 14
        var w = Double(int16LE(qOff)) / 32767.0
        var x = Double(int16LE(qOff + 2)) / 32767.0
        var y = Double(int16LE(qOff + 4)) / 32767.0
        var z = Double(int16LE(qOff + 6)) / 32767.0
        let qn = sqrt(w * w + x * x + y * y + z * z)
        guard qn > 0.5, qn < 1.5 else { return }
        w /= qn
        x /= qn
        y /= qn
        z /= qn

        let gx = Double(int16LE(gOff)) / 2048.0
        let gy = Double(int16LE(gOff + 2)) / 2048.0
        let gz = Double(int16LE(gOff + 4)) / 2048.0
        let translationX = isV3 ? Double(int16LE(4)) / 10000.0 : 0.0
        let translationY = isV3 ? Double(int16LE(6)) / 10000.0 : 0.0
        let translationZ = isV3 ? Double(int16LE(8)) / 10000.0 : Double(int16LE(4)) / 10000.0
        let translationPosition = isV3 ? translationZ : Double(int16LE(4)) / 10000.0
        let accelAccuracy = (bytes[1] >> 2) & 0x03
        let gyroAccuracy = (bytes[1] >> 4) & 0x03
        let stationary = (bytes[1] & 0x40) != 0
        let calibrationReady = (bytes[1] & 0x80) != 0

        pendingW = w
        pendingX = x
        pendingY = y
        pendingZ = z
        sampleSeq &+= 1
        pendingDirty = true
        rxCount &+= 1
        // Must refresh on every packet — otherwise the stall watchdog thinks the
        // stream died ~3.5 s after connect and keeps REBOOTing into a ~1 Hz loop.
        lastBlePacketAt = Date()
        bleRecoveryInProgress = false
        let now = Date()
        if now.timeIntervalSince(lastHzTick) >= 1.0 {
            lastRxHz = rxCount
            rxCount = 0
            lastHzTick = now
            NSLog(
                "ProgeniaIMU mode=%@ raw_rx_hz=%u ws_tx_hz=%u",
                streamMode ?? "none",
                lastRxHz,
                localQuatServer.lastTxHz
            )
            if lastRxHz >= 12 {
                bleLowRateTicks = 0
                bleRateRecoveryCount = 0
            }
        }
        localQuatServer.broadcast(
            w: w, x: x, y: y, z: z,
            gravityX: gx, gravityY: gy, gravityZ: gz,
            hasGravity: true, seq: sampleSeq,
            accelAccuracy: accelAccuracy, gyroAccuracy: gyroAccuracy,
            stationary: stationary, calibrationReady: calibrationReady,
            translationPosition: translationPosition,
            translationX: translationX,
            translationY: translationY,
            translationZ: translationZ
        )
    }

    private func sendConnFast(_ peripheral: CBPeripheral) {
        guard let command = bleCommandCharacteristic else { return }
        peripheral.writeValue(
            Data("CONN_FAST".utf8),
            for: command,
            type: .withoutResponse
        )
    }

    private func kickSlowLink(_ peripheral: CBPeripheral) {
        guard let central = bleCentral else { return }
        NSLog("ProgeniaBLE kick_slow_link")
        sendConnFast(peripheral)
        if let characteristic = bleOrientationCharacteristic {
            peripheral.setNotifyValue(false, for: characteristic)
        }
        central.cancelPeripheralConnection(peripheral)
    }

    private func finishBleHandshake(peripheral: CBPeripheral) {
        bleTimeout?.cancel()
        bleTimeout = nil
        bleRateProbe?.cancel()
        bleRateProbe = nil
        bleConnectWatchdog?.cancel()
        bleConnectWatchdog = nil
        sendConnFast(peripheral)
        let call = bleStartCall
        bleStartCall = nil
        lastBlePacketAt = Date()
        startBleWatchdog()
        call?.resolve([
            "ok": true,
            "mode": "native-ble",
            "deviceId": peripheral.identifier.uuidString,
            "name": peripheral.name ?? "ProGenia Frame"
        ])
    }

    /**
     * Wait for GATT notifies — do NOT send REBOOT during handshake.
     * iPad cold ATT often opens at ~1 Hz; CONN_FAST + one soft reconnect
     * during handshake usually lands on ~30 Hz before the UI enters streaming.
     */
    private func validateBleRate(_ peripheral: CBPeripheral) {
        bleRateProbe?.cancel()
        let startSeq = sampleSeq
        notifyListeners("streamStatus", data: [
            "state": "connecting",
            "message": "Moldura encontrada · validando stream…"
        ])

        func scheduleProbe(after seconds: Double, phase: Int) {
            let probe = DispatchWorkItem { [weak self, weak peripheral] in
                guard let self = self,
                      let peripheral = peripheral,
                      self.streamMode == "native-ble",
                      self.bleStartCall != nil else { return }

                let received = self.sampleSeq &- startSeq
                NSLog("ProgeniaBLE rate_probe samples=%u phase=%d", received, phase)

                if received >= 8 {
                    self.finishBleHandshake(peripheral: peripheral)
                    return
                }

                if phase == 0 {
                    self.sendConnFast(peripheral)
                    if received >= 1 {
                        self.notifyListeners("streamStatus", data: [
                            "state": "connecting",
                            "message": "Acelerando link Bluetooth…"
                        ])
                        scheduleProbe(after: 1.5, phase: 1)
                        return
                    }
                    scheduleProbe(after: 2.0, phase: 0)
                    return
                }

                if phase == 1 && received >= 1 && received < 8 && self.bleWarmupRetries < 1 {
                    self.bleWarmupRetries += 1
                    self.notifyListeners("streamStatus", data: [
                        "state": "connecting",
                        "message": "Link lento · reconectando…"
                    ])
                    self.kickSlowLink(peripheral)
                    scheduleProbe(after: 2.5, phase: 2)
                    return
                }

                if received >= 3 || (phase >= 1 && received >= 1) {
                    self.finishBleHandshake(peripheral: peripheral)
                    return
                }

                if phase >= 2 {
                    let call = self.bleStartCall
                    self.bleStartCall = nil
                    call?.reject(
                        "BLE conectou no iPad, mas o stream IMU não chegou. " +
                        "Aproxime a moldura, feche o app no iPhone e tente de novo."
                    )
                    self.streamMode = nil
                    self.stopBleInternal()
                    self.localQuatServer.stop()
                }
            }
            self.bleRateProbe = probe
            DispatchQueue.main.asyncAfter(deadline: .now() + seconds, execute: probe)
        }

        scheduleProbe(after: 1.5, phase: 0)
    }

    private func startBleWatchdog() {
        bleWatchdog?.cancel()
        bleLowRateTicks = 0
        bleRateRecoveryCount = 0
        let timer = DispatchSource.makeTimerSource(queue: ioQueue)
        timer.schedule(deadline: .now() + 1.5, repeating: 1.5)
        timer.setEventHandler { [weak self] in
            guard let self = self,
                  self.streamMode == "native-ble",
                  self.bleStartCall == nil,
                  !self.bleRecoveryInProgress,
                  let central = self.bleCentral,
                  let peripheral = self.blePeripheral,
                  peripheral.state == .connected else { return }

            let silence = Date().timeIntervalSince(self.lastBlePacketAt)
            if self.lastRxHz > 0 && self.lastRxHz < 10 {
                self.bleLowRateTicks += 1
            } else if silence <= 3.5 {
                self.bleLowRateTicks = 0
            }

            let silentStall = silence > 3.5
            let slowStall = self.bleLowRateTicks >= 1 // ~1.5 s below 10 Hz
            guard silentStall || slowStall else { return }

            self.bleRecoveryInProgress = true
            self.bleLowRateTicks = 0
            let useReboot = self.bleRateRecoveryCount >= 1
            self.bleRateRecoveryCount += 1
            NSLog(
                "ProgeniaBLE rate_recover silent=%d slow=%d hz=%u reboot=%d",
                silentStall ? 1 : 0,
                slowStall ? 1 : 0,
                self.lastRxHz,
                useReboot ? 1 : 0
            )
            self.notifyListeners("streamStatus", data: [
                "state": "reconnecting",
                "message": useReboot
                    ? "Stream BLE lento · reiniciando moldura…"
                    : "Stream BLE lento · reconectando…"
            ])

            if useReboot, let command = self.bleCommandCharacteristic {
                peripheral.writeValue(
                    Data("REBOOT".utf8),
                    for: command,
                    type: .withoutResponse
                )
                self.ioQueue.asyncAfter(deadline: .now() + .milliseconds(500)) {
                    guard self.streamMode == "native-ble",
                          peripheral.state == .connected else { return }
                    central.cancelPeripheralConnection(peripheral)
                }
            } else {
                self.kickSlowLink(peripheral)
            }
        }
        bleWatchdog = timer
        timer.resume()
    }

    private func scheduleBleReconnect(
        _ peripheral: CBPeripheral,
        central: CBCentralManager
    ) {
        guard streamMode == "native-ble" else { return }
        bleReconnectWork?.cancel()
        let attempt = bleReconnectAttempt
        bleReconnectAttempt += 1
        let delay = min(8.0, 0.5 * pow(2.0, Double(min(attempt, 4))))
        let work = DispatchWorkItem { [weak self, weak peripheral, weak central] in
            guard let self = self,
                  self.streamMode == "native-ble",
                  let peripheral = peripheral,
                  let central = central else { return }
            guard peripheral.state == .disconnected else { return }
            peripheral.delegate = self
            central.connect(peripheral, options: nil)
        }
        bleReconnectWork = work
        DispatchQueue.main.asyncAfter(deadline: .now() + delay, execute: work)
    }
}

extension ProgeniaArFramePlugin: CBCentralManagerDelegate, CBPeripheralDelegate {
    public func centralManagerDidUpdateState(_ central: CBCentralManager) {
        guard bleStartCall != nil else { return }
        switch central.state {
        case .poweredOn:
            bleConnectAttempts = 0
            if let target = bleTargetIdentifier {
                if let peripheral = central.retrievePeripherals(withIdentifiers: [target]).first {
                    NSLog("ProgeniaBLE connect_cached %@", peripheral.identifier.uuidString)
                    notifyListeners("streamStatus", data: [
                        "state": "connecting",
                        "message": "Conectando moldura conhecida…"
                    ])
                    connectFramePeripheral(peripheral, central: central)
                    return
                }
                NSLog("ProgeniaBLE cache_miss %@ → service scan", target.uuidString)
            }

            // Already linked at OS level (rare, but skips advertising).
            if let connected = central.retrieveConnectedPeripherals(withServices: [frameServiceUUID]).first {
                NSLog("ProgeniaBLE connect_system %@", connected.identifier.uuidString)
                notifyListeners("streamStatus", data: [
                    "state": "connecting",
                    "message": "Moldura já vinculada · abrindo…"
                ])
                if connected.state == .connected {
                    blePeripheral = connected
                    connected.delegate = self
                    connected.discoverServices([frameServiceUUID])
                } else {
                    connectFramePeripheral(connected, central: central)
                }
                return
            }

            // Service scan first (works with UUID-in-ADV firmware); name fallback second.
            beginBleScan(central, openNameScan: false)
            scheduleBleNameScanFallback(central)
        case .unauthorized:
            let call = bleStartCall
            bleStartCall = nil
            call?.reject("Bluetooth sem permissão. Ative em Ajustes → ProGenia → Bluetooth.")
            stopBleInternal()
            localQuatServer.stop()
        case .unsupported:
            let call = bleStartCall
            bleStartCall = nil
            call?.reject("Bluetooth LE não suportado neste aparelho.")
            stopBleInternal()
            localQuatServer.stop()
        case .poweredOff:
            let call = bleStartCall
            bleStartCall = nil
            call?.reject("Bluetooth desligado. Ligue o Bluetooth e tente de novo.")
            stopBleInternal()
            localQuatServer.stop()
        default:
            break
        }
    }

    public func centralManager(
        _ central: CBCentralManager,
        didDiscover peripheral: CBPeripheral,
        advertisementData: [String: Any],
        rssi RSSI: NSNumber
    ) {
        guard blePeripheral == nil else { return }
        // Fresh iPads often have peripheral.name == nil until after the first
        // successful connect (iPhone keeps a CoreBluetooth name cache).
        let advName = advertisementData[CBAdvertisementDataLocalNameKey] as? String
        let name = peripheral.name ?? advName ?? ""
        let serviceUUIDs =
            (advertisementData[CBAdvertisementDataServiceUUIDsKey] as? [CBUUID] ?? []) +
            (advertisementData[CBAdvertisementDataOverflowServiceUUIDsKey] as? [CBUUID] ?? [])
        let hasService = serviceUUIDs.contains(frameServiceUUID)
        let hasName = name.hasPrefix("ProGenia-Frame-")

        // Service-UUID scan already scoped the results — accept even with empty name.
        // Open scan must match name (adv or cached) or the service UUID in the payload.
        if bleOpenNameScan {
            guard hasName || hasService else { return }
        }

        NSLog(
            "ProgeniaBLE discovered name=%@ adv=%@ rssi=%@ svc=%d open=%d",
            peripheral.name ?? "(nil)",
            advName ?? "(nil)",
            RSSI,
            hasService ? 1 : 0,
            bleOpenNameScan ? 1 : 0
        )
        bleScanFallbackWork?.cancel()
        bleScanFallbackWork = nil
        central.stopScan()
        notifyListeners("streamStatus", data: [
            "state": "connecting",
            "message": "Conectando \(hasName ? name : "moldura")…"
        ])
        connectFramePeripheral(peripheral, central: central)
    }

    public func centralManager(_ central: CBCentralManager, didConnect peripheral: CBPeripheral) {
        bleReconnectWork?.cancel()
        bleReconnectWork = nil
        bleConnectWatchdog?.cancel()
        bleConnectWatchdog = nil
        bleReconnectAttempt = 0
        bleConnectAttempts = 0
        lastBlePacketAt = Date()
        bleRecoveryInProgress = false
        blePeripheral = peripheral
        peripheral.delegate = self
        NSLog("ProgeniaBLE did_connect %@", peripheral.identifier.uuidString)
        peripheral.discoverServices([frameServiceUUID])
    }

    public func centralManager(
        _ central: CBCentralManager,
        didFailToConnect peripheral: CBPeripheral,
        error: Error?
    ) {
        guard streamMode == "native-ble" else { return }
        let detail = error?.localizedDescription ?? "falha ao conectar"
        NSLog("ProgeniaBLE did_fail_connect %@", detail)
        // During handshake, don't surface raw English CoreBluetooth strings in the UI.
        if bleStartCall != nil && bleReconnectAttempt >= 4 {
            let call = bleStartCall
            bleStartCall = nil
            call?.reject(
                "iPad não conseguiu manter o Bluetooth com a moldura. " +
                "Feche o ProGenia no iPhone e tente outra vez."
            )
            streamMode = nil
            stopBleInternal()
            localQuatServer.stop()
            return
        }
        notifyListeners("streamStatus", data: [
            "state": "reconnecting",
            "message": "Reconectando moldura…"
        ])
        scheduleBleReconnect(peripheral, central: central)
    }

    public func centralManager(
        _ central: CBCentralManager,
        didDisconnectPeripheral peripheral: CBPeripheral,
        error: Error?
    ) {
        guard streamMode == "native-ble" else { return }
        NSLog(
            "ProgeniaBLE did_disconnect %@",
            error?.localizedDescription ?? "clean"
        )
        bleOrientationCharacteristic = nil
        bleCommandCharacteristic = nil
        // If handshake is still open, keep trying quietly — never show the
        // system "connection has timed out unexpectedly" string in the lab UI.
        if bleStartCall != nil {
            notifyListeners("streamStatus", data: [
                "state": "connecting",
                "message": "Reconectando moldura…"
            ])
        } else {
            notifyListeners("streamStatus", data: [
                "state": "reconnecting",
                "message": "BLE desconectado · reconectando…"
            ])
        }
        scheduleBleReconnect(peripheral, central: central)
    }

    public func peripheral(_ peripheral: CBPeripheral, didDiscoverServices error: Error?) {
        if let error = error {
            let call = bleStartCall
            bleStartCall = nil
            call?.reject("Serviço BLE: \(error.localizedDescription)")
            stopBleInternal()
            localQuatServer.stop()
            return
        }
        guard let service = peripheral.services?.first(where: { $0.uuid == frameServiceUUID }) else {
            let call = bleStartCall
            bleStartCall = nil
            call?.reject("Firmware antigo: serviço ProGenia não encontrado.")
            stopBleInternal()
            localQuatServer.stop()
            return
        }
        peripheral.discoverCharacteristics(
            [frameOrientationUUID, frameCommandUUID],
            for: service
        )
    }

    public func peripheral(
        _ peripheral: CBPeripheral,
        didDiscoverCharacteristicsFor service: CBService,
        error: Error?
    ) {
        guard error == nil,
              let characteristic = service.characteristics?.first(where: {
                  $0.uuid == frameOrientationUUID
              }) else {
            let call = bleStartCall
            bleStartCall = nil
            call?.reject("Firmware antigo: characteristic de stream BLE ausente. Regrave a moldura.")
            stopBleInternal()
            localQuatServer.stop()
            return
        }
        bleOrientationCharacteristic = characteristic
        bleCommandCharacteristic = service.characteristics?.first(where: {
            $0.uuid == frameCommandUUID
        })
        peripheral.setNotifyValue(true, for: characteristic)
    }

    public func peripheral(
        _ peripheral: CBPeripheral,
        didUpdateNotificationStateFor characteristic: CBCharacteristic,
        error: Error?
    ) {
        guard characteristic.uuid == frameOrientationUUID else { return }
        if let error = error {
            let call = bleStartCall
            bleStartCall = nil
            call?.reject("Não foi possível assinar o stream BLE: \(error.localizedDescription)")
            stopBleInternal()
            localQuatServer.stop()
            return
        }
        guard characteristic.isNotifying else { return }
        sendConnFast(peripheral)
        if bleStartCall != nil {
            validateBleRate(peripheral)
        } else {
            notifyListeners("streamStatus", data: ["state": "streaming", "mode": "native-ble"])
        }
    }

    public func peripheral(
        _ peripheral: CBPeripheral,
        didUpdateValueFor characteristic: CBCharacteristic,
        error: Error?
    ) {
        guard error == nil,
              characteristic.uuid == frameOrientationUUID,
              let data = characteristic.value else { return }
        // CBCentralManager runs on main for iPad permission reliability;
        // keep packet parsing off the UI thread.
        let payload = Data(data)
        ioQueue.async { [weak self] in
            self?.ingestBlePacket(payload)
        }
    }
}

extension ProgeniaArFramePlugin: ARSessionDelegate {
    public func session(_ session: ARSession, didUpdate frame: ARFrame) {
        if session === mixedRealityView?.session {
            syncHologram(to: frame)
        }
        if streamMode == "native-device-motion" {
            ingestDeviceMotionArFrame(frame)
        }
        if handTrackingEnabled {
            processHandTrackingFrame(frame)
        }
    }
}
