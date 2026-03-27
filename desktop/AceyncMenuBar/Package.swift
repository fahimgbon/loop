// swift-tools-version: 5.9
import PackageDescription

let package = Package(
  name: "AceyncMenuBar",
  platforms: [
    .macOS(.v13)
  ],
  products: [
    .executable(name: "AceyncMenuBar", targets: ["AceyncMenuBar"])
  ],
  targets: [
    .executableTarget(
      name: "AceyncMenuBar",
      path: "Sources/AceyncMenuBar"
    )
  ]
)
