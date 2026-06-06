-- RPG Tracker — Full Schema, RLS, and RPC Functions
-- Run this entire file in the Supabase SQL editor

-- ============================================================
-- TABLES
-- ============================================================

create table if not exists campaigns (
  id                       uuid primary key default gen_random_uuid(),
  name                     text not null,
  admin_token              uuid not null default gen_random_uuid(),
  turns_per_minute         integer not null default 6,
  mode                     text not null default 'exploration'
                             check (mode in ('exploration','tactical')),
  current_day              integer not null default 1,
  current_time_minutes     integer not null default 480,
  current_initiative_index integer not null default 0,
  theme                    text not null default 'fallout1945',
  created_at               timestamptz not null default now()
);

create table if not exists condition_groups (
  id          uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  name        text not null,
  sort_order  integer not null default 0
);

create table if not exists conditions (
  id          uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  group_id    uuid not null references condition_groups(id) on delete cascade,
  name        text not null,
  sort_order  integer not null default 0
);

create table if not exists condition_phases (
  id                  uuid primary key default gen_random_uuid(),
  condition_id        uuid not null references conditions(id) on delete cascade,
  phase_order         integer not null default 0,
  duration_type       text not null check (duration_type in ('fixed','dice')),
  duration_expression text not null,
  effect_text         text not null default ''
);

create table if not exists characters (
  id               uuid primary key default gen_random_uuid(),
  campaign_id      uuid not null references campaigns(id) on delete cascade,
  name             text not null,
  player_token     uuid not null default gen_random_uuid(),
  is_npc           boolean not null default false,
  initiative_order integer,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now()
);

create table if not exists character_conditions (
  id              uuid primary key default gen_random_uuid(),
  character_id    uuid not null references characters(id) on delete cascade,
  condition_id    uuid not null references conditions(id) on delete cascade,
  current_phase   integer not null default 0,
  remaining_turns integer not null default 1,
  is_active       boolean not null default true,
  source_note     text,
  applied_at      timestamptz not null default now(),
  expired_at      timestamptz
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table campaigns            enable row level security;
alter table condition_groups     enable row level security;
alter table conditions           enable row level security;
alter table condition_phases     enable row level security;
alter table characters           enable row level security;
alter table character_conditions enable row level security;

-- Anon can SELECT everything (UUID obscurity model)
do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'anon_select_campaigns') then
    create policy anon_select_campaigns            on campaigns            for select to anon using (true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'anon_select_condition_groups') then
    create policy anon_select_condition_groups     on condition_groups     for select to anon using (true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'anon_select_conditions') then
    create policy anon_select_conditions           on conditions           for select to anon using (true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'anon_select_condition_phases') then
    create policy anon_select_condition_phases     on condition_phases     for select to anon using (true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'anon_select_characters') then
    create policy anon_select_characters           on characters           for select to anon using (true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'anon_select_character_conditions') then
    create policy anon_select_character_conditions on character_conditions for select to anon using (true);
  end if;
end $$;

-- ============================================================
-- HELPER: validate admin token
-- ============================================================

create or replace function validate_admin(p_campaign_id uuid, p_admin_token uuid)
returns void language plpgsql security definer as $$
begin
  if not exists (
    select 1 from campaigns
    where id = p_campaign_id and admin_token = p_admin_token
  ) then
    raise exception 'unauthorized';
  end if;
end;
$$;

-- ============================================================
-- CAMPAIGN RPCs
-- ============================================================

create or replace function create_campaign(
  p_name             text,
  p_turns_per_minute integer default 6
)
returns json language plpgsql security definer as $$
declare v campaigns;
begin
  insert into campaigns (name, turns_per_minute)
  values (p_name, p_turns_per_minute)
  returning * into v;
  return json_build_object('id', v.id, 'admin_token', v.admin_token);
end;
$$;

create or replace function update_campaign_settings(
  p_campaign_id      uuid,
  p_admin_token      uuid,
  p_name             text    default null,
  p_turns_per_minute integer default null,
  p_theme            text    default null
)
returns void language plpgsql security definer as $$
begin
  perform validate_admin(p_campaign_id, p_admin_token);
  update campaigns set
    name             = coalesce(p_name, name),
    turns_per_minute = coalesce(p_turns_per_minute, turns_per_minute),
    theme            = coalesce(p_theme, theme)
  where id = p_campaign_id;
end;
$$;

create or replace function advance_time(
  p_campaign_id uuid,
  p_admin_token uuid,
  p_minutes     integer
)
returns void language plpgsql security definer as $$
declare
  v_total integer;
  v_day   integer;
begin
  perform validate_admin(p_campaign_id, p_admin_token);
  select current_time_minutes + p_minutes, current_day
  into v_total, v_day
  from campaigns where id = p_campaign_id;
  update campaigns set
    current_time_minutes = v_total % 1440,
    current_day          = v_day + (v_total / 1440)
  where id = p_campaign_id;
