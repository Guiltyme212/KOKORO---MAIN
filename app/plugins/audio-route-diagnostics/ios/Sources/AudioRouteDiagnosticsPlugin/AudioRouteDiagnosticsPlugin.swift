import AVFAudio
import Capacitor
import Foundation
import UIKit

@objc(AudioRouteDiagnosticsPlugin)
public class AudioRouteDiagnosticsPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AudioRouteDiagnosticsPlugin"
    public let jsName = "AudioRouteDiagnostics"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "snapshot", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "activatePlayback", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "deactivatePlayback", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "keepAwake", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "allowSleep", returnType: CAPPluginReturnPromise)
    ]

    private var routeChangeObserver: NSObjectProtocol?
    private var interruptionObserver: NSObjectProtocol?
    private var didBecomeActiveObserver: NSObjectProtocol?

    // The iOS idle timer is a single global flag, but two unrelated features want
    // the screen kept awake: the meditation player (which also holds an audio
    // session) and the chat/generation flow (idle-timer ONLY — it must never
    // touch AVAudioSession or it breaks the ElevenLabs mic). Track each reason
    // independently and OR them together so leaving one doesn't re-enable sleep
    // while the other still needs it. Always mutated on the main thread.
    private var playbackRequested = false
    private var keepAwakeRequested = false

    override public func load() {
        routeChangeObserver = NotificationCenter.default.addObserver(
            forName: AVAudioSession.routeChangeNotification,
            object: nil,
            queue: .main
        ) { [weak self] notification in
            guard let self else { return }
            var extra: [String: Any] = [:]
            if let rawReason = notification.userInfo?[AVAudioSessionRouteChangeReasonKey] as? UInt,
               let reason = AVAudioSession.RouteChangeReason(rawValue: rawReason) {
                extra["reason"] = self.routeChangeReasonName(reason)
            }
            self.printSnapshot(label: "native.route-change", elapsedMs: nil, extra: extra)
        }

        interruptionObserver = NotificationCenter.default.addObserver(
            forName: AVAudioSession.interruptionNotification,
            object: nil,
            queue: .main
        ) { [weak self] notification in
            guard let self else { return }
            var extra: [String: Any] = [:]
            if let rawType = notification.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
               let type = AVAudioSession.InterruptionType(rawValue: rawType) {
                extra["type"] = type == .began ? "began" : "ended"
            }
            self.printSnapshot(label: "native.interruption", elapsedMs: nil, extra: extra)
        }

        // iOS can silently clear isIdleTimerDisabled across a background round-trip
        // (the iOS 13+ scene gotcha). Re-apply our desired state every time the
        // app becomes active so a lock/unlock cycle during generation doesn't
        // quietly re-arm auto-lock.
        didBecomeActiveObserver = NotificationCenter.default.addObserver(
            forName: UIApplication.didBecomeActiveNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            self?.applyIdleTimer()
        }

        printSnapshot(label: "native.plugin-load", elapsedMs: nil, extra: nil)
    }

    deinit {
        if let routeChangeObserver {
            NotificationCenter.default.removeObserver(routeChangeObserver)
        }
        if let interruptionObserver {
            NotificationCenter.default.removeObserver(interruptionObserver)
        }
        if let didBecomeActiveObserver {
            NotificationCenter.default.removeObserver(didBecomeActiveObserver)
        }
        // Symmetry with load(): never leave the idle timer disabled if this plugin
        // instance goes away (defensive — Capacitor plugins normally live for the
        // whole app lifetime).
        DispatchQueue.main.async {
            UIApplication.shared.isIdleTimerDisabled = false
        }
    }

    @objc func snapshot(_ call: CAPPluginCall) {
        let label = call.getString("label") ?? "snapshot"
        let elapsedMs = call.getDouble("elapsedMs")
        let extra = call.getObject("extra")
        let snapshot = makeSnapshot(label: label, elapsedMs: elapsedMs, extra: extra)
        printSnapshot(snapshot)
        call.resolve(snapshot)
    }

    // Scoped playback session for the meditation player. Two effects, both
    // reverted by deactivatePlayback():
    //   1. AVAudioSession `.playback` so audio keeps playing through a manual
    //      lock / backgrounding (paired with the app's `audio` UIBackgroundMode).
    //   2. Disable the idle timer so the screen does not auto-lock mid-meditation.
    // This is deliberately NOT a broad app-launch override — it runs only while
    // the player screen is open, so it cannot clash with the ElevenLabs voice/mic
    // lifecycle. (See docs/ios-elevenlabs-audio-troubleshooting.md.)
    @objc func activatePlayback(_ call: CAPPluginCall) {
        let session = AVAudioSession.sharedInstance()
        do {
            try session.setCategory(.playback, mode: .default)
            try session.setActive(true)
            DispatchQueue.main.async {
                self.playbackRequested = true
                self.applyIdleTimer()
            }
            printSnapshot(label: "native.playback.activate", elapsedMs: nil, extra: nil)
            call.resolve()
        } catch {
            printSnapshot(
                label: "native.playback.activate-failed",
                elapsedMs: nil,
                extra: ["error": error.localizedDescription]
            )
            call.reject("Failed to activate playback session: \(error.localizedDescription)")
        }
    }

    @objc func deactivatePlayback(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.playbackRequested = false
            self.applyIdleTimer()
        }
        let session = AVAudioSession.sharedInstance()
        do {
            try session.setActive(false, options: [.notifyOthersOnDeactivation])
            printSnapshot(label: "native.playback.deactivate", elapsedMs: nil, extra: nil)
        } catch {
            // Deactivation can throw if another session is mid-transition; not fatal.
            printSnapshot(
                label: "native.playback.deactivate-failed",
                elapsedMs: nil,
                extra: ["error": error.localizedDescription]
            )
        }
        call.resolve()
    }

    // Keep the screen awake (disable the iOS idle timer) WITHOUT touching the
    // audio session — safe to call during the ElevenLabs voice/mic flow and while
    // a meditation is generating. Idempotent. NOTE: this only stops the automatic
    // idle lock; a manual side-button lock still suspends the app.
    @objc func keepAwake(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.keepAwakeRequested = true
            self.applyIdleTimer()
            self.printSnapshot(label: "native.keep-awake", elapsedMs: nil, extra: nil)
            call.resolve()
        }
    }

    @objc func allowSleep(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.keepAwakeRequested = false
            self.applyIdleTimer()
            self.printSnapshot(label: "native.allow-sleep", elapsedMs: nil, extra: nil)
            call.resolve()
        }
    }

    // Re-applies the OR of every keep-awake reason. Must run on the main thread.
    private func applyIdleTimer() {
        UIApplication.shared.isIdleTimerDisabled = keepAwakeRequested || playbackRequested
    }

    private func makeSnapshot(label: String, elapsedMs: Double?, extra: [String: Any]?) -> [String: Any] {
        let session = AVAudioSession.sharedInstance()
        var snapshot: [String: Any] = [
            "label": label,
            "category": session.category.rawValue,
            "mode": session.mode.rawValue,
            "categoryOptions": categoryOptionNames(session.categoryOptions),
            "route": [
                "inputs": session.currentRoute.inputs.map(portSnapshot),
                "outputs": session.currentRoute.outputs.map(portSnapshot)
            ],
            "availableInputs": (session.availableInputs ?? []).map(portSnapshot),
            "outputVolume": session.outputVolume,
            "sampleRate": session.sampleRate,
            "ioBufferDuration": session.ioBufferDuration,
            "isOtherAudioPlaying": session.isOtherAudioPlaying,
            "secondaryAudioShouldBeSilencedHint": session.secondaryAudioShouldBeSilencedHint
        ]

        if let preferredInput = session.preferredInput {
            snapshot["preferredInput"] = portSnapshot(preferredInput)
        } else {
            snapshot["preferredInput"] = NSNull()
        }

        if let elapsedMs {
            snapshot["elapsedMs"] = elapsedMs
        }
        if let extra {
            snapshot["extra"] = extra
        }

        return snapshot
    }

    private func printSnapshot(label: String, elapsedMs: Double?, extra: [String: Any]?) {
        printSnapshot(makeSnapshot(label: label, elapsedMs: elapsedMs, extra: extra))
    }

    private func printSnapshot(_ snapshot: [String: Any]) {
        if let data = try? JSONSerialization.data(withJSONObject: snapshot, options: [.sortedKeys]),
           let json = String(data: data, encoding: .utf8) {
            print("🔊 [audio-route] \(json)")
        } else {
            print("🔊 [audio-route] \(snapshot)")
        }
    }

    private func portSnapshot(_ port: AVAudioSessionPortDescription) -> [String: Any] {
        var snapshot: [String: Any] = [
            "name": port.portName,
            "type": port.portType.rawValue,
            "uid": port.uid
        ]
        if let channels = port.channels {
            snapshot["channels"] = channels.map { channel in
                [
                    "name": channel.channelName,
                    "number": channel.channelNumber
                ] as [String: Any]
            }
        }
        return snapshot
    }

    private func categoryOptionNames(_ options: AVAudioSession.CategoryOptions) -> [String] {
        var names: [String] = []
        if options.contains(.mixWithOthers) { names.append("mixWithOthers") }
        if options.contains(.duckOthers) { names.append("duckOthers") }
        if options.contains(.allowBluetooth) { names.append("allowBluetooth") }
        if options.contains(.defaultToSpeaker) { names.append("defaultToSpeaker") }
        if options.contains(.interruptSpokenAudioAndMixWithOthers) { names.append("interruptSpokenAudioAndMixWithOthers") }
        if #available(iOS 10.0, *) {
            if options.contains(.allowBluetoothA2DP) { names.append("allowBluetoothA2DP") }
            if options.contains(.allowAirPlay) { names.append("allowAirPlay") }
        }
        return names
    }

    private func routeChangeReasonName(_ reason: AVAudioSession.RouteChangeReason) -> String {
        switch reason {
        case .unknown:
            return "unknown"
        case .newDeviceAvailable:
            return "newDeviceAvailable"
        case .oldDeviceUnavailable:
            return "oldDeviceUnavailable"
        case .categoryChange:
            return "categoryChange"
        case .override:
            return "override"
        case .wakeFromSleep:
            return "wakeFromSleep"
        case .noSuitableRouteForCategory:
            return "noSuitableRouteForCategory"
        case .routeConfigurationChange:
            return "routeConfigurationChange"
        @unknown default:
            return "unknown-\(reason.rawValue)"
        }
    }
}
