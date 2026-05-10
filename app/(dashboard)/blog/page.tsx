"use client";

const posts = [
  {
    slug: "how-to-automate-instagram-replies",
    title: "How to Automate Instagram Replies Without Losing Your Brand Voice",
    excerpt: "Learn how AI can respond to comments, DMs, and story mentions 24/7 while sounding exactly like you — driving leads while you sleep.",
    tag: "Strategy",
    date: "May 5, 2026",
    readTime: "5 min",
    cta: true,
  },
  {
    slug: "best-times-to-post-instagram-2026",
    title: "The Best Times to Post on Instagram in 2026 (Data-Backed)",
    excerpt: "Stop guessing. We analyzed millions of posts to find the peak engagement windows for your niche — and how to auto-schedule for maximum reach.",
    tag: "Growth",
    date: "Apr 28, 2026",
    readTime: "7 min",
    cta: true,
  },
  {
    slug: "ai-brand-voice-guide",
    title: "Train Your AI to Sound Like You: A Brand Voice Guide for Creators",
    excerpt: "Your followers can tell when it's not really you. Here's how to train your AI to match your tone, CTAs, and style — perfectly.",
    tag: "AI Tips",
    date: "Apr 18, 2026",
    readTime: "6 min",
    cta: false,
  },
];

export default function BlogPage() {
  return (
    <div className="p-5 md:p-7 max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <p className="text-xs text-text-muted uppercase tracking-wider mb-1">Resources</p>
        <h1 className="text-3xl font-semibold tracking-tight text-text-primary">Autom8 Blog</h1>
        <p className="text-sm text-text-secondary mt-1">
          High-value guides, growth strategies, and AI automation tips — built for creators and business owners.
        </p>
      </div>

      {/* Featured Post */}
      <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-transparent to-accent-purple/5 p-6 md:p-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(123,63,242,0.05),transparent_60%)] pointer-events-none" />
        <div className="relative">
          <span className="inline-flex items-center gap-1.5 bg-primary/10 border border-primary/20 text-primary text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full mb-4">
            ⭐ Featured
          </span>
          <h2 className="text-xl md:text-2xl font-bold text-text-primary mb-3 leading-snug">
            {posts[0].title}
          </h2>
          <p className="text-sm text-text-secondary leading-relaxed mb-5">{posts[0].excerpt}</p>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-xs text-text-muted">
              <span>{posts[0].date}</span>
              <span>·</span>
              <span>{posts[0].readTime} read</span>
            </div>
            <a
              href={`/blog/${posts[0].slug}`}
              className="text-sm font-semibold text-primary hover:underline"
            >
              Read Article →
            </a>
          </div>
        </div>
      </div>

      {/* Post grid */}
      <div className="grid sm:grid-cols-2 gap-4">
        {posts.slice(1).map((post) => (
          <div key={post.slug} className="flex flex-col p-5 rounded-xl border border-border bg-surface hover:border-primary/20 transition-colors">
            <span className="text-[10px] font-bold uppercase tracking-wider text-primary mb-3">{post.tag}</span>
            <h3 className="text-sm font-semibold text-text-primary mb-2 leading-snug flex-1">{post.title}</h3>
            <p className="text-xs text-text-muted leading-relaxed mb-4">{post.excerpt}</p>
            {post.cta && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 mb-4 text-xs text-primary font-medium text-center">
                🚀 Start your free trial today →
              </div>
            )}
            <div className="flex items-center justify-between text-xs text-text-muted mt-auto">
              <span>{post.date} · {post.readTime}</span>
              <a href={`/blog/${post.slug}`} className="text-primary hover:underline font-medium">Read →</a>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}
