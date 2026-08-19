"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";

import { LOGIN_DISABLED } from "@/lib/auth-mode";
import {
  EMAIL_CONSENT_TEXT,
  SMS_CONSENT_TEXT,
  normalizePhone,
} from "@/lib/marketing-os/consent";
import { opsTable } from "@/lib/marketing-os/operations";
import { safeNextPath } from "@/lib/safe-redirect";
import { createClient } from "@/lib/supabase/server";

export type AuthState = { error: string } | null;

/**
 * Where to land after auth. Carries intent from links such as
 * `/signup?next=/join`, so someone who clicked "Join the cohort" reaches
 * checkout instead of a generic dashboard.
 */
function readDestination(formData: FormData): string {
  return safeNextPath(formData.get("next")) ?? "/dashboard";
}

function readCredentials(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  return { email, password };
}

export async function login(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const { email, password } = readCredentials(formData);
  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { error: error.message };
  }

  redirect(readDestination(formData));
}

const checked = (formData: FormData, name: string) =>
  formData.get(name) === "on" || formData.get(name) === "true";

/**
 * Writes contact details and the consent audit trail.
 *
 * Failures here are logged, not surfaced: the account exists and checkout is
 * the next step, so blocking someone at a green light because an analytics
 * row did not land would be the worse outcome. The auth user metadata carries
 * the same values, so nothing is lost if the tables are not migrated yet.
 */
async function recordContactAndConsent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  user: User,
  details: {
    fullName: string;
    email: string;
    phone: string | null;
    emailOptIn: boolean;
    smsOptIn: boolean;
  },
) {
  const now = new Date().toISOString();

  try {
    await opsTable(supabase, "marketing_os_contact_profiles").upsert(
      {
        owner_id: user.id,
        full_name: details.fullName || null,
        email: details.email,
        phone: details.phone,
        email_opt_in: details.emailOptIn,
        sms_opt_in: details.smsOptIn,
        email_opt_in_at: details.emailOptIn ? now : null,
        sms_opt_in_at: details.smsOptIn ? now : null,
      },
      { onConflict: "owner_id" },
    );
  } catch (error) {
    console.error("Could not save contact profile:", error);
  }

  // Only opt-ins are logged at signup — an unticked box is the absence of
  // consent, not a withdrawal of it, and logging it as an event would make
  // the audit trail harder to read rather than more complete.
  const events = [
    details.emailOptIn && {
      channel: "email",
      contact_value: details.email,
      consent_text: EMAIL_CONSENT_TEXT,
    },
    details.smsOptIn && {
      channel: "sms",
      contact_value: details.phone,
      consent_text: SMS_CONSENT_TEXT,
    },
  ].filter(Boolean) as {
    channel: string;
    contact_value: string | null;
    consent_text: string;
  }[];

  if (!events.length) return;

  let ip: string | null = null;
  let userAgent: string | null = null;
  try {
    const headerList = await headers();
    ip =
      headerList.get("x-nf-client-connection-ip") ??
      headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      null;
    userAgent = headerList.get("user-agent");
  } catch {
    // Header access can fail outside a request scope; the log is still useful.
  }

  try {
    await opsTable(supabase, "marketing_os_consent_events").insert(
      events.map((event) => ({
        ...event,
        owner_id: user.id,
        granted: true,
        source: "signup_form",
        ip_address: ip,
        user_agent: userAgent,
      })),
    );
  } catch (error) {
    console.error("Could not write consent events:", error);
  }
}

export async function signup(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const { email, password } = readCredentials(formData);
  const fullName = String(formData.get("full_name") ?? "").trim();
  const phoneRaw = String(formData.get("phone") ?? "");
  const emailOptIn = checked(formData, "consent_email");
  const smsOptIn = checked(formData, "consent_sms");

  if (!email || !password) {
    return { error: "Email and password are required." };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  const phone = normalizePhone(phoneRaw);
  if (!phone) {
    return { error: "Enter a phone number we can reach you on." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        phone,
        email_opt_in: emailOptIn,
        sms_opt_in: smsOptIn,
      },
    },
  });
  if (error) {
    return { error: error.message };
  }

  if (data.user) {
    await recordContactAndConsent(supabase, data.user, {
      fullName,
      email,
      phone,
      emailOptIn,
      smsOptIn,
    });
  }

  // No session means the Supabase project still has "Confirm email" switched
  // on, which puts a verification step in front of checkout. The cohort flow
  // deliberately verifies after payment, so this is a configuration problem
  // rather than something the visitor can fix — say so plainly instead of
  // leaving them at a dead end.
  if (!data.session) {
    return {
      error:
        "Your account was created, but this project requires email " +
        "confirmation before signing in. Check your inbox to confirm, then " +
        "sign in to continue. (To let people check out first, turn off " +
        "Confirm email in Supabase → Authentication → Providers → Email.)",
    };
  }

  redirect(readDestination(formData));
}

export async function signOut() {
  if (LOGIN_DISABLED) {
    redirect("/dashboard");
  }

  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
