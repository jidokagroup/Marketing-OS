"use client";

import Link from "next/link";
import { useActionState } from "react";

import { type AuthState } from "@/app/(auth)/actions";
import {
  EMAIL_CONSENT_LABEL,
  EMAIL_CONSENT_TEXT,
  SMS_CONSENT_LABEL,
  SMS_CONSENT_TEXT,
} from "@/lib/marketing-os/consent";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Action = (prev: AuthState, formData: FormData) => Promise<AuthState>;

interface AuthFormProps {
  mode: "login" | "signup";
  action: Action;
  /** Same-origin path to land on after auth, already validated by the caller. */
  nextPath?: string | null;
}

/**
 * Opt-in checkbox. Unticked by default and never required — pre-ticking a
 * marketing consent box is not consent, and making it a condition of signup
 * is not allowed for SMS.
 */
function ConsentCheckbox({
  id,
  name,
  label,
  detail,
}: {
  id: string;
  name: string;
  label: string;
  detail: string;
}) {
  return (
    <div className="flex items-baseline gap-2.5">
      <input
        id={id}
        name={name}
        type="checkbox"
        className="size-4 shrink-0 self-start rounded border-input accent-primary"
      />
      <div className="min-w-0">
        <Label htmlFor={id} className="text-sm font-normal">
          {label}
        </Label>
        {/* The full disclosure stays one click away rather than off the page:
            it is what the consent log records, so it has to be readable here. */}
        <details className="group mt-0.5">
          <summary className="cursor-pointer list-none text-xs text-muted-foreground underline decoration-dotted underline-offset-2 group-open:hidden">
            Read more
          </summary>
          <p className="text-xs leading-relaxed text-muted-foreground">{detail}</p>
        </details>
      </div>
    </div>
  );
}

export function AuthForm({ mode, action, nextPath }: AuthFormProps) {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    action,
    null,
  );
  const isSignup = mode === "signup";
  // Switching between sign in and sign up must not drop the destination.
  const withNext = (path: string) =>
    nextPath ? `${path}?next=${encodeURIComponent(nextPath)}` : path;

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>{isSignup ? "Create your account" : "Welcome back"}</CardTitle>
        <CardDescription>
          {isSignup
            ? "Takes a minute. You can verify your email after checkout."
            : "Sign in to your agency workspace."}
        </CardDescription>
      </CardHeader>
      <form action={formAction}>
        {nextPath && <input type="hidden" name="next" value={nextPath} />}
        <CardContent className="space-y-4">
          {isSignup && (
            <div className="space-y-2">
              <Label htmlFor="full_name">Full name</Label>
              <Input id="full_name" name="full_name" placeholder="Erik" autoComplete="name" />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@agency.com"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              {!isSignup && (
                <Link
                  href="/forgot-password"
                  className="text-xs text-muted-foreground underline"
                >
                  Forgot password?
                </Link>
              )}
            </div>
            <Input
              id="password"
              name="password"
              type="password"
              required
              autoComplete={isSignup ? "new-password" : "current-password"}
              placeholder="••••••••"
            />
          </div>
          {isSignup && (
            <>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone number</Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  required
                  autoComplete="tel"
                  placeholder="+1 555 123 4567"
                />
              </div>
              <fieldset className="space-y-3 rounded-lg border p-3">
                <legend className="px-1 text-xs font-medium text-muted-foreground">
                  How we can reach you
                </legend>
                <ConsentCheckbox
                  id="consent_email"
                  name="consent_email"
                  label={EMAIL_CONSENT_LABEL}
                  detail={EMAIL_CONSENT_TEXT}
                />
                <ConsentCheckbox
                  id="consent_sms"
                  name="consent_sms"
                  label={SMS_CONSENT_LABEL}
                  detail={SMS_CONSENT_TEXT}
                />
                <p className="text-xs leading-relaxed text-muted-foreground">
                  These are optional. Read our{" "}
                  <Link href="/privacy" className="underline">
                    privacy policy
                  </Link>{" "}
                  and{" "}
                  <Link href="/terms" className="underline">
                    terms
                  </Link>
                  .
                </p>
              </fieldset>
            </>
          )}
          {state?.error && (
            <p className="text-sm text-destructive" role="alert">
              {state.error}
            </p>
          )}
        </CardContent>
        <CardFooter className="mt-4 flex-col gap-3">
          <Button type="submit" className="w-full" disabled={pending}>
            {pending
              ? "Please wait…"
              : isSignup
                ? "Create account"
                : "Sign in"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            {isSignup ? (
              <>
                Already have an account?{" "}
                <Link href={withNext("/login")} className="text-foreground underline">
                  Sign in
                </Link>
              </>
            ) : (
              <>
                Need an account?{" "}
                <Link href={withNext("/signup")} className="text-foreground underline">
                  Sign up
                </Link>
              </>
            )}
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
