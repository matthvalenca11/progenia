import Foundation
import Network

/**
 Local WebSocket server on 127.0.0.1 — high-rate IMU data plane for WKWebView.
 V4 binary frame (52 bytes LE): V2 fields + world translation dpx,dpy,dpz.
 */
final class ProgeniaLocalQuatServer {
    static let port: UInt16 = 19091
    static let frameSize = 52

    private let queue = DispatchQueue(
        label: "com.progenia.frame.localws",
        qos: .userInteractive
    )
    private var listener: NWListener?
    private var connections: [ObjectIdentifier: NWConnection] = [:]
    private var emitTimer: DispatchSourceTimer?

    private var pendingW = 1.0
    private var pendingX = 0.0
    private var pendingY = 0.0
    private var pendingZ = 0.0
    private var pendingGX = 0.0
    private var pendingGY = 0.0
    private var pendingGZ = 0.0
    private var pendingHasGravity = false
    private var pendingAccelAccuracy: UInt8 = 0
    private var pendingGyroAccuracy: UInt8 = 0
    private var pendingStationary = false
    private var pendingCalibrationReady = false
    private var pendingTranslationX = 0.0
    private var pendingTranslationY = 0.0
    private var pendingTranslationZ = 0.0
    private var pendingSeq: UInt32 = 0
    private var pendingDirty = false

    private var txCount: UInt32 = 0
    private var txWindowStart = Date()
    private(set) var lastTxHz: UInt32 = 0

    var isRunning: Bool { listener != nil }
    var clientCount: Int { connections.count }

    func start() throws {
        stop()

        let wsOptions = NWProtocolWebSocket.Options()
        wsOptions.autoReplyPing = true
        let tcpOptions = NWProtocolTCP.Options()
        tcpOptions.enableKeepalive = true
        tcpOptions.noDelay = true
        let params = NWParameters(tls: nil, tcp: tcpOptions)
        params.defaultProtocolStack.applicationProtocols.insert(wsOptions, at: 0)
        params.allowLocalEndpointReuse = true

        guard let nwPort = NWEndpoint.Port(rawValue: Self.port) else {
            throw NSError(domain: "ProgeniaLocalWS", code: 1, userInfo: [
                NSLocalizedDescriptionKey: "invalid port \(Self.port)"
            ])
        }

        let listener = try NWListener(using: params, on: nwPort)
        listener.newConnectionHandler = { [weak self] connection in
            self?.accept(connection)
        }
        listener.stateUpdateHandler = { state in
            if case .failed(let error) = state {
                NSLog("ProgeniaLocalWS listener failed: \(error.localizedDescription)")
            }
        }
        listener.start(queue: queue)
        self.listener = listener
        startEmitTimer()
    }

    func stop() {
        emitTimer?.cancel()
        emitTimer = nil
        for (_, conn) in connections {
            conn.cancel()
        }
        connections.removeAll()
        listener?.cancel()
        listener = nil
        pendingDirty = false
        lastTxHz = 0
        txCount = 0
    }

    func broadcast(w: Double, x: Double, y: Double, z: Double, seq: UInt64) {
        broadcast(
            w: w, x: x, y: y, z: z,
            gravityX: 0, gravityY: 0, gravityZ: 0,
            hasGravity: false, seq: seq
        )
    }

    func broadcast(
        w: Double, x: Double, y: Double, z: Double,
        gravityX: Double, gravityY: Double, gravityZ: Double,
        hasGravity: Bool, seq: UInt64,
        accelAccuracy: UInt8 = 0, gyroAccuracy: UInt8 = 0,
        stationary: Bool = false, calibrationReady: Bool = false,
        translationPosition: Double = 0,
        translationX: Double? = nil,
        translationY: Double? = nil,
        translationZ: Double? = nil
    ) {
        queue.async {
            self.pendingW = w
            self.pendingX = x
            self.pendingY = y
            self.pendingZ = z
            self.pendingGX = gravityX
            self.pendingGY = gravityY
            self.pendingGZ = gravityZ
            self.pendingHasGravity = hasGravity
            self.pendingAccelAccuracy = accelAccuracy
            self.pendingGyroAccuracy = gyroAccuracy
            self.pendingStationary = stationary
            self.pendingCalibrationReady = calibrationReady
            if let tx = translationX, let ty = translationY, let tz = translationZ {
                self.pendingTranslationX = tx
                self.pendingTranslationY = ty
                self.pendingTranslationZ = tz
            } else {
                self.pendingTranslationX = 0
                self.pendingTranslationY = 0
                self.pendingTranslationZ = translationPosition
            }
            self.pendingSeq = UInt32(truncatingIfNeeded: seq)
            self.pendingDirty = true
        }
    }

