import AppKit
import Combine
import SwiftUI

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate {
  private let appModel = AppModel()
  private let popover = NSPopover()
  private var statusItem: NSStatusItem?
  private var cancellables = Set<AnyCancellable>()

  func applicationDidFinishLaunching(_ notification: Notification) {
    NSApp.setActivationPolicy(.accessory)
    configurePopover()
    configureStatusItem()
    observeState()
  }

  private func configurePopover() {
    popover.contentSize = NSSize(width: 420, height: 640)
    popover.behavior = .transient
    popover.animates = true
    popover.contentViewController = NSHostingController(
      rootView: MenuBarContentView()
        .environmentObject(appModel)
    )
  }

  private func configureStatusItem() {
    statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
    guard let button = statusItem?.button else { return }
    button.target = self
    button.action = #selector(togglePopover(_:))
    updateStatusItemImage(isRecording: appModel.isRecording)
  }

  private func observeState() {
    appModel.$isRecording
      .receive(on: RunLoop.main)
      .sink { [weak self] isRecording in
        self?.updateStatusItemImage(isRecording: isRecording)
      }
      .store(in: &cancellables)
  }

  private func updateStatusItemImage(isRecording: Bool) {
    let imageName = isRecording ? "suit.spade.fill" : "suit.spade"
    let image = NSImage(systemSymbolName: imageName, accessibilityDescription: "Aceync")
    image?.isTemplate = true
    statusItem?.button?.image = image
  }

  @objc private func togglePopover(_ sender: AnyObject?) {
    guard let button = statusItem?.button else { return }
    if popover.isShown {
      popover.performClose(sender)
      return
    }
    NSApp.activate(ignoringOtherApps: true)
    popover.show(relativeTo: button.bounds, of: button, preferredEdge: .minY)
  }
}

@main
enum AceyncMenuBarLauncher {
  @MainActor
  static func main() {
    let app = NSApplication.shared
    let delegate = AppDelegate()
    app.delegate = delegate
    app.run()
  }
}

private struct MenuBarContentView: View {
  @EnvironmentObject private var appModel: AppModel

  var body: some View {
    ZStack {
      AceyncBackdrop()

      ScrollView(showsIndicators: false) {
        VStack(alignment: .leading, spacing: 18) {
          header
          if appModel.isAuthenticated {
            capturePanel
            destinationPanel
            statusPanel
            actions
          } else {
            signInPanel
            waitingPanel
          }
        }
        .padding(20)
      }
    }
    .frame(minWidth: 400, minHeight: 560)
  }

  private var header: some View {
    VStack(alignment: .leading, spacing: 12) {
      HStack {
        HStack(spacing: 14) {
          ZStack {
            Circle()
              .fill(
                LinearGradient(
                  colors: [WebPalette.accentSoft, WebPalette.accentLilac],
                  startPoint: .topLeading,
                  endPoint: .bottomTrailing
                )
              )
              .frame(width: 50, height: 50)
              .overlay(
                Circle()
                  .stroke(WebPalette.border.opacity(0.7), lineWidth: 1)
              )

            Image(systemName: "suit.spade.fill")
              .font(.system(size: 19, weight: .bold))
              .foregroundStyle(WebPalette.fg)
          }

          VStack(alignment: .leading, spacing: 4) {
            Text("Aceync")
              .font(.system(size: 28, weight: .bold, design: .rounded))
              .foregroundStyle(WebPalette.fg)
            Text(appModel.isAuthenticated ? "Voice capture that lands inside the web workflow." : "A lightweight native companion for async capture.")
              .font(.system(size: 13, weight: .medium, design: .rounded))
              .foregroundStyle(WebPalette.muted)
              .fixedSize(horizontal: false, vertical: true)
          }
        }
        Spacer()

        VStack(alignment: .trailing, spacing: 8) {
          AccentChip(
            title: appModel.isAuthenticated ? "Connected" : "Menu Bar",
            tone: appModel.isAuthenticated ? .accent : .neutral
          )
          if !appModel.pendingUploads.isEmpty {
            AccentChip(title: "\(appModel.pendingUploads.count) queued", tone: .blush)
          }
        }
      }

      HStack(spacing: 10) {
        AccentChip(title: appModel.workspaceTitle.uppercased(), tone: .accent)
        if let name = appModel.session?.name, !name.isEmpty {
          AccentChip(title: name, tone: .neutral)
        }
      }
    }
  }

