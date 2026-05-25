"use client";
import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function ConnectionSuccessfulPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const didMark = useRef(false);

  useEffect(() => {
    if (didMark.current) return;
    didMark.current = true;

    const igBusinessId = searchParams.get("ig_business_id");
    fetch("/api/social/mark-connected", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ig_business_id: igBusinessId }),
    }).catch(() => {});

    const timer = setTimeout(() => {
      router.push("/dashboard");
    }, 3000);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        {/* Success icon */}
        <div className="w-20 h-20 rounded-full bg-primary/10 border-2 border-primary/30 flex items-center justify-center mx-auto mb-6">
          <svg
            className="w-10 h-10 text-primary"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-text-primary mb-2">
          Account Connected! 🎉
        </h1>
        <p className="text-text-secondary text-sm mb-6">
          Your Instagram & Facebook account has been successfully connected to Autom8.
          Your automations are now active.
        </p>

        <div className="flex items-center justify-center gap-2 text-xs text-text-muted mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          Redirecting you to your dashboard…
        </div>

        <button
          onClick={() => router.push("/dashboard")}
          className="inline-flex items-center gap-2 bg-primary hover:brightness-110 transition-all text-white font-semibold px-6 py-2.5 rounded-xl text-sm"
        >
          Go to Dashboard →
        </button>
      </div>
    </div>
  );
}
