"use client";
import { useState, useEffect } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Toggle from "@/components/ui/Toggle";
import InputBlock from "@/components/ui/InputBlock";
import PageHeader from "@/components/ui/PageHeader";
import { getBrandProfile, upsertBrandProfile } from "@/lib/actions/brand";
import PrivacyPolicyContent from "@/components/PrivacyPolicyContent";

const toneOptions = ["Friendly", "Professional", "Playful", "Authoritative", "Luxe", "Bold", "Warm"];
const ctaOptions = ["Book Now", "DM Us", "Link in Bio", "Get Quote", "Shop Now", "Book a Call", "Claim Offer"];
const escalationExamples = ["refund request", "medical advice", "legal issue", "complaint", "abuse"];

type Section = "tone" | "offers" | "automation" | "risk" | "privacy";

const defaultBrand = {
  businessName: "",
  industry: "",
  websiteUrl: "",
  description: "",
  tones: [] as string[],
  customToneNotes: "",
  services: [] as { name: string; priceRange: string }[],
  ctaKeywords: [] as string[],
  escalationRules: "",
  emojiAllowed: true,
  formalityLevel: 50,
  allowedCtas: [] as string[],
};

export default function BrandBrainPage() {
  const [brand, setBrand] = useState(defaultBrand);
  const [activeSection, setActiveSection] = useState<Section>("tone");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [loadingProfile, setLoadingProfile] = useState(true);

  // Automation settings
  const [commentLogic, setCommentLogic] = useState(true);
  const [dmLogic, setDmLogic] = useState(false);
  const [delay, setDelay] = useState("instant");
  const [triggerKeywords, setTriggerKeywords] = useState(["price", "book", "available", "how much"]);
  const [escalationKeywords, setEscalationKeywords] = useState(["refund", "complaint", "lawyer", "medical"]);

  useEffect(() => {
    getBrandProfile()
      .then((profile) => {
        if (profile) {
          setBrand({
            businessName: profile.business_name ?? "",
            industry: profile.industry ?? "",
            websiteUrl: profile.website_url ?? "",
            description: profile.description ?? "",
            tones: profile.tone ?? [],
            customToneNotes: profile.tone_notes ?? "",
            services: (profile.services ?? []).map((s) => ({
              name: s.service_name,
              priceRange: s.price_range ?? "",
            })),
            ctaKeywords: profile.cta_keywords ?? [],
            escalationRules: profile.escalation_rules ?? "",
            emojiAllowed: profile.emoji_allowed ?? true,
            formalityLevel: profile.formality_level ?? 50,
            allowedCtas: profile.allowed_ctas
              ? profile.allowed_ctas.split(",").map((c) => c.trim()).filter(Boolean)
              : [],
          });
          // Automation fields (previously not persisted)
          const p = profile as unknown as Record<string, unknown>;
          if (typeof p.dm_enabled === "boolean") setDmLogic(p.dm_enabled);
          if (Array.isArray(p.dm_trigger_keywords) && p.dm_trigger_keywords.length) {
            setTriggerKeywords(p.dm_trigger_keywords as string[]);
          }
        }
      })
      .catch(() => {
        // If unauthorized or error, leave defaults
      })
      .finally(() => setLoadingProfile(false));
  }, []);

  const set = (key: string, value: unknown) => setBrand((p) => ({ ...p, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    setSaveError("");
    try {
      // Fold escalation keywords into the free-text escalation rules the agent reads.
      const escalationCombined = [
        brand.escalationRules,
        escalationKeywords.length ? `Escalate on: ${escalationKeywords.join(", ")}` : "",
      ].filter(Boolean).join("\n");

      await upsertBrandProfile({
        business_name: brand.businessName,
        description: brand.description || null,
        tone: brand.tones,
        tone_notes: brand.customToneNotes || null,
        cta_keywords: brand.ctaKeywords,
        escalation_rules: escalationCombined || null,
        emoji_allowed: brand.emojiAllowed,
        formality_level: brand.formalityLevel,
        // Persist CTA + DM automation so the agents actually use them
        allowed_ctas: brand.allowedCtas.length ? brand.allowedCtas.join(", ") : null,
        dm_enabled: dmLogic,
        dm_trigger_keywords: triggerKeywords,
        services: brand.services.map((s) => ({
          service_name: s.name,
          price_range: s.priceRange || null,
        })),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const toggleTone = (tone: string) => {
    const next = brand.tones.includes(tone)
      ? brand.tones.filter((t) => t !== tone)
      : [...brand.tones, tone];
    set("tones", next);
  };

  const toggleCta = (cta: string) => {
    const ctaArr = (brand as Record<string, unknown>).allowedCtas as string[] ?? [];
    const next = ctaArr.includes(cta) ? ctaArr.filter((c) => c !== cta) : [...ctaArr, cta];
    setBrand((p) => ({ ...p, allowedCtas: next }));
  };

  const sections: { id: Section; label: string; icon: string }[] = [
    { id: "tone", label: "Tone & Voice", icon: "🎨" },
    { id: "offers", label: "Offers & CTAs", icon: "📣" },
    { id: "automation", label: "Automation Rules", icon: "⚡" },
    { id: "risk", label: "Risk Control", icon: "🛡" },
    { id: "privacy", label: "Privacy Policy", icon: "🔒" },
  ];

  if (loadingProfile) {
    return (
      <div className="p-5 md:p-7 max-w-3xl mx-auto flex items-center justify-center h-48">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-5 md:p-7 max-w-3xl mx-auto space-y-5">
      <PageHeader
        title="Brand Brain"
        subtitle="Train your AI to reply like you — with your voice, offers, and rules."
        actions={activeSection !== "privacy" && (
          <div className="flex items-center gap-2">
            {saved && <span className="text-xs text-primary">✓ Saved</span>}
            {saveError && <span className="text-xs text-error">{saveError}</span>}
            <Button variant="primary" onClick={handleSave} loading={saving}>Save Changes</Button>
          </div>
        )}
      />

      {/* Section tabs */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-1">
        {sections.map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all
              ${activeSection === s.id
                ? "bg-primary/10 text-primary border border-primary/20"
                : "bg-surface-elevated border border-border text-text-secondary hover:text-text-primary"
              }`}
          >
            <span>{s.icon}</span> {s.label}
          </button>
        ))}
      </div>

      {/* A. Tone & Voice */}
      {activeSection === "tone" && (
        <div className="space-y-4">
          <Card header={<h2 className="font-semibold text-text-primary">Tone & Voice</h2>}>
            <div className="space-y-5">
              <InputBlock
                label="Business Name"
                value={brand.businessName}
                onChange={(e) => set("businessName", (e.target as HTMLInputElement).value)}
              />
              <InputBlock
                label="Brand Description"
                multiline
                value={brand.description}
                onChange={(e) => set("description", (e.target as HTMLTextAreaElement).value)}
                rows={3}
                helperText="Help the AI understand what you do and who you serve."
              />

              <div>
                <p className="text-sm font-medium text-text-secondary mb-2">Select Tones</p>
                <div className="flex flex-wrap gap-2">
                  {toneOptions.map((tone) => (
                    <button
                      key={tone}
                      type="button"
                      onClick={() => toggleTone(tone)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all
                        ${brand.tones.includes(tone)
                          ? "bg-primary/10 border-primary/30 text-primary shadow-[0_0_10px_rgba(123,63,242,0.08)]"
                          : "bg-surface border border-border text-text-secondary hover:border-primary/20 hover:text-text-primary"
                        }`}
                    >
                      {tone}
                    </button>
                  ))}
                </div>
              </div>

              <InputBlock
                label="Custom Tone Notes"
                multiline
                value={brand.customToneNotes}
                onChange={(e) => set("customToneNotes", (e.target as HTMLTextAreaElement).value)}
                rows={2}
                helperText="e.g. 'Never use slang. Always end replies with a question or CTA.'"
              />

              <div className="grid sm:grid-cols-2 gap-4">
                <Toggle
                  label="Allow Emojis"
                  description="Let the AI use emojis in replies"
                  checked={brand.emojiAllowed}
                  onChange={(v) => set("emojiAllowed", v)}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-text-secondary">Formality Level</p>
                  <span className="text-xs text-primary">{brand.formalityLevel}%</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-text-muted w-12">Casual</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={brand.formalityLevel}
                    onChange={(e) => set("formalityLevel", parseInt(e.target.value))}
                    className="flex-1 accent-primary h-1.5 rounded-full"
                  />
                  <span className="text-xs text-text-muted w-12 text-right">Formal</span>
                </div>
              </div>
            </div>
          </Card>

          <Card header={<h2 className="font-semibold text-text-primary">Example Responses Preview</h2>}>
            <div className="space-y-3">
              {[
                { comment: "How much does this cost?", reply: "Our prices start at $149! Want me to send you the full menu? 😊" },
                { comment: "Do you have availability this week?", reply: "Yes! We have openings Tuesday–Friday. What time works best for you?" },
              ].map((ex, i) => (
                <div key={i} className="rounded-xl border border-border bg-surface p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-text-muted uppercase tracking-wider">Comment</span>
                  </div>
                  <p className="text-xs text-text-primary">{ex.comment}</p>
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-[10px] text-primary uppercase tracking-wider">AI Reply</span>
                  </div>
                  <p className="text-xs text-text-primary">{ex.reply}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* B. Offers & CTAs */}
      {activeSection === "offers" && (
        <div className="space-y-4">
          <Card header={<h2 className="font-semibold text-text-primary">Active CTAs</h2>}>
            <p className="text-xs text-text-muted mb-3">Select the calls-to-action the AI can use in replies.</p>
            <div className="flex flex-wrap gap-2 mb-4">
              {ctaOptions.map((cta) => {
                const ctaArr = (brand as Record<string, unknown>).allowedCtas as string[] ?? [];
                const active = ctaArr.includes(cta);
                return (
                  <button
                    key={cta}
                    type="button"
                    onClick={() => toggleCta(cta)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all
                      ${active
                        ? "bg-primary/10 border-primary/30 text-primary"
                        : "bg-surface border border-border text-text-secondary hover:text-text-primary"
                      }`}
                  >
                    {cta}
                  </button>
                );
              })}
            </div>
          </Card>

          <Card header={<h2 className="font-semibold text-text-primary">Dynamic CTA Rules</h2>}>
            <div className="space-y-4">
              <InputBlock
                label="CTA Keywords"
                value={brand.ctaKeywords.join(", ")}
                onChange={(e) => set("ctaKeywords", (e.target as HTMLInputElement).value.split(",").map((s) => s.trim()))}
                helperText="Trigger CTAs when comments contain these words. Separate with commas."
              />
              <div className="rounded-xl bg-surface border border-border p-4">
                <p className="text-xs text-text-muted uppercase tracking-wider mb-2">Example CTA Rule</p>
                <p className="text-xs text-text-secondary">
                  When a comment contains <span className="text-primary">&quot;price&quot;</span> or <span className="text-primary">&quot;how much&quot;</span>,
                  AI will automatically include a <span className="text-primary">&quot;Book Now&quot;</span> or pricing link in the reply.
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* C. Automation Rules */}
      {activeSection === "automation" && (
        <div className="space-y-4">
          <Card header={<h2 className="font-semibold text-text-primary">Automation Rules</h2>}>
            <div className="space-y-5">
              <Toggle
                label="Auto Reply — Comments"
                description="Automatically reply to Instagram/Facebook comments without review"
                checked={commentLogic}
                onChange={setCommentLogic}
              />
              <Toggle
                label="Auto Reply — DMs"
                description="Automatically reply to direct messages"
                checked={dmLogic}
                onChange={setDmLogic}
              />

              <div>
                <p className="text-sm font-medium text-text-secondary mb-2">Reply Delay</p>
                <div className="flex gap-2">
                  {["instant", "1 min", "5 min", "15 min"].map((d) => (
                    <button
                      key={d}
                      onClick={() => setDelay(d)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all
                        ${delay === d
                          ? "bg-primary/10 border-primary/30 text-primary"
                          : "bg-surface border border-border text-text-secondary hover:text-text-primary"
                        }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-text-secondary mb-2">Trigger Keywords</p>
                <p className="text-xs text-text-muted mb-2">AI will only auto-reply if the comment contains one of these words.</p>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {triggerKeywords.map((kw) => (
                    <span key={kw} className="flex items-center gap-1 bg-primary/10 border border-primary/20 text-primary text-xs px-2 py-0.5 rounded-lg">
                      {kw}
                      <button onClick={() => setTriggerKeywords((p) => p.filter((k) => k !== kw))} className="hover:text-white">×</button>
                    </span>
                  ))}
                </div>
                <input
                  placeholder="Add keyword and press Enter..."
                  className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-xs text-text-primary placeholder-text-muted outline-none focus:border-primary/40"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.target as HTMLInputElement).value.trim()) {
                      setTriggerKeywords((p) => [...new Set([...p, (e.target as HTMLInputElement).value.trim()])]);
                      (e.target as HTMLInputElement).value = "";
                    }
                  }}
                />
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* E. Privacy Policy */}
      {activeSection === "privacy" && (
        <div className="space-y-4">
          <Card>
            <PrivacyPolicyContent />
          </Card>
        </div>
      )}

      {/* D. Risk Control */}
      {activeSection === "risk" && (
        <div className="space-y-4">
          <Card header={<h2 className="font-semibold text-text-primary">Risk Control</h2>}>
            <div className="space-y-5">
              <div>
                <p className="text-sm font-medium text-text-secondary mb-1">Escalation Keywords</p>
                <p className="text-xs text-text-muted mb-2">Send to human review if a comment contains any of these.</p>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {escalationKeywords.map((kw) => (
                    <span key={kw} className="flex items-center gap-1 bg-error/10 border border-error/20 text-error text-xs px-2 py-0.5 rounded-lg">
                      {kw}
                      <button onClick={() => setEscalationKeywords((p) => p.filter((k) => k !== kw))} className="hover:text-white">×</button>
                    </span>
                  ))}
                </div>
                <input
                  placeholder="Add escalation keyword..."
                  className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-xs text-text-primary placeholder-text-muted outline-none focus:border-primary/40"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.target as HTMLInputElement).value.trim()) {
                      setEscalationKeywords((p) => [...new Set([...p, (e.target as HTMLInputElement).value.trim()])]);
                      (e.target as HTMLInputElement).value = "";
                    }
                  }}
                />
              </div>

              <div className="rounded-xl border border-error/10 bg-error/3 p-4 space-y-2">
                <p className="text-xs font-medium text-error uppercase tracking-wider">Auto-Escalated Topics</p>
                <p className="text-xs text-text-secondary">These topics are always sent to human review — AI will never auto-reply:</p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {escalationExamples.map((ex) => (
                    <span key={ex} className="text-xs px-2 py-0.5 rounded-lg bg-error/10 border border-error/20 text-error">{ex}</span>
                  ))}
                </div>
              </div>

              <InputBlock
                label="Custom Escalation Rules"
                multiline
                value={brand.escalationRules}
                onChange={(e) => set("escalationRules", (e.target as HTMLTextAreaElement).value)}
                rows={3}
                helperText="Describe any other topics or situations where the AI should hand off to a human."
              />
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
