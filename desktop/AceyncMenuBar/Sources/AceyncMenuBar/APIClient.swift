import Foundation

struct APIClient {
  private let decoder = JSONDecoder()

  func login(serverURL: String, email: String, password: String) async throws -> (token: String, session: DesktopSession) {
    var request = try baseRequest(serverURL: serverURL, pathComponents: ["api", "auth", "extension-token"], token: nil)
    request.httpMethod = "POST"
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.httpBody = try JSONSerialization.data(withJSONObject: [
      "email": email,
      "password": password,
    ])

    let (data, response) = try await URLSession.shared.data(for: request)
    try validate(response: response, data: data)

    let payload = try decoder.decode(ExtensionLoginResponse.self, from: data)
    return (payload.token, payload.session)
  }

  func fetchSession(serverURL: String, token: String) async throws -> DesktopSession {
    let request = try baseRequest(serverURL: serverURL, pathComponents: ["api", "auth", "session"], token: token)
    let (data, response) = try await URLSession.shared.data(for: request)
    try validate(response: response, data: data)
    let payload = try decoder.decode(SessionPayload.self, from: data)
    guard let session = payload.session else {
      throw APIClientError(message: "Session not found.")
    }
    return session
  }

  func fetchArtifacts(serverURL: String, token: String, workspaceSlug: String) async throws -> [ArtifactSummary] {
    let request = try baseRequest(
      serverURL: serverURL,
      pathComponents: ["api", "workspaces", workspaceSlug, "artifacts"],
      token: token
    )
    let (data, response) = try await URLSession.shared.data(for: request)
    try validate(response: response, data: data)
    return try decoder.decode(ArtifactListPayload.self, from: data).artifacts
  }

  func fetchReviewRequests(serverURL: String, token: String, workspaceSlug: String) async throws -> [ReviewRequestSummary] {
    let request = try baseRequest(
      serverURL: serverURL,
      pathComponents: ["api", "workspaces", workspaceSlug, "review-requests"],
      token: token
    )
    let (data, response) = try await URLSession.shared.data(for: request)
    try validate(response: response, data: data)
    return try decoder.decode(ReviewRequestListPayload.self, from: data).reviewRequests
  }

  func uploadAudio(
    serverURL: String,
    token: String,
    workspaceSlug: String,
    fileURL: URL,
    artifactId: String? = nil
  ) async throws -> String {
    let path = ["api", "workspaces", workspaceSlug, "contributions", "audio"]
    let fields = artifactId.map { ["artifactId": $0] } ?? [:]
    return try await uploadMultipart(
      serverURL: serverURL,
      token: token,
      pathComponents: path,
      fileURL: fileURL,
      fields: fields
    )
  }

  func uploadReviewAudio(
    serverURL: String,
    token: String,
    workspaceSlug: String,
    reviewRequestId: String,
    fileURL: URL
  ) async throws -> String {
    let path = ["api", "workspaces", workspaceSlug, "review-requests", reviewRequestId, "responses", "audio"]
    return try await uploadMultipart(
      serverURL: serverURL,
      token: token,
      pathComponents: path,
      fileURL: fileURL,
      fields: [:]
    )
  }

  func fetchContribution(
    serverURL: String,
    token: String,
    workspaceSlug: String,
    contributionId: String
  ) async throws -> ContributionSummary {
    let request = try baseRequest(
      serverURL: serverURL,
      pathComponents: ["api", "workspaces", workspaceSlug, "contributions", contributionId],
      token: token
    )
    let (data, response) = try await URLSession.shared.data(for: request)
    try validate(response: response, data: data)
    return try decoder.decode(ContributionPayload.self, from: data).contribution
  }

  private func uploadMultipart(
    serverURL: String,
    token: String,
    pathComponents: [String],
    fileURL: URL,
    fields: [String: String]
  ) async throws -> String {
    var request = try baseRequest(serverURL: serverURL, pathComponents: pathComponents, token: token)
    request.httpMethod = "POST"

    let boundary = "Boundary-\(UUID().uuidString)"
    request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")

    let body = try multipartBody(boundary: boundary, fileURL: fileURL, fields: fields)
    request.httpBody = body

    let (data, response) = try await URLSession.shared.data(for: request)
    try validate(response: response, data: data)

    let payload = try decoder.decode(UploadPayload.self, from: data)
    return payload.contributionId
  }

  private func baseRequest(serverURL: String, pathComponents: [String], token: String?) throws -> URLRequest {
    guard var url = URL(string: normalizedServerURL(serverURL)) else {
      throw APIClientError(message: "Enter a valid server URL.")
    }
    for component in pathComponents {
      url.appendPathComponent(component)
    }

    var request = URLRequest(url: url)
    request.timeoutInterval = 60
    if let token {
      request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    }
    return request
  }

  private func normalizedServerURL(_ serverURL: String) -> String {
    let trimmed = serverURL.trimmingCharacters(in: .whitespacesAndNewlines)
    return trimmed.hasSuffix("/") ? String(trimmed.dropLast()) : trimmed
  }

  private func validate(response: URLResponse, data: Data) throws {
    guard let http = response as? HTTPURLResponse else {
      throw APIClientError(message: "Invalid server response.")
    }
    guard (200..<300).contains(http.statusCode) else {
      if let apiError = try? decoder.decode(ErrorPayload.self, from: data) {
        throw APIClientError(message: apiError.error)
      }
      throw APIClientError(message: "Server returned \(http.statusCode).")
    }
  }

  private func multipartBody(boundary: String, fileURL: URL, fields: [String: String]) throws -> Data {
    var data = Data()
    let lineBreak = "\r\n"

    for (key, value) in fields {
      data.append(Data("--\(boundary)\(lineBreak)".utf8))
      data.append(Data("Content-Disposition: form-data; name=\"\(key)\"\(lineBreak)\(lineBreak)".utf8))
      data.append(Data("\(value)\(lineBreak)".utf8))
    }

    let fileData = try Data(contentsOf: fileURL)
    data.append(Data("--\(boundary)\(lineBreak)".utf8))
    data.append(Data("Content-Disposition: form-data; name=\"file\"; filename=\"\(fileURL.lastPathComponent)\"\(lineBreak)".utf8))
    data.append(Data("Content-Type: audio/mp4\(lineBreak)\(lineBreak)".utf8))
    data.append(fileData)
    data.append(Data(lineBreak.utf8))
    data.append(Data("--\(boundary)--\(lineBreak)".utf8))

    return data
  }
}

struct APIClientError: LocalizedError {
  let message: String

  var errorDescription: String? { message }
}

private struct ExtensionLoginResponse: Decodable {
  let token: String
  let session: DesktopSession
}

private struct SessionPayload: Decodable {
  let session: DesktopSession?
}

private struct ArtifactListPayload: Decodable {
  let artifacts: [ArtifactSummary]
}

private struct ReviewRequestListPayload: Decodable {
  let reviewRequests: [ReviewRequestSummary]
}

private struct UploadPayload: Decodable {
  let contributionId: String

  enum CodingKeys: String, CodingKey {
    case contributionId
  }
}

private struct ContributionPayload: Decodable {
  let contribution: ContributionSummary
}

private struct ErrorPayload: Decodable {
  let error: String
}
