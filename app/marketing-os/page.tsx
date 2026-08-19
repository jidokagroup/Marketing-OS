import type { Metadata } from "next";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import MarketingRoiCalculator from "./MarketingRoiCalculator";

export const metadata: Metadata = {
  title: "Convia Pro x Jidoka | Conversation Intelligence for Marketing Machines",
  alternates: { canonical: "/ConviaproxJidoka" },
  description:
    "Convia Pro x Jidoka turns long form content into cohesive multi-channel campaigns connected to market intelligence, social signals, analytics, and agency workflow layers.",
  openGraph: {
    title: "Convia Pro x Jidoka",
    description:
      "Turn long form content into authority campaigns with market intelligence, social signals, analytics, and integrated workflow layers.",
    type: "website",
    url: "https://jidoka-marketing-os.netlify.app/ConviaproxJidoka",
  },
};

const ACCENT = "#5659F0";
const BORDER = "#E2E8F0";
const INK = "#101828";
const MUTED = "#4A5565";
const PAPER = "#F8FAFC";
/**
 * The interactive demo, served from this site's own public/demo/index.html.
 * It is deliberately not the Artifact URL: that is a claude.ai page, so a
 * visitor without a Claude account gets bounced to Claude's sign-up instead
 * of the demo.
 */
const DEMO_URL = "/demo";
/** Opens Stripe Checkout, signing the visitor up first when needed. */
const JOIN_URL = "/join";
/** Founder pricing is capped at this many seats (agency brief, p2). */
const COHORT_SEATS = 20;

const WORKFLOW_STAGES = [
  "Source content",
  "Extract signal",
  "Build campaign",
  "Distribute",
  "Compare analytics",
  "Market signals",
  "Choose next move",
  "Feed back in",
];

const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Upload or pull long form content",
    body: "Bring in long form video, podcasts, interviews, webinars, YouTube links, client calls, or uploaded recordings.",
    stat: "Source",
  },
  {
    step: "02",
    title: "Extract the signal",
    body: "Identify themes, hooks, proof points, questions, clips, quotes, objections, and reusable content patterns.",
    stat: "Signal",
  },
  {
    step: "03",
    title: "Build the campaign package",
    body: "Generate short-form scripts, captions, email, blog, social posts, briefs, and client-ready campaign assets.",
    stat: "Campaign",
  },
  {
    step: "04",
    title: "Smart Scheduler distribution",
    body: "AI chooses peak activity times from current followers and schedules the right assets across all platforms without losing context.",
    stat: "Distribution",
  },
  {
    step: "05",
    title: "Compare Your Analytics with Competitors",
    body: "See how your content performs against competitor signals, then get AI suggestions for content gaps, stronger angles, and what to improve next time.",
    stat: "Benchmark",
  },
  {
    step: "06",
    title: "Market intelligence and social signal generator",
    body: "Scan competitor posts, hooks, topics, formats, comments, saves, shares, platform velocity, creator angles, recurring objections, and market patterns before the next campaign starts.",
    stat: "Signals",
  },
  {
    step: "07",
    title: "Select signals and generate the next round",
    body: "Choose which social signals become topics, generate scripts and content, then feed the best ideas back into Part 1.",
    stat: "Loop",
  },
  {
    step: "08",
    title: "Additional Features",
    body: "Bring all other elements of a successful marketing agency into one place. We're not here to replace. Our goal is to connect what already is working, solve what doesn't, then bring it all together to streamline processes.",
    stat: "Add-ons",
  },
];

const SIGNAL_ACTIONS = [
  "Scripts",
  "Paid ad campaign",
  "Carousel",
  "SEO/AEO blog post",
  "Newsletter",
];

const NEW_SIGNAL_OPTIONS = [
  "Competitor carousel spike",
  "Comment thread asking for implementation examples",
  "Proof-led hooks outperforming education posts",
  "Save-heavy checklist format",
];

const HIGH_PERFORMERS = [
  "Founder interview proof clip",
  "Instagram caption: The bottleneck nobody names",
  "Email: Your process is leaking revenue",
  "Blog post: From content chaos to campaign loop",
];

