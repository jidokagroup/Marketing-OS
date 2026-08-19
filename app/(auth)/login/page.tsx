import { redirect } from "next/navigation";

import { AuthForm } from "@/components/auth-form";
import { login } from "@/app/(auth)/actions";
import { LOGIN_DISABLED } from "@/lib/auth-mode";
import { safeNextPath } from "@/lib/safe-redirect";

export const metadata = { title: "Sign in · Convia Pro x Jidoka" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  if (LOGIN_DISABLED) {
    redirect("/dashboard");
  }

  const nextPath = safeNextPath((await searchParams).next);

  return <AuthForm mode="login" action={login} nextPath={nextPath} />;
}
