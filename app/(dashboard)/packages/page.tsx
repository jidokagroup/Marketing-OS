import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";

import {
  CORE_MODULES,
  PACKAGE_LAYER_STATUS,
} from "@/lib/core-modules";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata = { title: "Package Layers · Jidoka Marketing Team OS" };

const NEXT_STEPS = [
  "Keep the shared Core foundation stable.",
  "Map package-specific workflows to existing Core modules.",
  "Only add new data objects when Marketing OS cannot reuse a Core object.",
  "Use orchestrator memory and playbooks as the handoff layer between packages.",
];

export default function PackagesPage() {
  const PackageLayerIcon = PACKAGE_LAYER_STATUS.icon;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Package Layers"
        description="Industry package layers configure the shared Jidoka Core foundation."
      />

      <section className="rounded-lg border bg-muted/20 p-5">
        <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
          <div>
            <Badge variant="secondary">{PACKAGE_LAYER_STATUS.phase}</Badge>
            <h2 className="mt-3 text-xl font-semibold tracking-tight">
              Marketing OS sits on the shared Core foundation.
            </h2>
          </div>
          <p className="text-sm leading-6 text-muted-foreground">
            {PACKAGE_LAYER_STATUS.summary} This page keeps that boundary clear:
            Core modules stay stable, while Marketing OS adds content,
            scheduler, analytics, inbox, and campaign workflows on top.
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">
          Required before new package work
        </h2>
        <div className="grid gap-3 md:grid-cols-2">
          {NEXT_STEPS.map((step) => (
            <Card key={step} size="sm">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                  <CardTitle>{step}</CardTitle>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">
          Core modules packages can configure
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CORE_MODULES.map((module) => {
            const Icon = module.icon;
            return (
              <Link
                key={module.id}
                href={module.href}
                className="flex min-h-24 items-start gap-3 rounded-lg border p-3 text-left transition-colors hover:border-primary/50"
              >
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{module.label}</span>
                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                    {module.summary}
                  </span>
                </span>
                <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            );
          })}
        </div>
      </section>

      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <PackageLayerIcon className="mt-0.5 h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle>Holding space, not forking the OS</CardTitle>
              <CardDescription className="mt-2 leading-6">
                The Marketing OS can grow into other industries without losing
                the common command center, memory, permissions, and integration
                model.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent />
      </Card>
    </div>
  );
}
