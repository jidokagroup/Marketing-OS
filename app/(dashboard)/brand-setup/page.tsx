"use client";
import { useState, useEffect } from "react";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import TagInput from "@/components/ui/TagInput";

function ConnectButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const handleConnect = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/social/connect", { method: "POST" });
      const data = await res.json();
      if (data.authUrl) { window.location.href = data.authUrl; }
      else { setError(data.error ?? "Failed to connect."); setLoading(false); }
    } catch { setError("Network error."); setLoading(false); }
  };
  return (
    <div className="shrink-0 text-right">
      <Button variant="primary" onClick={handleConnect} loading={loading}>
        {loading ? "Redirecting…" : "Connect →"}
      </Button>
      {error && <p className="text-[11px] text-error mt-1">{error}</p>}
    </div>
  );
}

const toneOptions = ["Friendly", "Professional", "Playful", "Authoritative", "Luxe", "Bold", "Warm", "Minimalist", "Funny", "Academic", "Positive", "Sarcastic"];
const languageOptions = [
  { value: "English", label: "English" },
  { value: "Spanish", label: "Spanish" },
  { value: "French", label: "French" },
  { value: "Portuguese", label: "Portuguese" },
  { value: "Italian", label: "Italian" },
  { value: "German", label: "German" },
  { value: "Arabic", label: "Arabic" },
];

type SaveState = "idle" | "saving" | "saved" | "error";