const SCHEDULER_TIME_WINDOWS = [
  ["12 AM", "24%"],
  ["2 AM", "18%"],
  ["4 AM", "14%"],
  ["6 AM", "32%"],
  ["8 AM", "48%"],
  ["10 AM", "72%"],
  ["12 PM", "58%"],
  ["2 PM", "84%"],
  ["4 PM", "66%"],
  ["6 PM", "76%"],
  ["8 PM", "52%"],
  ["10 PM", "38%"],
];

const PROCESS_TITLE_STYLE: CSSProperties = {
  color: INK,
  fontFamily: "var(--font-heading), system-ui, sans-serif",
  fontSize: "clamp(2rem, 3.8vw, 2.25rem)",
  fontWeight: 700,
  lineHeight: 1.12,
};

const DECISION_FLOW_STYLE: CSSProperties = {
  display: "grid",
  gap: 12,
};

const DECISION_CARD_STYLE: CSSProperties = {
  display: "grid",
  gap: 12,
  border: "1px solid rgba(86, 89, 240, 0.1)",
  borderRadius: 20,
  background: "rgba(255, 255, 255, 0.94)",
  boxShadow: "0 12px 28px rgba(13, 15, 46, 0.06)",
  padding: 14,
};

const DECISION_HEADER_STYLE: CSSProperties = {
  display: "grid",
  gap: 4,
  borderBottom: "1px solid rgba(86, 89, 240, 0.08)",
  color: INK,
  paddingBottom: 12,
};

const DECISION_BADGE_STYLE: CSSProperties = {
  width: "fit-content",
  borderRadius: 999,
  background: "#F4F3FF",
  color: ACCENT,
  fontSize: "0.68rem",
  fontWeight: 900,
  padding: "5px 9px",
  textTransform: "uppercase",
};

const DECISION_TITLE_STYLE: CSSProperties = {
  display: "block",
  fontFamily: "var(--font-heading), system-ui, sans-serif",
  fontSize: "clamp(1.45rem, 2.2vw, 1.65rem)",
  fontWeight: 700,
  lineHeight: 1.12,
};

const DECISION_HELPER_STYLE: CSSProperties = {
  display: "block",
  color: MUTED,
  fontSize: "0.78rem",
  fontWeight: 800,
  lineHeight: 1.35,
};

const SELECT_CONTROL_STYLE: CSSProperties = {
  display: "grid",
  gap: 8,
};

const SELECT_LABEL_STYLE: CSSProperties = {
  color: MUTED,
  fontSize: "0.74rem",
  fontWeight: 900,
  textTransform: "uppercase",
};

const SELECT_STYLE: CSSProperties = {
  width: "100%",
  border: "1px solid rgba(86, 89, 240, 0.12)",
  borderRadius: 13,
  background: "#FFFFFF",
  color: INK,
  fontSize: "0.84rem",
  fontWeight: 800,
  padding: "10px 12px",
};

const FLOW_ARROW_STYLE: CSSProperties = {
  justifySelf: "start",
  borderRadius: 999,
  background: "linear-gradient(90deg, rgba(86, 89, 240, 0.12), rgba(0, 187, 127, 0.1))",
  color: ACCENT,
  fontSize: "0.7rem",
  fontWeight: 900,
  padding: "6px 10px",
  textTransform: "uppercase",
};

const FLOW_DIVIDER_STYLE: CSSProperties = {
  justifySelf: "center",
  border: "1px solid rgba(86, 89, 240, 0.1)",
  borderRadius: 999,
  background: "#FFFFFF",
  color: ACCENT,
  fontSize: "0.72rem",
  fontWeight: 900,
  padding: "5px 11px",
  textTransform: "uppercase",
};

