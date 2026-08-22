import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

import { requireUser } from "@/lib/auth";
import { SeatSync } from "@/components/seat-context";
import {
  asRows,
  formatDate,
  formatMoney,
  isOpsSchemaMissing,
  opsTable,
  titleCase,
} from "@/lib/marketing-os/operations";
import { touchpointFor } from "@/lib/acquisition/touchpoints";
import { OutreachGenerateButton } from "@/components/outreach-generate-button";
import { OpsSchemaNotice } from "@/components/ops-schema-notice";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { recordReplyAction, updateAttemptStatusAction } from "../actions";

export const metadata = { title: "Lead · Jidoka Marketing Team OS" };

type Lead = {
  id: string;
  client_id: string | null;
  lead_name: string | null;
  company: string | null;
  email: string | null;
  linkedin_url: string | null;
  source_channel: string | null;
  source_url: string | null;
  evidence: string | null;
  status: string;
  estimated_value: number;
  outreach_stage: string | null;
  next_attempt_at: string | null;
};

type Attempt = {
  id: string;
  attempt_no: number;
  channel: string;
  subject: string | null;
  body: string;
  status: string;
  sent_at: string | null;
  created_at: string;
  verification: {
    verdict?: string;
    score?: number;
    issues?: string[];
    reasoning?: string;
    pain_point?: string;
    offer_angle?: string;
  } | null;
};

