import Foundation

struct DesktopSession: Codable {
  let userId: String
  let workspaceId: String
  let workspaceSlug: String
  let role: String
  let name: String?
  let email: String?

  enum CodingKeys: String, CodingKey {
    case userId
    case workspaceId
    case workspaceSlug
    case role
    case name
    case email
  }
}

struct ArtifactSummary: Codable, Identifiable {
  let id: String
  let title: String
  let status: String
  let updatedAt: String
  let folderId: String?
  let folderName: String?

  enum CodingKeys: String, CodingKey {
    case id
    case title
    case status
    case updatedAt = "updated_at"
    case folderId = "folder_id"
    case folderName = "folder_name"
  }
}

struct ReviewRequestSummary: Codable, Identifiable {
  let id: String
  let artifactId: String
  let artifactTitle: String?
  let title: String
  let questions: [String]
  let dueAt: String?
  let createdAt: String

  enum CodingKeys: String, CodingKey {
    case id
    case artifactId = "artifact_id"
    case artifactTitle = "artifact_title"
    case title
    case questions
    case dueAt = "due_at"
    case createdAt = "created_at"
  }
}

struct ContributionSummary: Codable {
  let id: String
  let transcript: String?
  let textContent: String?
  let artifactId: String?

  enum CodingKeys: String, CodingKey {
    case id
    case transcript
    case textContent = "text_content"
    case artifactId = "artifact_id"
  }
}

enum CaptureDestinationKind: String, CaseIterable, Codable, Identifiable {
  case inbox
  case artifact
  case reviewRequest

  var id: String { rawValue }

  var label: String {
    switch self {
    case .inbox:
      return "Inbox"
    case .artifact:
      return "Artifact"
    case .reviewRequest:
      return "Review"
    }
  }
}

struct PendingUpload: Codable, Identifiable {
  let id: String
  let createdAt: Date
  let filePath: String
  let destination: CaptureDestinationKind
  let artifactId: String?
  let reviewRequestId: String?
}
