"use client";
import { useState } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";

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

export default function DemoHelpPage() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    pageName: "",
    concernType: "",
    message: "",
  });

  const set = (key: string, val: string) => setForm((p) => ({ ...p, [key]: val }));

  return (
    <div className="p-5 md:p-7 max-w-2xl mx-auto space-y-6">
      <div>
        <p className="text-xs text-text-muted uppercase tracking-wider mb-1">Support</p>
        <h1 className="text-3xl font-semibold tracking-tight text-text-primary">Submit Help Ticket</h1>
        <p className="text-sm text-text-secondary mt-1">
          Our team reviews every ticket. Need a faster response?
        </p>
      </div>

      {/* Text Support — fully functional in demo */}
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

      <div className="space-y-5">
        <Card header={<h2 className="text-sm font-semibold text-text-primary">Contact Information</h2>}>
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">Full Name *</label>
                <input
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
                value={form.message}
                onChange={(e) => set("message", e.target.value)}
                placeholder="Please describe your concern in detail..."
                rows={5}
                className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm text-text-primary placeholder-text-muted outline-none focus:border-primary/40 transition-colors resize-none"
              />
            </div>
          </div>
        </Card>

        {/* Locked submit */}
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-base">🔒</span>
            <p className="text-sm text-text-secondary">
              <span className="font-semibold text-text-primary">Start a free trial</span> to submit tickets and contact our team.
            </p>
          </div>
          <Link
            href="/signup"
            className="shrink-0 bg-primary text-white text-sm font-semibold px-4 py-2 rounded-xl hover:opacity-90 transition-opacity"
          >
            Start Free Trial →
          </Link>
        </div>
      </div>
    </div>
  );
}
