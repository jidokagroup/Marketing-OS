import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { marked } from "marked";
import { getAllPosts, getPostBySlug, formatDate, readTime } from "@/lib/blog";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return getAllPosts().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return {};
  return {
    title: `${post.title} | Autom8 Blog`,
    description: post.excerpt,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      url: `https://autom8ig.io/blog/${slug}`,
      type: "article",
      publishedTime: post.date,
    },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post || post.draft) notFound();

  const html = await marked(post.content, { gfm: true, breaks: true });

  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      {/* Header */}
      <div className="border-b border-[#262626]">
        <div className="max-w-3xl mx-auto px-6 py-6 flex items-center justify-between">
          <Link href="/" className="text-white font-semibold text-lg tracking-tight">
            Autom8
          </Link>
          <Link
            href="/blog"
            className="text-sm text-[#A1A1AA] hover:text-white transition-colors"
          >
            ← All posts
          </Link>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-6 py-16">
        {/* Meta */}
        <div className="mb-10">
          <div className="flex items-center gap-3 text-xs font-mono text-[#6B7280] mb-6">
            <Link href="/blog" className="hover:text-[#7b3ff2] transition-colors">
              Blog
            </Link>
            <span>/</span>
            <span className="text-[#A1A1AA]">{formatDate(post.date)}</span>
            <span>·</span>
            <span>{readTime(post.content)}</span>
          </div>

          <h1 className="text-4xl font-bold text-white tracking-tight leading-tight mb-6">
            {post.title}
          </h1>

          <p className="text-[#A1A1AA] text-lg leading-relaxed border-l-2 border-[#7b3ff2] pl-4">
            {post.excerpt}
          </p>
        </div>

        {/* Divider */}
        <div className="h-px bg-gradient-to-r from-[#7b3ff2]/40 via-[#f857a6]/40 to-transparent mb-12" />

        {/* Prose */}
        <article
          className="prose-blog"
          dangerouslySetInnerHTML={{ __html: html }}
        />

        {/* CTA */}
        <div className="mt-16 p-8 rounded-2xl border border-[#262626] bg-[#121212] text-center">
          <p className="text-[#A1A1AA] text-sm mb-4">
            Ready to automate your Instagram replies with AI?
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold text-white"
            style={{ background: "linear-gradient(135deg, #f857a6, #7b3ff2)" }}
          >
            Start for free →
          </Link>
        </div>

        {/* Back */}
        <div className="mt-10 text-center">
          <Link
            href="/blog"
            className="text-sm text-[#6B7280] hover:text-white transition-colors"
          >
            ← Back to all posts
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#262626] mt-16">
        <div className="max-w-3xl mx-auto px-6 py-8 flex items-center justify-between text-sm text-[#6B7280]">
          <span>© {new Date().getFullYear()} Autom8. All rights reserved.</span>
          <Link href="/" className="hover:text-white transition-colors">
            autom8ig.io
          </Link>
        </div>
      </footer>
    </div>
  );
}
