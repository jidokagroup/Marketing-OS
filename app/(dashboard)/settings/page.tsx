import Link from "next/link";
import { ChevronRight, CreditCard, FileText, ShieldCheck } from "lucide-react";

import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export const metadata = { title: "Settings · Jidoka Marketing Team OS" };

export default async function SettingsPage() {
  const { user } = await requireUser();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="Settings" description="Your account details." />

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>Signed in to your agency workspace.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={user.email ?? ""} readOnly disabled />
          </div>
          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              value={user.user_metadata?.full_name ?? "—"}
              readOnly
              disabled
            />
          </div>
          <p className="text-sm text-muted-foreground">
            Use the sign-out button in the top bar when you are finished.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Billing
          </CardTitle>
          <CardDescription>
            Subscription details for Jidoka Marketing Team OS.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border p-4">
              <p className="text-sm font-medium">Plan</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Marketing Team OS
              </p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-sm font-medium">Status</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Stripe setup pending
              </p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Account creation currently opens the dashboard directly. Stripe
            subscription checkout will be connected here after the billing
            account and price are configured.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Legal</CardTitle>
          <CardDescription>Policies for Jidoka Group and Jidoka Marketing Team OS.</CardDescription>
        </CardHeader>
        <CardContent className="divide-y rounded-lg border p-0">
          <Link
            href="/privacy"
            className="flex items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-muted/50"
          >
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            <span className="flex-1 font-medium">Privacy Policy</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
          <Link
            href="/terms"
            className="flex items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-muted/50"
          >
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="flex-1 font-medium">Terms and Conditions</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
