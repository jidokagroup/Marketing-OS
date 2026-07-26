import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy · Jidoka Group",
  description: "Privacy Policy for Jidoka Group and the Jidoka Marketing Team OS platform.",
};

const UPDATED = "July 3, 2026";

const sections = [
  {
    title: "1. Overview",
    body: [
      "This Privacy Policy explains how Jidoka Group collects, uses, stores, and shares information in connection with Jidoka Marketing Team OS, a marketing workflow platform for client-specific Client Content Agents, content generation, scheduling, account connections, and analytics.",
      "Jidoka Marketing Team OS is designed for business marketing workflows. It is not intended to store patient records, protected health information, payment card data, government IDs, passwords, or other regulated sensitive information unless Jidoka Group has separately agreed in writing that the service is configured for that use.",
    ],
  },
  {
    title: "2. Information We Collect",
    body: [
      "Account and workspace information: names, email addresses, client names, agent names, industry notes, connection status, and settings needed to operate the platform.",
      "Uploaded and entered content: scripts, captions, emails, transcripts, brand documents, notes, media file names, scheduled content, comments, campaign copy, and other materials you choose to add to Jidoka Marketing Team OS.",
      "Connected platform information: account identifiers, usernames, page or channel identifiers, profile images, access tokens, refresh tokens when available, analytics data, post metadata, campaign metadata, and other information returned by platforms you choose to connect, including Meta, YouTube, X, and Mailchimp.",
      "Usage and technical information: pages visited, actions taken, timestamps, device and browser information, error logs, IP-derived location, and basic security records needed to run, debug, and protect the service.",
    ],
  },
  {
    title: "3. How We Use Information",
    body: [
      "We use information to provide the Jidoka Marketing Team OS service, including creating Client Content Agents, extracting brand voice and knowledge from uploaded materials, generating draft marketing content, scheduling posts and email campaigns, displaying connected account status, importing analytics, and helping users navigate the platform.",
      "We may also use information to secure the service, troubleshoot errors, prevent abuse, improve features, maintain records, comply with legal obligations, and communicate about service updates or support requests.",
    ],
  },
  {
    title: "4. AI Processing",
    body: [
      "Jidoka Marketing Team OS may send relevant text, prompts, excerpts, summaries, and metadata to AI service providers to analyze brand voice, create knowledge summaries, generate draft content, score output, and produce recommendations.",
      "AI-generated output should be reviewed by a human before use. You are responsible for deciding what to upload and for reviewing generated content before publishing, sending, or relying on it.",
    ],
  },
  {
    title: "5. Social and Email Account Connections",
    body: [
      "When you connect a third-party account, Jidoka Marketing Team OS requests the permissions needed for the features you choose. This may include reading account profile data, importing analytics, managing draft or scheduled content, or preparing publishing workflows.",
      "Connected platforms may provide access tokens or similar credentials. Jidoka Marketing Team OS stores these credentials in encrypted form where supported by the platform integration. You can disconnect accounts from within Jidoka Marketing Team OS, and you may also revoke access directly through the third-party platform.",
    ],
  },
  {
    title: "6. How We Share Information",
    body: [
      "We share information with service providers that help us operate Jidoka Marketing Team OS, such as hosting, database, storage, authentication, AI, analytics, and infrastructure providers. These providers are allowed to process information only as needed to provide services to Jidoka Group.",
      "We share information with connected third-party platforms when you authorize a connection or request an action involving that platform. We may also disclose information if required by law, to protect rights or safety, to investigate abuse, or in connection with a business transfer involving Jidoka Group or Jidoka Marketing Team OS.",
      "Jidoka Group does not sell personal information collected through Jidoka Marketing Team OS.",
    ],
  },
  {
    title: "7. Data Retention",
    body: [
      "We keep information for as long as needed to provide Jidoka Marketing Team OS, maintain business records, comply with legal obligations, resolve disputes, secure the service, and support client workflows.",
      "You may request deletion of uploaded content, connected account data, or workspace records. Some information may remain in backups, logs, audit records, or records we are legally or operationally required to keep for a limited period.",
    ],
  },
  {
    title: "8. Security",
    body: [
      "Jidoka Group uses administrative, technical, and organizational safeguards designed to protect information from unauthorized access, loss, misuse, and disclosure. These safeguards may include encryption, access controls, role-based permissions, and hosted infrastructure security controls.",
      "No internet service can guarantee perfect security. You are responsible for using strong account credentials, limiting workspace access, reviewing connected platform permissions, and avoiding uploads of sensitive information that Jidoka Marketing Team OS is not intended to process.",
    ],
  },
  {
    title: "9. Regulated or Sensitive Industry Content",
    body: [
      "Jidoka Marketing Team OS may be used to create or organize marketing content for healthcare, wellness, finance, legal, education, or other regulated businesses. Jidoka Marketing Team OS is not a medical record system, medical device, clinical decision tool, financial advisor, legal advisor, or compliance approval tool.",
      "Do not upload patient records or protected health information unless Jidoka Group has separately agreed in writing to appropriate requirements and safeguards. Users are responsible for reviewing health-related claims, testimonials, disclaimers, substantiation, and advertising compliance before publication.",
    ],
  },
  {
    title: "10. Cookies and Similar Technologies",
    body: [
      "Jidoka Marketing Team OS may use cookies, local storage, and similar technologies to keep users signed in, maintain sessions, remember preferences, secure the service, and support basic analytics or diagnostics.",
      "Browser settings may allow you to block or delete cookies, but parts of Jidoka Marketing Team OS may not work correctly without them.",
    ],
  },
  {
    title: "11. Your Choices",
    body: [
      "You may choose what content to upload, which accounts to connect, and when to disconnect third-party services. You can also request access, correction, export, or deletion of information associated with your Jidoka Marketing Team OS workspace.",
      "Some privacy rights depend on where you live and the nature of your relationship with Jidoka Group. We will respond to requests as required by applicable law and may need to verify your identity or authority before acting on a request.",
    ],
  },
  {
    title: "12. Children",
    body: [
      "Jidoka Marketing Team OS is intended for business users and is not directed to children under 13. Jidoka Group does not knowingly collect personal information from children through Jidoka Marketing Team OS.",
    ],
  },
  {
    title: "13. International Processing",
    body: [
      "Information may be processed in the United States and other locations where Jidoka Group, its service providers, or connected platforms operate. By using Jidoka Marketing Team OS, you understand that information may be processed outside your state, province, or country.",
    ],
  },
  {
    title: "14. Changes to This Policy",
    body: [
      "Jidoka Group may update this Privacy Policy from time to time. The updated date above shows when this Policy was last revised. Continued use of Jidoka Marketing Team OS after changes become effective means the updated Policy applies.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-background px-6 py-10 text-foreground">
      <div className="mx-auto max-w-3xl">
        <nav className="mb-10 flex items-center justify-between text-sm">
          <a href="https://jidokagroup.com" className="font-semibold tracking-tight">
            Jidoka Group
          </a>
          <div className="flex gap-4 text-muted-foreground">
            <Link href="/terms" className="hover:text-foreground">
              Terms
            </Link>
            <Link href="/dashboard" className="hover:text-foreground">
              Jidoka Marketing Team OS
            </Link>
          </div>
        </nav>

        <header className="border-b pb-8">
          <p className="text-sm font-medium text-muted-foreground">Jidoka Group</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight">
            Privacy Policy for Jidoka Marketing Team OS
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
              Privacy questions or requests can be sent to Jidoka Group through{" "}
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
