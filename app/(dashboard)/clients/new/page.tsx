import { PageHeader } from "@/components/page-header";
import { ClientForm } from "@/components/client-form";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = { title: "New Client · Jidoka Marketing Team OS" };

export default function NewClientPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="New client" description="Group Client Content Agents under a client." />
      <Card>
        <CardContent className="pt-6">
          <ClientForm />
        </CardContent>
      </Card>
    </div>
  );
}
