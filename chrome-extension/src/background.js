/* global chrome */

const MAX_ENTRIES = 10;
const TAB_LOAD_TIMEOUT_MS = 15000;

function normalizeEntry(entry) {
  const raw = String(entry || "").trim();
  if (!raw) return null;

  const explicit = raw.match(/^([a-zA-Z_ -]+)\s*[:|-]\s*(.+)$/);
  const label = explicit ? explicit[1].trim().toLowerCase() : "";
  const value = explicit ? explicit[2].trim() : raw;
  const handle = value.replace(/^@/, "").trim();

  if (/^https?:\/\//i.test(value)) return value;
  if (value.includes(".") && !value.includes(" ")) return `https://${value}`;

  if (label.includes("instagram")) return `https://www.instagram.com/${handle}`;
  if (label.includes("facebook")) return `https://www.facebook.com/${handle}`;
  if (label.includes("youtube")) return handle.startsWith("@")
    ? `https://www.youtube.com/${handle}`
    : `https://www.youtube.com/@${handle}`;
  if (label.includes("tiktok")) return handle.startsWith("@")
    ? `https://www.tiktok.com/${handle}`
    : `https://www.tiktok.com/@${handle}`;
  if (label === "x" || label.includes("twitter")) return `https://x.com/${handle}`;
  if (label.includes("linkedin")) return `https://www.linkedin.com/company/${handle}`;

  return null;
}

function waitForTabComplete(tabId) {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      resolve(false);
    }, TAB_LOAD_TIMEOUT_MS);

    function listener(updatedTabId, changeInfo) {
      if (updatedTabId !== tabId || changeInfo.status !== "complete") return;
      clearTimeout(timeout);
      chrome.tabs.onUpdated.removeListener(listener);
      resolve(true);
    }

    chrome.tabs.onUpdated.addListener(listener);
  });
}

function createTab(url) {
  return new Promise((resolve, reject) => {
    chrome.tabs.create({ url, active: false }, (tab) => {
      if (chrome.runtime.lastError || !tab?.id) {
        reject(new Error(chrome.runtime.lastError?.message || "Could not open tab"));
        return;
      }
      resolve(tab);
    });
  });
}

function sendScanMessage(tabId) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { type: "scan-current-page" }, (response) => {
      if (chrome.runtime.lastError) {
        resolve({
          ok: false,
          error: chrome.runtime.lastError.message
        });
        return;
      }
      resolve(response || { ok: false, error: "No response from page scanner." });
    });
  });
}

async function scanUrl(url) {
  let tab = null;
  try {
    tab = await createTab(url);
    await waitForTabComplete(tab.id);
    await new Promise((resolve) => setTimeout(resolve, 1200));
    const result = await sendScanMessage(tab.id);
    return { requestedUrl: url, ...result };
  } catch (error) {
    return {
      requestedUrl: url,
      ok: false,
      error: error instanceof Error ? error.message : "Scan failed"
    };
  } finally {
    if (tab?.id) chrome.tabs.remove(tab.id);
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "scan-watchlist") return false;

  const urls = (Array.isArray(message.entries) ? message.entries : [])
    .map(normalizeEntry)
    .filter(Boolean)
    .slice(0, MAX_ENTRIES);

  Promise.all(urls.map(scanUrl))
    .then((results) => {
      sendResponse({
        ok: true,
        requestId: message.requestId,
        scannedAt: new Date().toISOString(),
        results
      });
    })
    .catch((error) => {
      sendResponse({
        ok: false,
        requestId: message.requestId,
        error: error instanceof Error ? error.message : "Watchlist scan failed"
      });
    });

  return true;
});
