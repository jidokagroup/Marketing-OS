/* global chrome */

const PRIVATE_PATH_PARTS = [
  "/direct",
  "/messages",
  "/messaging",
  "/inbox",
  "/notifications",
  "/settings",
  "/accounts",
  "/login",
  "/logout"
];

function platformFromLocation(location) {
  const host = location.hostname.toLowerCase();
  if (host.includes("instagram.com")) return "instagram";
  if (host.includes("facebook.com")) return "facebook";
  if (host.includes("youtube.com") || host.includes("youtu.be")) return "youtube";
  if (host.includes("tiktok.com")) return "tiktok";
  if (host.includes("x.com") || host.includes("twitter.com")) return "x";
  if (host.includes("linkedin.com")) return "linkedin";
  return "other";
}

function isBlockedPrivateArea(location) {
  const path = location.pathname.toLowerCase();
  return PRIVATE_PATH_PARTS.some((part) => path.includes(part));
}

function meta(name) {
  return (
    document.querySelector(`meta[name="${name}"]`)?.content ||
    document.querySelector(`meta[property="${name}"]`)?.content ||
    ""
  ).trim();
}

function visibleText() {
  return (document.body?.innerText || "")
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim()
    .slice(0, 12000);
}

function headings() {
  return Array.from(document.querySelectorAll("h1,h2,h3"))
    .map((node) => node.textContent?.trim())
    .filter(Boolean)
    .slice(0, 20);
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "scan-current-page") return false;

  if (isBlockedPrivateArea(window.location)) {
    sendResponse({
      ok: false,
      url: window.location.href,
      platform: platformFromLocation(window.location),
      error: "Skipped private or account-management area."
    });
    return false;
  }

  sendResponse({
    ok: true,
    url: window.location.href,
    platform: platformFromLocation(window.location),
    title: document.title,
    description: meta("description") || meta("og:description"),
    handle:
      window.location.pathname
        .split("/")
        .map((part) => part.trim())
        .filter(Boolean)
        .find((part) => part.startsWith("@")) || "",
    headings: headings(),
    visibleText: visibleText(),
    capturedAt: new Date().toISOString()
  });
  return false;
});
