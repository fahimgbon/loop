import Carbon.HIToolbox
import Foundation

final class GlobalHotkeyMonitor {
  var onPress: (() -> Void)?

  private var hotKeyRef: EventHotKeyRef?
  private var eventHandlerRef: EventHandlerRef?

  func register() {
    unregister()

    var eventType = EventTypeSpec(eventClass: OSType(kEventClassKeyboard), eventKind: UInt32(kEventHotKeyPressed))
    let status = InstallEventHandler(
      GetApplicationEventTarget(),
      { _, event, userData in
        guard let userData else { return noErr }
        let monitor = Unmanaged<GlobalHotkeyMonitor>.fromOpaque(userData).takeUnretainedValue()
        var hotKeyID = EventHotKeyID()
        GetEventParameter(
          event,
          EventParamName(kEventParamDirectObject),
          EventParamType(typeEventHotKeyID),
          nil,
          MemoryLayout<EventHotKeyID>.size,
          nil,
          &hotKeyID
        )
        if hotKeyID.id == 1 {
          monitor.onPress?()
        }
        return noErr
      },
      1,
      &eventType,
      UnsafeMutableRawPointer(Unmanaged.passUnretained(self).toOpaque()),
      &eventHandlerRef
    )

    guard status == noErr else { return }

    let hotKeyID = EventHotKeyID(signature: OSType(0x4159434E), id: 1)
    RegisterEventHotKey(
      UInt32(kVK_ANSI_S),
      UInt32(cmdKey | optionKey),
      hotKeyID,
      GetApplicationEventTarget(),
      0,
      &hotKeyRef
    )
  }

  func unregister() {
    if let hotKeyRef {
      UnregisterEventHotKey(hotKeyRef)
      self.hotKeyRef = nil
    }
    if let eventHandlerRef {
      RemoveEventHandler(eventHandlerRef)
      self.eventHandlerRef = nil
    }
  }

  deinit {
    unregister()
  }
}
