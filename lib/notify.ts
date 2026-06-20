/**
 * Notification helpers for support tickets.
 * Both are env-gated: if the relevant keys aren't set, they no-op (skipped:true)
 * so ticket submission never fails just because notifications aren't configured.
 */

export interface TicketNotification {
  name: string
  email: string
  phone?: string | null
  page_name?: string | null
  concern_type?: string | null
  message: string
}

type NotifyResult = { ok: boolean; skipped?: boolean; error?: string }

/** Email via Resend (https://resend.com). Free tier: 100/day. */
export async function sendHelpEmail(ticket: TicketNotification): Promise<NotifyResult> {
  const apiKey = process.env.RESEND_API_KEY
  const to = process.env.HELP_NOTIFY_EMAIL || 'hello@barebranding.site'
  // Resend's shared sender works without domain verification (delivers to the account owner).
  const from = process.env.HELP_NOTIFY_FROM || 'Autom8 Support <onboarding@resend.dev>'
  if (!apiKey) return { ok: false, skipped: true }

  const subject = `🎫 Help Ticket [${ticket.concern_type || 'General'}] — ${ticket.page_name || ticket.name}`
  const text =
    `New support ticket from the Autom8 dashboard\n\n` +
    `Name: ${ticket.name}\n` +
    `Email: ${ticket.email}\n` +
    `Phone: ${ticket.phone || 'N/A'}\n` +
    `Page / Account: ${ticket.page_name || 'N/A'}\n` +
    `Category: ${ticket.concern_type || 'N/A'}\n\n` +
    `Message:\n${ticket.message}\n`

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, reply_to: ticket.email, subject, text }),
    })
    if (!res.ok) return { ok: false, error: `Resend ${res.status}: ${await res.text()}` }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'email send error' }
  }
}

export interface CollabApproval {
  name: string
  email: string
  referralCode: string | null
  dashboardUrl: string
}

/** Email a collaborator when their application is approved. Env-gated via Resend. */
export async function sendCollabApprovalEmail(a: CollabApproval): Promise<NotifyResult> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.HELP_NOTIFY_FROM || 'Autom8 <onboarding@resend.dev>'
  if (!apiKey) return { ok: false, skipped: true }

  const subject = `🎉 You're approved for the Autom8 Collab Program`
  const codeLine = a.referralCode ? `Your referral code: ${a.referralCode}\n` : ''
  const text =
    `Hi ${a.name},\n\n` +
    `You've been approved for the Autom8 Creator Collab Program! 🎉\n\n` +
    `Head to your collaborator dashboard to claim your free month and grab your referral link:\n` +
    `${a.dashboardUrl}\n\n` +
    codeLine +
    `\nWelcome aboard,\nThe Autom8 Team`

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: a.email, subject, text }),
    })
    if (!res.ok) return { ok: false, error: `Resend ${res.status}: ${await res.text()}` }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'email send error' }
  }
}

/** SMS via Twilio. Needs TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER. */
export async function sendHelpSms(ticket: TicketNotification): Promise<NotifyResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_FROM_NUMBER
  const to = process.env.HELP_NOTIFY_SMS || '+12404101925'
  if (!sid || !token || !from) return { ok: false, skipped: true }

  const body =
    `New Autom8 ticket — ${ticket.concern_type || 'General'}\n` +
    `${ticket.name} (${ticket.email})\n` +
    `${ticket.message.slice(0, 200)}`

  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: to, From: from, Body: body }),
    })
    if (!res.ok) return { ok: false, error: `Twilio ${res.status}: ${await res.text()}` }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'sms send error' }
  }
}
