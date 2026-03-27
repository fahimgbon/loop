import AppKit
import Combine
import Foundation

@MainActor
final class AppModel: ObservableObject {
  @Published var serverURL: String
  @Published var email = ""
  @Published var password = ""
  @Published private(set) var session: DesktopSession?
  @Published private(set) var artifacts: [ArtifactSummary] = []
  @Published private(set) var reviewRequests: [ReviewRequestSummary] = []
  @Published private(set) var pendingUploads: [PendingUpload] = []
  @Published private(set) var lastStatus = "Ready to capture from the menu bar."
  @Published private(set) var lastTranscript = ""
  @Published private(set) var isSigningIn = false
  @Published private(set) var isRefreshing = false
  @Published private(set) var isProcessingQueue = false
  @Published private(set) var isRecording = false
  @Published var selectedDestination: CaptureDestinationKind
  @Published var selectedArtifactId: String
  @Published var selectedReviewRequestId: String
  @Published var artifactQuery: String

  private let apiClient = APIClient()
  private let keychainStore = KeychainStore()
  private let recorder = AudioRecorder()
  private let queueStore = UploadQueueStore()
  private let hotkeyMonitor = GlobalHotkeyMonitor()
  private var retryTimer: Timer?

  private enum DefaultsKey {
    static let serverURL = "AceyncMenuBar.serverURL"
    static let savedSession = "AceyncMenuBar.savedSession"
    static let selectedDestination = "AceyncMenuBar.selectedDestination"
    static let selectedArtifactId = "AceyncMenuBar.selectedArtifactId"
    static let selectedReviewRequestId = "AceyncMenuBar.selectedReviewRequestId"
  }

  init() {
    let defaults = UserDefaults.standard
    serverURL = defaults.string(forKey: DefaultsKey.serverURL) ?? "http://localhost:3000"
    selectedDestination = CaptureDestinationKind(rawValue: defaults.string(forKey: DefaultsKey.selectedDestination) ?? "") ?? .inbox
    selectedArtifactId = defaults.string(forKey: DefaultsKey.selectedArtifactId) ?? ""
    selectedReviewRequestId = defaults.string(forKey: DefaultsKey.selectedReviewRequestId) ?? ""
    artifactQuery = ""
    pendingUploads = queueStore.load()

    hotkeyMonitor.onPress = { [weak self] in
      Task { [weak self] in
        await self?.toggleRecording()
      }
    }
    hotkeyMonitor.register()

    retryTimer = Timer.scheduledTimer(withTimeInterval: 20, repeats: true) { [weak self] _ in
      Task { [weak self] in
        await self?.refreshForBackgroundWork()
      }
    }

    Task {
      await restoreSession()
    }
  }

  deinit {
    retryTimer?.invalidate()
    hotkeyMonitor.unregister()
  }

  var isAuthenticated: Bool {
    session != nil
  }

  var workspaceTitle: String {
    session?.workspaceSlug ?? "Not connected"
  }

  var filteredArtifacts: [ArtifactSummary] {
    let trimmed = artifactQuery.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else {
      return Array(artifacts.prefix(18))
    }
    return artifacts
      .filter {
        $0.title.localizedCaseInsensitiveContains(trimmed) ||
        ($0.folderName?.localizedCaseInsensitiveContains(trimmed) ?? false)
      }
      .prefix(18)
      .map { $0 }
  }

  var filteredReviewRequests: [ReviewRequestSummary] {
    Array(reviewRequests.prefix(18))
  }

  func signIn() async {
    let email = email.trimmingCharacters(in: .whitespacesAndNewlines)
    let password = password.trimmingCharacters(in: .whitespacesAndNewlines)
    let serverURL = serverURL.trimmingCharacters(in: .whitespacesAndNewlines)

    guard !serverURL.isEmpty, !email.isEmpty, !password.isEmpty else {
      lastStatus = "Enter your server URL, email, and password."
      return
    }

    isSigningIn = true
    defer { isSigningIn = false }

    do {
      let auth = try await apiClient.login(serverURL: serverURL, email: email, password: password)
      try keychainStore.saveToken(auth.token)
      session = auth.session
      persistSession(auth.session)
      persistSelections()
      self.serverURL = serverURL
      UserDefaults.standard.set(serverURL, forKey: DefaultsKey.serverURL)
      self.password = ""
      lastStatus = "Connected to \(auth.session.workspaceSlug)."
      await refreshRemoteData()
      await processPendingUploads()
    } catch {
      lastStatus = error.localizedDescription
    }
  }

  func signOut() {
    keychainStore.clearToken()
    session = nil
    artifacts = []
    reviewRequests = []
    pendingUploads = queueStore.load()
    lastTranscript = ""
    lastStatus = "Signed out."
    UserDefaults.standard.removeObject(forKey: DefaultsKey.savedSession)
  }

