import Link from "next/link";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-charcoal text-white px-6 py-16 max-w-3xl mx-auto">
      <Link href="/" className="text-brand-purple text-sm hover:underline">← Back to Home</Link>
      <h1 className="text-3xl font-bold mt-8 mb-4">Terms of Service</h1>
      <p className="text-white/40 text-sm mb-8">Last updated: {new Date().getFullYear()}</p>
      <div className="prose prose-invert space-y-6 text-white/70 text-sm leading-relaxed">
        <p>These Terms of Service (&quot;Terms&quot;) govern your access to and use of Autom8 (&quot;Service&quot;). By using our Service, you agree to be bound by these Terms.</p>
        <h2 className="text-white font-semibold text-base mt-6">1. Use of Service</h2>
        <p>You may use Autom8 only for lawful purposes and in accordance with these Terms. You agree not to use the Service in any way that could harm, disable, or impair the Service.</p>
        <h2 className="text-white font-semibold text-base mt-6">2. Accounts</h2>
        <p>You are responsible for maintaining the confidentiality of your account credentials and for all activity that occurs under your account.</p>
        <h2 className="text-white font-semibold text-base mt-6">3. Payments</h2>
        <p>Paid plans are billed monthly. You may cancel at any time. Cancellations take effect at the end of the current billing period.</p>
        <h2 className="text-white font-semibold text-base mt-6">4. Changes to Terms</h2>
        <p>We reserve the right to modify these Terms at any time. We will notify you of significant changes via email.</p>
        <p className="mt-8 text-white/30 text-xs">Full terms coming soon. Contact hello@autom8ig.io with questions.</p>
      </div>
    </div>
  );
}