  private var signInPanel: some View {
    PanelCard(title: "Connect The Capture Layer", eyebrow: "SIGN IN", tint: .accent) {
      VStack(alignment: .leading, spacing: 14) {
        Text("Point the menu bar client at your Aceync workspace and keep the web app alive in the background.")
          .font(.system(size: 13, weight: .medium, design: .rounded))
          .foregroundStyle(WebPalette.muted)

        LabeledField(label: "Server URL", icon: "network", text: $appModel.serverURL)
        LabeledField(label: "Email", icon: "at", text: $appModel.email)
        SecureLabeledField(label: "Password", icon: "key.fill", text: $appModel.password)

        Button {
          Task { await appModel.signIn() }
        } label: {
          PrimaryButtonFace {
            if appModel.isSigningIn {
              ProgressView()
                .progressViewStyle(.circular)
                .tint(.white)
            } else {
              HStack(spacing: 8) {
                Image(systemName: "arrow.up.forward.app.fill")
                Text("Enter Aceync")
                  .font(.system(size: 14, weight: .bold, design: .rounded))
              }
              .foregroundStyle(.white)
            }
          }
        }
        .buttonStyle(.plain)
        .disabled(appModel.isSigningIn)
      }
    }
  }

  private var capturePanel: some View {
    PanelCard(title: "Quick Capture", eyebrow: "VOICE", tint: .accent) {
      VStack(alignment: .leading, spacing: 16) {
        VStack(alignment: .leading, spacing: 16) {
          HStack(alignment: .center, spacing: 16) {
            Button {
              Task { await appModel.toggleRecording() }
            } label: {
              ZStack {
                Circle()
                  .fill(
                    LinearGradient(
                      colors: appModel.isRecording
                        ? [WebPalette.accentBlush, Color(red: 1.0, green: 0.96, blue: 0.97)]
                        : [WebPalette.accentSoft, Color.white],
                      startPoint: .topLeading,
                      endPoint: .bottomTrailing
                    )
                  )
                  .frame(width: 108, height: 108)
                  .overlay(
                    Circle()
                      .stroke(appModel.isRecording ? WebPalette.danger.opacity(0.35) : WebPalette.border.opacity(0.8), lineWidth: 1)
                  )
                  .shadow(color: Color.black.opacity(0.08), radius: 22, x: 0, y: 10)

                Circle()
                  .fill(appModel.isRecording ? WebPalette.danger : WebPalette.fg)
                  .frame(width: 54, height: 54)

                Image(systemName: appModel.isRecording ? "stop.fill" : "mic.fill")
                  .font(.system(size: 20, weight: .bold))
                  .foregroundStyle(.white)
              }
            }
            .buttonStyle(.plain)

            VStack(alignment: .leading, spacing: 8) {
              Text(appModel.isRecording ? "Listening live" : "Ready when you are")
                .font(.system(size: 20, weight: .bold, design: .rounded))
                .foregroundStyle(WebPalette.fg)
              Text(appModel.isRecording ? "Tap again to stop and sync the note straight into Aceync." : "Capture feedback in one click and let the web app process the transcript.")
                .font(.system(size: 13, weight: .medium, design: .rounded))
                .foregroundStyle(WebPalette.muted)
                .fixedSize(horizontal: false, vertical: true)
              AccentChip(title: "Hotkey: Option-Command-S", tone: .neutral)
            }
          }

          Button {
            Task { await appModel.toggleRecording() }
          } label: {
            PrimaryButtonFace {
              HStack(spacing: 8) {
                Image(systemName: appModel.isRecording ? "stop.fill" : "mic.fill")
                Text(appModel.isRecording ? "Stop And Sync" : "Start Recording")
                  .font(.system(size: 14, weight: .bold, design: .rounded))
              }
              .foregroundStyle(.white)
            }
          }
          .buttonStyle(.plain)
        }
      }
    }
  }

