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
-- CORE RPC PATCHES (written against the LIVE definitions)
-- Old signatures are dropped first so the added params don't create
-- ambiguous overloads.
-- ============================================================

drop function if exists apply_condition(uuid, uuid, uuid, uuid, integer, text);
drop function if exists player_apply_condition(uuid, uuid, uuid, integer, text);
drop function if exists end_turn_advance(uuid, uuid, uuid, jsonb);
drop function if exists advance_time(uuid, uuid, integer, jsonb);

-- apply_condition: store phase-0 resolved dice effects + phase_total_turns
create or replace function apply_condition(
  p_campaign_id       uuid,
  p_admin_token       uuid,
  p_character_id      uuid,
  p_condition_id      uuid,
  p_first_phase_turns integer,
  p_source_note       text  default null,
  p_effect_values     jsonb default '{}'::jsonb
)
returns uuid language plpgsql security definer as $$
declare
  v_id   uuid;
  v_turn integer;
begin
  perform validate_admin(p_campaign_id, p_admin_token);
  select current_turn into v_turn from campaigns where id = p_campaign_id;
  insert into character_conditions
    (character_id, condition_id, current_phase, remaining_turns, source_note, applied_turn,
     phase_total_turns, effect_values)
  values
    (p_character_id, p_condition_id, 0, p_first_phase_turns, p_source_note, v_turn,
     p_first_phase_turns, coalesce(p_effect_values, '{}'::jsonb))
  returning id into v_id;
  return v_id;
end;
$$;

-- player_apply_condition: same, validated by player_token
create or replace function player_apply_condition(
  p_campaign_id       uuid,
  p_player_token      uuid,
  p_condition_id      uuid,
  p_first_phase_turns integer,
  p_source_note       text  default null,
  p_effect_values     jsonb default '{}'::jsonb
)
returns uuid language plpgsql security definer as $$
declare
  v_character_id uuid;
  v_current_turn integer;
  v_id           uuid;
begin
  select c.id into v_character_id
  from characters c
  where c.campaign_id = p_campaign_id and c.player_token = p_player_token;
  if v_character_id is null then
    raise exception 'unauthorized';
  end if;

  select current_turn into v_current_turn from campaigns where id = p_campaign_id;
  insert into character_conditions
    (character_id, condition_id, current_phase, remaining_turns, source_note, applied_turn,
     phase_total_turns, effect_values)
  values
    (v_character_id, p_condition_id, 0, p_first_phase_turns, p_source_note, v_current_turn,
     p_first_phase_turns, coalesce(p_effect_values, '{}'::jsonb))
  returning id into v_id;
  return v_id;
end;
$$;

-- end_turn_advance: on phase transition persist the new phase's resolved dice
-- effect values + phase_total_turns; also append the client-computed effect log.
create or replace function end_turn_advance(
  p_campaign_id  uuid,
  p_admin_token  uuid,
  p_character_id uuid,
  p_dice_rolls   jsonb default '[]'::jsonb,
  p_effect_log   jsonb default '[]'::jsonb
)
returns void language plpgsql security definer as $$
declare
  cc             character_conditions%rowtype;
  next_phase     condition_phases%rowtype;
  rolled_turns   integer;
  roll_entry     jsonb;
  v_roll_turns   integer;
  v_effect_vals  jsonb;
  v_count        integer;
  v_next_idx     integer;
  v_tpm          integer;
  v_raw          integer;
  v_turn         integer;
begin
  perform validate_admin(p_campaign_id, p_admin_token);
  select turns_per_minute, current_turn into v_tpm, v_turn from campaigns where id = p_campaign_id;

  for cc in
    select * from character_conditions
    where character_id = p_character_id and is_active = true
  loop
    update character_conditions set remaining_turns = remaining_turns - 1 where id = cc.id;

    if (cc.remaining_turns - 1) <= 0 then
      select * into next_phase from condition_phases
      where condition_id = cc.condition_id and phase_order = cc.current_phase + 1;

      if found then
        -- resolve roll entry (rolled duration + dice effect values) for this cc
        v_roll_turns := null;
        v_effect_vals := '{}'::jsonb;
        for roll_entry in select * from jsonb_array_elements(p_dice_rolls) loop
          if (roll_entry->>'character_condition_id') = cc.id::text then
            v_roll_turns := (roll_entry->>'rolled_turns')::integer;
            v_effect_vals := coalesce(roll_entry->'effect_values', '{}'::jsonb);
          end if;
        end loop;

        if next_phase.duration_type = 'dice' then
          rolled_turns := v_roll_turns;
          if rolled_turns is null or rolled_turns < 1 then rolled_turns := 1; end if;
        else
          v_raw := (next_phase.duration_expression)::integer;
          rolled_turns := case next_phase.duration_unit
            when 'minutes' then v_raw * v_tpm
            when 'hours'   then v_raw * v_tpm * 60
            when 'days'    then v_raw * v_tpm * 60 * 24
            else v_raw
          end;
        end if;

        update character_conditions set
          current_phase     = cc.current_phase + 1,
          remaining_turns   = rolled_turns,
          phase_total_turns = rolled_turns,
          effect_values     = v_effect_vals
        where id = cc.id;
      else
        update character_conditions set is_active = false, expired_turn = v_turn where id = cc.id;
      end if;
    end if;
  end loop;

  -- persist the effects that fired this turn
  if jsonb_array_length(coalesce(p_effect_log, '[]'::jsonb)) > 0 then
    insert into effect_log (campaign_id, character_id, condition_id, turn, label, target, value, detail)
    select p_campaign_id,
           (e->>'character_id')::uuid,
           nullif(e->>'condition_id', '')::uuid,
           coalesce((e->>'turn')::integer, v_turn),
           coalesce(e->>'label', ''),
           coalesce(e->>'target', ''),
           coalesce((e->>'value')::integer, 0),
           coalesce(e->>'detail', '')
    from jsonb_array_elements(p_effect_log) e;
  end if;

  select count(*) into v_count from characters
  where campaign_id = p_campaign_id and is_active = true and initiative_order is not null;
  if v_count > 0 then
    select current_initiative_index into v_next_idx from campaigns where id = p_campaign_id;
    update campaigns
      set current_initiative_index = (v_next_idx + 1) % v_count,
          current_turn = current_turn + 1
    where id = p_campaign_id;
  end if;
