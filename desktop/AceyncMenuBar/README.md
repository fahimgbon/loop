# Aceync Menu Bar

Native macOS menu bar capture app for Aceync.

## What it does

- Lives in the macOS menu bar with a spade icon
- Signs into the same Aceync backend as the web app
- Records microphone input as an `m4a` voice note
- Queues uploads locally if the network is down
- Syncs voice notes into the Aceync inbox, a specific artifact, or an open review request
- Polls for the generated transcript so the user gets quick confirmation that the web app processed the upload
- Supports a global hotkey: `Option-Command-S`

## Local development

1. Start the web app from the repo root:
   - `npm install`
   - `npm run dev`
2. In another terminal:
   - `cd desktop/AceyncMenuBar`
   - `swift run`

The default server URL is `http://localhost:3000`.

## Notes

- The app uses the existing bearer-style extension token from the web backend.
- Upload retry state is stored in `~/Library/Application Support/AceyncMenuBar`.
- The current package is designed to run locally and in Xcode. For a signed production distribution, the next step would be packaging it as a standard `.app` bundle with notarization and launch-at-login polish.