  func refreshRemoteData() async {
    guard let session else { return }
    guard let token = try? keychainStore.loadToken() else { return }
    isRefreshing = true
    defer { isRefreshing = false }

    do {
      async let artifactsTask = apiClient.fetchArtifacts(serverURL: serverURL, token: token, workspaceSlug: session.workspaceSlug)
      async let reviewTask = apiClient.fetchReviewRequests(serverURL: serverURL, token: token, workspaceSlug: session.workspaceSlug)

      artifacts = try await artifactsTask
      reviewRequests = try await reviewTask
      syncSelections()
    } catch {
      lastStatus = error.localizedDescription
    }
  }

  func refreshForBackgroundWork() async {
    guard session != nil else { return }
    await processPendingUploads()
    await refreshRemoteData()
  }

  func openWorkspace() {
    guard let session else { return }
    openPath(["w", session.workspaceSlug, "inbox"])
  }

  func openSelectedDestinationInBrowser() {
    guard let session else { return }

    switch resolvedDestination() {
    case .inbox:
      openPath(["w", session.workspaceSlug, "inbox"])
    case .artifact(let artifactId):
      openPath(["w", session.workspaceSlug, "artifacts", artifactId])
    case .reviewRequest(let reviewRequestId):
      openPath(["w", session.workspaceSlug, "review-requests", reviewRequestId])
    }
  }

  func toggleRecording() async {
    guard isAuthenticated else {
      lastStatus = "Sign in before using the menu bar recorder."
      NSApp.activate(ignoringOtherApps: true)
      return
    }

    if isRecording {
      await stopRecordingAndQueueUpload()
    } else {
      await startRecording()
    }
  }

  private func startRecording() async {
    do {
      try await recorder.start()
      isRecording = true
      lastTranscript = ""
      lastStatus = "Recording… press Option-Command-S again to stop."
    } catch {
      lastStatus = error.localizedDescription
    }
  }

  private func stopRecordingAndQueueUpload() async {
    do {
      let fileURL = try recorder.stop()
      isRecording = false
      let destination = resolvedDestination()
      let pending = try queueStore.enqueue(
        sourceFileURL: fileURL,
        destination: destination.kind,
        artifactId: destination.artifactId,
        reviewRequestId: destination.reviewRequestId
      )
      try? FileManager.default.removeItem(at: fileURL)
      pendingUploads = queueStore.load()
      lastStatus = "Saved locally. Syncing to Aceync…"
      await processPendingUploads(startingWith: pending.id)
    } catch {
      isRecording = false
      lastStatus = error.localizedDescription
    }
  }

  private func restoreSession() async {
    pendingUploads = queueStore.load()

    guard
      let token = try? keychainStore.loadToken(),
      let savedSession = loadPersistedSession()
    else {
      lastStatus = pendingUploads.isEmpty ? "Sign in to connect the menu bar app." : "Sign in to flush queued uploads."
      return
    }

    do {
      let validated = try await apiClient.fetchSession(serverURL: serverURL, token: token)
      session = DesktopSession(
        userId: validated.userId,
        workspaceId: validated.workspaceId,
        workspaceSlug: validated.workspaceSlug,
        role: validated.role,
        name: savedSession.name ?? validated.name,
        email: savedSession.email ?? validated.email
      )
      persistSession(session)
      lastStatus = pendingUploads.isEmpty ? "Connected to \(validated.workspaceSlug)." : "Connected. Resuming queued uploads."
      await refreshRemoteData()
      await processPendingUploads()
    } catch {
      keychainStore.clearToken()
      session = nil
      lastStatus = pendingUploads.isEmpty ? "Session expired. Sign in again." : "Session expired. Sign in to flush queued uploads."
    }
  }

  private func processPendingUploads(startingWith prioritizedId: String? = nil) async {
    guard !isProcessingQueue else { return }
    guard let session else {
      pendingUploads = queueStore.load()
      return
    }
    guard let token = try? keychainStore.loadToken() else {
      pendingUploads = queueStore.load()
      return
    }

    isProcessingQueue = true
    defer { isProcessingQueue = false }

    var queue = queueStore.load()
    if let prioritizedId, let index = queue.firstIndex(where: { $0.id == prioritizedId }) {
      let prioritized = queue.remove(at: index)
      queue.insert(prioritized, at: 0)
    }

    for item in queue {
      guard FileManager.default.fileExists(atPath: item.filePath) else {
        try? queueStore.remove(item)
        pendingUploads = queueStore.load()
        continue
      }

      let fileURL = URL(fileURLWithPath: item.filePath)

      do {
        let contributionId: String
        switch item.destination {
        case .inbox:
          contributionId = try await apiClient.uploadAudio(
            serverURL: serverURL,
            token: token,
            workspaceSlug: session.workspaceSlug,
            fileURL: fileURL,
            artifactId: nil
          )
        case .artifact:
          contributionId = try await apiClient.uploadAudio(
            serverURL: serverURL,
            token: token,
            workspaceSlug: session.workspaceSlug,
            fileURL: fileURL,
            artifactId: item.artifactId
          )
        case .reviewRequest:
          guard let reviewRequestId = item.reviewRequestId else {
            throw APIClientError(message: "Missing review request target.")
          }
          contributionId = try await apiClient.uploadReviewAudio(
            serverURL: serverURL,
            token: token,
            workspaceSlug: session.workspaceSlug,
            reviewRequestId: reviewRequestId,
            fileURL: fileURL
          )
        }

        try queueStore.remove(item)
        pendingUploads = queueStore.load()
        lastStatus = "Uploaded. Waiting for transcript…"
        await trackContribution(contributionId)
      } catch {
        pendingUploads = queueStore.load()
        lastStatus = "Upload queued for retry: \(error.localizedDescription)"
        break
      }
    }
  }

