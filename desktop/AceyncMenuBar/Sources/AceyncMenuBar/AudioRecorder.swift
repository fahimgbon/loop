import AVFoundation
import Foundation

final class AudioRecorder {
  private var recorder: AVAudioRecorder?

  var isRecording: Bool {
    recorder?.isRecording == true
  }

  func start() async throws {
    let granted = await requestMicrophonePermission()
    guard granted else {
      throw RecorderError.microphoneDenied
    }

    let url = FileManager.default.temporaryDirectory
      .appendingPathComponent(UUID().uuidString)
      .appendingPathExtension("m4a")

    let settings: [String: Any] = [
      AVFormatIDKey: kAudioFormatMPEG4AAC,
      AVSampleRateKey: 44_100,
      AVNumberOfChannelsKey: 1,
      AVEncoderAudioQualityKey: AVAudioQuality.high.rawValue,
    ]

    let recorder = try AVAudioRecorder(url: url, settings: settings)
    recorder.prepareToRecord()
    guard recorder.record() else {
      throw RecorderError.failedToStart
    }

    self.recorder = recorder
  }

  func stop() throws -> URL {
    guard let recorder else {
      throw RecorderError.notRecording
    }
    recorder.stop()
    self.recorder = nil
    return recorder.url
  }

  func cancel() {
    guard let recorder else { return }
    let url = recorder.url
    recorder.stop()
    self.recorder = nil
    try? FileManager.default.removeItem(at: url)
  }

  private func requestMicrophonePermission() async -> Bool {
    switch AVCaptureDevice.authorizationStatus(for: .audio) {
    case .authorized:
      return true
    case .notDetermined:
      return await withCheckedContinuation { continuation in
        AVCaptureDevice.requestAccess(for: .audio) { granted in
          continuation.resume(returning: granted)
        }
      }
    default:
      return false
    }
  }
}

enum RecorderError: LocalizedError {
  case microphoneDenied
  case failedToStart
  case notRecording

  var errorDescription: String? {
    switch self {
    case .microphoneDenied:
      return "Microphone permission is required for menu bar capture."
    case .failedToStart:
      return "Aceync could not start recording."
    case .notRecording:
      return "There is no active recording to stop."
    }
  }
}
