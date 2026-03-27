const form = document.getElementById("config-form");
const appUrlInput = document.getElementById("app-url");
const tokenInput = document.getElementById("token");
const openConnectButton = document.getElementById("open-connect");
const statusDot = document.getElementById("status-dot");
const statusLabel = document.getElementById("status-label");
const statusDetail = document.getElementById("status-detail");

init().catch((error) => {
  setStatus(false, "Unable to load settings", error.message || "Unknown error");
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const appBaseUrl = normalizeBaseUrl(appUrlInput.value);
  const extensionToken = tokenInput.value.trim();

  if (!appBaseUrl || !extensionToken) {
    setStatus(false, "Missing details", "Both the app URL and extension token are required.");
    return;
  }

  try {
    const granted = await chrome.permissions.request({
      origins: [`${appBaseUrl}/*`],
    });
    if (!granted) {
      setStatus(false, "Permission required", "Allow access to your Aceync app URL so the extension can sync docs.");
      return;
    }

    await sendMessage("SAVE_CONFIG", { appBaseUrl, extensionToken });
    const sessionData = await sendMessage("VALIDATE_SESSION");
    const session = sessionData.session ?? null;
    if (!session) throw new Error("Token was saved, but the session could not be validated.");

    appUrlInput.value = appBaseUrl;
    setStatus(
      true,
      `Connected to ${session.workspaceSlug}`,
      `The Google Docs panel will sync into the ${session.workspaceSlug} workspace.`,
    );
  } catch (error) {
    setStatus(false, "Validation failed", error.message || "Unknown error");
  }
});

openConnectButton.addEventListener("click", async () => {
  const appBaseUrl = normalizeBaseUrl(appUrlInput.value) || "http://localhost:4000";
  await chrome.tabs.create({ url: `${appBaseUrl}/extension/connect` });
});

async function init() {
  const config = await sendMessage("GET_CONFIG");
  appUrlInput.value = config.appBaseUrl || "";
  tokenInput.value = config.extensionToken || "";

  if (config.appBaseUrl && config.extensionToken) {
    try {
      const sessionData = await sendMessage("VALIDATE_SESSION");
      const session = sessionData.session ?? null;
      if (session) {
        setStatus(
          true,
          `Connected to ${session.workspaceSlug}`,
          `Ready to import Google Docs and capture voice feedback into Aceync.`,
        );
        return;
      }
    } catch (error) {
      setStatus(false, "Stored token needs attention", error.message || "Could not validate the saved token.");
      return;
    }
  }

  setStatus(false, "Not connected", "Open the connect page, copy a token, and save it here.");
}

function normalizeBaseUrl(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  try {
    return new URL(trimmed).origin;
  } catch {
    return "";
  }
}

function setStatus(connected, title, detail) {
  statusLabel.textContent = title;
  statusDetail.textContent = detail;
  statusDot.classList.toggle("is-on", Boolean(connected));
}

function sendMessage(type, payload) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type, payload }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (!response?.ok) {
        reject(new Error(response?.error || "Request failed"));
        return;
      }
      resolve(response.result);
    });
  });
}
