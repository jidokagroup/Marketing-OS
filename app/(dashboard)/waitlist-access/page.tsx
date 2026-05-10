"use client";
import { useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

const roles = [
  {
    id: "business",
    icon: "🏢",
    title: "Business Owner",
    tagline: "Automate your entire customer journey",
    desc: "Stop manually managing comments, DMs, bookings, and follow-ups. Get a fully customized automation ecosystem built around your brand — so you earn while you sleep.",
    perks: ["AI reply automation across all platforms", "Lead capture & CRM integrations", "Custom booking & sales funnels", "Content scheduling & distribution"],
  },
  {
    id: "developer",
    icon: "💻",
    title: "Developer",
    tagline: "Build, list, and earn from your automations",
    desc: "Create AI workflows and automation solutions, list them on the Autom8 marketplace, and earn recurring income every time a non-tech user deploys your work.",
    perks: ["Access to Autom8 developer API", "Marketplace listing & revenue share", "Connect your tools to non-AI-native users", "Collaborate with creators & businesses"],
  },
  {
    id: "creator",
    icon: "🎬",
    title: "Content Creator",
    tagline: "Automate growth, not creativity",
    desc: "Let AI handle scheduling, captions, hashtags, and DM replies while you focus on making content. Get featured in the Autom8 creator network and unlock collab opportunities.",
    perks: ["AI-powered content scheduling", "Auto-captions, hooks & hashtags", "Paid brand collaboration opportunities", "Featured in Autom8 creator spotlight"],
  },
  {
    id: "architect",
    icon: "🤖",
    title: "AI Architect",
    tagline: "Design the future of intelligent automation",
    desc: "If you think in systems and design AI agents, pipelines, and ecosystems — this is your platform. Build algorithmic solutions and connect them to users who need them most.",
    perks: ["Design & deploy agent ecosystems", "Algorithmic solution marketplace", "Early access to new Autom8 APIs", "Featured architect profile & case studies"],
  },
];

const ecosystemFeatures = [
  {
    icon: "🔗",
    title: "Algorithmic Ecosystem Marketplace",
    desc: "A curated library of AI workflows, agents, and automation systems — each matched to your specific needs. Whether you're a solopreneur or scaling enterprise, find or build the exact ecosystem you need.",
  },
  {
    icon: "🤝",
    title: "Developer ↔ User Bridge",
    desc: "We connect AI-native developers with non-technical business owners and creators. Developers earn from their builds. Users get powerful automation without writing a single line of code.",
  },
  {
    icon: "🎓",
    title: "Autom8 University",
    desc: "From zero to automation-native. Whether you want to become a developer, AI architect, or simply use tools to 10x your output — our structured learning paths meet you exactly where you are.",
  },
  {
    icon: "⚡",
    title: "Customized Solution Curation",
    desc: "No one-size-fits-all. Answer a few questions about your business, platforms, and goals — and we'll match you with the automations that will actually move the needle for you.",
  },
  {
    icon: "💰",
    title: "Earn on the Platform",
    desc: "Build automations, teach courses, refer users, or create content — every contribution to the Autom8 ecosystem has an earning path attached to it.",
  },
  {
    icon: "🌐",
    title: "Community & Collaboration",
    desc: "Join a network of builders, creators, and entrepreneurs who are all reclaiming their time through intelligent automation. Real people, real results.",
  },
];

const universityTracks = [
  { icon: "🔰", title: "Everyday User", desc: "Learn to use AI tools to 10x your productivity — no coding required. Perfect for business owners and creators who want maximum output with minimum effort." },
  { icon: "🛠", title: "Automation Builder", desc: "Learn to build no-code workflows with n8n, Make.com, and Zapier. Connect your apps, automate your business, and start offering your services." },
  { icon: "💻", title: "Developer Track", desc: "Go deep with APIs, AI agents, LLM integrations, and custom automation pipelines. Learn to build, test, and monetize sophisticated AI systems." },
  { icon: "🤖", title: "AI Architect", desc: "Master the design of multi-agent ecosystems, prompt engineering, vector databases, and enterprise-scale automation architecture." },
];

export default function WaitlistAccessPage() {
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", interest: "" });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeSection, setActiveSection] = useState<"overview" | "university" | "join">("overview");

  const set = (key: string, val: string) => setForm((p) => ({ ...p, [key]: val }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await new Promise((r) => setTimeout(r, 1000));
    setSubmitted(true);
    setLoading(false);
  };

  return (
    <div className="p-5 md:p-7 max-w-4xl mx-auto space-y-8">

      {/* Hero */}
      <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/8 via-transparent to-accent-purple/8 p-7 md:p-10 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(123,63,242,0.08),transparent_60%)] pointer-events-none" />
        <div className="relative">
          <span className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary text-xs font-semibold px-3 py-1 rounded-full mb-5">
            <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
            Coming Soon — Currently in Development
          </span>
          <h1 className="text-3xl md:text-5xl font-black text-text-primary mb-4 tracking-tight leading-tight">
            The Future of<br />
            <span className="text-primary">Intelligent Automation</span>
          </h1>
          <p className="text-text-secondary max-w-2xl leading-relaxed text-sm md:text-base mb-6">
            Autom8 is building the world&apos;s most accessible AI and agentic automation ecosystem — where developers connect with users, creators automate their growth, and everyone can reclaim their time.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button variant="primary" size="md" onClick={() => setActiveSection("join")}>
              Secure My Spot →
            </Button>
            <button
              onClick={() => setActiveSection("university")}
              className="px-4 py-2 border border-border text-text-secondary hover:text-text-primary hover:border-primary/30 transition-colors rounded-xl text-sm font-medium"
            >
              Explore University
            </button>
          </div>
        </div>
      </div>

      {/* Section tabs */}
      <div className="flex gap-2 border-b border-border pb-0">
        {[
          { id: "overview" as const, label: "Ecosystem Overview", icon: "🌐" },
          { id: "university" as const, label: "Autom8 University", icon: "🎓" },
          { id: "join" as const, label: "Join the Waitlist", icon: "⭐" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSection(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px
              ${activeSection === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-text-muted hover:text-text-secondary"
              }`}
          >
            <span>{tab.icon}</span> {tab.label}
          </button>
        ))}
      </div>

      {/* OVERVIEW */}
      {activeSection === "overview" && (
        <div className="space-y-8">
          <div>
            <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4">Who is this for?</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {roles.map((role) => (
                <div
                  key={role.id}
                  onClick={() => setSelectedRole(selectedRole === role.id ? null : role.id)}
                  className={`p-5 rounded-xl border cursor-pointer transition-all
                    ${selectedRole === role.id
                      ? "border-primary/40 bg-primary/5 shadow-[0_0_20px_rgba(123,63,242,0.06)]"
                      : "border-border bg-surface hover:border-primary/20"
                    }`}
                >
                  <div className="flex items-start gap-3 mb-3">
                    <span className="text-3xl shrink-0">{role.icon}</span>
                    <div>
                      <p className="text-sm font-bold text-text-primary">{role.title}</p>
                      <p className="text-xs text-primary font-medium mt-0.5">{role.tagline}</p>
                    </div>
                  </div>
                  <p className="text-xs text-text-secondary leading-relaxed mb-2">{role.desc}</p>
                  {selectedRole === role.id ? (
                    <ul className="space-y-1.5 mt-3 pt-3 border-t border-border">
                      {role.perks.map((perk) => (
                        <li key={perk} className="flex items-center gap-2 text-xs text-text-secondary">
                          <span className="text-primary shrink-0">✓</span> {perk}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-primary">Tap to see what&apos;s included →</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4">What&apos;s inside the ecosystem</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {ecosystemFeatures.map((f) => (
                <div key={f.title} className="flex items-start gap-4 p-4 rounded-xl border border-border bg-surface hover:border-primary/20 transition-colors">
                  <span className="text-2xl shrink-0">{f.icon}</span>
                  <div>
                    <p className="text-sm font-semibold text-text-primary mb-1">{f.title}</p>
                    <p className="text-xs text-text-muted leading-relaxed">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Developer bridge */}
          <div className="rounded-2xl border border-border bg-surface-elevated p-6">
            <h2 className="text-base font-bold text-text-primary mb-2">How Developers Meet Users</h2>
            <p className="text-sm text-text-secondary mb-5 leading-relaxed">
              Most people want powerful AI automation but don&apos;t know how to build it. Most developers can build it but struggle to find the right users. Autom8 closes that gap.
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="flex-1 rounded-xl border border-border bg-surface p-4 text-center">
                <p className="text-2xl mb-2">💻</p>
                <p className="text-sm font-semibold text-text-primary">Developer</p>
                <p className="text-xs text-text-muted mt-1">Builds the automation solution once</p>
              </div>
              <div className="text-primary font-bold text-lg">→</div>
              <div className="flex-1 rounded-xl border border-primary/20 bg-primary/5 p-4 text-center">
                <p className="text-2xl mb-2">🔗</p>
                <p className="text-sm font-semibold text-primary">Autom8 Marketplace</p>
                <p className="text-xs text-text-muted mt-1">Matches needs to solutions</p>
              </div>
              <div className="text-primary font-bold text-lg">→</div>
              <div className="flex-1 rounded-xl border border-border bg-surface p-4 text-center">
                <p className="text-2xl mb-2">🏢</p>
                <p className="text-sm font-semibold text-text-primary">Business / Creator</p>
                <p className="text-xs text-text-muted mt-1">Deploys it in one click, no code</p>
              </div>
            </div>
          </div>

          <div className="text-center pt-2">
            <Button variant="primary" size="lg" onClick={() => setActiveSection("join")}>
              Join the Waitlist →
            </Button>
          </div>
        </div>
      )}

      {/* UNIVERSITY */}
      {activeSection === "university" && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6 text-center">
            <div className="text-4xl mb-3">🎓</div>
            <h2 className="text-2xl font-bold text-text-primary mb-2">Autom8 University</h2>
            <p className="text-sm text-text-secondary max-w-xl mx-auto leading-relaxed">
              Learn how to develop, create, and utilize AI and automation — whether you want to become a builder or simply maximize your everyday output. We meet you exactly where you are.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {universityTracks.map((track) => (
              <div key={track.title} className="p-5 rounded-xl border border-border bg-surface hover:border-primary/20 transition-colors">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-3xl">{track.icon}</span>
                  <p className="text-sm font-bold text-text-primary">{track.title}</p>
                </div>
                <p className="text-xs text-text-muted leading-relaxed">{track.desc}</p>
              </div>
            ))}
          </div>

          <Card>
            <div className="flex items-start gap-3">
              <span className="text-2xl shrink-0">📚</span>
              <div>
                <p className="text-sm font-semibold text-text-primary mb-2">What you&apos;ll learn</p>
                <div className="grid sm:grid-cols-2 gap-1.5">
                  {[
                    "n8n, Make.com, Zapier workflow design",
                    "Prompt engineering & AI agent design",
                    "LLM integrations (OpenAI, Claude, Gemini)",
                    "Instagram & social media automation",
                    "CRM & sales funnel automation",
                    "Content creation & scheduling at scale",
                    "Building & selling automation services",
                    "AI-native business model design",
                  ].map((item) => (
                    <div key={item} className="flex items-start gap-1.5 text-xs text-text-secondary">
                      <span className="text-primary mt-0.5 shrink-0">✓</span> {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          <div className="rounded-xl border border-warning/20 bg-warning/5 p-4 flex gap-3">
            <span className="text-warning text-xl shrink-0">🚧</span>
            <div>
              <p className="text-sm font-semibold text-warning mb-1">Currently in development</p>
              <p className="text-xs text-text-secondary leading-relaxed">
                Autom8 University is being built right now. Join the waitlist to be notified first and get founding member pricing when we launch.
              </p>
            </div>
          </div>

          <div className="text-center">
            <Button variant="primary" size="lg" onClick={() => setActiveSection("join")}>
              Get Early Access →
            </Button>
          </div>
        </div>
      )}

      {/* JOIN WAITLIST */}
      {activeSection === "join" && (
        <div className="space-y-5">
          {submitted ? (
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-10 text-center">
              <div className="text-5xl mb-4">🎉</div>
              <h2 className="text-2xl font-bold text-text-primary mb-2">You&apos;re In!</h2>
              <p className="text-sm text-text-secondary max-w-sm mx-auto mb-2">
                You&apos;re on the exclusive waitlist. We&apos;ll notify you by email and SMS the moment access opens.
              </p>
              <p className="text-xs text-text-muted">Expect founding member pricing and first-access benefits.</p>
            </div>
          ) : (
            <Card header={
              <div>
                <h2 className="text-base font-bold text-text-primary">Join the Exclusive Waitlist</h2>
                <p className="text-xs text-text-muted mt-0.5">Email &amp; SMS intake — be first in line for early access</p>
              </div>
            }>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1.5">Full Name *</label>
                    <input required type="text" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Your name"
                      className="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-sm text-text-primary placeholder-text-muted outline-none focus:border-primary/40 transition-colors" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1.5">Email *</label>
                    <input required type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="you@example.com"
                      className="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-sm text-text-primary placeholder-text-muted outline-none focus:border-primary/40 transition-colors" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1.5">Phone (for SMS early access alerts)</label>
                  <input type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="(555) 000-0000"
                    className="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-sm text-text-primary placeholder-text-muted outline-none focus:border-primary/40 transition-colors" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-2">I am joining as a… *</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {roles.map((role) => (
                      <button key={role.id} type="button" onClick={() => set("interest", role.id)}
                        className={`flex flex-col items-center gap-1 p-3 rounded-xl border text-center transition-all
                          ${form.interest === role.id ? "border-primary/40 bg-primary/8 text-primary" : "border-border bg-surface text-text-secondary hover:border-primary/20"}`}>
                        <span className="text-xl">{role.icon}</span>
                        <span className="text-xs font-medium">{role.title}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <Button type="submit" variant="primary" size="lg" loading={loading} className="w-full">
                  Secure My Spot →
                </Button>
                <p className="text-center text-xs text-text-muted">No spam. Only early access notifications and founding member offers.</p>
              </form>
            </Card>
          )}

          <div className="grid sm:grid-cols-3 gap-3">
            {[
              { icon: "💰", title: "Paid Collaboration", desc: "Get paid to collaborate as we grow — brand deals and creator opportunities." },
              { icon: "🏆", title: "Founding Member Pricing", desc: "Lock in the lowest price forever — never pay full rate as an early adopter." },
              { icon: "🎬", title: "Creator Features", desc: "Be amplified and featured in the Autom8 ecosystem and creator network." },
            ].map((p) => (
              <div key={p.title} className="p-4 rounded-xl border border-border bg-surface text-center">
                <p className="text-2xl mb-2">{p.icon}</p>
                <p className="text-xs font-semibold text-text-primary mb-1">{p.title}</p>
                <p className="text-[11px] text-text-muted leading-snug">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