end;
$$;

-- advance_time: bulk time-skip; same persistence on transition + aggregated log.
create or replace function advance_time(
  p_campaign_id uuid,
  p_admin_token uuid,
  p_minutes     integer,
  p_dice_rolls  jsonb default '[]'::jsonb,
  p_effect_log  jsonb default '[]'::jsonb
)
returns void language plpgsql security definer as $$
declare
  v_tpm         integer;
  adv_turns     integer;
  v_new_turn    integer;
  cc            character_conditions%rowtype;
  next_phase    condition_phases%rowtype;
  new_remain    integer;
  rolled_turns  integer;
  roll_entry    jsonb;
  v_roll_turns  integer;
  v_effect_vals jsonb;
  v_raw         integer;
begin
  perform validate_admin(p_campaign_id, p_admin_token);
  select turns_per_minute into v_tpm from campaigns where id = p_campaign_id;
  adv_turns := p_minutes * v_tpm;

  update campaigns set current_turn = current_turn + adv_turns
  where id = p_campaign_id returning current_turn into v_new_turn;

  for cc in
    select cc_i.* from character_conditions cc_i
    join characters ch on ch.id = cc_i.character_id
    where ch.campaign_id = p_campaign_id and ch.is_active = true and cc_i.is_active = true
  loop
    new_remain := cc.remaining_turns - adv_turns;
    update character_conditions set remaining_turns = greatest(0, new_remain) where id = cc.id;

    if new_remain <= 0 then
      select * into next_phase from condition_phases
      where condition_id = cc.condition_id and phase_order = cc.current_phase + 1;

      if found then
        v_roll_turns := null;
        v_effect_vals := '{}'::jsonb;
        for roll_entry in select * from jsonb_array_elements(p_dice_rolls) loop
          if (roll_entry->>'character_condition_id') = cc.id::text then
            v_roll_turns := (roll_entry->>'rolled_turns')::integer;
            v_effect_vals := coalesce(roll_entry->'effect_values', '{}'::jsonb);
          end if;
        end loop;

        if next_phase.duration_type = 'dice' then
          rolled_turns := v_roll_turns;
          if rolled_turns is null or rolled_turns < 1 then rolled_turns := 1; end if;
        else
          v_raw := (next_phase.duration_expression)::integer;
          rolled_turns := case next_phase.duration_unit
            when 'minutes' then v_raw * v_tpm
            when 'hours'   then v_raw * v_tpm * 60
            when 'days'    then v_raw * v_tpm * 60 * 24
            else v_raw
          end;
        end if;

        update character_conditions set
          current_phase     = cc.current_phase + 1,
          remaining_turns   = rolled_turns,
          phase_total_turns = rolled_turns,
          effect_values     = v_effect_vals
        where id = cc.id;
      else
        update character_conditions set is_active = false, expired_turn = v_new_turn where id = cc.id;
      end if;
    end if;
  end loop;

  if jsonb_array_length(coalesce(p_effect_log, '[]'::jsonb)) > 0 then
    insert into effect_log (campaign_id, character_id, condition_id, turn, label, target, value, detail)
    select p_campaign_id,
           (e->>'character_id')::uuid,
           nullif(e->>'condition_id', '')::uuid,
           coalesce((e->>'turn')::integer, v_new_turn),
           coalesce(e->>'label', ''),
           coalesce(e->>'target', ''),
           coalesce((e->>'value')::integer, 0),
           coalesce(e->>'detail', '')
    from jsonb_array_elements(p_effect_log) e;
  end if;
end;
$$;
