-- Migration: structured per-phase effects + shared effect log
-- ============================================================
-- Adds:
--   * phase_effects table (timing/target/value per phase)
--   * character_conditions.phase_total_turns + .effect_values
--   * effect_log table (persisted, realtime, shared)
--   * upsert_phase_effect / delete_phase_effect RPCs
-- The drifted core RPCs (apply_condition, end_turn_advance, advance_time,
-- player_apply_condition) are patched in the companion section below, written
-- against the LIVE definitions (schema.sql is stale — do not copy from it).

-- ============================================================
-- TABLES / COLUMNS
-- ============================================================

create table if not exists phase_effects (
  id               uuid primary key default gen_random_uuid(),
  phase_id         uuid not null references condition_phases(id) on delete cascade,
  timing           text not null check (timing in ('first','last','every','distributed')),
  target           text not null default '',
  value_type       text not null check (value_type in ('fixed','dice')),
  value_expression text not null default '1',
  sort_order       integer not null default 0
);

create index if not exists phase_effects_phase_id_idx on phase_effects(phase_id);

alter table character_conditions
  add column if not exists phase_total_turns integer not null default 1;

alter table character_conditions
  add column if not exists effect_values jsonb not null default '{}'::jsonb;

create table if not exists effect_log (
  id           uuid primary key default gen_random_uuid(),
  campaign_id  uuid not null references campaigns(id) on delete cascade,
  character_id uuid not null references characters(id) on delete cascade,
  condition_id uuid,
  turn         integer not null default 0,
  label        text not null default '',
  target       text not null default '',
  value        integer not null default 0,
  detail       text not null default '',
  created_at   timestamptz not null default now()
);

create index if not exists effect_log_campaign_id_idx on effect_log(campaign_id, created_at desc);

-- ============================================================
-- ROW LEVEL SECURITY (anon SELECT, UUID-obscurity model)
-- ============================================================

alter table phase_effects enable row level security;
alter table effect_log    enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'anon_select_phase_effects') then
    create policy anon_select_phase_effects on phase_effects for select to anon using (true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'anon_select_effect_log') then
    create policy anon_select_effect_log on effect_log for select to anon using (true);
  end if;
end $$;

-- ============================================================
-- PHASE EFFECT RPCs
-- ============================================================

create or replace function upsert_phase_effect(
  p_admin_token      uuid,
  p_phase_id         uuid,
  p_id               uuid    default null,
  p_timing           text    default 'every',
  p_target           text    default '',
  p_value_type       text    default 'fixed',
  p_value_expression text    default '1',
  p_sort_order       integer default 0
)
returns uuid language plpgsql security definer as $$
declare
  v_id          uuid;
  v_campaign_id uuid;
begin
  select c.campaign_id into v_campaign_id
  from condition_phases p
  join conditions c on c.id = p.condition_id
  where p.id = p_phase_id;
  perform validate_admin(v_campaign_id, p_admin_token);

  if p_id is null then
    insert into phase_effects (phase_id, timing, target, value_type, value_expression, sort_order)
    values (p_phase_id, p_timing, p_target, p_value_type, p_value_expression, p_sort_order)
    returning id into v_id;
  else
    update phase_effects set
      timing           = p_timing,
      target           = p_target,
      value_type       = p_value_type,
      value_expression = p_value_expression,
      sort_order       = p_sort_order
    where id = p_id and phase_id = p_phase_id;
    v_id := p_id;
  end if;
  return v_id;
end;
$$;

create or replace function delete_phase_effect(
  p_admin_token uuid,
  p_phase_id    uuid,
  p_id          uuid
)
returns void language plpgsql security definer as $$
declare v_campaign_id uuid;
begin
  select c.campaign_id into v_campaign_id
  from condition_phases p
  join conditions c on c.id = p.condition_id
  where p.id = p_phase_id;
  perform validate_admin(v_campaign_id, p_admin_token);
  delete from phase_effects where id = p_id and phase_id = p_phase_id;
end;
$$;

-- ============================================================
-- REALTIME
-- ============================================================
-- Enable Realtime for: phase_effects, effect_log
--   alter publication supabase_realtime add table phase_effects;
--   alter publication supabase_realtime add table effect_log;

-- ============================================================
-- CORE RPC PATCHES — appended after live introspection
-- (apply_condition, player_apply_condition, end_turn_advance, advance_time)
-- ============================================================
