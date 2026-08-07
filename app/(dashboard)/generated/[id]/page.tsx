import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarClock, CheckCircle2, CopyPlus, Edit3, Trash2 } from "lucide-react";

import { requireUser } from "@/lib/auth";
import { CopyButton } from "@/components/copy-button";
import { ScoreBadge } from "@/components/score-badge";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  deleteGeneratedContentAction,
  duplicateGeneratedContentAction,
  updateGeneratedContentAction,
} from "../actions";

const SCORE_FIELDS: { key: string; label: string }[] = [
  { key: "voice_match", label: "Voice" },
  { key: "syntax_match", label: "Syntax" },
  { key: "hook_match", label: "Hook" },
  { key: "story_match", label: "Story" },
  { key: "belief_match", label: "Belief" },
  { key: "emotional_match", label: "Emotional" },
  { key: "phrase_match", label: "Phrase" },
  { key: "brand_accuracy", label: "Brand" },
  { key: "knowledge_accuracy", label: "Knowledge" },
];

export default async function GeneratedDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await requireUser();

  const { data: content } = await supabase
    .from("marketing_os_generated_content")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!content) notFound();

  const { data: agent } = await supabase
    .from("marketing_os_writing_agents")
    .select("id, name, client_id")
    .eq("id", content.agent_id)
    .maybeSingle();

  const { data: score } = await supabase
    .from("marketing_os_quality_scores")
    .select("*")
    .eq("generated_content_id", id)
    .order("attempt", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: scheduledPosts } = await supabase
    .from("marketing_os_scheduled_posts")
    .select("id, status, platform")
    .eq("generated_content_id", id);
  const scheduledStatus = scheduledPosts?.[0]?.status ?? "draft";
  const approvalStatus = content.below_threshold
    ? "Needs revision"
    : scheduledStatus === "posted"
      ? "Published"
      : scheduledStatus === "scheduled"
        ? "Approved and scheduled"
        : "Draft review";

  const platformText = String(content.platform ?? "").toLowerCase();
  const wantsBlogPost = platformText.includes("blog");
  const variants: { value: string; label: string; text: string | null }[] = [
    { value: "primary", label: "Reel script", text: content.primary_script },
    { value: "short", label: "Short caption", text: content.short_version },
    { value: "long", label: wantsBlogPost ? "Blog post" : "Long caption", text: content.long_version },
    { value: "organic", label: "Carousel copy", text: content.organic_version },
    { value: "sales", label: "Email", text: content.sales_version },
  ];

  const hooks = (content.alternate_hooks ?? []) as string[];
  const ctas = (content.alternate_ctas ?? []) as string[];
  const schedulerParams = new URLSearchParams({
    agent_id: agent?.id ?? "",
    title: content.title || content.topic || "",
  });
  if (agent?.client_id) schedulerParams.set("client", agent.client_id);
  const generatedLibraryHref = agent?.client_id
    ? `/generated?client=${agent.client_id}`
    : "/generated";

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <Link
          href={generatedLibraryHref}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← All generated content
        </Link>
      </div>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">
            {content.topic || "Untitled piece"}
          </h1>
          <div className="flex flex-wrap items-center gap-1.5">
            {agent && (
              <Link href={`/agents/${agent.id}`}>
                <Badge variant="outline">{agent.name}</Badge>
              </Link>
            )}
            {content.platform && <Badge variant="secondary">{content.platform}</Badge>}
            {content.goal && <Badge variant="secondary">{content.goal}</Badge>}
            <Badge variant={scheduledStatus === "draft" ? "outline" : "default"}>
              {scheduledStatus}
            </Badge>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {content.overall_score != null && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Authenticity</span>
              <ScoreBadge score={Number(content.overall_score)} />
            </div>
          )}
          <ButtonLink
            href={`/scheduler?${schedulerParams.toString()}`}
            variant="outline"
            size="sm"
          >
            <CalendarClock className="mr-1 h-3.5 w-3.5" />
            Schedule this
          </ButtonLink>
          {agent && (
            <ButtonLink href={`/agents/${agent.id}?tab=generate`} variant="outline" size="sm">
              Generate another
            </ButtonLink>
          )}
          <form action={duplicateGeneratedContentAction}>
            <input type="hidden" name="id" value={content.id} />
            <Button type="submit" variant="outline" size="sm">
              <CopyPlus className="mr-1 h-3.5 w-3.5" />
              Duplicate
            </Button>
          </form>
          <form action={deleteGeneratedContentAction}>
            <input type="hidden" name="id" value={content.id} />
            <ConfirmSubmitButton
              message="Delete this generated piece?"
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="mr-1 h-3.5 w-3.5" />
              Delete
            </ConfirmSubmitButton>
          </form>
        </div>
      </div>

      <Card className="mb-6">
        <CardContent className="grid gap-4 py-4 text-sm md:grid-cols-[1fr_auto]">
          <div className="text-muted-foreground">
            <p>
              The authenticity score estimates how closely this piece matches the
              agent&apos;s voice, beliefs, syntax, hooks, phrases, and brand knowledge.
            </p>
            <p className="mt-1">
              Scores above 90 are usually ready for review and scheduling.
            </p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="font-medium">Approval status</p>
            <p className="mt-1 flex items-center gap-2 text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              {approvalStatus}
            </p>
          </div>
        </CardContent>
      </Card>

      <details className="mb-6 rounded-lg border p-4">
        <summary className="flex cursor-pointer list-none items-center gap-2 font-medium">
          <Edit3 className="h-4 w-4" />
          Edit generated content
        </summary>
        <form action={updateGeneratedContentAction} className="mt-4 space-y-4">
          <input type="hidden" name="id" value={content.id} />
          {variants.map((variant) => (
            <div key={variant.value} className="space-y-2">
              <label className="text-sm font-medium">{variant.label}</label>
              <Textarea
                name={
                  variant.value === "primary"
                    ? "primary_script"
                    : `${variant.value}_version`
                }
                rows={variant.value === "primary" ? 8 : 5}
                defaultValue={variant.text ?? ""}
              />
            </div>
          ))}
          <Button type="submit">Save edits</Button>
        </form>
      </details>

      {content.below_threshold && (
        <div className="mb-6 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
          This piece scored below the 90 fidelity bar after an automatic rewrite.
          Review carefully before publishing.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Content</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="primary">
                <TabsList>
                  {variants.map((v) => (
                    <TabsTrigger key={v.value} value={v.value}>
                      {v.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
                {variants.map((v) => (
                  <TabsContent key={v.value} value={v.value} className="mt-4 space-y-3">
                    <div className="flex justify-end">
                      <CopyButton text={v.text ?? ""} />
                    </div>
                    <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed">
                      {v.text || "—"}
                    </pre>
                  </TabsContent>
                ))}
              </Tabs>
            </CardContent>
          </Card>

          {(hooks.length > 0 || ctas.length > 0) && (
            <Card>
              <CardHeader>
                <CardTitle>Alternates</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {hooks.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
                      Hooks
                    </p>
                    <ul className="space-y-1 text-sm">
                      {hooks.map((h, i) => (
                        <li key={i}>• {h}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {ctas.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
                      CTAs
                    </p>
                    <ul className="space-y-1 text-sm">
                      {ctas.map((c, i) => (
                        <li key={i}>• {c}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Quality scores</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {score ? (
                <>
                  {SCORE_FIELDS.map((f) => {
                    const value = score[f.key as keyof typeof score];
                    const n = value == null ? 0 : Number(value);
                    return (
                      <div key={f.key} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{f.label}</span>
                        <span className="font-medium tabular-nums">{Math.round(n)}</span>
                      </div>
                    );
                  })}
                  <div className="mt-3 flex items-center justify-between border-t pt-3 text-sm font-semibold">
                    <span>Overall</span>
                    <span className="tabular-nums">
                      {score.overall == null ? "—" : Math.round(Number(score.overall))}
                    </span>
                  </div>
                  {score.rationale && (
                    <p className="pt-2 text-xs text-muted-foreground">
                      {score.rationale}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No scores recorded.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
