import { redirect } from "next/navigation";

import { AuthForm } from "@/components/auth-form";
import { signup } from "@/app/(auth)/actions";
import { LOGIN_DISABLED } from "@/lib/auth-mode";
import { safeNextPath } from "@/lib/safe-redirect";

export const metadata = { title: "Sign up · Jidoka Marketing Team OS" };

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  if (LOGIN_DISABLED) {
    redirect("/dashboard");
  }

  const nextPath = safeNextPath((await searchParams).next);

  return <AuthForm mode="signup" action={signup} nextPath={nextPath} />;
}
