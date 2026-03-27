const DEFAULT_CONFIG = {
  appBaseUrl: "http://localhost:4000",
  extensionToken: "",
};

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  handleMessage(message)
    .then((result) => sendResponse({ ok: true, result }))
    .catch((error) => sendResponse({ ok: false, error: error instanceof Error ? error.message : "Unknown error" }));
  return true;
});

async function handleMessage(message) {
  switch (message?.type) {
    case "GET_CONFIG":
      return getConfig();
    case "SAVE_CONFIG":
      return saveConfig(message.payload ?? {});
    case "VALIDATE_SESSION":
      return fetchJson("/api/auth/session");
    case "LIST_ARTIFACTS":
      return fetchJson(`/api/workspaces/${encodeURIComponent(message.payload.workspaceSlug)}/artifacts`);
    case "IMPORT_GOOGLE_DOC":
      return fetchJson(
        `/api/workspaces/${encodeURIComponent(message.payload.workspaceSlug)}/imports/google-doc`,
        {
          method: "POST",
          body: message.payload.body,
        },
      );
    case "UPLOAD_AUDIO_FEEDBACK":
      return uploadAudioFeedback(message.payload);
    case "GET_CONTRIBUTION":
      return fetchJson(
        `/api/workspaces/${encodeURIComponent(message.payload.workspaceSlug)}/contributions/${encodeURIComponent(message.payload.contributionId)}`,
      );
    case "GET_DOC_LINK":
      return getDocLink(message.payload.docId);
    case "SET_DOC_LINK":
      return setDocLink(message.payload.docId, message.payload.artifact ?? null);
    default:
      throw new Error("Unsupported message");
  }
}

async function getConfig() {
  const stored = await chrome.storage.sync.get(DEFAULT_CONFIG);
  return {
    appBaseUrl: normalizeBaseUrl(stored.appBaseUrl || DEFAULT_CONFIG.appBaseUrl),
    extensionToken: stored.extensionToken || "",
  };
}

async function saveConfig(input) {
  const config = {
    appBaseUrl: normalizeBaseUrl(input.appBaseUrl || DEFAULT_CONFIG.appBaseUrl),
    extensionToken: String(input.extensionToken || "").trim(),
  };
  await chrome.storage.sync.set(config);
  return config;
}

function normalizeBaseUrl(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  const url = new URL(trimmed);
  return url.origin;
}

async function fetchJson(path, options = {}) {
  const config = await getConfig();
  if (!config.appBaseUrl) throw new Error("Set the Loop app URL in the extension popup.");
  if (!config.extensionToken) throw new Error("Set the extension token in the extension popup.");

  const url = new URL(path, config.appBaseUrl).toString();
  const headers = new Headers(options.headers || {});
  headers.set("Authorization", `Bearer ${config.extensionToken}`);

  let body = undefined;
  if (options.formData) {
    body = options.formData;
  } else if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(options.body);
  }

  const response = await fetch(url, {
    method: options.method || "GET",
    headers,
    body,
  });

  const data = await response.json().catch(async () => {
    const text = await response.text().catch(() => "");
    return text ? { error: text } : null;
  });

  if (!response.ok) {
    const message = data && typeof data === "object" && "error" in data ? data.error : `Request failed (${response.status})`;
    throw new Error(String(message));
  }

  return data;
}

async function uploadAudioFeedback(payload) {
  const form = new FormData();
  const blob = new Blob([payload.bytes], { type: payload.mimeType || "audio/webm" });
  form.append("file", blob, payload.filename || "google-doc-feedback.webm");
  if (payload.artifactId) form.append("artifactId", payload.artifactId);
  if (payload.blockId) form.append("blockId", payload.blockId);

  return fetchJson(`/api/workspaces/${encodeURIComponent(payload.workspaceSlug)}/contributions/audio`, {
    method: "POST",
    formData: form,
  });
}

async function getDocLink(docId) {
  if (!docId) return null;
  const stored = await chrome.storage.local.get("docLinks");
  const links = stored.docLinks && typeof stored.docLinks === "object" ? stored.docLinks : {};
  return links[docId] || null;
}

async function setDocLink(docId, artifact) {
  if (!docId) return null;
  const stored = await chrome.storage.local.get("docLinks");
  const links = stored.docLinks && typeof stored.docLinks === "object" ? stored.docLinks : {};
  if (artifact) {
    links[docId] = artifact;
  } else {
    delete links[docId];
  }
  await chrome.storage.local.set({ docLinks: links });
  return links[docId] || null;
}