function verdictBadge(verdict?: string) {
  if (verdict === "rejected") return { variant: "destructive" as const, label: "Held — rejected" };
  if (verdict === "revised") return { variant: "secondary" as const, label: "Revised by check" };
  return { variant: "default" as const, label: "Approved by check" };
}

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { user, supabase } = await requireUser();

  const leadResult = await opsTable(supabase, "marketing_os_leads")
    .select(
      "id, client_id, lead_name, company, email, linkedin_url, source_channel, source_url, evidence, status, estimated_value, outreach_stage, next_attempt_at",
    )
    .eq("id", id)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (isOpsSchemaMissing(leadResult.error)) {
    return (
      <div className="space-y-6">
        <PageHeader title="Lead" />
        <OpsSchemaNotice feature="Client acquisition" />
      </div>
    );
  }
  const lead = leadResult.data as Lead | null;
  if (!lead) notFound();

  const [attemptsResult, repliesResult] = await Promise.all([
    opsTable(supabase, "marketing_os_acquisition_attempts")
      .select("id, attempt_no, channel, subject, body, status, sent_at, created_at, verification")
      .eq("owner_id", user.id)
      .eq("lead_id", id)
      .order("attempt_no", { ascending: true }),
    opsTable(supabase, "marketing_os_acquisition_replies")
      .select("id, body, channel, received_at")
      .eq("owner_id", user.id)
      .eq("lead_id", id)
      .order("received_at", { ascending: false }),
  ]);
  const attempts = asRows<Attempt>(attemptsResult.data);
  const replies = asRows<{ id: string; body: string; channel: string; received_at: string }>(
    repliesResult.data,
  );

  const nextTouch = touchpointFor(attempts.length + 1);
  const sequenceDone = attempts.length >= 6;

  return (
    <div className="space-y-6">
      <SeatSync clientId={lead.client_id} />
      <div>
        <Link href="/pipeline" className="text-sm text-muted-foreground hover:underline">
          ← Pipeline
        </Link>
      </div>

      <PageHeader
        title={lead.lead_name || lead.email || "Unnamed lead"}
        description={[lead.company, lead.source_channel && `via ${lead.source_channel}`]
          .filter(Boolean)
          .join(" · ")}
      >
        {lead.client_id && !sequenceDone && replies.length === 0 && (
          <OutreachGenerateButton
            leadId={lead.id}
            channel={lead.email ? "email" : "linkedin"}
            attemptNo={attempts.length + 1}
          />
        )}
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{titleCase(lead.outreach_stage ?? "Daily Queue")}</Badge>
        <Badge variant="secondary">{titleCase(lead.status)}</Badge>
        <Badge variant="outline">{formatMoney(lead.estimated_value)}</Badge>
        {lead.next_attempt_at && (
          <span className="text-sm text-muted-foreground">
            Next touch due {formatDate(lead.next_attempt_at)}
          </span>
        )}
      </div>

      {!lead.evidence && (
        <Card className="border-amber-300 bg-amber-50/60 text-amber-950">
          <CardContent className="flex items-start gap-3 py-4 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              No evidence recorded for this prospect. Outreach opens on something specific they
              said or did &mdash; without it the first line will be generic, which is the one thing
              a first touch cannot afford. Add context before drafting.
            </p>
          </CardContent>
        </Card>
      )}

      {lead.evidence && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Evidence</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">{lead.evidence}</CardContent>
        </Card>
      )}

      {replies.length > 0 && (
        <Card className="border-emerald-300 bg-emerald-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="h-4 w-4" /> They replied
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {replies.map((reply) => (
              <div key={reply.id} className="rounded-lg border bg-background p-3 text-sm">
                <p className="text-xs text-muted-foreground">
                  {titleCase(reply.channel)} · {formatDate(reply.received_at)}
                </p>
                <p className="mt-1">{reply.body}</p>
              </div>
            ))}
            <p className="text-xs text-muted-foreground">
              The automated sequence stopped here. Continuing to send after a reply is the fastest
              way to undo the relationship.
            </p>
          </CardContent>
        </Card>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Sequence</h2>
          {!sequenceDone && replies.length === 0 && (
            <span className="text-sm text-muted-foreground">
              Next: {nextTouch.label} (day {nextTouch.day})
            </span>
          )}
        </div>

        {attempts.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
            Nothing drafted yet. The first touch is an introduction &mdash; no ask, just specific
            awareness of their work.
          </p>
        ) : (
          <div className="space-y-3">
            {attempts.map((attempt) => {
              const touch = touchpointFor(attempt.attempt_no);
              const badge = verdictBadge(attempt.verification?.verdict);
              const issues = attempt.verification?.issues ?? [];
              return (
                <Card key={attempt.id}>
                  <CardHeader className="pb-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <CardTitle className="text-base">
                        {attempt.attempt_no}. {touch.label}
                      </CardTitle>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant="outline">{titleCase(attempt.channel)}</Badge>
                        <Badge variant={badge.variant}>{badge.label}</Badge>
                        <Badge variant={attempt.status === "sent" ? "default" : "outline"}>
                          {titleCase(attempt.status)}
                        </Badge>
                      </div>
                    </div>
                    {attempt.verification?.reasoning && (
                      <p className="text-xs text-muted-foreground">
                        {attempt.verification.reasoning}
                      </p>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {issues.length > 0 && (
                      <ul className="space-y-1 rounded-lg border border-amber-300 bg-amber-50/60 p-3 text-sm text-amber-950">
                        {issues.map((issue, i) => (
                          <li key={i}>• {issue}</li>
                        ))}
                      </ul>
                    )}
                    <form action={updateAttemptStatusAction} className="space-y-2">
                      <input type="hidden" name="id" value={attempt.id} />
                      <input type="hidden" name="lead_id" value={lead.id} />
                      {attempt.subject && (
                        <p className="text-sm font-medium">Subject: {attempt.subject}</p>
                      )}
                      <Textarea name="body" defaultValue={attempt.body} rows={7} aria-label="Message" />
                      <div className="flex flex-wrap gap-2">
                        <Button type="submit" name="status" value="sent" size="sm">
                          Mark sent
                        </Button>
                        <Button type="submit" name="status" value="approved" size="sm" variant="outline">
                          Save as approved
                        </Button>
                        <Button type="submit" name="status" value="skipped" size="sm" variant="outline">
                          Skip
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {replies.length === 0 && attempts.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Log a reply</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={recordReplyAction} className="space-y-2">
              <input type="hidden" name="lead_id" value={lead.id} />
              <Textarea name="body" rows={3} placeholder="What they said…" aria-label="Reply" />
              <Button type="submit" size="sm" variant="outline">
                Record reply and stop the sequence
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
