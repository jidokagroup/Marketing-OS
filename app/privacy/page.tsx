import Link from "next/link";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-charcoal text-white px-6 py-16 max-w-3xl mx-auto">
      <Link href="/" className="text-brand-purple text-sm hover:underline">← Back to Home</Link>
      <h1 className="text-3xl font-bold mt-8 mb-4">Privacy Policy</h1>
      <p className="text-white/40 text-sm mb-8">Last updated: {new Date().getFullYear()}</p>
      <div className="space-y-6 text-white/70 text-sm leading-relaxed">
        <p>Autom8 (&quot;we&quot;, &quot;us&quot;) is committed to protecting your privacy. This policy explains how we collect, use, and safeguard your information.</p>
        <h2 className="text-white font-semibold text-base mt-6">Information We Collect</h2>
        <p>We collect information you provide directly (account details, brand profile) and usage data to improve the Service.</p>
        <h2 className="text-white font-semibold text-base mt-6">How We Use Your Information</h2>
        <p>We use your information to provide and improve the Service, process payments, and communicate with you about your account.</p>
        <h2 className="text-white font-semibold text-base mt-6">Data Security</h2>
        <p>We use industry-standard encryption and security practices to protect your data. We never sell your data to third parties.</p>
        <h2 className="text-white font-semibold text-base mt-6">Social Account Data</h2>
        <p>When you connect Instagram or Facebook, we access only the permissions required to read comments and post replies on your behalf.</p>
        <h2 className="text-white font-semibold text-base mt-6">Contact</h2>
        <p>Questions? Email us at <a href="mailto:hello@autom8ig.io" className="text-brand-purple hover:underline">hello@autom8ig.io</a></p>
      </div>
    </div>
  );
}