  private var destinationPanel: some View {
    PanelCard(title: "Routing", eyebrow: "DESTINATION", tint: .lilac) {
      VStack(alignment: .leading, spacing: 14) {
        Picker("Destination", selection: $appModel.selectedDestination) {
          ForEach(CaptureDestinationKind.allCases) { option in
            Text(option.label).tag(option)
          }
        }
        .pickerStyle(.segmented)
        .onChange(of: appModel.selectedDestination) { _ in
          appModel.persistSelectionState()
        }

        switch appModel.selectedDestination {
        case .inbox:
          RouteHighlight(
            title: "Inbox drop",
            message: "Perfect for loose feedback, fast ideas, and capture-first workflows that get triaged later."
          )
        case .artifact:
          LabeledField(label: "Filter Artifacts", icon: "magnifyingglass", text: $appModel.artifactQuery)
          Picker("Artifact", selection: $appModel.selectedArtifactId) {
            ForEach(appModel.filteredArtifacts) { artifact in
              Text(artifact.title).tag(artifact.id)
            }
          }
          .pickerStyle(.menu)
          .onChange(of: appModel.selectedArtifactId) { _ in
            appModel.persistSelectionState()
          }
          RouteHighlight(
            title: "Selected artifact",
            message: selectedArtifactTitle
          )
        case .reviewRequest:
          Picker("Review Request", selection: $appModel.selectedReviewRequestId) {
            ForEach(appModel.filteredReviewRequests) { request in
              Text(request.title).tag(request.id)
            }
          }
          .pickerStyle(.menu)
          .onChange(of: appModel.selectedReviewRequestId) { _ in
            appModel.persistSelectionState()
          }
          RouteHighlight(
            title: "Selected review thread",
            message: selectedReviewRequestTitle
          )
        }
      }
    }
  }

  private var statusPanel: some View {
    PanelCard(title: "Signal", eyebrow: "STATUS", tint: .accent) {
      VStack(alignment: .leading, spacing: 12) {
        RouteHighlight(title: "Current state", message: appModel.lastStatus)

        if !appModel.lastTranscript.isEmpty {
          VStack(alignment: .leading, spacing: 8) {
            Text("Last transcript")
              .font(.system(size: 11, weight: .bold, design: .rounded))
              .foregroundStyle(WebPalette.muted)
            Text(appModel.lastTranscript)
              .font(.system(size: 13, weight: .medium, design: .rounded))
              .foregroundStyle(WebPalette.fg)
              .padding(14)
              .frame(maxWidth: .infinity, alignment: .leading)
              .background(
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                  .fill(Color.white)
                  .overlay(
                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                      .stroke(WebPalette.border.opacity(0.74), lineWidth: 1)
                  )
              )
          }
        } else {
          Text("Your latest synced transcript will appear here after Aceync finishes processing it.")
            .font(.system(size: 12, weight: .medium, design: .rounded))
            .foregroundStyle(WebPalette.muted)
            .fixedSize(horizontal: false, vertical: true)
        }
      }
    }
  }

  private var actions: some View {
    VStack(spacing: 10) {
      HStack(spacing: 10) {
        ActionButton(title: "Open Web App", icon: "arrow.up.right.square.fill", style: .primary) {
          appModel.openWorkspace()
        }
        ActionButton(title: "Open Target", icon: "scope", style: .secondary) {
          appModel.openSelectedDestinationInBrowser()
        }
      }
      HStack(spacing: 10) {
        ActionButton(title: "Refresh", icon: "arrow.clockwise", style: .secondary) {
          Task { await appModel.refreshRemoteData() }
        }
        ActionButton(title: "Sign Out", icon: "rectangle.portrait.and.arrow.right", style: .danger) {
          appModel.signOut()
        }
      }
    }
  }

  private var waitingPanel: some View {
    PanelCard(title: "Before You Go Live", eyebrow: "SETUP", tint: .accent) {
      VStack(alignment: .leading, spacing: 10) {
        Text("Keep `npm run dev` active, then run the native target from Xcode so the spade stays resident in the menu bar.")
          .font(.system(size: 13, weight: .medium, design: .rounded))
          .foregroundStyle(WebPalette.muted)
        HStack(spacing: 8) {
          AccentChip(title: "Menu bar first", tone: .neutral)
          AccentChip(title: "Voice-native", tone: .lilac)
          AccentChip(title: "Async-ready", tone: .blush)
        }
      }
    }
  }

  private var selectedArtifactTitle: String {
    appModel.artifacts.first(where: { $0.id == appModel.selectedArtifactId })?.title ?? "Choose an artifact to attach feedback directly."
  }

  private var selectedReviewRequestTitle: String {
    appModel.reviewRequests.first(where: { $0.id == appModel.selectedReviewRequestId })?.title ?? "Choose a live review request to reply in context."
  }
}

private struct AceyncBackdrop: View {
  var body: some View {
    ZStack {
      LinearGradient(
        colors: [
          WebPalette.bg,
          Color.white,
          WebPalette.accentSoft.opacity(0.6),
        ],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
      )
      .ignoresSafeArea()

      Circle()
        .fill(WebPalette.accentSoft.opacity(0.95))
        .frame(width: 220, height: 220)
        .blur(radius: 40)
        .offset(x: 120, y: -180)

      Circle()
        .fill(WebPalette.accentLilac.opacity(0.82))
        .frame(width: 180, height: 180)
        .blur(radius: 36)
        .offset(x: -140, y: 60)

      Circle()
        .fill(WebPalette.accentBlush.opacity(0.88))
        .frame(width: 140, height: 140)
        .blur(radius: 28)
        .offset(x: 80, y: 230)
    }
  }
}

