/* global chrome */

const EXTENSION_SOURCE = "jidoka-chrome-extension";
const APP_SOURCE = "jidoka-marketing-os";

window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  const message = event.data;
  if (!message || message.source !== APP_SOURCE) return;

  if (message.type === "JIDOKA_CONNECT_EXTENSION") {
    window.postMessage(
      {
        source: EXTENSION_SOURCE,
        type: "JIDOKA_EXTENSION_READY",
        requestId: message.requestId,
        version: chrome.runtime.getManifest().version
      },
      window.location.origin
    );
    return;
  }

  if (message.type === "JIDOKA_SCAN_WATCHLIST") {
    chrome.runtime.sendMessage(
      {
        type: "scan-watchlist",
        requestId: message.requestId,
        entries: Array.isArray(message.entries) ? message.entries : []
      },
      (response) => {
        if (chrome.runtime.lastError) {
          window.postMessage(
            {
              source: EXTENSION_SOURCE,
              type: "JIDOKA_SCAN_RESULT",
              requestId: message.requestId,
              ok: false,
              error: chrome.runtime.lastError.message
            },
            window.location.origin
          );
          return;
        }

        window.postMessage(
          {
            source: EXTENSION_SOURCE,
            type: "JIDOKA_SCAN_RESULT",
            requestId: message.requestId,
            ok: Boolean(response?.ok),
            scannedAt: response?.scannedAt,
            results: response?.results ?? [],
            error: response?.error
          },
          window.location.origin
        );
      }
    );
  }
});
