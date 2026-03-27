import Foundation

final class UploadQueueStore {
  private let fileManager = FileManager.default
  private let baseDirectory: URL
  private let queueDirectory: URL
  private let manifestURL: URL

  init() {
    let appSupport = fileManager.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
      ?? fileManager.temporaryDirectory
    baseDirectory = appSupport.appendingPathComponent("AceyncMenuBar", isDirectory: true)
    queueDirectory = baseDirectory.appendingPathComponent("Queue", isDirectory: true)
    manifestURL = baseDirectory.appendingPathComponent("pending-uploads.json")
  }

  func load() -> [PendingUpload] {
    ensureDirectories()
    guard let data = try? Data(contentsOf: manifestURL) else {
      return []
    }
    return (try? JSONDecoder().decode([PendingUpload].self, from: data)) ?? []
  }

  @discardableResult
  func enqueue(sourceFileURL: URL, destination: CaptureDestinationKind, artifactId: String?, reviewRequestId: String?) throws -> PendingUpload {
    ensureDirectories()

    let id = UUID().uuidString
    let destinationURL = queueDirectory
      .appendingPathComponent(id)
      .appendingPathExtension(sourceFileURL.pathExtension.isEmpty ? "m4a" : sourceFileURL.pathExtension)

    if fileManager.fileExists(atPath: destinationURL.path) {
      try fileManager.removeItem(at: destinationURL)
    }
    try fileManager.copyItem(at: sourceFileURL, to: destinationURL)

    let item = PendingUpload(
      id: id,
      createdAt: Date(),
      filePath: destinationURL.path,
      destination: destination,
      artifactId: artifactId,
      reviewRequestId: reviewRequestId
    )

    var items = load()
    items.append(item)
    try persist(items)
    return item
  }

  func remove(_ item: PendingUpload) throws {
    var items = load()
    items.removeAll { $0.id == item.id }
    try persist(items)
    try? fileManager.removeItem(atPath: item.filePath)
  }

  func persist(_ items: [PendingUpload]) throws {
    ensureDirectories()
    let data = try JSONEncoder().encode(items)
    try data.write(to: manifestURL, options: [.atomic])
  }

  private func ensureDirectories() {
    try? fileManager.createDirectory(at: baseDirectory, withIntermediateDirectories: true)
    try? fileManager.createDirectory(at: queueDirectory, withIntermediateDirectories: true)
  }
}
