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
    <div className="p-5 md:p-7 max-w-3xl mx-auto">
      <div className="mb-6">
        <Link href="/blog" className="text-xs text-text-muted hover:text-primary transition-colors">← Back to Blog</Link>
      </div>
      <div className="mb-8">
        <div className="flex items-center gap-3 text-xs font-mono text-text-muted mb-4">
          <span>{formatDate(post.date)}</span>
          <span>·</span>
          <span>{readTime(post.content)}</span>
        </div>
        <h1 className="text-3xl font-bold text-text-primary tracking-tight leading-tight mb-4">{post.title}</h1>
        <p className="text-text-secondary leading-relaxed border-l-2 border-primary pl-4">{post.excerpt}</p>
      </div>
      <div className="h-px bg-gradient-to-r from-primary/40 via-accent-pink/40 to-transparent mb-10" />
      <article className="prose-blog" dangerouslySetInnerHTML={{ __html: html }} />
      <div className="mt-12 p-6 rounded-2xl border border-primary/20 bg-primary/5 text-center">
        <p className="text-text-secondary text-sm mb-4">Ready to automate your Instagram replies?</p>
        <Link href="/signup" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white" style={{ background: "linear-gradient(135deg, #f857a6, #7b3ff2)" }}>
          Start for free →
        </Link>
      </div>
    </div>
  );
}
