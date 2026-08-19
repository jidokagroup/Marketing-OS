"use server";

import { redirect } from "next/navigation";

import { LOGIN_DISABLED } from "@/lib/auth-mode";
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

export async function signup(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const { email, password } = readCredentials(formData);
  const fullName = String(formData.get("full_name") ?? "").trim();

  if (!email || !password) {
    return { error: "Email and password are required." };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });
  if (error) {
    return { error: error.message };
  }

  // If the project requires email confirmation there is no session yet.
  if (!data.session) {
    return {
      error:
        "Account created. Check your email to confirm, then sign in.",
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
