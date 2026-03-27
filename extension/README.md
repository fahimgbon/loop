# Aceync Google Docs Extension

This extension adds an Aceync side panel to Google Docs so a doc can be:

- synced into a standardized Aceync artifact
- captured as a transcript-like contribution inside Aceync
- annotated with voice feedback that is uploaded and transcribed asynchronously

## Load it locally

1. Open `chrome://extensions`
2. Enable `Developer mode`
3. Click `Load unpacked`
4. Select the repo's [`extension/`](/Users/fahimgbon/Documents/Loop/extension) folder

## Connect it to Aceync

1. Start the app and sign in.
2. Open [http://localhost:4000/extension/connect](http://localhost:4000/extension/connect) or the equivalent route on your deployed app.
3. Copy the extension token shown there.
4. Open the extension popup and paste:
   - your app URL
   - the extension token
5. Save and validate.

## Use it in Google Docs

1. Open a Google Doc.
2. Click the floating `Aceync` button.
3. Choose whether to create a fresh artifact or append into an existing one.
4. Pick a standardized format template or leave it on inferred standard.
5. Click `Sync into Aceync`.
6. Record voice feedback from the same panel when you want to attach spoken notes to the linked artifact.

## Notes

- Google Doc import uses the workspace's existing Google integration on the server. If import fails with a Google connection error, reconnect Google in Aceync first.
- Voice notes upload straight to Aceync and follow the same async transcription pipeline as the main app.
