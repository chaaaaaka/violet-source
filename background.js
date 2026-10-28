const STORE_URLS = [
  /^https?:\/\/chrome\.google\.com\/webstore\/detail\/[^/]+\/([a-p]{32})(?:[/?#]|$)/i,
  /^https?:\/\/chromewebstore\.google\.com\/detail\/[^/]+\/([a-p]{32})(?:[/?#]|$)/i,
  /^https?:\/\/chrome\.google\.com\/webstore\/detail\/([a-p]{32})(?:[/?#]|$)/i
];

function extractExtensionId(input) {
  if (typeof input !== "string" || !input.trim()) return null;
  try {
    const url = new URL(input.trim());
    if (!["http:", "https:"].includes(url.protocol)) return null;
    for (const pattern of STORE_URLS) {
      const match = input.trim().match(pattern);
      if (match?.[1]) return match[1].toLowerCase();
    }
  } catch (_) {}
  return null;
}

function browserVersion() {
  const match = navigator.userAgent.match(/Chrom(?:e|ium)\/(\d+)\.(\d+)\.(\d+)\.(\d+)/);
  return match ? match.slice(1).join(".") : "120.0.0.0";
}

function buildDownloadUrl(id) {
  const version = browserVersion();
  return "https://clients2.google.com/service/update2/crx" +
    "?response=redirect&prodversion=" + encodeURIComponent(version) +
    "&acceptformat=crx2,crx3&x=id%3D" + encodeURIComponent(id) +
    "%26installsource%3Dondemand%26uc";
}

function sendProgress(message, percent = null) {
  chrome.runtime.sendMessage({
    type: "PROGRESS",
    message,
    percent
  }).catch(() => {});
}

function parseCrxToZip(buffer) {
  const bytes = new Uint8Array(buffer);
  if (bytes.length < 12 || String.fromCharCode(...bytes.slice(0, 4)) !== "Cr24") {
    throw new Error("The downloaded file is not a valid CRX package.");
  }
  const view = new DataView(buffer);
  const version = view.getUint32(4, true);
  let offset;
  if (version === 2) {
    if (bytes.length < 16) throw new Error("The CRX header is incomplete.");
    const publicKeyLength = view.getUint32(8, true);
    const signatureLength = view.getUint32(12, true);
    offset = 16 + publicKeyLength + signatureLength;
  } else if (version === 3) {
    const headerLength = view.getUint32(8, true);
    offset = 12 + headerLength;
  } else {
    throw new Error("Unsupported CRX format version: " + version);
  }
  if (offset >= bytes.length) throw new Error("The CRX package does not contain ZIP data.");
  return new Blob([bytes.slice(offset)], { type: "application/zip" });
}

async function getCrxBlob(id) {
  const response = await fetch(buildDownloadUrl(id), { redirect: "follow" });
  if (!response.ok) throw new Error("Download request failed (HTTP " + response.status + ").");
  const buffer = await response.arrayBuffer();
  return new Blob([buffer], { type: "application/x-chrome-extension" });
}

async function saveBlob(blob, filename) {
  // Service workers cannot create object URLs, so use a data URL for the
  // downloaded payload. Build the base64 string in chunks to avoid argument limits.
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  const dataUrl = "data:" + (blob.type || "application/octet-stream") + ";base64," + btoa(binary);
  await chrome.downloads.download({
    url: dataUrl,
    filename,
    saveAs: true,
    conflictAction: "uniquify"
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message.type !== "string") return;

  if (message.type === "EXTRACT_ID") {
    sendResponse({ id: extractExtensionId(message.url) });
    return;
  }

  if (message.type === "GET_ACTIVE_TAB") {
    chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      sendResponse({ url: tab?.url || "" });
    }).catch(() => sendResponse({ url: "" }));
    return true;
  }

  if (message.type === "DOWNLOAD") {
    (async () => {
      const id = extractExtensionId(message.url);
      if (!id) throw new Error("Enter a valid Chrome Web Store extension URL.");
      const format = message.format;
      if (!["crx", "zip"].includes(format)) throw new Error("Choose CRX or ZIP format.");

      sendProgress("Connecting to the Chrome Web Store…", 8);
      const crxBlob = await getCrxBlob(id);
      sendProgress("Package received. Preparing your file…", 72);

      if (format === "crx") {
        await saveBlob(crxBlob, id + ".crx");
      } else {
        const zipBlob = parseCrxToZip(await crxBlob.arrayBuffer());
        await saveBlob(zipBlob, id + ".zip");
      }
      chrome.runtime.sendMessage({ type: "DOWNLOAD_DONE", id, format }).catch(() => {});
    })().catch(error => {
      chrome.runtime.sendMessage({
        type: "DOWNLOAD_ERROR",
        message: error?.message || "Something went wrong. Please try again."
      }).catch(() => {});
    });
    sendResponse({ started: true });
    return true;
  }
});