    private func startEmitTimer() {
        emitTimer?.cancel()
        let timer = DispatchSource.makeTimerSource(queue: queue)
        timer.schedule(deadline: .now(), repeating: .milliseconds(16))
        timer.setEventHandler { [weak self] in
            self?.flushPending()
        }
        emitTimer = timer
        timer.resume()
    }

    private func flushPending() {
        guard pendingDirty, !connections.isEmpty else { return }
        pendingDirty = false
        let frame = Self.buildFrame(
            w: pendingW, x: pendingX, y: pendingY, z: pendingZ,
            gravityX: pendingGX, gravityY: pendingGY, gravityZ: pendingGZ,
            hasGravity: pendingHasGravity, seq: pendingSeq,
            accelAccuracy: pendingAccelAccuracy, gyroAccuracy: pendingGyroAccuracy,
            stationary: pendingStationary, calibrationReady: pendingCalibrationReady,
            translationX: pendingTranslationX,
            translationY: pendingTranslationY,
            translationZ: pendingTranslationZ
        )
        sendToAll(frame)

        txCount &+= 1
        let now = Date()
        if now.timeIntervalSince(txWindowStart) >= 1.0 {
            lastTxHz = txCount
            txCount = 0
            txWindowStart = now
        }
    }

    private static func buildFrame(
        w: Double, x: Double, y: Double, z: Double,
        gravityX: Double, gravityY: Double, gravityZ: Double,
        hasGravity: Bool, seq: UInt32,
        accelAccuracy: UInt8, gyroAccuracy: UInt8,
        stationary: Bool, calibrationReady: Bool,
        translationX: Double,
        translationY: Double,
        translationZ: Double
    ) -> Data {
        var data = Data(count: frameSize)
        data.withUnsafeMutableBytes { raw in
            guard let base = raw.baseAddress?.assumingMemoryBound(to: UInt8.self) else { return }
            // Magic 0x5134 (v4)
            base[0] = 0x34
            base[1] = 0x51
            var seqLe = seq.littleEndian
            _ = withUnsafeBytes(of: &seqLe) { bytes in
                memcpy(base + 2, bytes.baseAddress!, 4)
            }
            base[6] =
                (hasGravity ? 0x01 : 0x00) |
                ((accelAccuracy & 0x03) << 1) |
                ((gyroAccuracy & 0x03) << 3) |
                (stationary ? 0x20 : 0x00) |
                (calibrationReady ? 0x40 : 0x00)
            base[7] = 0
            func putFloat(_ value: Double, at offset: Int) {
                var f = Float(value).bitPattern.littleEndian
                _ = withUnsafeBytes(of: &f) { bytes in
                    memcpy(base + offset, bytes.baseAddress!, 4)
                }
            }
            putFloat(w, at: 8)
            putFloat(x, at: 12)
            putFloat(y, at: 16)
            putFloat(z, at: 20)
            putFloat(gravityX, at: 24)
            putFloat(gravityY, at: 28)
            putFloat(gravityZ, at: 32)
            putFloat(translationX, at: 36)
            putFloat(translationY, at: 40)
            putFloat(translationZ, at: 44)
            putFloat(0, at: 48) // reserved
        }
        return data
    }

    private func sendToAll(_ data: Data) {
        let metadata = NWProtocolWebSocket.Metadata(opcode: .binary)
        let context = NWConnection.ContentContext(identifier: "quat", metadata: [metadata])
        for (id, conn) in connections {
            conn.send(content: data, contentContext: context, isComplete: true, completion: .contentProcessed { [weak self] error in
                if error != nil {
                    self?.queue.async {
                        self?.connections.removeValue(forKey: id)
                    }
                }
            })
        }
    }

    private func accept(_ connection: NWConnection) {
        let id = ObjectIdentifier(connection)
        connections[id] = connection
        connection.stateUpdateHandler = { [weak self] state in
            switch state {
            case .failed, .cancelled:
                self?.queue.async {
                    self?.connections.removeValue(forKey: id)
                }
            default:
                break
            }
        }
        connection.start(queue: queue)
        receiveNext(on: connection, id: id)
    }

    /// Keep Network.framework's WebSocket state machine draining inbound
    /// control frames (ping/pong/close and flow-control acknowledgements).
    private func receiveNext(on connection: NWConnection, id: ObjectIdentifier) {
        connection.receiveMessage { [weak self, weak connection] _, _, _, error in
            guard let self = self, let connection = connection else { return }
            if error != nil {
                self.queue.async {
                    self.connections.removeValue(forKey: id)
                }
                return
            }
            self.receiveNext(on: connection, id: id)
        }
    }
}