end;
$$;

-- ============================================================
-- CONDITION GROUP RPCs
-- ============================================================

create or replace function upsert_condition_group(
  p_campaign_id uuid,
  p_admin_token uuid,
  p_id          uuid   default null,
  p_name        text   default '',
  p_sort_order  integer default 0
)
returns uuid language plpgsql security definer as $$
declare v_id uuid;
begin
  perform validate_admin(p_campaign_id, p_admin_token);
  if p_id is null then
    insert into condition_groups (campaign_id, name, sort_order)
    values (p_campaign_id, p_name, p_sort_order)
    returning id into v_id;
  else
    update condition_groups set name=p_name, sort_order=p_sort_order
    where id=p_id and campaign_id=p_campaign_id;
    v_id := p_id;
  end if;
  return v_id;
end;
$$;

create or replace function delete_condition_group(
  p_campaign_id uuid,
  p_admin_token uuid,
  p_id          uuid
)
returns void language plpgsql security definer as $$
begin
  perform validate_admin(p_campaign_id, p_admin_token);
  delete from condition_groups where id=p_id and campaign_id=p_campaign_id;
end;
$$;

-- ============================================================
-- CONDITION RPCs
-- ============================================================

create or replace function upsert_condition(
  p_campaign_id uuid,
  p_admin_token uuid,
  p_id          uuid    default null,
  p_group_id    uuid    default null,
  p_name        text    default '',
  p_sort_order  integer default 0
)
returns uuid language plpgsql security definer as $$
declare v_id uuid;
begin
  perform validate_admin(p_campaign_id, p_admin_token);
  if p_id is null then
    insert into conditions (campaign_id, group_id, name, sort_order)
    values (p_campaign_id, p_group_id, p_name, p_sort_order)
    returning id into v_id;
  else
    update conditions set
      group_id   = coalesce(p_group_id, group_id),
      name       = p_name,
      sort_order = p_sort_order
    where id=p_id and campaign_id=p_campaign_id;
    v_id := p_id;
  end if;
  return v_id;
end;
$$;

create or replace function delete_condition(
  p_campaign_id uuid,
  p_admin_token uuid,
  p_id          uuid
)
returns void language plpgsql security definer as $$
begin
  perform validate_admin(p_campaign_id, p_admin_token);
  delete from conditions where id=p_id and campaign_id=p_campaign_id;
end;
$$;

-- ============================================================
-- CONDITION PHASE RPCs
-- ============================================================

create or replace function upsert_condition_phase(
  p_admin_token         uuid,
  p_condition_id        uuid,
  p_id                  uuid    default null,
  p_phase_order         integer default 0,
  p_duration_type       text    default 'fixed',
  p_duration_expression text    default '1',
  p_effect_text         text    default ''
)
returns uuid language plpgsql security definer as $$
declare
  v_id          uuid;
  v_campaign_id uuid;
begin
  select c.campaign_id into v_campaign_id from conditions c where c.id = p_condition_id;
  perform validate_admin(v_campaign_id, p_admin_token);
  if p_id is null then
    insert into condition_phases
      (condition_id, phase_order, duration_type, duration_expression, effect_text)
    values (p_condition_id, p_phase_order, p_duration_type, p_duration_expression, p_effect_text)
    returning id into v_id;
  else
    update condition_phases set
      phase_order         = p_phase_order,
      duration_type       = p_duration_type,
      duration_expression = p_duration_expression,
      effect_text         = p_effect_text
    where id=p_id and condition_id=p_condition_id;
    v_id := p_id;
  end if;
  return v_id;
end;
$$;

create or replace function delete_condition_phase(
  p_admin_token  uuid,
  p_condition_id uuid,
  p_id           uuid
)
returns void language plpgsql security definer as $$
declare v_campaign_id uuid;
begin
  select c.campaign_id into v_campaign_id from conditions c where c.id = p_condition_id;
  perform validate_admin(v_campaign_id, p_admin_token);
  delete from condition_phases where id=p_id and condition_id=p_condition_id;
end;
$$;

-- ============================================================
-- CHARACTER RPCs
-- ============================================================

create or replace function add_character(
  p_campaign_id uuid,
  p_admin_token uuid,
  p_name        text,
  p_is_npc      boolean default false
)
returns json language plpgsql security definer as $$
declare v characters;
begin
  perform validate_admin(p_campaign_id, p_admin_token);
  insert into characters (campaign_id, name, is_npc)
  values (p_campaign_id, p_name, p_is_npc)
  returning * into v;
  return json_build_object('id', v.id, 'player_token', v.player_token);
end;
$$;

create or replace function deactivate_character(
  p_campaign_id  uuid,
  p_admin_token  uuid,
  p_character_id uuid
)
returns void language plpgsql security definer as $$
begin
  perform validate_admin(p_campaign_id, p_admin_token);
  update characters set is_active=false
  where id=p_character_id and campaign_id=p_campaign_id;