private struct PanelCard<Content: View>: View {
  let title: String
  let eyebrow: String
  let tint: AccentTone
  let content: Content

  init(title: String, eyebrow: String, tint: AccentTone, @ViewBuilder content: () -> Content) {
    self.title = title
    self.eyebrow = eyebrow
    self.tint = tint
    self.content = content()
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 14) {
      HStack(alignment: .center) {
        VStack(alignment: .leading, spacing: 4) {
          Text(eyebrow)
            .font(.system(size: 10, weight: .heavy, design: .rounded))
            .tracking(1.6)
            .foregroundStyle(tint.highlight)
          Text(title)
            .font(.system(size: 18, weight: .bold, design: .rounded))
            .foregroundStyle(WebPalette.fg)
        }
        Spacer()
        Circle()
          .fill(
            LinearGradient(colors: [tint.highlight.opacity(0.95), tint.deep.opacity(0.55)], startPoint: .topLeading, endPoint: .bottomTrailing)
          )
          .frame(width: 12, height: 12)
      }

      content
    }
    .padding(18)
    .background(
      RoundedRectangle(cornerRadius: 26, style: .continuous)
        .fill(Color.white.opacity(0.96))
        .overlay(
          RoundedRectangle(cornerRadius: 26, style: .continuous)
            .stroke(WebPalette.border.opacity(0.74), lineWidth: 1)
        )
    )
    .shadow(color: Color.black.opacity(0.08), radius: 28, x: 0, y: 12)
  }
}

private struct AccentChip: View {
  let title: String
  let tone: AccentTone

  var body: some View {
    Text(title)
      .font(.system(size: 11, weight: .bold, design: .rounded))
      .foregroundStyle(tone.foreground)
      .padding(.horizontal, 10)
      .padding(.vertical, 6)
      .background(
        Capsule()
          .fill(tone.background)
      )
      .overlay(
        Capsule()
          .stroke(tone.border, lineWidth: 1)
      )
  }
}

private struct RouteHighlight: View {
  let title: String
  let message: String

  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      Text(title.uppercased())
        .font(.system(size: 10, weight: .heavy, design: .rounded))
        .tracking(1.4)
        .foregroundStyle(WebPalette.muted)
      Text(message)
        .font(.system(size: 13, weight: .medium, design: .rounded))
        .foregroundStyle(WebPalette.fg.opacity(0.84))
        .fixedSize(horizontal: false, vertical: true)
    }
    .padding(14)
    .frame(maxWidth: .infinity, alignment: .leading)
    .background(
      RoundedRectangle(cornerRadius: 18, style: .continuous)
        .fill(Color.white)
        .overlay(
          RoundedRectangle(cornerRadius: 18, style: .continuous)
            .stroke(WebPalette.border.opacity(0.72), lineWidth: 1)
        )
    )
  }
}

private struct LabeledField: View {
  let label: String
  let icon: String
  @Binding var text: String

  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      Text(label)
        .font(.system(size: 11, weight: .bold, design: .rounded))
        .foregroundStyle(WebPalette.muted)
      HStack(spacing: 10) {
        Image(systemName: icon)
          .foregroundStyle(WebPalette.muted)
        TextField(label, text: $text)
          .textFieldStyle(.plain)
          .foregroundStyle(WebPalette.fg)
      }
      .padding(.horizontal, 14)
      .padding(.vertical, 12)
      .background(
        RoundedRectangle(cornerRadius: 18, style: .continuous)
          .fill(Color.white)
          .overlay(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
              .stroke(WebPalette.border.opacity(0.82), lineWidth: 1)
          )
      )
      .shadow(color: Color.black.opacity(0.03), radius: 10, x: 0, y: 4)
    }
  }
}

private struct SecureLabeledField: View {
  let label: String
  let icon: String
  @Binding var text: String

  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      Text(label)
        .font(.system(size: 11, weight: .bold, design: .rounded))
        .foregroundStyle(WebPalette.muted)
      HStack(spacing: 10) {
        Image(systemName: icon)
          .foregroundStyle(WebPalette.muted)
        SecureField(label, text: $text)
          .textFieldStyle(.plain)
          .foregroundStyle(WebPalette.fg)
      }
      .padding(.horizontal, 14)
      .padding(.vertical, 12)
      .background(
        RoundedRectangle(cornerRadius: 18, style: .continuous)
          .fill(Color.white)
          .overlay(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
              .stroke(WebPalette.border.opacity(0.82), lineWidth: 1)
          )
      )
      .shadow(color: Color.black.opacity(0.03), radius: 10, x: 0, y: 4)
    }
  }
}