const PARTNERS = [
  [
    "Business intelligence",
    "HIVE",
    "Bloomberg Terminal-level business analytics for small and medium-sized businesses, helping operators improve bottom lines, see performance more clearly, and make smarter business decisions.",
  ],
  ["Software and product", "Unstuck Labs", "Enterprise software, product development, and accelerator support for clients moving from idea to scalable build."],
  ["Web3 and regulated platforms", "Anointed Coder", "Specialists in Web3, blockchain, crypto, and gambling platform builds for clients who need experienced technical execution in complex digital categories."],
  [
    "Financial strategy",
    "Moshe Cohen CPA",
    "New York-based fractional CFO support for founders and businesses moving from scale to exit, with deep connections across investors and technology startups.",
  ],
  [
    "Strategic advisory",
    "Capitol Advisory Group",
    "Advisory and business strategy support with an extensive network across hospitality, real estate, nonprofits, politics, and institutional investors.",
  ],
  ["Business insurance", "Corgi Insurance", "Business insurance providers helping founders and operators protect the companies they are building as complexity, risk, and growth increase."],
];

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-4 text-xs font-semibold uppercase tracking-[0.24em]" style={{ color: ACCENT }}>
      {children}
    </p>
  );
}

function CtaButton({
  href,
  children,
  variant = "primary",
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary" | "dark";
}) {
  const styles =
    variant === "primary"
      ? { background: ACCENT, borderColor: ACCENT, color: "#ffffff" }
      : variant === "dark"
        ? { background: INK, borderColor: INK, color: "#ffffff" }
        : { background: "#ffffff", borderColor: BORDER, color: INK };

  const className =
    "inline-flex min-h-11 items-center justify-center rounded-md border px-5 py-3 text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5659F0]";

  // Neither destination is a page, so next/link must not handle them: it
  // navigates by fetching an RSC payload, and /join is a Route Handler that
  // answers with a redirect to Stripe while /demo is a static document. Both
  // need a real browser navigation.
  if (/^https?:/.test(href) || href === DEMO_URL || href === JOIN_URL) {
    // Off-site reading material opens in its own tab; checkout stays in this
    // one, because sending someone to pay in a background tab loses them.
    const newTab = href !== JOIN_URL;
    return (
      <a
        href={href}
        {...(newTab ? { target: "_blank", rel: "noreferrer" } : {})}
        className={className}
        style={styles}
      >
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className={className} style={styles}>
      {children}
    </Link>
  );
}

function MarketingLandingNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-[#E2E8F0] bg-white/90 px-6 py-4 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4">
        <Link href="/ConviaproxJidoka" className="text-sm font-bold tracking-tight text-[#101828] sm:text-base">
          Convia Pro x Jidoka
        </Link>
        <div className="hidden items-center gap-5 text-sm font-semibold text-[#4A5565] md:flex">
          <a href="#workflow" className="transition hover:text-[#101828]">
            Workflow
          </a>
          <a href="#interactive-demo" className="transition hover:text-[#101828]">
            How it works
          </a>
          <a
            href={DEMO_URL}
            target="_blank"
            rel="noreferrer"
            className="transition hover:text-[#101828]"
          >
            View demo
          </a>
          <a href="#ecosystem" className="transition hover:text-[#101828]">
            Ecosystem
          </a>
          <a href="#pricing" className="transition hover:text-[#101828]">
            Pricing
          </a>
        </div>
        <a
          href={JOIN_URL}
          className="inline-flex min-h-10 items-center justify-center rounded-md bg-[#101828] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#242D40]"
        >
          Join the cohort
        </a>
      </nav>
    </header>
  );
}

function MarketingLandingFooter() {
  return (
    <footer className="border-t border-[#E2E8F0] bg-white px-6 py-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 text-sm text-[#4A5565] sm:flex-row sm:items-center sm:justify-between">
        <p className="font-semibold text-[#101828]">Convia Pro x Jidoka</p>
        <div className="flex flex-wrap gap-4">
          <Link href="/privacy" className="transition hover:text-[#101828]">
            Privacy
          </Link>
          <Link href="/terms" className="transition hover:text-[#101828]">
            Terms
          </Link>
          <a href={JOIN_URL} className="transition hover:text-[#101828]">
            Join the cohort
          </a>
          <a
            href={DEMO_URL}
            target="_blank"
            rel="noreferrer"
            className="transition hover:text-[#101828]"
          >
            View demo
          </a>
        </div>
      </div>
    </footer>
  );
}