end;
$$;

-- ============================================================
-- MODE SWITCH RPCs
-- ============================================================

create or replace function switch_to_tactical(
  p_campaign_id uuid,
  p_admin_token uuid,
  p_assignments jsonb  -- [{"character_id":"...","initiative_order":1}, ...]
)
returns void language plpgsql security definer as $$
declare r jsonb;
begin
  perform validate_admin(p_campaign_id, p_admin_token);
  for r in select * from jsonb_array_elements(p_assignments) loop
    update characters
    set initiative_order = (r->>'initiative_order')::integer
    where id = (r->>'character_id')::uuid
      and campaign_id = p_campaign_id;
  end loop;
  update campaigns set mode='tactical', current_initiative_index=0
  where id=p_campaign_id;
end;
$$;

create or replace function switch_to_exploration(
  p_campaign_id uuid,
  p_admin_token uuid
)
returns void language plpgsql security definer as $$
begin
  perform validate_admin(p_campaign_id, p_admin_token);
  update characters set is_active=false
  where campaign_id=p_campaign_id and is_npc=true;
  update characters set initiative_order=null
  where campaign_id=p_campaign_id and is_npc=false;
  update campaigns set mode='exploration', current_initiative_index=0
  where id=p_campaign_id;
end;
$$;

-- ============================================================
-- APPLY CONDITION RPC
-- ============================================================

create or replace function apply_condition(
  p_campaign_id      uuid,
  p_admin_token      uuid,
  p_character_id     uuid,
  p_condition_id     uuid,
  p_first_phase_turns integer,
  p_source_note      text default null
)
returns uuid language plpgsql security definer as $$
declare v_id uuid;
begin
  perform validate_admin(p_campaign_id, p_admin_token);
  insert into character_conditions
    (character_id, condition_id, current_phase, remaining_turns, source_note)
  values
    (p_character_id, p_condition_id, 0, p_first_phase_turns, p_source_note)
  returning id into v_id;
  return v_id;
end;
$$;

-- ============================================================
-- END TURN RPC (core game logic)
-- ============================================================

create or replace function end_turn_advance(
  p_campaign_id  uuid,
  p_admin_token  uuid,
  p_character_id uuid,
  -- Pre-rolled values for dice-type phase transitions:
  -- [{"character_condition_id":"...","rolled_turns":3}, ...]
  p_dice_rolls   jsonb default '[]'
)
returns void language plpgsql security definer as $$
declare
  cc           character_conditions%rowtype;
  next_phase   condition_phases%rowtype;
  rolled_turns integer;
  roll_entry   jsonb;
  v_count      integer;
  v_next_idx   integer;
begin
  perform validate_admin(p_campaign_id, p_admin_token);

  -- Tick all active conditions for this character
  for cc in
    select * from character_conditions
    where character_id = p_character_id and is_active = true
  loop
    -- Decrement remaining turns
    update character_conditions
    set remaining_turns = remaining_turns - 1
    where id = cc.id;

    -- Check if phase expired
    if (cc.remaining_turns - 1) <= 0 then
      -- Try to advance to next phase
      select * into next_phase
      from condition_phases
      where condition_id = cc.condition_id
        and phase_order = cc.current_phase + 1;

      if found then
        -- Advance phase
        if next_phase.duration_type = 'dice' then
          rolled_turns := null;
          for roll_entry in select * from jsonb_array_elements(p_dice_rolls) loop
            if (roll_entry->>'character_condition_id') = cc.id::text then
              rolled_turns := (roll_entry->>'rolled_turns')::integer;
            end if;
          end loop;
          if rolled_turns is null or rolled_turns < 1 then
            rolled_turns := 1;  -- safe fallback
          end if;
        else
          rolled_turns := (next_phase.duration_expression)::integer;
        end if;

        update character_conditions set
          current_phase   = cc.current_phase + 1,
          remaining_turns = rolled_turns
        where id = cc.id;

      else
        -- No more phases — expire the condition
        update character_conditions set
          is_active  = false,
          expired_at = now()
        where id = cc.id;
      end if;
    end if;
  end loop;

  -- Advance initiative index
  select count(*) into v_count
  from characters
  where campaign_id = p_campaign_id
    and is_active = true
    and initiative_order is not null;

  if v_count > 0 then
    select current_initiative_index into v_next_idx
    from campaigns where id = p_campaign_id;

    update campaigns
    set current_initiative_index = (v_next_idx + 1) % v_count
    where id = p_campaign_id;
  end if;
end;
$$;

-- ============================================================
-- REALTIME: enable on all tables
-- ============================================================
-- Run these in the Supabase dashboard under Database > Replication
-- or enable via the Realtime UI for each table:
--   campaigns, condition_groups, conditions, condition_phases,
--   characters, character_conditions
-- ============================================================
