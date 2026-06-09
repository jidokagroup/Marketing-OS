import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getAllPosts, getPostBySlug, formatDate, readTime } from "@/lib/blog";

interface Props { params: Promise<{ slug: string }> }

export async function generateStaticParams() {
  return getAllPosts().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return {};
  return { title: `${post.title} | Autom8`, description: post.excerpt };
}

function mdToHtml(md: string): string {
  return md
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/^[-*] (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`)
    .replace(/^(?!<[hul\/]|<li)(.+)$/gm, "<p>$1</p>");
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post || post.draft) notFound();
  const html = mdToHtml(post.content);

  return (
    /* pb-24 clears fixed mobile bottom nav */
    <div className="px-4 py-5 md:px-7 md:py-7 max-w-3xl mx-auto pb-24 md:pb-12">

      {/* Back link — large touch target on mobile */}
      <div className="mb-5">
        <Link
          href="/blog"
          className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-primary transition-colors py-2 -ml-1 px-1"
        >
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Blog
        </Link>
      </div>

      {/* Post header */}
      <div className="mb-7">
        <div className="flex items-center gap-2 text-xs font-mono text-text-muted mb-4 flex-wrap">
          <span>{formatDate(post.date)}</span>
          <span>·</span>
          <span>{readTime(post.content)}</span>
        </div>
        {/* Responsive heading — smaller on mobile */}
        <h1 className="text-2xl sm:text-3xl font-bold text-text-primary tracking-tight leading-tight mb-4">
          {post.title}
        </h1>
        <p className="text-text-secondary leading-relaxed border-l-2 border-primary pl-4 text-sm sm:text-base">
          {post.excerpt}
        </p>
      </div>

      {/* Gradient divider */}
      <div className="h-px bg-gradient-to-r from-primary/40 via-accent-pink/40 to-transparent mb-8" />

      {/* Prose — overflow protection for mobile */}
      <article
        className="prose-blog"
        dangerouslySetInnerHTML={{ __html: html }}
      />

      {/* CTA */}
      <div className="mt-10 p-5 md:p-6 rounded-2xl border border-primary/20 bg-primary/5 text-center">
        <p className="text-text-secondary text-sm mb-4 leading-relaxed">
          Ready to automate your Instagram replies with AI?
        </p>
        {/* Full-width on mobile, auto on larger */}
        <Link
          href="/signup"
          className="flex sm:inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold text-white active:opacity-80 transition-opacity"
          style={{ background: "linear-gradient(135deg, #f857a6, #7b3ff2)" }}
        >
          Start for free →
        </Link>
      </div>
    </div>
  );
}
