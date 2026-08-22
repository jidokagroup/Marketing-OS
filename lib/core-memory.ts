/**
 * Which stored memories belong to which Core agent.
 *
 * Shared by the Core detail page, which lists them, and by Core Command,
 * which needs to know whether an agent has any memory before describing how
 * ready it is. Both used to be able to disagree about the same record.
 */

import type { CoreAgentDefinition } from "@/lib/core-agents";

export type CoreMemoryRow = {
  record_type: string;
  title: string;
  memory_owner: string | null;
  affected_business_systems: string[] | null;
};

const ORCHESTRATOR_SYSTEMS = ["Routing", "Memory", "Handoffs", "Escalations"];

/**
 * The agent's own bookkeeping is not knowledge about the business, so it does
 * not count towards an agent looking like it has learned anything.
 */
export function isUsefulMemory(memory: CoreMemoryRow) {
  return (
    memory.record_type !== "Agent Refinement" &&
    !memory.title.toLowerCase().includes("training updated")
  );
}

export function isMemoryForAgent(
  memory: CoreMemoryRow,
  agent: CoreAgentDefinition,
) {
  if (!isUsefulMemory(memory)) return false;
  const systems = memory.affected_business_systems ?? [];

  if (agent.key === "orchestrator") {
    return (
      memory.memory_owner === agent.label ||
      memory.memory_owner === "JIDOKA Core Orchestrator" ||
      memory.record_type === "Playbook" ||
      systems.some((system) => ORCHESTRATOR_SYSTEMS.includes(system))
    );
  }

  if (memory.memory_owner === agent.label) return true;
  return systems.some((system) => agent.systems.includes(system));
}

export function countMemoriesByAgent(
  memories: CoreMemoryRow[],
  agents: CoreAgentDefinition[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const agent of agents) {
    counts.set(
      agent.key,
      memories.filter((memory) => isMemoryForAgent(memory, agent)).length,
    );
  }
  return counts;
}
