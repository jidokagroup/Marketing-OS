/**
 * What each follow-up touch is *for*.
 *
 * Adapted from the Aurumverse follow-up sequence agent (FinTech_brain,
 * agents/07-follow-up-sequences.md). Its insight is that a sequence is not a
 * cadence of reminders — each touch has a distinct job, and the ask only
 * arrives after value has been given twice. Its own rule says it best:
 * "Every follow-up must feel like a continuation of a real relationship, not
 * a drip campaign."
 *
 * Generalised here: the original was written for Aurumverse raising from
 * crypto/RWA investors, so its content hooks (TVL, on-chain data, BNB) are
 * replaced by whatever the client's own Brand Brain supplies. The shape of
 * the ladder — and the discipline of no-ask, no-ask, light-ask, real-ask —
 * is the part worth keeping.
 */

export type Touchpoint = {
  /** Days after the first touch that this one is due. */
  day: number;
  label: string;
  /** What this message is trying to achieve. Goes into the prompt. */
  purpose: string;
  /** How hard this touch is allowed to push. */
  ask: "none" | "light" | "direct";
};

export const TOUCHPOINTS: Touchpoint[] = [
  {
    day: 1,
    label: "Introduction",
    purpose:
      "Establish presence and show genuine awareness of their work. Peer acknowledgement of " +
      "something specific they have actually done or said.",
    ask: "none",
  },
  {
    day: 4,
    label: "Value",
    purpose:
      "Deliver something genuinely useful with nothing attached — one insight, observation or " +
      "data point relevant to what they are working on. Give before asking.",
    ask: "none",
  },
  {
    day: 10,
    label: "Signal",
    purpose:
      "Position the client as a source of high-signal information: a development in their " +
      "prospect's space worth knowing about. Invite a view rather than a meeting.",
    ask: "light",
  },
  {
    day: 20,
    label: "Proof",
    purpose:
      "Social proof and momentum — a brief, concrete update on the client's own traction or " +
      "results. Confident, not boastful.",
    ask: "direct",
  },
  {
    day: 30,
    label: "Invitation",
    purpose:
      "Convert the relationship into a conversation: a specific, low-friction invitation.",
    ask: "direct",
  },
  {
    day: 45,
    label: "Check-in",
    purpose:
      "Final re-engagement before the lead goes quiet. Short, warm, and easy to ignore without " +
      "awkwardness — never guilt them for the silence.",
    ask: "light",
  },
];

/** The touchpoint for an attempt number (1-based); the last one repeats. */
export function touchpointFor(attemptNo: number): Touchpoint {
  const index = Math.min(Math.max(attemptNo, 1), TOUCHPOINTS.length) - 1;
  return TOUCHPOINTS[index];
}

/** Days to wait before the next touch, or null when the sequence is finished. */
export function daysUntilNextTouch(attemptNo: number): number | null {
  const current = touchpointFor(attemptNo);
  const next = TOUCHPOINTS[attemptNo];
  if (!next) return null;
  return next.day - current.day;
}

const ASK_GUIDANCE: Record<Touchpoint["ask"], string> = {
  none: "Make NO ask in this message. No meeting request, no call to action beyond an optional, easy reply.",
  light: "Keep the ask light — invite a view or a reaction, not a meeting.",
  direct: "A direct but low-friction ask is appropriate here.",
};

export function touchpointBrief(attemptNo: number): string {
  const t = touchpointFor(attemptNo);
  return [
    `TOUCHPOINT ${attemptNo} — ${t.label} (day ${t.day})`,
    t.purpose,
    ASK_GUIDANCE[t.ask],
    "This must read as a continuation of a real relationship, not a drip campaign. " +
      "Reference the earlier contact, and never repeat the type of message you sent last time.",
  ].join("\n");
}
