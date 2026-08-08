-- Allow the command orchestrator to use the same Core training table.

alter table if exists public.marketing_os_core_agent_training
  drop constraint if exists marketing_os_core_agent_training_agent_key_check;

alter table if exists public.marketing_os_core_agent_training
  add constraint marketing_os_core_agent_training_agent_key_check
  check (
    agent_key in (
      'orchestrator',
      'growth-revenue',
      'client-delivery',
      'success-intelligence',
      'business-operations'
    )
  );

comment on table public.marketing_os_core_agent_training is
  'User-editable training context for the JIDOKA Core specialist agents and the command orchestrator.';