private struct ActionButton: View {
  let title: String
  let icon: String
  let style: ActionButtonStyle
  let action: () -> Void

  var body: some View {
    Button(action: action) {
      HStack(spacing: 8) {
        Image(systemName: icon)
        Text(title)
      }
      .font(.system(size: 12, weight: .bold, design: .rounded))
      .foregroundStyle(style.foreground)
      .padding(.horizontal, 12)
      .padding(.vertical, 10)
      .frame(maxWidth: .infinity)
      .background(
        RoundedRectangle(cornerRadius: 16, style: .continuous)
          .fill(style.background)
          .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
              .stroke(style.border, lineWidth: style.borderWidth)
          )
      )
    }
    .buttonStyle(.plain)
  }
}

private struct AccentTone {
  let background: Color
  let foreground: Color
  let highlight: Color
  let deep: Color
  let border: Color

  static let accent = AccentTone(
    background: WebPalette.accentSoft,
    foreground: WebPalette.accent,
    highlight: WebPalette.accent,
    deep: WebPalette.accent2,
    border: WebPalette.accent3
  )

  static let lilac = AccentTone(
    background: WebPalette.accentLilac,
    foreground: WebPalette.accent2,
    highlight: WebPalette.accent2,
    deep: WebPalette.accent,
    border: WebPalette.accent3
  )

  static let blush = AccentTone(
    background: WebPalette.accentBlush,
    foreground: Color(red: 0.64, green: 0.28, blue: 0.44),
    highlight: Color(red: 0.78, green: 0.38, blue: 0.56),
    deep: Color(red: 0.84, green: 0.54, blue: 0.7),
    border: Color(red: 0.92, green: 0.8, blue: 0.86)
  )

  static let neutral = AccentTone(
    background: Color.white,
    foreground: WebPalette.fg.opacity(0.88),
    highlight: WebPalette.fg.opacity(0.88),
    deep: WebPalette.muted.opacity(0.8),
    border: WebPalette.border.opacity(0.88)
  )
}

private struct PrimaryButtonFace<Content: View>: View {
  let content: Content

  init(@ViewBuilder content: () -> Content) {
    self.content = content()
  }

  var body: some View {
    ZStack {
      RoundedRectangle(cornerRadius: 18, style: .continuous)
        .fill(WebPalette.fg)
        .shadow(color: Color.black.opacity(0.18), radius: 18, x: 0, y: 10)
      content
    }
    .frame(height: 52)
  }
}

private struct ActionButtonStyle {
  let background: Color
  let foreground: Color
  let border: Color
  let borderWidth: CGFloat

  static let primary = ActionButtonStyle(
    background: WebPalette.fg,
    foreground: .white,
    border: WebPalette.fg,
    borderWidth: 0
  )

  static let secondary = ActionButtonStyle(
    background: .white,
    foreground: WebPalette.fg,
    border: WebPalette.border.opacity(0.92),
    borderWidth: 1
  )

  static let danger = ActionButtonStyle(
    background: Color.white,
    foreground: WebPalette.danger,
    border: WebPalette.danger.opacity(0.24),
    borderWidth: 1
  )
}

private enum WebPalette {
  static let bg = Color(red: 243 / 255, green: 246 / 255, blue: 251 / 255)
  static let fg = Color(red: 8 / 255, green: 15 / 255, blue: 35 / 255)
  static let muted = Color(red: 60 / 255, green: 72 / 255, blue: 88 / 255)
  static let border = Color(red: 179 / 255, green: 191 / 255, blue: 214 / 255)
  static let accent = Color(red: 70 / 255, green: 116 / 255, blue: 242 / 255)
  static let accent2 = Color(red: 122 / 255, green: 104 / 255, blue: 246 / 255)
  static let accent3 = Color(red: 192 / 255, green: 203 / 255, blue: 255 / 255)
  static let accentSoft = Color(red: 223 / 255, green: 234 / 255, blue: 255 / 255)
  static let accentLilac = Color(red: 231 / 255, green: 225 / 255, blue: 255 / 255)
  static let accentBlush = Color(red: 248 / 255, green: 233 / 255, blue: 241 / 255)
  static let danger = Color(red: 220 / 255, green: 38 / 255, blue: 38 / 255)
}