  private func trackContribution(_ contributionId: String) async {
    guard let session else { return }
    guard let token = try? keychainStore.loadToken() else { return }

    for _ in 0..<12 {
      do {
        let contribution = try await apiClient.fetchContribution(
          serverURL: serverURL,
          token: token,
          workspaceSlug: session.workspaceSlug,
          contributionId: contributionId
        )
        let transcript = (contribution.transcript ?? contribution.textContent ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        if !transcript.isEmpty {
          lastTranscript = transcript
          lastStatus = "Synced to Aceync."
          await refreshRemoteData()
          return
        }
      } catch {
        lastStatus = "Uploaded. Aceync is still processing the note."
      }

      try? await Task.sleep(nanoseconds: 1_500_000_000)
    }

    lastStatus = "Uploaded. Aceync will finish processing in the web app."
    await refreshRemoteData()
  }

  private func resolvedDestination() -> ResolvedDestination {
    switch selectedDestination {
    case .inbox:
      return .inbox
    case .artifact:
      let resolvedArtifactId = selectedArtifactId.isEmpty ? artifacts.first?.id : selectedArtifactId
      guard let resolvedArtifactId else { return .inbox }
      return .artifact(id: resolvedArtifactId)
    case .reviewRequest:
      let resolvedReviewRequestId = selectedReviewRequestId.isEmpty ? reviewRequests.first?.id : selectedReviewRequestId
      guard let resolvedReviewRequestId else { return .inbox }
      return .reviewRequest(id: resolvedReviewRequestId)
    }
  }

  private func openPath(_ components: [String]) {
    guard var url = URL(string: normalizedServerURL(serverURL)) else { return }
    for component in components {
      url.appendPathComponent(component)
    }
    NSWorkspace.shared.open(url)
  }

  private func normalizedServerURL(_ serverURL: String) -> String {
    let trimmed = serverURL.trimmingCharacters(in: .whitespacesAndNewlines)
    return trimmed.hasSuffix("/") ? String(trimmed.dropLast()) : trimmed
  }

  private func syncSelections() {
    if selectedArtifactId.isEmpty || !artifacts.contains(where: { $0.id == selectedArtifactId }) {
      selectedArtifactId = artifacts.first?.id ?? ""
    }
    if selectedReviewRequestId.isEmpty || !reviewRequests.contains(where: { $0.id == selectedReviewRequestId }) {
      selectedReviewRequestId = reviewRequests.first?.id ?? ""
    }
    persistSelections()
  }

  func persistSelectionState() {
    persistSelections()
  }

  private func persistSelections() {
    let defaults = UserDefaults.standard
    defaults.set(serverURL, forKey: DefaultsKey.serverURL)
    defaults.set(selectedDestination.rawValue, forKey: DefaultsKey.selectedDestination)
    defaults.set(selectedArtifactId, forKey: DefaultsKey.selectedArtifactId)
    defaults.set(selectedReviewRequestId, forKey: DefaultsKey.selectedReviewRequestId)
  }

  private func persistSession(_ session: DesktopSession?) {
    let defaults = UserDefaults.standard
    guard let session, let data = try? JSONEncoder().encode(session) else {
      defaults.removeObject(forKey: DefaultsKey.savedSession)
      return
    }
    defaults.set(data, forKey: DefaultsKey.savedSession)
  }

  private func loadPersistedSession() -> DesktopSession? {
    guard
      let data = UserDefaults.standard.data(forKey: DefaultsKey.savedSession),
      let session = try? JSONDecoder().decode(DesktopSession.self, from: data)
    else {
      return nil
    }
    return session
  }
}

private enum ResolvedDestination {
  case inbox
  case artifact(id: String)
  case reviewRequest(id: String)

  var kind: CaptureDestinationKind {
    switch self {
    case .inbox:
      return .inbox
    case .artifact:
      return .artifact
    case .reviewRequest:
      return .reviewRequest
    }
  }

  var artifactId: String? {
    switch self {
    case .artifact(let id):
      return id
    default:
      return nil
    }
  }

  var reviewRequestId: String? {
    switch self {
    case .reviewRequest(let id):
      return id
    default:
      return nil
    }
  }
}
