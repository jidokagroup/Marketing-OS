"use client";
import { useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

const TEXT_SUPPORT = "2404101925";

const concernTypes = [
  "Billing / Payment Issue",
  "Instagram Connection Problem",
  "AI Reply Quality",
  "Account Access",
  "Scheduler Issue",
  "Feature Request",
  "Bug Report",
  "Other",
];

export default function HelpTicketPage() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    pageName: "",
    concernType: "",
    message: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const set = (key: string, val: string) => setForm((p) => ({ ...p, [key]: val }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const subject = encodeURIComponent(
      `Help Ticket [${form.concernType || "General"}] — ${form.pageName}`
    );
    const body = encodeURIComponent(
      `Name: ${form.name}\nEmail: ${form.email}\nPhone: ${form.phone || "N/A"}\nPage / Account: ${form.pageName}\nConcern Type: ${form.concernType}\n\n${form.message}`
    );
    window.location.href = `mailto:hello@barebranding.site?subject=${subject}&body=${body}`;
    setTimeout(() => {
      setSubmitted(true);
      setLoading(false);
    }, 500);
  };

  if (submitted) {
    return (
      <div className="p-5 md:p-7 max-w-2xl mx-auto">
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-10 text-center">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-2xl font-bold text-text-primary mb-2">Ticket Submitted!</h2>
          <p className="text-text-secondary text-sm max-w-md mx-auto mb-2">
            Your email client opened with your ticket pre-filled — just hit send. We&apos;ll get back to you within 24 hours.
          </p>
          <p className="text-xs text-text-muted mb-6">For urgent issues, use the Text Support button below.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button variant="primary" onClick={() => setSubmitted(false)}>Submit Another Ticket →</Button>
            <a
              href={`sms:${TEXT_SUPPORT}`}
              className="flex items-center justify-center gap-2 border border-border text-text-secondary hover:text-text-primary hover:border-primary/30 transition-colors rounded-xl px-4 py-2.5 text-sm font-semibold"
            >
              📱 Text Now
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 md:p-7 max-w-2xl mx-auto space-y-6">
      <div>
        <p className="text-xs text-text-muted uppercase tracking-wider mb-1">Support</p>
        <h1 className="text-3xl font-semibold tracking-tight text-text-primary">Submit Help Ticket</h1>
        <p className="text-sm text-text-secondary mt-1">
          Our team reviews every ticket. Need a faster response?
        </p>
      </div>

      {/* Text Support card */}
      <Card>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">💬</span>
            <div>
              <p className="text-sm font-semibold text-text-primary">Text Support</p>
              <p className="text-xs text-text-muted">Real humans, real help — text us anytime</p>
            </div>
          </div>
          <a
            href={`sms:${TEXT_SUPPORT}`}
            className="shrink-0 flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 transition-colors rounded-xl px-4 py-2.5 text-sm font-semibold"
          >
            <span>📱</span>
            Text Now
          </a>
        </div>
      </Card>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Card header={<h2 className="text-sm font-semibold text-text-primary">Contact Information</h2>}>
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">Full Name *</label>
                <input
                  required
                  type="text"
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder="Your name"
                  className="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-sm text-text-primary placeholder-text-muted outline-none focus:border-primary/40 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">Email *</label>
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                  placeholder="you@example.com"
                  className="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-sm text-text-primary placeholder-text-muted outline-none focus:border-primary/40 transition-colors"
                />
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">Phone Number</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => set("phone", e.target.value)}
                  placeholder="(555) 000-0000"
                  className="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-sm text-text-primary placeholder-text-muted outline-none focus:border-primary/40 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">Page / Account Name *</label>
                <input
                  required
                  type="text"
                  value={form.pageName}
                  onChange={(e) => set("pageName", e.target.value)}
                  placeholder="@yourinstagram or business name"
                  className="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-sm text-text-primary placeholder-text-muted outline-none focus:border-primary/40 transition-colors"
                />
              </div>
            </div>
          </div>
        </Card>

        <Card header={<h2 className="text-sm font-semibold text-text-primary">What&apos;s your concern?</h2>}>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-2">Category *</label>
              <div className="flex flex-wrap gap-2">
                {concernTypes.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => set("concernType", type)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all
                      ${form.concernType === type
                        ? "bg-primary/10 border-primary/30 text-primary"
                        : "bg-surface border-border text-text-secondary hover:text-text-primary"
                      }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Describe your issue *</label>
              <textarea
                required
                value={form.message}
                onChange={(e) => set("message", e.target.value)}
                placeholder="Please describe your concern in detail — include any error messages, screenshots, or steps to reproduce the issue..."
                rows={5}
                className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm text-text-primary placeholder-text-muted outline-none focus:border-primary/40 transition-colors resize-none"
              />
            </div>
          </div>
        </Card>

        <div className="flex items-center justify-between pt-1">
          <p className="text-xs text-text-muted">We typically respond within 24 hours.</p>
          <Button type="submit" variant="primary" size="md" loading={loading}>
            Submit Ticket →
          </Button>
        </div>
      </form>
    </div>
  );
}