function WorkflowLoopVisual() {
  return (
    <div className="marketing-loop-visual relative overflow-hidden rounded-[2rem] border bg-white p-5 shadow-[0_24px_70px_rgba(13,15,46,0.08)] sm:p-8" style={{ borderColor: BORDER }}>
      <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em]" style={{ color: ACCENT }}>
            Always-on marketing loop
          </p>
          <h3 className="mt-3 max-w-md text-3xl font-bold leading-tight">Every conversation should feed the next campaign.</h3>
          <p className="mt-4 max-w-lg text-base leading-relaxed" style={{ color: MUTED }}>
            Convia Pro x Jidoka creates the loop agencies need: turn long form content into campaigns, compare performance to the market, find the next signal, and feed it back into production.
          </p>
        </div>

        <div className="marketing-loop-orbit relative mx-auto aspect-square w-full max-w-[520px]">
          <div className="marketing-loop-ring absolute inset-0 rounded-full" />
          <div className="marketing-loop-sweep absolute inset-[7%] rounded-full" />
          <div className="marketing-loop-center absolute inset-[20%] flex flex-col items-center justify-center rounded-full border bg-white p-8 text-center shadow-[0_18px_50px_rgba(13,15,46,0.10)]" style={{ borderColor: BORDER }}>
            <p className="text-xs font-semibold uppercase tracking-[0.22em]" style={{ color: ACCENT }}>
              Aha moment
            </p>
            <p className="mt-3 text-2xl font-bold leading-tight">Every signal becomes the next move.</p>
            <p className="mt-3 text-sm leading-relaxed" style={{ color: MUTED }}>
              Conversations, performance data, and competitor movement feed the next campaign instead of getting lost between tools.
            </p>
          </div>
          {WORKFLOW_STAGES.map((stage, index) => (
            <div key={stage} className={`marketing-loop-node marketing-loop-node-${index + 1}`}>
              <span className="marketing-loop-node-index" aria-hidden="true">{index + 1}</span>
              <span className="marketing-loop-node-label">{stage}</span>
            </div>
          ))}
        </div>

        <ol className="marketing-loop-rail">
          {WORKFLOW_STAGES.map((stage, index) => (
            <li key={stage} className="marketing-loop-rail-chip">
              <span aria-hidden="true">{index + 1}</span>
              {stage}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function HowItWorksPreview() {
  return (
    <div className="marketing-process-stack space-y-5">
      {HOW_IT_WORKS.map((item, index) => (
        <article
          key={item.title}
          className={`marketing-process-step marketing-process-step-${index + 1}`}
          style={{ animationDelay: `${index * 160}ms` }}
        >
          <div className="marketing-process-copy">
            <span className="font-data text-sm font-semibold" style={{ color: ACCENT }}>{item.step}</span>
            <h3 className="font-heading" style={PROCESS_TITLE_STYLE}>{item.title}</h3>
            <p>{item.body}</p>
            <span className="marketing-process-chip">{item.stat}</span>
          </div>
          <div className={`marketing-process-visual marketing-process-visual-${index + 1}`}>
            <div className="marketing-window">
              <div className="marketing-window-top">
                <span />
                <span />
                <span />
              </div>
              <div className="marketing-window-body">
                {index === 0 ? (
                  <>
                    <div className="marketing-upload-drop">Long form source</div>
                    <div className="marketing-progress"><span /></div>
                    <p>founder-interview.mp4</p>
                  </>
                ) : index === 1 ? (
                  <>
                    <div className="marketing-insight-tags">
                      <span>Hook</span>
                      <span>Proof</span>
                      <span>Clip</span>
                    </div>
                    <blockquote>&quot;The real bottleneck is not ideas. It is carrying the context forward.&quot;</blockquote>
                    <div className="marketing-score"><span /> Resonance score rising</div>
                  </>
                ) : index === 2 ? (
                  <>
                    {["Video clip", "Platform dynamic captions", "Email", "Blog post"].map((asset) => (
                      <div key={asset} className="marketing-content-row">
                        <span>{asset}</span>
                        <strong>ready</strong>
                      </div>
                    ))}
                  </>
                ) : index === 3 ? (
                  <>
                    <div className="marketing-mini-chart">
                      {SCHEDULER_TIME_WINDOWS.map(([time, height]) => (
                        <div key={time} className="marketing-mini-bar">
                          <span style={{ "--bar-height": height } as CSSProperties} />
                          <small>{time}</small>
                        </div>
                      ))}
                    </div>
                    <div className="marketing-schedule-row">Smart Scheduler - AI chooses peak follower activity times to publish</div>
                    <div className="marketing-platform-strip">
                      <span>Instagram</span>
                      <span>TikTok</span>
                      <span>Facebook</span>
                      <span>YouTube</span>
                      <span>Email</span>
                      <span>X</span>
                      <span>LinkedIn</span>
                    </div>
                  </>
                ) : index === 4 ? (
                  <>
                    <div className="marketing-competitor-grid">
                      <div>
                        <span>Your content</span>
                        <strong>64</strong>
                      </div>
                      <div>
                        <span>Competitor avg</span>
                        <strong>81</strong>
                      </div>
                    </div>
                    <div className="marketing-suggestion-card">AI suggestion: stronger proof in the first 3 seconds.</div>
                    <div className="marketing-suggestion-card">Gap found: pricing objections are under-addressed.</div>
                  </>
                ) : index === 5 ? (
                  <>
                    <div className="marketing-signal-cloud">
                      {[
                        "Hook velocity",
                        "Save-heavy posts",
                        "Comment themes",
                        "Creator angle shifts",
                        "Competitor carousel spike",
                        "Audio trend lift",
                        "Repeated objections",
                        "Format gaps",
                      ].map((signal) => (
                        <span key={signal}>{signal}</span>
                      ))}
                    </div>
                    <div className="marketing-suggestion-card">Competitor movement: top posts are shifting from education to proof-led breakdowns.</div>
                    <div className="marketing-suggestion-card">Social signal: comments keep asking for implementation examples, not more theory.</div>
                    <div className="marketing-schedule-row">Market scan complete - strongest signals ready for topic selection</div>
                  </>
                ) : index === 6 ? (
                  <>
                    <div className="marketing-decision-flow" style={DECISION_FLOW_STYLE}>
                      <div className="marketing-decision-card" style={DECISION_CARD_STYLE}>
                        <div className="marketing-decision-header" style={DECISION_HEADER_STYLE}>
                          <span style={DECISION_BADGE_STYLE}>Option A</span>
                          <strong style={DECISION_TITLE_STYLE}>Choose New Signal</strong>
                          <small style={DECISION_HELPER_STYLE}>Start from a fresh market signal found in Part 06.</small>
                        </div>
                        <label className="marketing-select-control" style={SELECT_CONTROL_STYLE}>
                          <span style={SELECT_LABEL_STYLE}>1. Select a signal</span>
                          <select defaultValue={NEW_SIGNAL_OPTIONS[0]} style={SELECT_STYLE}>
                            {NEW_SIGNAL_OPTIONS.map((signal) => (
                              <option key={signal}>{signal}</option>
                            ))}
                          </select>
                        </label>
                        <div className="marketing-flow-arrow" style={FLOW_ARROW_STYLE}>Then</div>
                        <label className="marketing-select-control" style={SELECT_CONTROL_STYLE}>
                          <span style={SELECT_LABEL_STYLE}>2. Generate</span>
                          <select defaultValue={SIGNAL_ACTIONS[0]} style={SELECT_STYLE}>
                            {SIGNAL_ACTIONS.map((action) => (
                              <option key={action}>{action}</option>
                            ))}
                          </select>
                        </label>
                      </div>

                      <div className="marketing-flow-divider" style={FLOW_DIVIDER_STYLE}>or</div>

                      <div className="marketing-decision-card" style={DECISION_CARD_STYLE}>
                        <div className="marketing-decision-header" style={DECISION_HEADER_STYLE}>
                          <span style={DECISION_BADGE_STYLE}>Option B</span>
                          <strong style={DECISION_TITLE_STYLE}>Repeat High Performer</strong>
                          <small style={DECISION_HELPER_STYLE}>Start from a winning campaign asset created in Part 03.</small>
                        </div>
                        <label className="marketing-select-control" style={SELECT_CONTROL_STYLE}>
                          <span style={SELECT_LABEL_STYLE}>1. Select a high performer</span>
                          <select defaultValue={HIGH_PERFORMERS[0]} style={SELECT_STYLE}>
                            {HIGH_PERFORMERS.map((piece) => (
                              <option key={piece}>{piece}</option>
                            ))}
                          </select>
                        </label>
                        <div className="marketing-flow-arrow" style={FLOW_ARROW_STYLE}>Then</div>
                        <label className="marketing-select-control" style={SELECT_CONTROL_STYLE}>
                          <span style={SELECT_LABEL_STYLE}>2. Re-generate</span>
                          <select defaultValue={SIGNAL_ACTIONS[0]} style={SELECT_STYLE}>
                            {SIGNAL_ACTIONS.map((action) => (
                              <option key={action}>{action}</option>
                            ))}
                          </select>
                        </label>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="marketing-addon-grid">
                      {[
                        "Financial analytics",
                        "Lead funnels",
                        "CRM",
                        "Paid ads",
                        "Content generator",
                        "Virtual receptionist",
                        "Inbox moderator",
                        "Comment-to-DM",
                        "Email campaigns",
                      ].map((addon) => (
                        <span key={addon}>{addon}</span>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

export default function MarketingOsPage() {
  return (
    <div className="marketing-page-shell min-h-screen font-sans" style={{ background: "#ffffff", color: INK }}>
      <MarketingLandingNav />

      <main>
        <section className="blueprint-grid-soft px-6 pb-20 pt-32 sm:pt-36">
          <div className="mx-auto max-w-6xl">
            <div className="grid gap-12 lg:grid-cols-[1.02fr_0.98fr] lg:items-center">
              <div>
                <SectionLabel>Convia Pro x Jidoka</SectionLabel>
                <h1 className="max-w-4xl text-5xl font-bold leading-[0.98] tracking-tight sm:text-6xl lg:text-7xl">
                  <span className="block">Turn conversations into authority.</span>
                  <span className="block">Turn authority into a marketing machine.</span>
                </h1>
                <p className="mt-6 max-w-2xl text-lg leading-relaxed sm:text-xl" style={{ color: MUTED }}>
                  Convia Pro turns long form content into cohesive multi-channel campaigns. Jidoka sharpens the competitive edge through market intelligence, social signals, and integrated workflow layers. Together, they turn every signal into your next campaign.
                </p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <CtaButton href={JOIN_URL}>Join the cohort</CtaButton>
                  <CtaButton href={DEMO_URL} variant="dark">View Demo</CtaButton>
                </div>
              </div>

              <div className="marketing-hero-machine relative overflow-hidden rounded-[2rem] border bg-white p-6 shadow-[0_26px_80px_rgba(13,15,46,0.12)]" style={{ borderColor: BORDER }}>
                <div className="relative z-10">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em]" style={{ color: ACCENT }}>
                    From long form to market loop
                  </p>
                  <div className="mt-6 grid gap-3">
                    {["Capture", "Campaign", "Distribute", "Benchmark", "Signals", "Next topic"].map((item, index) => (
                      <div key={item} className="marketing-hero-step">
                        <span className="font-data">0{index + 1}</span>
                        <strong>{item}</strong>
                      </div>
                    ))}
                  </div>
                  <p className="mt-6 rounded-2xl bg-[#0F172B] p-4 text-sm font-semibold leading-relaxed text-white">
                    One cycle from ideation -&gt; distribution -&gt; analytics.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="workflow" className="px-6 py-20" style={{ background: PAPER }}>
          <div className="mx-auto max-w-6xl">
            <SectionLabel>Workflow</SectionLabel>
            <h2 className="max-w-3xl text-4xl font-bold leading-tight">The fundamental loop behind every high-performing marketing operation.</h2>
            <div className="mt-8">
              <WorkflowLoopVisual />
            </div>
          </div>
        </section>

        <section id="interactive-demo" className="px-6 py-20">
          <div className="mx-auto max-w-6xl">
            <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <SectionLabel>How it works</SectionLabel>
                <h2 className="max-w-3xl text-4xl font-bold leading-tight">From long form content to the next campaign loop.</h2>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <CtaButton href={DEMO_URL}>View Demo</CtaButton>
                <CtaButton href={JOIN_URL} variant="dark">Join the cohort</CtaButton>
              </div>
            </div>
            <HowItWorksPreview />
          </div>
        </section>

        <section id="ecosystem" className="px-6 py-20">
          <div className="mx-auto max-w-6xl">
            <SectionLabel>Agency value network</SectionLabel>
            <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
              <div>
                <h2 className="text-4xl font-bold leading-tight">Make Your Agency Indispensable</h2>
                <p className="mt-4 text-lg leading-relaxed" style={{ color: MUTED }}>
                  Jidoka gives agencies a trusted partner ecosystem for business intelligence, software, finance, insurance, advisory, and specialized technical work.
                </p>
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  {["Deepen client trust", "Expand perceived capability", "Protect the relationship", "Create eligible referral upside"].map((item) => (
                    <div key={item} className="rounded-2xl border bg-white p-4 text-sm font-semibold" style={{ borderColor: BORDER }}>
                      {item}
                    </div>
                  ))}
                </div>
                <p className="mt-5 text-sm leading-relaxed" style={{ color: MUTED }}>
                  Partners also get access to Jidoka&apos;s multi-city community of founders and builders, creating more opportunities for trusted introductions, collaboration, and shared momentum.
                </p>
              </div>
              <div className="space-y-3">
                {PARTNERS.map(([capability, partner, description]) => (
                  <details
                    key={partner}
                    className="group rounded-2xl border bg-white p-5 open:shadow-[0_14px_40px_rgba(13,15,46,0.06)]"
                    style={{ borderColor: BORDER }}
                  >
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
                      <span>
                        <span className="block text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: ACCENT }}>
                          {capability}
                        </span>
                        <span className="mt-1 block font-semibold">{partner}</span>
                      </span>
                      <span className="text-xl transition group-open:rotate-45" aria-hidden="true">
                        +
                      </span>
                    </summary>
                    <p className="mt-4 text-sm leading-relaxed" style={{ color: MUTED }}>
                      {description}
                    </p>
                  </details>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="pricing" className="px-6 py-20 lg:min-h-screen lg:py-24" style={{ background: PAPER }}>
          <div className="mx-auto max-w-6xl">
            <SectionLabel>Limited offer</SectionLabel>
            <div className="max-w-4xl">
              <h2 className="text-4xl font-bold leading-tight sm:text-5xl">See what the platform could put back into your agency every month.</h2>
              <p className="mt-4 text-lg leading-relaxed" style={{ color: MUTED }}>
                Saved production time, faster delivery, stronger retention, and eligible referral opportunities can add up quickly. Move the sliders to estimate the monthly upside.
              </p>
              <p className="mt-4 text-base leading-relaxed" style={{ color: MUTED }}>
                Start with a 7-day trial, then $297/month or $3,267/year with 1 month free.
              </p>
              <p className="mt-4 text-base leading-relaxed" style={{ color: MUTED }}>
                Founder pricing is capped at {COHORT_SEATS} seats. We are building against real
                rosters, not demo data — {COHORT_SEATS} is as many as we can shape the loop
                around, and it closes with the cohort.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <CtaButton href={JOIN_URL}>Join the cohort</CtaButton>
                <CtaButton href={DEMO_URL} variant="secondary">View Demo</CtaButton>
              </div>
            </div>
            <div className="mt-10">
              <MarketingRoiCalculator />
            </div>
          </div>
        </section>
      </main>

      <MarketingLandingFooter />
    </div>
  );
}
