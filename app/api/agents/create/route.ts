import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { getAuthContext } from "@/lib/auth";
import { AGENT_EXISTS_FOR_CLIENT_ERROR, existingAgentForClient } from "@/lib/agent-per-client";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let context: Awaited<ReturnType<typeof getAuthContext>>;

  try {
    context = await getAuthContext();
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not start the demo session.",
      },
      { status: 500 },
    );
  }

  if (!context) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { user, supabase } = context;
  const formData = await request.formData().catch(() => new FormData());
  const name = String(formData.get("name") ?? "").trim();
  const clientId = String(formData.get("client_id") ?? "").trim();
  const industry = String(formData.get("industry") ?? "").trim() || null;
  const platform = String(formData.get("platform") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!name) {
    return NextResponse.json({ error: "Agent name is required." }, { status: 400 });
  }
  if (!clientId) {
    return NextResponse.json(
      { error: "Choose a client so this agent only uses that client's data." },
      { status: 400 },
    );
  }

  const { data: client, error: clientError } = await supabase
    .from("marketing_os_clients")
    .select("id")
    .eq("id", clientId)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (clientError) {
    return NextResponse.json({ error: clientError.message }, { status: 500 });
  }
  if (!client) {
    return NextResponse.json({ error: "Client not found." }, { status: 404 });
  }

  const existingId = await existingAgentForClient(supabase, user.id, clientId);
  if (existingId) {
    return NextResponse.json({
      id: existingId,
      existing: true,
      message: AGENT_EXISTS_FOR_CLIENT_ERROR,
    });
  }

  const { data, error } = await supabase
    .from("marketing_os_writing_agents")
    .insert({
      owner_id: user.id,
      client_id: clientId,
      name,
      industry,
      platform,
      notes,
      status: "draft",
    })
    .select("id")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Could not create agent." },
      { status: 500 },
    );
  }

  revalidatePath("/agents");
  revalidatePath("/clients");
  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/dashboard");
  return NextResponse.json({ id: data.id, existing: false });
}
