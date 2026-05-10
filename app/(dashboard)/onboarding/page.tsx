"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Button from "@/components/ui/Button";
import InputBlock from "@/components/ui/InputBlock";
import Toggle from "@/components/ui/Toggle";
import { upsertBrandProfile, getBrandProfile } from "@/lib/actions/brand";

const STEPS = [
  { id: 1, label: "Connect", icon: "📱" },
  { id: 2, label: "Brand Voice", icon: "🎨" },
  { id: 3, label: "CTAs", icon: "📣" },
  { id: 4, label: "Activate", icon: "⚡" },
];

const toneOptions = ["Friendly", "Professional", "Playful", "Authoritative", "Luxe", "Bold", "Warm"];
const ctaOptions = ["Book Now", "DM Us", "Link in Bio", "Get Quote", "Shop Now", "Book a Call", "Claim Offer"];

function OnboardingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const justPaid = searchParams.get("paid") === "1";
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Step 1
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState("");

  // Step 2
  const [businessName, setBusinessName] = useState("");
  const [description, setDescription] = useState("");
  const [tones, setTones] = useState<string[]>(["Friendly"]);
  const [emojiAllowed, setEmojiAllowed] = useState(true);

  // Step 3
  const [selectedCtas, setSelectedCtas] = useState<string[]>(["Book Now", "DM Us"]);
  const [ctaKeywords, setCtaKeywords] = useState("price, how much, book, available");

  // Step 4
  const [autoReply, setAutoReply] = useState(false);
  const [reviewFirst, setReviewFirst] = useState(true);

  // Pre-fill from existing brand profile (returning users)
  useEffect(() => {
    getBrandProfile()
      .then((profile) => {
        if (!profile) return;
        setBusinessName(profile.business_name ?? "");
        setDescription(profile.description ?? "");
        setTones(profile.tone?.length ? profile.tone : ["Friendly"]);
        setEmojiAllowed(profile.emoji_allowed ?? true);
        setCtaKeywords(profile.cta_keywords?.join(", ") ?? "");
      })
      .catch(() => {});
  }, []);

  const toggleTone = (tone: string) =>
    setTones((p) => p.includes(tone) ? p.filter((t) => t !== tone) : [...p, tone]);

  const toggleCta = (cta: string) =>
    setSelectedCtas((p) => p.includes(cta) ? p.filter((c) => c !== cta) : [...p, cta]);

  const handleConnect = async () => {
    setConnecting(true);
    setConnectError("");
    try {
      const res = await fetch("/api/social/connect", { method: "POST" });
      const data = await res.json();
      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        setConnectError(data.error ?? "Failed to start connection. Please try again.");
        setConnecting(false);
      }
    } catch {
      setConnectError("Network error. Please try again.");
      setConnecting(false);
    }
  };

  const canAdvance = () => {
    if (step === 2) return businessName.trim().length > 0;
    return true;
  };

  const handleFinish = async () => {
    setSaving(true);
    setSaveError("");
    try {
      await upsertBrandProfile({
        business_name: businessName,
        description: description || null,
        tone: tones,
        emoji_allowed: emojiAllowed,
        cta_keywords: ctaKeywords
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      });
      router.push("/dashboard");
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save. Please try again.");
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-start px-4 py-10">
      {/* Logo */}
      <div className="mb-8">
        <span className="text-2xl font-black tracking-tight text-primary glow-text">Autom8</span>
      </div>

      {/* Payment success banner */}
      {justPaid && (
        <div className="w-full max-w-lg mb-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 px-4 py-3 flex items-center gap-3">
          <span className="text-emerald-400 text-lg">✓</span>
          <p className="text-sm text-emerald-300 font-medium">Payment successful — let&apos;s get you set up!</p>
        </div>
      )}

      {/* Progress bar */}
      <div className="w-full max-w-lg mb-8">
        <div className="flex items-center justify-between mb-3">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-base font-bold border-2 transition-all
                    ${step > s.id
                      ? "bg-primary border-primary text-bg shadow-[0_0_12px_rgba(123,63,242,0.4)]"
                      : step === s.id
                      ? "bg-primary/10 border-primary text-primary"
                      : "bg-surface-elevated border-border text-text-muted"
                    }`}
                >
                  {step > s.id ? "✓" : s.icon}
                </div>
                <span className={`text-[10px] mt-1 font-medium ${step >= s.id ? "text-primary" : "text-text-muted"}`}>
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2 mb-4 rounded-full transition-all ${step > s.id ? "bg-primary shadow-[0_0_6px_rgba(123,63,242,0.4)]" : "bg-border"}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Card */}
      <div className="w-full max-w-lg bg-surface-elevated border border-border rounded-2xl p-6 shadow-lg space-y-5">

        {/* Step 1 — Connect Instagram */}
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-bold text-text-primary">Connect your Instagram</h2>
              <p className="text-sm text-text-secondary mt-1">Link your account so Autom8 can monitor and reply to comments.</p>
            </div>

            {/* Requirement notice */}
            <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 px-4 py-3 flex items-start gap-3">
              <span className="text-amber-400 text-base mt-0.5">⚠️</span>
              <div>
                <p className="text-xs font-semibold text-amber-300 mb-0.5">Professional or Business account required</p>
                <p className="text-xs text-amber-200/70">Autom8 only works with Instagram <strong>Professional</strong> or <strong>Business</strong> accounts connected to a Facebook Page. Personal accounts are not supported by Meta&apos;s API.</p>
              </div>
            </div>

            {!connected ? (
              <div className="space-y-3">
                <button
                  onClick={handleConnect}
                  disabled={connecting}
                  className="w-full flex items-center justify-center gap-3 py-4 rounded-xl border-2 border-dashed border-border hover:border-primary/40 hover:bg-primary/3 transition-all group disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <span className="text-3xl">{connecting ? "⏳" : "📱"}</span>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-text-primary group-hover:text-white">
                      {connecting ? "Redirecting to Facebook…" : "Connect Facebook & Instagram Business"}
                    </p>
                    <p className="text-xs text-text-muted">
                      {connecting ? "Please wait" : "Authorize via Meta Login — takes 30 seconds"}
                    </p>
                  </div>
                </button>
                {connectError && (
                  <p className="text-xs text-error text-center">{connectError}</p>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-primary/5 border border-primary/20">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-accent-purple to-accent-pink flex items-center justify-center text-white text-lg shrink-0">📷</div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-text-primary">@yourbusiness</p>
                  <p className="text-xs text-primary">Connected ✓</p>
                </div>
                <button onClick={() => setConnected(false)} className="text-xs text-text-muted hover:text-text-secondary">Disconnect</button>
              </div>
            )}

            <div className="rounded-xl bg-surface border border-border p-4">
              <p className="text-xs font-medium text-text-secondary mb-2">What Autom8 accesses via Meta:</p>
              <ul className="space-y-1.5">
                {[
                  "Your Facebook Pages & Business info",
                  "Instagram Basic profile & comments",
                  "Read & reply to post comments",
                  "Manage Page engagement & metadata",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-xs text-text-muted">
                    <span className="text-primary text-[10px]">✓</span> {item}
                  </li>
                ))}
              </ul>
              <p className="text-[10px] text-text-muted mt-3">We never post on your behalf without your approval. Tokens are stored securely by our automation layer.</p>
            </div>
          </div>
        )}

        {/* Step 2 — Brand Voice */}
        {step === 2 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-bold text-text-primary">Set your brand voice</h2>
              <p className="text-sm text-text-secondary mt-1">Train the AI to reply exactly like you.</p>
            </div>

            <InputBlock
              label="Business Name"
              value={businessName}
              onChange={(e) => setBusinessName((e.target as HTMLInputElement).value)}
              placeholder="e.g. Luxe Glow Medspa"
            />

            <InputBlock
              label="What do you do?"
              multiline
              value={description}
              onChange={(e) => setDescription((e.target as HTMLTextAreaElement).value)}
              rows={3}
              placeholder="e.g. Premier medical spa offering HydraFacials, Botox, and laser treatments in Los Angeles."
              helperText="The more detail, the better your AI replies will be."
            />

            <div>
              <p className="text-sm font-medium text-text-secondary mb-2">Brand Tones</p>
              <div className="flex flex-wrap gap-2">
                {toneOptions.map((tone) => (
                  <button
                    key={tone}
                    type="button"
                    onClick={() => toggleTone(tone)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all
                      ${tones.includes(tone)
                        ? "bg-primary/10 border-primary/30 text-primary shadow-[0_0_10px_rgba(123,63,242,0.08)]"
                        : "bg-surface border border-border text-text-secondary hover:border-primary/20 hover:text-text-primary"
                      }`}
                  >
                    {tone}
                  </button>
                ))}
              </div>
            </div>

            <Toggle
              label="Allow Emojis"
              description="Let the AI use emojis in replies"
              checked={emojiAllowed}
              onChange={setEmojiAllowed}
            />
          </div>
        )}

        {/* Step 3 — CTAs */}
        {step === 3 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-bold text-text-primary">Add your CTAs</h2>
              <p className="text-sm text-text-secondary mt-1">Tell the AI what actions to push in replies.</p>
            </div>

            <div>
              <p className="text-sm font-medium text-text-secondary mb-2">Select CTAs</p>
              <div className="flex flex-wrap gap-2">
                {ctaOptions.map((cta) => (
                  <button
                    key={cta}
                    type="button"
                    onClick={() => toggleCta(cta)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all
                      ${selectedCtas.includes(cta)
                        ? "bg-primary/10 border-primary/30 text-primary"
                        : "bg-surface border border-border text-text-secondary hover:text-text-primary"
                      }`}
                  >
                    {cta}
                  </button>
                ))}
              </div>
            </div>

            <InputBlock
              label="CTA Trigger Keywords"
              value={ctaKeywords}
              onChange={(e) => setCtaKeywords((e.target as HTMLInputElement).value)}
              helperText="AI uses a CTA when a comment contains one of these words. Separate with commas."
            />

            {/* Live preview */}
            <div className="rounded-xl border border-primary/20 bg-primary/3 p-4">
              <p className="text-[10px] text-primary uppercase tracking-wider mb-2">Live Preview</p>
              <div className="space-y-2">
                <div className="bg-surface rounded-lg px-3 py-2">
                  <p className="text-[10px] text-text-muted mb-0.5">Comment</p>
                  <p className="text-xs text-text-primary">How much does this cost?</p>
                </div>
                <div className="bg-primary/5 border border-primary/10 rounded-lg px-3 py-2">
                  <p className="text-[10px] text-primary mb-0.5">AI Reply</p>
                  <p className="text-xs text-text-primary">
                    Hey! Thanks for asking 😊 Our prices start from $149 — DM us for a full quote.
                    {selectedCtas.length > 0 && <span className="text-primary"> {selectedCtas[0]}!</span>}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 4 — Activate */}
        {step === 4 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-bold text-text-primary">Turn on Autom8</h2>
              <p className="text-sm text-text-secondary mt-1">Choose how hands-on you want to be — you can change this anytime.</p>
            </div>

            <div className="space-y-3">
              <Toggle
                label="Auto Reply to Comments"
                description="AI replies automatically without your review (highest speed)"
                checked={autoReply}
                onChange={(v) => { setAutoReply(v); if (v) setReviewFirst(false); }}
              />
              <Toggle
                label="Review Before Sending"
                description="Every AI reply goes to your inbox for approval first (recommended)"
                checked={reviewFirst}
                onChange={(v) => { setReviewFirst(v); if (v) setAutoReply(false); }}
              />
            </div>

            <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
              <p className="text-xs font-medium text-text-secondary uppercase tracking-wider">Your Setup</p>
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-text-muted">Account</span>
                  <span className={connected ? "text-primary font-medium" : "text-text-muted"}>
                    {connected ? "@yourbusiness ✓" : "Not connected (set up later)"}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-text-muted">Business</span>
                  <span className="text-text-primary font-medium">{businessName || "—"}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-text-muted">Tones</span>
                  <span className="text-text-primary font-medium">{tones.join(", ") || "—"}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-text-muted">CTAs</span>
                  <span className="text-text-primary font-medium">{selectedCtas.length} selected</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-text-muted">Mode</span>
                  <span className="text-primary font-medium">{autoReply ? "Auto Reply" : "Review First"}</span>
                </div>
              </div>
            </div>

            {saveError && (
              <p className="text-xs text-error">{saveError}</p>
            )}

            <button
              onClick={handleFinish}
              disabled={saving}
              className="w-full py-4 rounded-2xl bg-primary text-bg font-black text-base tracking-tight hover:brightness-110 transition-all shadow-[0_0_24px_rgba(123,63,242,0.3)] hover:shadow-[0_0_36px_rgba(123,63,242,0.5)] disabled:opacity-60"
            >
              {saving ? "Saving…" : "Activate Autom8 ⚡"}
            </button>
          </div>
        )}

        {/* Navigation */}
        {step < 4 && (
          <div className="flex items-center justify-between pt-2">
            {step > 1 ? (
              <button onClick={() => setStep((p) => p - 1)} className="text-sm text-text-secondary hover:text-text-primary transition-colors">
                ← Back
              </button>
            ) : (
              <div />
            )}
            <div className="flex items-center gap-3">
              {step === 1 && (
                <button
                  onClick={() => setStep(2)}
                  className="text-sm text-text-muted hover:text-text-secondary transition-colors"
                >
                  Skip for now →
                </button>
              )}
              {step > 1 && (
                <Button
                  variant="primary"
                  onClick={() => setStep((p) => p + 1)}
                  disabled={!canAdvance()}
                >
                  {step === 3 ? "Review Setup →" : "Continue →"}
                </Button>
              )}
              {step === 1 && connected && (
                <Button
                  variant="primary"
                  onClick={() => setStep(2)}
                >
                  Continue →
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      <p className="text-xs text-text-muted mt-6">
        Already set up?{" "}
        <button onClick={() => router.push("/dashboard")} className="text-primary hover:underline">
          Go to dashboard →
        </button>
      </p>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-bg flex items-center justify-center"><span className="text-text-muted text-sm">Loading…</span></div>}>
      <OnboardingContent />
    </Suspense>
  );
}
