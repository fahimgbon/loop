(function bootstrapAceyncDocsPanel() {
  if (window.__aceyncDocsPanelLoaded) return;
  window.__aceyncDocsPanelLoaded = true;

  const TEMPLATE_OPTIONS = [
    { value: "", label: "Inferred standard" },
    { value: "prd", label: "PRD" },
    { value: "research-question", label: "Research question" },
    { value: "policy-proposal", label: "Policy proposal" },
    { value: "startup-idea", label: "Startup idea" },
  ];

  const state = {
    open: false,
    busy: false,
    feedbackBusy: false,
    loadingConnection: true,
    loadingArtifacts: false,
    config: null,
    session: null,
    error: "",
    artifacts: [],
    mode: "new_artifact",
    templateSlug: "",
    currentDoc: getCurrentDoc(),
    docLink: null,
    selectedArtifactId: "",
    importResult: null,
    feedbackItems: [],
    recorder: {
      mediaRecorder: null,
      stream: null,
      chunks: [],
      startedAt: null,
      timerId: null,
    },
    recording: false,
    recordingSeconds: 0,
  };

  const host = document.createElement("div");
  host.id = "aceync-docs-root";
  document.documentElement.appendChild(host);
  const shadowRoot = host.attachShadow({ mode: "open" });

  shadowRoot.innerHTML = `
    <style>${panelStyles()}</style>
    <button id="aceync-toggle" class="aceync-toggle" type="button" aria-expanded="false">Aceync</button>
    <aside id="aceync-panel" class="aceync-panel is-hidden" aria-live="polite">
      <div class="aceync-panel__shell">
        <div class="aceync-panel__header">
          <div>
            <div class="intent-pill">Google Docs</div>
            <h2>Standardize this doc</h2>
            <p class="muted">Import into Aceync and capture voice feedback without leaving the page.</p>
          </div>
          <button id="aceync-close" class="aceync-icon-btn" type="button" aria-label="Close panel">×</button>
        </div>

        <section class="aceync-card">
          <div class="section-title">Connection</div>
          <div id="connection-status" class="status-line">
            <span class="status-dot"></span>
            <span>Checking connection…</span>
          </div>
          <p id="connection-detail" class="muted">Open the extension popup if this stays disconnected.</p>
          <div class="row-actions">
            <button id="aceync-refresh" class="btn btn-secondary" type="button">Refresh</button>
            <button id="aceync-open-connect" class="btn btn-ghost" type="button">Open connect page</button>
          </div>
        </section>

        <section class="aceync-card">
          <div class="section-title">Current doc</div>
          <div class="doc-card">
            <div id="doc-title" class="doc-title"></div>
            <div id="doc-meta" class="doc-meta"></div>
          </div>
        </section>

        <section class="aceync-card">
          <div class="section-title">Artifact sync</div>
          <label class="field">
            <span>Mode</span>
            <select id="import-mode"></select>
          </label>
          <label class="field">
            <span>Standard format</span>
            <select id="template-slug"></select>
          </label>
          <label id="artifact-field" class="field">
            <span>Target artifact</span>
            <select id="artifact-select"></select>
          </label>
          <div class="row-actions">
            <button id="sync-doc" class="btn btn-primary" type="button">Sync into Aceync</button>
            <a id="artifact-link" class="btn btn-secondary link-btn hidden" href="#" target="_blank" rel="noreferrer">Open artifact</a>
          </div>
          <p id="import-feedback" class="muted"></p>
        </section>

        <section class="aceync-card">
          <div class="section-title">Voice feedback</div>
          <p class="muted">Record feedback against the active artifact. Aceync will transcribe it asynchronously.</p>
          <div class="voice-status">
            <span class="status-dot" id="recording-dot"></span>
            <span id="recording-label">Ready to record</span>
          </div>
          <div class="row-actions">
            <button id="record-button" class="btn btn-primary" type="button">Record feedback</button>
            <button id="stop-button" class="btn btn-danger hidden" type="button">Stop and upload</button>
          </div>
          <div id="feedback-list" class="feedback-list"></div>
        </section>

        <div id="global-error" class="error hidden"></div>
      </div>
    </aside>
  `;

  const elements = {
    toggle: shadowRoot.getElementById("aceync-toggle"),
    panel: shadowRoot.getElementById("aceync-panel"),
    close: shadowRoot.getElementById("aceync-close"),
    refresh: shadowRoot.getElementById("aceync-refresh"),
    openConnect: shadowRoot.getElementById("aceync-open-connect"),
    connectionStatus: shadowRoot.getElementById("connection-status"),
    connectionDetail: shadowRoot.getElementById("connection-detail"),
    docTitle: shadowRoot.getElementById("doc-title"),
    docMeta: shadowRoot.getElementById("doc-meta"),
    importMode: shadowRoot.getElementById("import-mode"),
    templateSlug: shadowRoot.getElementById("template-slug"),
    artifactField: shadowRoot.getElementById("artifact-field"),
    artifactSelect: shadowRoot.getElementById("artifact-select"),
    syncDoc: shadowRoot.getElementById("sync-doc"),
    artifactLink: shadowRoot.getElementById("artifact-link"),
    importFeedback: shadowRoot.getElementById("import-feedback"),
    recordButton: shadowRoot.getElementById("record-button"),
    stopButton: shadowRoot.getElementById("stop-button"),
    recordingDot: shadowRoot.getElementById("recording-dot"),
    recordingLabel: shadowRoot.getElementById("recording-label"),
    feedbackList: shadowRoot.getElementById("feedback-list"),
    globalError: shadowRoot.getElementById("global-error"),
  };

  seedSelect(elements.importMode, [
    { value: "new_artifact", label: "Create a fresh artifact" },
    { value: "extend_artifact", label: "Append into an existing artifact" },
  ]);
  seedSelect(elements.templateSlug, TEMPLATE_OPTIONS);

  elements.toggle.addEventListener("click", () => {
    state.open = !state.open;
    render();
    if (state.open) void refreshConnection();
  });
  elements.close.addEventListener("click", () => {
    state.open = false;
    render();
  });
  elements.refresh.addEventListener("click", () => void refreshConnection(true));
  elements.openConnect.addEventListener("click", async () => {
    const base = state.config?.appBaseUrl || "http://localhost:4000";
    window.open(`${base}/extension/connect`, "_blank", "noopener,noreferrer");
  });
  elements.importMode.addEventListener("change", (event) => {
    state.mode = event.target.value;
    render();
  });
  elements.templateSlug.addEventListener("change", (event) => {
    state.templateSlug = event.target.value;
  });
  elements.artifactSelect.addEventListener("change", async (event) => {
    state.selectedArtifactId = event.target.value;
    await persistSelectedArtifact();
    render();
  });
  elements.syncDoc.addEventListener("click", () => void syncCurrentDoc());
  elements.recordButton.addEventListener("click", () => void startRecording());
  elements.stopButton.addEventListener("click", () => void stopRecordingAndUpload());

  render();
  void refreshConnection();
  window.setInterval(() => {
    const nextDoc = getCurrentDoc();
    if (nextDoc.id !== state.currentDoc.id || nextDoc.url !== state.currentDoc.url || nextDoc.title !== state.currentDoc.title) {
      state.currentDoc = nextDoc;
      state.importResult = null;
      void loadDocLink();
      render();
    }
  }, 1500);

  async function refreshConnection(forceArtifacts) {
    state.loadingConnection = true;
    state.error = "";
    render();
    try {
      state.config = await sendMessage("GET_CONFIG");
      if (!state.config.appBaseUrl || !state.config.extensionToken) {
        state.session = null;
        state.artifacts = [];
        state.docLink = null;
        state.selectedArtifactId = "";
        return;
      }

      const sessionData = await sendMessage("VALIDATE_SESSION");
      state.session = sessionData.session ?? null;
      if (!state.session) throw new Error("The saved token could not be validated.");

      await loadDocLink();
      if (forceArtifacts || state.artifacts.length === 0) {
        await loadArtifacts();
      }
    } catch (error) {
      state.session = null;
      state.artifacts = [];
      state.error = error.message || "Connection failed";
    } finally {
      state.loadingConnection = false;
      render();
    }
  }

  async function loadArtifacts() {
    if (!state.session) return;
    state.loadingArtifacts = true;
    render();
    try {
      const data = await sendMessage("LIST_ARTIFACTS", {
        workspaceSlug: state.session.workspaceSlug,
      });
      state.artifacts = Array.isArray(data.artifacts) ? data.artifacts : [];
      if (state.docLink?.artifactId) {
        state.selectedArtifactId = state.docLink.artifactId;
      } else if (!state.selectedArtifactId && state.artifacts[0]?.id) {
        state.selectedArtifactId = state.artifacts[0].id;
      }
    } finally {
      state.loadingArtifacts = false;
      render();
    }
  }

  async function loadDocLink() {
    if (!state.currentDoc.id) {
      state.docLink = null;
      state.selectedArtifactId = "";
      return;
    }
    state.docLink = await sendMessage("GET_DOC_LINK", { docId: state.currentDoc.id });
    state.selectedArtifactId = state.docLink?.artifactId || state.selectedArtifactId || "";
  }

  async function persistSelectedArtifact() {
    if (!state.currentDoc.id || !state.selectedArtifactId) return;
    const artifact = state.artifacts.find((item) => item.id === state.selectedArtifactId);
    state.docLink = await sendMessage("SET_DOC_LINK", {
      docId: state.currentDoc.id,
      artifact: {
        artifactId: state.selectedArtifactId,
        artifactTitle: artifact?.title || state.currentDoc.title,
      },
    });
  }

  async function syncCurrentDoc() {
    if (!state.session) {
      state.error = "Connect the extension first.";
      render();
      return;
    }
    if (state.mode === "extend_artifact" && !state.selectedArtifactId) {
      state.error = "Pick an existing artifact before extending it.";
      render();
      return;
    }

    state.busy = true;
    state.error = "";
    state.importResult = null;
    render();

    try {
      const body = {
        docUrl: state.currentDoc.url,
        title: state.currentDoc.title,
        mode: state.mode,
        targetArtifactId: state.mode === "extend_artifact" ? state.selectedArtifactId : undefined,
        structureMode: "template",
        templateSlug: state.templateSlug || undefined,
        captureContribution: true,
      };

      const result = await sendMessage("IMPORT_GOOGLE_DOC", {
        workspaceSlug: state.session.workspaceSlug,
        body,
      });

      state.importResult = result;
      const artifactTitle =
        state.artifacts.find((item) => item.id === result.artifactId)?.title || state.currentDoc.title;

      state.docLink = await sendMessage("SET_DOC_LINK", {
        docId: state.currentDoc.id,
        artifact: {
          artifactId: result.artifactId,
          artifactTitle,
        },
      });
      state.selectedArtifactId = result.artifactId;
      await loadArtifacts();
      if (result.contributionId) {
        trackFeedbackItem({
          id: result.contributionId,
          label: "Source doc",
          transcript: "",
          intent: "",
          pending: true,
        });
        void pollContribution(result.contributionId, "Source doc");
      }
    } catch (error) {
      state.error = error.message || "Import failed";
    } finally {
      state.busy = false;
      render();
    }
  }

  async function startRecording() {
    if (!state.session) {
      state.error = "Connect the extension first.";
      render();
      return;
    }
    if (!activeArtifactId()) {
      state.error = "Sync this doc into an artifact or choose an artifact before recording feedback.";
      render();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      state.recorder.stream = stream;
      state.recorder.mediaRecorder = recorder;
      state.recorder.chunks = [];
      state.recorder.startedAt = Date.now();
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) state.recorder.chunks.push(event.data);
      };
      recorder.start();
      state.recording = true;
      state.recordingSeconds = 0;
      state.recorder.timerId = window.setInterval(() => {
        state.recordingSeconds = Math.max(0, Math.floor((Date.now() - state.recorder.startedAt) / 1000));
        render();
      }, 500);
      render();
    } catch (error) {
      state.error = error.message || "Microphone access was denied.";
      render();
    }
  }

  async function stopRecordingAndUpload() {
    if (!state.recorder.mediaRecorder) return;

    state.feedbackBusy = true;
    render();

    try {
      const recorder = state.recorder.mediaRecorder;
      await new Promise((resolve) => {
        recorder.onstop = () => resolve();
        recorder.stop();
      });

      state.recorder.stream?.getTracks().forEach((track) => track.stop());
      if (state.recorder.timerId) window.clearInterval(state.recorder.timerId);

      const blob = new Blob(state.recorder.chunks, { type: "audio/webm" });
      const bytes = await blob.arrayBuffer();
      const result = await sendMessage("UPLOAD_AUDIO_FEEDBACK", {
        workspaceSlug: state.session.workspaceSlug,
        artifactId: activeArtifactId(),
        filename: `google-doc-feedback-${Date.now()}.webm`,
        mimeType: blob.type,
        bytes,
      });

      trackFeedbackItem({
        id: result.contributionId,
        label: "Voice note",
        transcript: "",
        intent: "",
        pending: true,
      });
      void pollContribution(result.contributionId, "Voice note");
    } catch (error) {
      state.error = error.message || "Upload failed";
    } finally {
      resetRecorder();
      state.feedbackBusy = false;
      render();
    }
  }

  async function pollContribution(contributionId, label) {
    const maxAttempts = 20;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      try {
        const data = await sendMessage("GET_CONTRIBUTION", {
          workspaceSlug: state.session.workspaceSlug,
          contributionId,
        });
        const contribution = data.contribution;
        const transcript = String(contribution?.transcript || contribution?.text_content || "").trim();
        const pending = !transcript;
        trackFeedbackItem({
          id: contributionId,
          label,
          transcript,
          intent: contribution?.intent || "",
          pending,
        });
        render();
        if (!pending) return;
      } catch {
        // Ignore transient polling errors.
      }
      await delay(1500);
    }
  }

  function trackFeedbackItem(item) {
    const existingIndex = state.feedbackItems.findIndex((entry) => entry.id === item.id);
    if (existingIndex >= 0) {
      state.feedbackItems[existingIndex] = { ...state.feedbackItems[existingIndex], ...item };
      return;
    }
    state.feedbackItems.unshift(item);
    state.feedbackItems = state.feedbackItems.slice(0, 4);
  }

  function activeArtifactId() {
    return state.docLink?.artifactId || state.selectedArtifactId || "";
  }

  function resetRecorder() {
    state.recording = false;
    state.recordingSeconds = 0;
    state.recorder.mediaRecorder = null;
    state.recorder.stream = null;
    state.recorder.chunks = [];
    state.recorder.startedAt = null;
    if (state.recorder.timerId) window.clearInterval(state.recorder.timerId);
    state.recorder.timerId = null;
  }

  function render() {
    elements.toggle.setAttribute("aria-expanded", String(state.open));
    elements.panel.classList.toggle("is-hidden", !state.open);

    const connected = Boolean(state.session);
    elements.connectionStatus.innerHTML = `
      <span class="status-dot ${connected ? "is-on" : ""}"></span>
      <span>${state.loadingConnection ? "Checking connection…" : connected ? `Connected to ${state.session.workspaceSlug}` : "Not connected"}</span>
    `;
    elements.connectionDetail.textContent = connected
      ? `Imports and feedback will sync into ${state.session.workspaceSlug}.`
      : state.error || "Use the popup to set your app URL and extension token.";

    elements.docTitle.textContent = state.currentDoc.title || "Untitled Google Doc";
    elements.docMeta.textContent = state.currentDoc.id
      ? `Doc ID ${state.currentDoc.id}`
      : "Open a Google Doc to use this panel.";

    elements.importMode.value = state.mode;
    elements.templateSlug.value = state.templateSlug;
    elements.artifactField.classList.toggle("hidden", state.mode !== "extend_artifact");

    seedSelect(
      elements.artifactSelect,
      state.artifacts.length
        ? state.artifacts.map((artifact) => ({
            value: artifact.id,
            label: `${artifact.title}${artifact.folder_name ? ` · ${artifact.folder_name}` : ""}`,
          }))
        : [{ value: "", label: state.loadingArtifacts ? "Loading artifacts…" : "No artifacts found" }],
    );
    elements.artifactSelect.value = state.selectedArtifactId || "";
    elements.artifactSelect.disabled = state.loadingArtifacts || !state.artifacts.length;

    const artifactId = activeArtifactId();
    const artifactUrl =
      connected && artifactId
        ? `${state.config.appBaseUrl}/w/${state.session.workspaceSlug}/artifacts/${artifactId}`
        : "#";
    elements.artifactLink.href = artifactUrl;
    elements.artifactLink.classList.toggle("hidden", !artifactId || !connected);
    elements.importFeedback.textContent = state.importResult
      ? `Synced. ${state.importResult.insertedBlocks || 0} block(s) inserted, ${state.importResult.updatedBlocks || 0} block(s) updated.${state.importResult.contributionId ? " Source doc captured as a contribution." : ""}`
      : artifactId
        ? `Linked to ${state.docLink?.artifactTitle || "an artifact"}.`
        : "Sync this doc to create or extend a structured artifact.";

    elements.syncDoc.disabled = state.busy || !connected || !state.currentDoc.id;
    elements.syncDoc.textContent = state.busy ? "Syncing…" : "Sync into Aceync";

    elements.recordButton.disabled = !connected || !artifactId || state.feedbackBusy || state.recording;
    elements.stopButton.classList.toggle("hidden", !state.recording);
    elements.recordButton.classList.toggle("hidden", state.recording);
    elements.stopButton.disabled = state.feedbackBusy;
    elements.recordingDot.classList.toggle("is-on", state.recording);
    elements.recordingLabel.textContent = state.recording
      ? `Recording… ${state.recordingSeconds}s`
      : artifactId
        ? "Ready to record"
        : "Pick or create an artifact first";

    elements.feedbackList.innerHTML = state.feedbackItems.length
      ? state.feedbackItems
          .map(
            (item) => `
              <article class="feedback-item">
                <div class="feedback-item__head">
                  <strong>${escapeHtml(item.label)}</strong>
                  <span class="mini-pill ${item.pending ? "" : "is-on"}">${item.pending ? "Parsing…" : item.intent || "Captured"}</span>
                </div>
                <p>${escapeHtml(item.transcript || "Aceync is still transcribing this input.")}</p>
              </article>
            `,
          )
          .join("")
      : `<p class="muted">New voice notes and imported-source captures will appear here.</p>`;

    elements.globalError.textContent = state.error;
    elements.globalError.classList.toggle("hidden", !state.error);
  }

  function getCurrentDoc() {
    const url = new URL(window.location.href);
    const match = url.pathname.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
    return {
      id: match ? match[1] : "",
      url: `${url.origin}${url.pathname}`,
      title: document.title.replace(/\s*-\s*Google Docs\s*$/i, "").trim() || "Untitled Google Doc",
    };
  }

  function seedSelect(select, options) {
    const current = select.value;
    select.innerHTML = options
      .map((option) => `<option value="${escapeAttr(option.value)}">${escapeHtml(option.label)}</option>`)
      .join("");
    if (options.some((option) => option.value === current)) {
      select.value = current;
    }
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

  function delay(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function escapeAttr(value) {
    return escapeHtml(value).replaceAll("`", "&#96;");
  }

  function panelStyles() {
    return `
      :host {
        all: initial;
      }

      * {
        box-sizing: border-box;
      }

      .aceync-toggle,
      .aceync-panel {
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      .aceync-toggle {
        position: fixed;
        right: 20px;
        top: 92px;
        z-index: 2147483646;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 42px;
        border-radius: 999px;
        border: 1px solid rgba(15, 23, 42, 0.12);
        background: linear-gradient(135deg, rgba(15, 23, 42, 0.98), rgba(70, 116, 242, 0.94));
        color: white;
        padding: 0 16px;
        font-size: 13px;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        box-shadow: 0 22px 46px rgba(15, 23, 42, 0.28);
        cursor: pointer;
      }

      .aceync-panel {
        position: fixed;
        top: 24px;
        right: 20px;
        bottom: 24px;
        z-index: 2147483645;
        width: min(400px, calc(100vw - 32px));
      }

      .aceync-panel.is-hidden {
        display: none;
      }

      .aceync-panel__shell {
        display: grid;
        gap: 14px;
        height: 100%;
        overflow: auto;
        border-radius: 32px;
        border: 1px solid rgba(179, 191, 214, 0.74);
        background:
          radial-gradient(circle at top right, rgba(122, 104, 246, 0.16), transparent 38%),
          radial-gradient(circle at top left, rgba(70, 116, 242, 0.14), transparent 34%),
          rgba(255, 255, 255, 0.96);
        padding: 18px;
        color: rgb(8 15 35 / 1);
        box-shadow: 0 36px 120px rgba(15, 23, 42, 0.2);
        backdrop-filter: blur(18px) saturate(180%);
      }

      .aceync-panel__header {
        display: flex;
        justify-content: space-between;
        gap: 12px;
      }

      .aceync-panel__header h2 {
        margin: 8px 0 4px;
        font-size: 24px;
        line-height: 1.05;
      }

      .muted {
        margin: 0;
        color: rgba(60, 72, 88, 0.88);
        font-size: 13px;
        line-height: 1.45;
      }

      .intent-pill,
      .mini-pill {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: fit-content;
        border-radius: 999px;
        border: 1px solid rgba(179, 191, 214, 0.82);
        background: rgba(255, 255, 255, 0.88);
        padding: 6px 10px;
        font-size: 11px;
        letter-spacing: 0.18em;
        text-transform: uppercase;
      }

      .mini-pill {
        padding: 4px 8px;
        font-size: 10px;
        letter-spacing: 0.12em;
      }

      .mini-pill.is-on {
        border-color: rgba(16, 185, 129, 0.3);
        background: rgba(16, 185, 129, 0.08);
        color: rgba(5, 150, 105, 1);
      }

      .aceync-card {
        display: grid;
        gap: 12px;
        border-radius: 24px;
        border: 1px solid rgba(179, 191, 214, 0.65);
        background: rgba(255, 255, 255, 0.94);
        padding: 14px;
        box-shadow: 0 22px 60px rgba(15, 23, 42, 0.08);
      }

      .section-title {
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        color: rgba(60, 72, 88, 0.78);
      }

      .status-line,
      .voice-status {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        font-weight: 600;
      }

      .status-dot {
        width: 10px;
        height: 10px;
        border-radius: 999px;
        border: 1px solid rgba(148, 163, 184, 0.55);
        background: rgba(148, 163, 184, 0.25);
      }

      .status-dot.is-on {
        border-color: rgba(16, 185, 129, 0.6);
        background: rgba(16, 185, 129, 0.85);
        box-shadow: 0 10px 24px rgba(16, 185, 129, 0.22);
      }

      .doc-card {
        display: grid;
        gap: 4px;
        border-radius: 18px;
        background: linear-gradient(180deg, rgba(248, 250, 252, 0.92), rgba(255, 255, 255, 1));
        border: 1px solid rgba(203, 213, 225, 0.9);
        padding: 12px;
      }

      .doc-title {
        font-size: 15px;
        font-weight: 700;
      }

      .doc-meta {
        color: rgba(60, 72, 88, 0.88);
        font-size: 12px;
      }

      .field {
        display: grid;
        gap: 6px;
      }

      .field.hidden {
        display: none;
      }

      .field span {
        font-size: 12px;
        font-weight: 600;
        color: rgba(60, 72, 88, 0.92);
      }

      select {
        width: 100%;
        border: 1px solid rgb(203 213 225 / 1);
        border-radius: 14px;
        background: white;
        padding: 12px 13px;
        color: rgb(8 15 35 / 1);
        font: inherit;
        outline: none;
        box-shadow: 0 8px 22px -18px rgba(4, 12, 27, 0.2);
      }

      select:focus {
        border-color: rgba(70, 116, 242, 1);
        box-shadow: 0 0 0 4px rgba(70, 116, 242, 0.16);
      }

      .row-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        min-height: 40px;
        border-radius: 14px;
        border: 1px solid transparent;
        padding: 0 14px;
        font: inherit;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        text-decoration: none;
        transition: transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease, background 120ms ease;
      }

      .btn:hover {
        transform: translateY(-1px);
      }

      .btn:disabled {
        opacity: 0.54;
        cursor: not-allowed;
        transform: none;
      }

      .btn-primary {
        border-color: rgba(15, 23, 42, 1);
        background: rgba(15, 23, 42, 1);
        color: white;
        box-shadow: 0 18px 40px -24px rgba(4, 12, 27, 0.45);
      }

      .btn-secondary {
        border-color: rgba(203, 213, 225, 1);
        background: white;
        color: rgba(15, 23, 42, 1);
      }

      .btn-danger {
        background: rgb(220 38 38 / 1);
        color: white;
      }

      .btn-ghost {
        background: transparent;
        color: rgba(15, 23, 42, 0.82);
      }

      .link-btn.hidden,
      .hidden {
        display: none;
      }

      .feedback-list {
        display: grid;
        gap: 10px;
      }

      .feedback-item {
        display: grid;
        gap: 8px;
        border-radius: 18px;
        border: 1px solid rgba(203, 213, 225, 0.9);
        background: rgba(248, 250, 252, 0.8);
        padding: 12px;
      }

      .feedback-item__head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }

      .feedback-item p {
        margin: 0;
        color: rgba(15, 23, 42, 0.84);
        font-size: 12px;
        line-height: 1.5;
      }

      .error {
        border-radius: 16px;
        border: 1px solid rgba(248, 113, 113, 0.38);
        background: rgba(254, 242, 242, 0.98);
        color: rgba(153, 27, 27, 1);
        padding: 12px;
        font-size: 12px;
      }

      .aceync-icon-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        border-radius: 999px;
        border: 1px solid rgba(203, 213, 225, 1);
        background: white;
        font-size: 20px;
        cursor: pointer;
      }
    `;
  }
})();
