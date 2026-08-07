import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Boxes } from "lucide-react";

import {
  CORE_MODULES,
  CORE_MODULE_BY_ID,
  FOUNDATION_LAYERS,
  PACKAGE_LAYER_STATUS,
} from "@/lib/core-modules";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function statusLabel(status: string) {
  if (status === "needs_api") return "Needs API";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function CoreModulePage({ moduleId }: { moduleId: string }) {
  const coreModule = CORE_MODULE_BY_ID.get(moduleId);
  if (!coreModule) notFound();

  const Icon = coreModule.icon;
  const PackageLayerIcon = PACKAGE_LAYER_STATUS.icon;
  const foundationLayer = FOUNDATION_LAYERS.find(
    (layer) => layer.id === coreModule.foundationLayer,
  );
  const connectedModules = CORE_MODULES.filter(
    (item) =>
      item.id !== coreModule.id &&
      (item.foundationLayer === coreModule.foundationLayer ||
        item.dataObjects.some((object) => coreModule.dataObjects.includes(object))),
  ).slice(0, 4);

  return (
    <div className="space-y-8">
      <PageHeader title={coreModule.label} description={coreModule.summary}>
        <ButtonLink href="/dashboard" variant="outline">
          Core Command
        </ButtonLink>
        <ButtonLink href={PACKAGE_LAYER_STATUS.href} variant="outline">
          <PackageLayerIcon className="mr-1 h-4 w-4" />
          Package layers
        </ButtonLink>
      </PageHeader>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <CardHeader>
            <div className="flex items-start gap-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <Badge variant="secondary">Jidoka Core module</Badge>
                <CardTitle className="mt-3 text-xl">
                  {coreModule.capability}
                </CardTitle>
                <CardDescription className="mt-3 leading-6">
                  Marketing OS surface: {coreModule.marketingSurface}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Build state</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-center justify-between gap-4">
              <span>Route</span>
              <Badge>Online</Badge>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span>Coverage</span>
              <Badge variant={coreModule.status === "needs_api" ? "outline" : "default"}>
                {statusLabel(coreModule.status)}
              </Badge>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span>Foundation</span>
              <Badge variant="outline">{foundationLayer?.label ?? "Core"}</Badge>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground">
            Foundation data objects
          </h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
            These Marketing OS tables and concepts cover this Core module inside
            the current product.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 rounded-lg border p-4">
          {coreModule.dataObjects.map((object) => (
            <Badge key={object} variant="secondary">
              {object}
            </Badge>
          ))}
        </div>
      </section>

      <section className="rounded-lg border p-5">
        <div className="flex items-start gap-3">
          <Boxes className="mt-0.5 h-5 w-5 text-muted-foreground" />
          <div className="space-y-1">
            <h2 className="font-semibold">
              {PACKAGE_LAYER_STATUS.label}: {PACKAGE_LAYER_STATUS.phase}
            </h2>
            <p className="text-sm leading-6 text-muted-foreground">
              {PACKAGE_LAYER_STATUS.summary}
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">
          Connected modules
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {connectedModules.map((item) => {
            const AdjacentIcon = item.icon;
            return (
              <Link
                key={item.id}
                href={item.href}
                className="flex min-h-24 items-start gap-3 rounded-lg border p-3 text-left transition-colors hover:border-primary/50"
              >
                <AdjacentIcon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{item.label}</span>
                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                    {item.summary}
                  </span>
                </span>
                <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