export default function BrandSetupPage() {
  const [formData, setFormData] = useState({
    businessName: "",
    websiteUrl: "",
    phone: "",
    location: "",
    hours: "",
    bookingLink: "",
    igBusinessId: "",
    tones: [] as string[],
    language: "English",
    emojiAllowed: true,
    brandVoiceExamples: "",
    servicesProducts: "",
    pricings: "",
    allowedCtas: "",
    ctaKeywords: [] as string[],
    faq1: "",
    faq2: "",
    faq3: "",
    escalationRules: "",
  });
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (key: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    setSaveState("idle");
  };

  useEffect(() => {
    fetch("/api/brand")
      .then(r => r.json())
      .then(json => {
        const d = json.data ?? json;
        if (!d || !d.business_name) return;
        setFormData(prev => ({
          ...prev,
          businessName: d.business_name ?? "",
          websiteUrl: d.website_url ?? "",
          phone: d.phone ?? "",
          location: d.location ?? "",
          hours: d.hours ?? "",
          bookingLink: d.booking_link ?? "",
          igBusinessId: d.ig_business_id ?? "",
          tones: d.tone ?? [],
          language: d.language ?? "English",
          emojiAllowed: d.emoji_allowed ?? true,
          brandVoiceExamples: d.brand_voice_examples ?? "",
          servicesProducts: d.services_products ?? "",
          pricings: d.pricings ?? "",
          allowedCtas: d.allowed_ctas ?? "",
          ctaKeywords: d.cta_keywords ?? [],
          faq1: d.faq_1 ?? "",
          faq2: d.faq_2 ?? "",
          faq3: d.faq_3 ?? "",
          escalationRules: d.escalation_rules ?? "",
        }));
      })
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    const newErrors: Record<string, string> = {};
    if (!formData.businessName.trim()) newErrors.businessName = "Business name is required.";
    if (Object.keys(newErrors).length) { setErrors(newErrors); return; }
    setErrors({});
    setSaveState("saving");
    try {
      const res = await fetch("/api/brand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business_name: formData.businessName,
          website_url: formData.websiteUrl,
          phone: formData.phone,
          location: formData.location,
          hours: formData.hours,
          booking_link: formData.bookingLink,
          ig_business_id: formData.igBusinessId || null,
          tone: formData.tones,
          language: formData.language,
          emoji_allowed: formData.emojiAllowed,
          brand_voice_examples: formData.brandVoiceExamples,
          services_products: formData.servicesProducts,
          pricings: formData.pricings,
          allowed_ctas: formData.allowedCtas,
          cta_keywords: formData.ctaKeywords,
          faq_1: formData.faq1,
          faq_2: formData.faq2,
          faq_3: formData.faq3,
          escalation_rules: formData.escalationRules,
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs text-white/40 uppercase tracking-wider mb-0.5">Settings</p>
          <h1 className="text-2xl font-bold text-white">Brand Brain</h1>
          <p className="text-sm text-white/50 mt-0.5">Train your AI on your business details.</p>
        </div>
        <div className="flex items-center gap-3">
          {saveState === "saving" && <span className="text-xs text-white/40 animate-pulse">Saving...</span>}
          {saveState === "saved" && <span className="text-xs text-green-400">✓ Saved</span>}
          {saveState === "error" && <span className="text-xs text-red-400">Save failed</span>}
          <Button variant="primary" onClick={handleSave} loading={saveState === "saving"} className="w-full sm:w-auto">
            Save Brand Brain
          </Button>
        </div>
      </div>

      {/* Business Info */}
      <Card header={
        <div className="flex items-center gap-2">
          <span className="text-base">🏢</span>
          <h2 className="font-semibold text-sm">Business Information</h2>
        </div>
      }>
        <div className="space-y-4">
          <Input label="Business Name *" value={formData.businessName} onChange={e => set("businessName", e.target.value)} error={errors.businessName} placeholder="Your business name" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Website URL" type="url" value={formData.websiteUrl} onChange={e => set("websiteUrl", e.target.value)} placeholder="https://yourbusiness.com" />
            <Input label="Booking / Appointment Link" type="url" value={formData.bookingLink} onChange={e => set("bookingLink", e.target.value)} placeholder="https://calendly.com/..." />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Phone Number" value={formData.phone} onChange={e => set("phone", e.target.value)} placeholder="+1 (555) 000-0000" />
            <Input label="Location / Address" value={formData.location} onChange={e => set("location", e.target.value)} placeholder="City, State or full address" />
          </div>
          <Input label="Business Hours" value={formData.hours} onChange={e => set("hours", e.target.value)} placeholder="Mon–Fri 9am–6pm, Sat 10am–4pm" />
        </div>
      </Card>

      {/* Services & Pricing */}
      <Card header={
        <div className="flex items-center gap-2">
          <span className="text-base">💼</span>
          <h2 className="font-semibold text-sm">Services & Pricing</h2>
        </div>
      }>
        <div className="space-y-4">
          <Textarea label="Services / Products" value={formData.servicesProducts} onChange={e => set("servicesProducts", e.target.value)} placeholder="List your main services or products..." maxLength={1000} />
          <Textarea label="Pricing Information" value={formData.pricings} onChange={e => set("pricings", e.target.value)} placeholder="Describe your pricing, packages, or price ranges..." maxLength={1000} />
        </div>
      </Card>

      {/* Brand Voice */}
      <Card header={
        <div className="flex items-center gap-2">
          <span className="text-base">🎙️</span>
          <h2 className="font-semibold text-sm">Brand Voice & Tone</h2>
        </div>
      }>
        <div className="space-y-5">
          <div>
            <label className="text-sm font-medium text-white/80 block mb-2">Tone <span className="text-white/30 font-normal">(select all that apply)</span></label>
            <div className="flex flex-wrap gap-2">
              {toneOptions.map(tone => (
                <button key={tone} type="button"
                  onClick={() => {
                    const next = formData.tones.includes(tone) ? formData.tones.filter(t => t !== tone) : [...formData.tones, tone];
                    set("tones", next);
                  }}
                  className={`px-3 py-1.5 rounded-full text-sm border transition-all ${formData.tones.includes(tone) ? "bg-primary/20 border-primary text-primary" : "border-white/10 text-white/50 hover:border-white/30 hover:text-white"}`}
                >
                  {tone}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
            <Select label="Response Language" value={formData.language} onChange={e => set("language", e.target.value)} options={languageOptions} />
            <div>
              <label className="text-sm font-medium text-white/80 block mb-2">Allow Emojis</label>
              <div className="flex gap-2">
                {[true, false].map(val => (
                  <button key={String(val)} type="button" onClick={() => set("emojiAllowed", val)}
                    className={`flex-1 sm:flex-none px-4 py-2 rounded-full text-sm border transition-all ${formData.emojiAllowed === val ? "bg-primary/20 border-primary text-primary" : "border-white/10 text-white/50 hover:border-white/30"}`}
                  >
                    {val ? "Yes 😊" : "No"}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <Textarea label="Brand Voice Examples" value={formData.brandVoiceExamples} onChange={e => set("brandVoiceExamples", e.target.value)} placeholder="Paste example replies that match your brand voice..." maxLength={1500} />
        </div>
      </Card>

      {/* CTAs */}
      <Card header={
        <div className="flex items-center gap-2">
          <span className="text-base">📣</span>
          <h2 className="font-semibold text-sm">Call-to-Action Settings</h2>
        </div>
      }>
        <div className="space-y-4">
          <Textarea label="Allowed CTAs" value={formData.allowedCtas} onChange={e => set("allowedCtas", e.target.value)} placeholder="e.g. Book a consultation, DM us for pricing, Visit our website..." maxLength={500} />
          <div>
            <label className="text-sm font-medium text-white/80 block mb-1">CTA Trigger Keywords</label>
            <p className="text-xs text-white/40 mb-2">Comments containing these words will trigger a CTA response.</p>
            <TagInput value={formData.ctaKeywords} onChange={tags => set("ctaKeywords", tags)} placeholder="price, book, available, how much..." maxTags={30} />
          </div>
        </div>
      </Card>

      {/* FAQs */}
      <Card header={
        <div className="flex items-center gap-2">
          <span className="text-base">❓</span>
          <h2 className="font-semibold text-sm">Frequently Asked Questions</h2>
        </div>
      }>
        <p className="text-xs text-white/40 mb-4">Train the AI to answer your 3 most commonly asked questions.</p>
        <div className="space-y-4">
          {[
            { key: "faq1", val: formData.faq1, label: "FAQ 1", placeholder: "Q: What are your hours?\nA: We're open Mon–Fri 9am–6pm." },
            { key: "faq2", val: formData.faq2, label: "FAQ 2", placeholder: "Q: Do you offer consultations?\nA: Yes, book via our website." },
            { key: "faq3", val: formData.faq3, label: "FAQ 3", placeholder: "Q: Where are you located?\nA: We're at 123 Main St." },
          ].map(({ key, val, label, placeholder }) => (
            <div key={key} className="rounded-xl border border-white/8 bg-white/3 p-3">
              <label className="text-xs font-semibold text-white/50 uppercase tracking-wider block mb-2">{label}</label>
              <Textarea value={val} onChange={e => set(key, e.target.value)} placeholder={placeholder} maxLength={500} />
            </div>
          ))}
        </div>
      </Card>

      {/* Escalation */}
      <Card header={
        <div className="flex items-center gap-2">
          <span className="text-base">🚫</span>
          <h2 className="font-semibold text-sm">Escalation Rules</h2>
        </div>
      }>
        <p className="text-xs text-white/40 mb-3">Topics the AI should NOT handle — escalate to your team instead.</p>
        <Textarea value={formData.escalationRules} onChange={e => set("escalationRules", e.target.value)} placeholder="e.g. Medical diagnoses, complaints, refund requests..." maxLength={1000} />
      </Card>

      {/* Connect */}
      <Card className="border-dashed border-primary/20">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-medium mb-1 text-text-primary">Connect Facebook & Instagram</h3>
            <p className="text-sm text-text-muted">Link your Meta Business account to start automating replies.</p>
          </div>
          <ConnectButton />
        </div>
      </Card>

      {/* Bottom save on mobile */}
      <div className="sm:hidden pb-4">
        <Button variant="primary" onClick={handleSave} loading={saveState === "saving"} className="w-full">
          Save Brand Brain
        </Button>
      </div>
    </div>
  );
}
