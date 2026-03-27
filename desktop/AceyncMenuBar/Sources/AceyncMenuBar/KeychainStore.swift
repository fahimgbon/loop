import Foundation
import Security

final class KeychainStore {
  private let service = "com.aceync.menubar"
  private let account = "extension-token"

  func saveToken(_ token: String) throws {
    let data = Data(token.utf8)
    let query: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: service,
      kSecAttrAccount as String: account,
    ]

    SecItemDelete(query as CFDictionary)

    let attributes: [String: Any] = query.merging([
      kSecValueData as String: data,
    ]) { _, new in
      new
    }

    let status = SecItemAdd(attributes as CFDictionary, nil)
    guard status == errSecSuccess else {
      throw KeychainStoreError(status: status)
    }
  }

  func loadToken() throws -> String? {
    let query: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: service,
      kSecAttrAccount as String: account,
      kSecReturnData as String: true,
      kSecMatchLimit as String: kSecMatchLimitOne,
    ]

    var result: AnyObject?
    let status = SecItemCopyMatching(query as CFDictionary, &result)
    if status == errSecItemNotFound {
      return nil
    }
    guard status == errSecSuccess else {
      throw KeychainStoreError(status: status)
    }
    guard let data = result as? Data, let token = String(data: data, encoding: .utf8) else {
      return nil
    }
    return token
  }

  func clearToken() {
    let query: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: service,
      kSecAttrAccount as String: account,
    ]
    SecItemDelete(query as CFDictionary)
  }
}

struct KeychainStoreError: LocalizedError {
  let status: OSStatus

  var errorDescription: String? {
    "Keychain error (\(status))."
  }
}
