const $ = (selector) => document.querySelector(selector);
const urlInput = $("#extensionUrl");
const extensionId = $("#extensionId");
const statusText = $("#statusText");
const statusDot = $("#statusDot");
const progressBar = $("#progressBar");
const crxButton = $("#downloadCrx");
const zipButton = $("#downloadZip");
const allDownloadButtons = [crxButton, zipButton];
let debounceTimer;

function setStatus(message, state = "idle", progress = 0) {
  statusText.textContent = message;
  statusDot.className = "status-dot" + (state === "idle" ? "" : " " + state);
  progressBar.style.width = Math.max(0, Math.min(100, progress)) + "%";
}

function send(message) {
  return chrome.runtime.sendMessage(message);
}

async function updateId() {
  const value = urlInput.value.trim();
  if (!value) {
    extensionId.textContent = "Waiting for URL";
    return null;
  }
  try {
    const result = await send({ type: "EXTRACT_ID", url: value });
    extensionId.textContent = result?.id || "Invalid store URL";
    return result?.id || null;
  } catch (_) {
    extensionId.textContent = "Unable to check URL";
    return null;
  }
}

function setBusy(busy) {
  allDownloadButtons.forEach(button => button.disabled = busy);
}

async function download(format) {
  const id = await updateId();
  if (!id) {
    setStatus("Paste a valid Chrome Web Store extension URL.", "error", 0);
    urlInput.focus();
    return;
  }
  setBusy(true);
  setStatus("Starting download…", "busy", 5);
  try {
    await send({ type: "DOWNLOAD", url: urlInput.value.trim(), format });
  } catch (error) {
    setStatus(error?.message || "Could not start download.", "error", 0);
    setBusy(false);
  }
}

urlInput.addEventListener("input", () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(updateId, 180);
  if (statusDot.classList.contains("error")) setStatus("Ready when you are.", "idle", 0);
});
urlInput.addEventListener("keydown", event => {
  if (event.key === "Enter") updateId();
});
crxButton.addEventListener("click", () => download("crx"));
zipButton.addEventListener("click", () => download("zip"));

$("#pasteButton").addEventListener("click", async () => {
  try {
    const text = await navigator.clipboard.readText();
    if (!text) throw new Error("Clipboard is empty.");
    urlInput.value = text.trim();
    await updateId();
    urlInput.focus();
    setStatus("Link added from clipboard.", "success", 0);
  } catch (_) {
    setStatus("Clipboard access unavailable. Paste with Ctrl+V.", "error", 0);
    urlInput.focus();
  }
});

$("#themeButton").addEventListener("click", async () => {
  document.body.classList.toggle("light");
  const theme = document.body.classList.contains("light") ? "light" : "dark";
  try { await chrome.storage.local.set({ theme }); } catch (_) {}
});

chrome.runtime.onMessage.addListener(message => {
  if (!message) return;
  if (message.type === "PROGRESS") {
    setStatus(message.message || "Working…", "busy", message.percent ?? 35);
  } else if (message.type === "DOWNLOAD_DONE") {
    setStatus(`${message.format.toUpperCase()} package is ready.`, "success", 100);
    setBusy(false);
  } else if (message.type === "DOWNLOAD_ERROR") {
    setStatus(message.message || "Download failed.", "error", 0);
    setBusy(false);
  }
});

(async function init() {
  try {
    const { theme } = await chrome.storage.local.get("theme");
    if (theme === "light") document.body.classList.add("light");
    const { url } = await send({ type: "GET_ACTIVE_TAB" });
    if (url && !url.startsWith("chrome://") && !url.startsWith("chrome-extension://")) {
      urlInput.value = url;
      await updateId();
    }
  } catch (_) {}
})();
