-- Migration: allow admins to dismiss any character's condition
-- Mirrors player_remove_condition but authorises via the admin token and
-- scopes the target to the campaign (any character, not just the caller's).

create or replace function admin_remove_condition(
  p_campaign_id           uuid,
  p_admin_token           uuid,
  p_character_condition_id uuid
)
returns void language plpgsql security definer as $fn$
declare v_current_turn integer;
begin
  perform validate_admin(p_campaign_id, p_admin_token);
  select current_turn into v_current_turn from campaigns where id = p_campaign_id;

  update character_conditions cc set
    is_active    = false,
    expired_turn = v_current_turn
  from characters ch
  where cc.id = p_character_condition_id
    and cc.character_id = ch.id
    and ch.campaign_id = p_campaign_id
    and cc.is_active = true;

  if not found then
    raise exception 'condition not found or already inactive';
  end if;
end;
$fn$;
