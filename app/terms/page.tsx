import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms and Conditions · Jidoka Group",
  description: "Terms and Conditions for Jidoka Group and the Jidoka Marketing Team OS platform.",
};

const UPDATED = "July 3, 2026";

const sections = [
  {
    title: "1. Who These Terms Cover",
    body: [
      "These Terms and Conditions govern access to and use of the Jidoka Marketing Team OS platform and related services made available by Jidoka Group. Jidoka Marketing Team OS is a marketing workflow platform used to organize client content, create Client Content Agents, generate draft marketing materials, connect approved social and email accounts, schedule content, and review performance data.",
      "By using Jidoka Marketing Team OS, you agree to these Terms on behalf of yourself and, if you use Jidoka Marketing Team OS for a company or client, on behalf of that organization.",
    ],
  },
  {
    title: "2. Accounts and Authorized Use",
    body: [
      "You are responsible for the accuracy of information you provide, the security of your account access, and all activity under your account or demo workspace.",
      "You may use Jidoka Marketing Team OS only for lawful business, marketing, and operational purposes. You may not interfere with the platform, attempt unauthorized access, scrape or reverse engineer the service, or use Jidoka Marketing Team OS to create deceptive, unlawful, infringing, or harmful content.",
    ],
  },
  {
    title: "3. Client Content and Uploaded Materials",
    body: [
      "You retain ownership of content you upload or enter into Jidoka Marketing Team OS, including scripts, captions, emails, brand documents, strategy notes, media files, and client information. You grant Jidoka Group a limited permission to process that content only as needed to provide, maintain, secure, and improve the services you request.",
      "Do not upload patient medical records, protected health information, payment card numbers, government IDs, passwords, or other regulated sensitive data unless Jidoka Group has separately agreed in writing that the service is configured for that use.",
    ],
  },
  {
    title: "4. AI Generated Output",
    body: [
      "Jidoka Marketing Team OS may use artificial intelligence to analyze uploaded content, summarize brand voice, generate drafts, recommend posting windows, and suggest social or email content. AI output can be incomplete, inaccurate, or inappropriate for a specific use case.",
      "You are responsible for reviewing, editing, approving, and legally clearing all generated content before publishing or sending it. Jidoka Marketing Team OS does not provide medical, legal, financial, compliance, or advertising approval advice.",
    ],
  },
  {
    title: "5. Social, Email, and Third-Party Services",
    body: [
      "When you connect accounts such as Instagram, Facebook, YouTube, X, or Mailchimp, you authorize Jidoka Marketing Team OS to request the access needed to support the actions you choose, such as reading account metadata, preparing content, scheduling drafts, or importing analytics.",
      "Third-party platforms are governed by their own terms, policies, permissions, rate limits, review requirements, and availability. Jidoka Group is not responsible for outages, rejections, permission changes, or policy decisions by those third-party services.",
    ],
  },
  {
    title: "6. Publishing and Compliance",
    body: [
      "You are responsible for making sure your content complies with applicable laws, platform rules, advertising standards, professional obligations, client approvals, and industry-specific requirements.",
      "For healthcare, wellness, finance, legal, education, or other regulated subject matter, you are responsible for reviewing claims, disclaimers, substantiation, testimonials, audience targeting, and required approvals before publication.",
    ],
  },
  {
    title: "7. Platform Availability",
    body: [
      "Jidoka Group may change, suspend, or discontinue parts of Jidoka Marketing Team OS as features are tested, reviewed by platforms, or improved. Some integrations may remain disabled until the relevant API approval, app review, or credential setup is complete.",
      "The service is provided on an as-is and as-available basis. Jidoka Group does not guarantee uninterrupted access, error-free operation, specific results, increased reach, revenue, or platform approval.",
    ],
  },
  {
    title: "8. Intellectual Property",
    body: [
      "Jidoka Group owns the Jidoka Marketing Team OS software, workflows, interface, templates, systems, and related materials, excluding your uploaded client content and third-party materials.",
      "You may not copy, resell, sublicense, or create competing services from Jidoka Marketing Team OS without written permission from Jidoka Group.",
    ],
  },
  {
    title: "9. Termination",
    body: [
      "Jidoka Group may suspend or terminate access if we believe use of the platform violates these Terms, creates risk for Jidoka Group, Jidoka Marketing Team OS, connected platforms, clients, or other users, or is required by law or platform policy.",
      "You may stop using the platform at any time. Data export or deletion requests can be submitted using the contact information below.",
    ],
  },
  {
    title: "10. Limitation of Liability",
    body: [
      "To the maximum extent allowed by law, Jidoka Group will not be liable for indirect, incidental, special, consequential, exemplary, or punitive damages, or for lost profits, lost data, platform suspensions, publishing errors, or business losses arising from use of Jidoka Marketing Team OS.",
      "Jidoka Group's total liability for claims relating to Jidoka Marketing Team OS will be limited to the amount paid to Jidoka Group for the service giving rise to the claim during the three months before the claim, or one hundred dollars if no amount was paid.",
    ],
  },
  {
    title: "11. Changes to These Terms",
    body: [
      "Jidoka Group may update these Terms from time to time. The updated date above shows when these Terms were last revised. Continued use of Jidoka Marketing Team OS after changes become effective means you accept the updated Terms.",
    ],
  },
];

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-background px-6 py-10 text-foreground">
      <div className="mx-auto max-w-3xl">
        <nav className="mb-10 flex items-center justify-between text-sm">
          <a href="https://jidokagroup.com" className="font-semibold tracking-tight">
            Jidoka Group
          </a>
          <div className="flex gap-4 text-muted-foreground">
            <Link href="/privacy" className="hover:text-foreground">
              Privacy
            </Link>
            <Link href="/dashboard" className="hover:text-foreground">
              Jidoka Marketing Team OS
            </Link>
          </div>
        </nav>

        <header className="border-b pb-8">
          <p className="text-sm font-medium text-muted-foreground">Jidoka Group</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight">
            Terms and Conditions for Jidoka Marketing Team OS
          </h1>
          <p className="mt-4 text-sm text-muted-foreground">
            Last updated: {UPDATED}
          </p>
        </header>

        <div className="space-y-8 py-8">
          {sections.map((section) => (
            <section key={section.title} className="space-y-3">
              <h2 className="text-xl font-semibold tracking-tight">{section.title}</h2>
              {section.body.map((paragraph) => (
                <p key={paragraph} className="leading-7 text-muted-foreground">
                  {paragraph}
                </p>
              ))}
            </section>
          ))}

          <section className="rounded-lg border bg-muted/30 p-5">
            <h2 className="text-xl font-semibold tracking-tight">Contact</h2>
            <p className="mt-3 leading-7 text-muted-foreground">
              Questions about these Terms can be sent to Jidoka Group through{" "}
              <a className="text-foreground underline" href="https://jidokagroup.com">
                jidokagroup.com
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
