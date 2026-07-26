"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Globe2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";

type ExtensionMessage =
  | {
      source?: string;
      type?: "JIDOKA_EXTENSION_READY";
      requestId?: string;
      version?: string;
    }
  | {
      source?: string;
      type?: "JIDOKA_SCAN_RESULT";
      requestId?: string;
      ok?: boolean;
      scannedAt?: string;
      results?: unknown[];
      error?: string;
    };

function readWatchlist(id: string) {
  const element = document.getElementById(id) as HTMLTextAreaElement | null;
  if (!element) return [];
  return element.value
    .split(/\n|,/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 10);
}

export function ChromeExtensionConnect({
  watchlistFieldId,
  scanContextFieldId,
}: {
  watchlistFieldId: string;
  scanContextFieldId: string;
}) {
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(
    "Install the JIDOKA Chrome extension, then connect it here.",
  );
  const pendingRequest = useRef<string | null>(null);

  useEffect(() => {
    function onMessage(event: MessageEvent<ExtensionMessage>) {
      if (event.source !== window) return;
      const message = event.data;
      if (message?.source !== "jidoka-chrome-extension") return;

      if (message.type === "JIDOKA_EXTENSION_READY") {
        pendingRequest.current = null;
        setConnected(true);
        setBusy(false);
        setStatus("Chrome extension connected.");
      }

      if (
        message.type === "JIDOKA_SCAN_RESULT" &&
        (!pendingRequest.current || message.requestId === pendingRequest.current)
      ) {
        pendingRequest.current = null;
        setBusy(false);
        if (!message.ok) {
          setStatus(message.error ?? "Chrome extension scan failed.");
          return;
        }
        const field = document.getElementById(
          scanContextFieldId,
        ) as HTMLTextAreaElement | null;
        if (field) {
          field.value = JSON.stringify(
            {
              scannedAt: message.scannedAt,
              results: message.results ?? [],
            },
            null,
            2,
          );
        }
        setStatus(
          `Chrome scan ready: ${(message.results ?? []).length} page(s) captured.`,
        );
      }
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [scanContextFieldId]);

  function connect() {
    const requestId = crypto.randomUUID();
    pendingRequest.current = requestId;
    setBusy(true);
    setStatus("Looking for the JIDOKA Chrome extension...");
    window.postMessage(
      {
        source: "jidoka-marketing-os",
        type: "JIDOKA_CONNECT_EXTENSION",
        requestId,
      },
      window.location.origin,
    );
    window.setTimeout(() => {
      if (pendingRequest.current !== requestId) return;
      pendingRequest.current = null;
      setBusy(false);
      setStatus(
        "Extension not detected. Install or reload it, then refresh this page.",
      );
    }, 2500);
  }

  function scan() {
    const entries = readWatchlist(watchlistFieldId);
    if (!entries.length) {
      setStatus("Add competitor or influencer accounts before scanning.");
      return;
    }

    const requestId = crypto.randomUUID();
    pendingRequest.current = requestId;
    setBusy(true);
    setStatus("Chrome extension is opening and scanning the watchlist...");
    window.postMessage(
      {
        source: "jidoka-marketing-os",
        type: "JIDOKA_SCAN_WATCHLIST",
        requestId,
        entries,
      },
      window.location.origin,
    );
  }

  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="flex items-center gap-2 text-sm font-medium">
            {connected ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            ) : (
              <Globe2 className="h-4 w-4 text-muted-foreground" />
            )}
            Chrome extension
          </p>
          <p className="text-xs text-muted-foreground">{status}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={connected ? "outline" : "default"}
            onClick={connect}
            disabled={busy}
          >
            {busy && !connected ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Globe2 className="mr-1 h-4 w-4" />
            )}
            Connect to chrome extension
          </Button>
          {connected && (
            <Button type="button" onClick={scan} disabled={busy}>
              {busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Scan watchlist
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
