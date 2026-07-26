"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import {
  saveBrandBrainAction,
  type FormState,
} from "@/app/(dashboard)/brand-brain/[id]/actions";
import { ctaLinksOf, faqsOf } from "@/lib/brand-brain";
import type { BrandBrain } from "@/lib/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const toneOptions = [
  "Friendly",
  "Professional",
  "Warm",
  "Authoritative",
  "Educational",
  "Playful",
  "Direct",
  "Luxury",
];

export function BrandBrainForm({
  agentId,
  brain,
}: {
  agentId: string;
  brain: BrandBrain | null;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    saveBrandBrainAction,
    null,
  );

  useEffect(() => {
    if (state && "ok" in state) toast.success("Agent profile saved");
    else if (state && "error" in state) toast.error(state.error);
  }, [state]);

  const faqs = brain ? faqsOf(brain) : [];
  const ctaLinks = brain ? ctaLinksOf(brain) : [];
  const selectedTones = new Set(brain?.tone ?? []);
  const completionFields = [
    ["Business name", brain?.business_name],
    ["Industry", brain?.industry],
    ["Description", brain?.description],
    ["Offers", brain?.offers],
    ["Services / products", brain?.services_products],
    ["Location", brain?.location],
    ["Approved CTAs", brain?.allowed_ctas],
    ["Website or booking link", brain?.web_link || brain?.booking_link],
  ] as const;
  const completedCount = completionFields.filter(([, value]) =>
    String(value ?? "").trim(),
  ).length;
  const completion = Math.round((completedCount / completionFields.length) * 100);
  const missing = completionFields
    .filter(([, value]) => !String(value ?? "").trim())
    .map(([label]) => label);
  type CompletionLabel = (typeof completionFields)[number][0];
  const [showAll, setShowAll] = useState(missing.length === 0);
  const showRequired = (label: CompletionLabel) => showAll || missing.includes(label);
  const showWebsiteFields = showAll || missing.includes("Website or booking link");

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="agent_id" value={agentId} />

      <Card>
        <CardHeader>
          <CardTitle>Agent profile checklist</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-muted-foreground">
              The Client Content Agent fills in voice and knowledge details first. Complete
              the missing business facts below.
            </span>
            <span className="font-semibold tabular-nums">{completion}% complete</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${completion}%` }} />
          </div>
          {missing.length > 0 && (
            <p className="text-sm text-muted-foreground">
              Missing: {missing.join(", ")}
            </p>
          )}
          <div className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
            Tip: use the Client Content Agent Knowledge Base for extracted offers,
            objections, testimonials, and competitor notes before typing details
            from scratch.
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowAll((value) => !value)}
          >
            {showAll ? "Show missing only" : "Show all fields"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tone & Voice</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label>Brand tones</Label>
            <div className="flex flex-wrap gap-2">
              {toneOptions.map((tone) => (
                <label
                  key={tone}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-sm"
                >
                  <input
                    type="checkbox"
                    name="tone"
                    value={tone}
                    defaultChecked={selectedTones.has(tone)}
                    className="h-3.5 w-3.5"
                  />
                  {tone}
                </label>
              ))}
            </div>
          </div>

          <Field
            name="tone_notes"
            label="Custom tone notes"
            textarea
            placeholder="Example: Warm, clear, never fear-based. Keep replies practical and encouraging."
            defaultValue={brain?.tone_notes}
          />

          <Field
            name="brand_voice_examples"
            label="Voice examples and human review notes"
            textarea
            placeholder="Add approved example replies, phrases to avoid, and situations the team should review before anything sends."
            defaultValue={brain?.brand_voice_examples}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex items-start gap-3 rounded-lg border p-3 text-sm">
              <input
                type="checkbox"
                name="emoji_allowed"
                defaultChecked={brain?.emoji_allowed ?? true}
                className="mt-0.5 h-4 w-4"
              />
              <span>
                <span className="block font-medium">Allow emojis</span>
                <span className="text-xs text-muted-foreground">
                  Let the AI use emojis when they match the client voice.
                </span>
              </span>
            </label>
            <label className="space-y-2 rounded-lg border p-3 text-sm">
              <span className="flex items-center justify-between gap-3 font-medium">
                Formality level
                <span className="text-xs text-muted-foreground">
                  {brain?.formality_level ?? 50}/100
                </span>
              </span>
              <input
                type="range"
                name="formality_level"
                min={0}
                max={100}
                defaultValue={brain?.formality_level ?? 50}
                className="w-full"
              />
            </label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Business Info</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field name="business_name" label="Business name" defaultValue={brain?.business_name} hidden={!showRequired("Business name")} />
          <Field name="industry" label="Industry" defaultValue={brain?.industry} hidden={!showRequired("Industry")} />
          <div className={showRequired("Description") ? "sm:col-span-2" : "hidden"}>
            <Field
              name="description"
              label="Description"
              textarea
              defaultValue={brain?.description}
            />
          </div>
          <Field name="location" label="Location" defaultValue={brain?.location} hidden={!showRequired("Location")} />
          <Field name="hours" label="Hours" defaultValue={brain?.hours} hidden={!showAll} />
          <Field name="phone" label="Phone" defaultValue={brain?.phone} hidden={!showAll} />
          <Field name="language" label="Language" defaultValue={brain?.language ?? "English"} hidden={!showAll} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Offers</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field
            name="offers"
            label="Offers"
            textarea
            placeholder="List current offers, packages, lead magnets, promos, programs, or campaigns."
            defaultValue={brain?.offers}
          />
          <Field
            name="services_products"
            label="Services / products"
            textarea
            placeholder="List the core services or products this client provides."
            defaultValue={brain?.services_products}
          />
          <Field name="pricing" label="Pricing" textarea defaultValue={brain?.pricing} hidden={!showAll} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>CTA Rules</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field
            name="allowed_ctas"
            label="Approved CTA instructions"
            textarea
            placeholder="Example: Invite people to book a discovery call, click the booking link, or comment GUIDE for the free resource."
            defaultValue={brain?.allowed_ctas}
            hidden={!showRequired("Approved CTAs")}
          />
          <Field
            name="cta_links"
            label="Approved CTA links"
            textarea
            placeholder={"Book a call | https://cal.com/jidoka\nFree guide | https://jidokagroup.com/guide"}
            defaultValue={ctaLinks.map((l) => `${l.label} | ${l.url}`).join("\n")}
            hidden={!showAll}
          />
          <Field name="web_link" label="Website" defaultValue={brain?.web_link} hidden={!showWebsiteFields} />
          <Field name="booking_link" label="Booking link" defaultValue={brain?.booking_link} hidden={!showWebsiteFields} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Automation Rules</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field
            name="cta_keywords"
            label="Comment-to-DM trigger keywords"
            placeholder="price, book, guide, available, appointment"
            defaultValue={(brain?.cta_keywords ?? []).join(", ")}
          />
          <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
            Instagram Comment-to-DM flows use these keywords first, then the
            scheduled public reply and DM sequence. Sensitive replies
            still route into the client Inbox for human review.
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Human Review</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            These topics should stay in the Inbox until a person approves the
            reply.
          </p>
          <div className="flex flex-wrap gap-2">
            {["medical advice", "refund", "complaint", "legal issue", "billing", "negative experience"].map((item) => (
              <span key={item} className="rounded-lg border px-2.5 py-1 text-xs">
                {item}
              </span>
            ))}
          </div>
          <p>
            Add client-specific rules in the voice notes above so the Writing
            Agent knows what to hold for review.
          </p>
        </CardContent>
      </Card>

      <Card className={showAll ? "" : "hidden"}>
        <CardHeader>
          <CardTitle>FAQs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className={showAll ? "grid gap-2 sm:grid-cols-2" : "hidden"}>
              <Field
                name={`faq_q_${i}`}
                label={`Q${i}`}
                defaultValue={faqs[i - 1]?.q}
              />
              <Field
                name={`faq_a_${i}`}
                label={`A${i}`}
                defaultValue={faqs[i - 1]?.a}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save agent profile"}
        </Button>
        {state && "ok" in state && (
          <span className="text-sm text-muted-foreground">Saved ✓</span>
        )}
      </div>
    </form>
  );
}

function Field({
  name,
  label,
  defaultValue,
  placeholder,
  textarea,
  hidden,
}: {
  name: string;
  label: string;
  defaultValue?: string | null;
  placeholder?: string;
  textarea?: boolean;
  hidden?: boolean;
}) {
  return (
    <div className={hidden ? "hidden" : "space-y-2"}>
      <Label htmlFor={name}>{label}</Label>
      {textarea ? (
        <Textarea id={name} name={name} rows={3} placeholder={placeholder} defaultValue={defaultValue ?? ""} />
      ) : (
        <Input id={name} name={name} placeholder={placeholder} defaultValue={defaultValue ?? ""} />
      )}
    </div>
  );
}
