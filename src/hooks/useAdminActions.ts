import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

interface ActionState {
  loading: boolean
  error: string | null
}

function useAction<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>
): [(...args: TArgs) => Promise<TResult>, ActionState] {
  const [state, setState] = useState<ActionState>({ loading: false, error: null })
  const execute = useCallback(async (...args: TArgs): Promise<TResult> => {
    setState({ loading: true, error: null })
    try {
      const result = await fn(...args)
      setState({ loading: false, error: null })
      return result
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setState({ loading: false, error: msg })
      throw e
    }
  }, [fn]) // eslint-disable-line react-hooks/exhaustive-deps
  return [execute, state]
}

async function rpc<T>(name: string, params: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(name, params)
  if (error) throw new Error(error.message)
  return data as T
}

export function useAdminActions(campaignId: string, adminToken: string) {
  const [updateSettings] = useAction((params: { name?: string; turns_per_minute?: number; theme?: string }) =>
    rpc('update_campaign_settings', { p_campaign_id: campaignId, p_admin_token: adminToken, ...Object.fromEntries(
      Object.entries(params).map(([k, v]) => [`p_${k}`, v])
    )})
  )

  const [advanceTime] = useAction((minutes: number) =>
    rpc('advance_time', { p_campaign_id: campaignId, p_admin_token: adminToken, p_minutes: minutes })
  )

  const [upsertGroup] = useAction((params: { id?: string; name: string; sort_order: number }) =>
    rpc<string>('upsert_condition_group', {
      p_campaign_id: campaignId, p_admin_token: adminToken,
      p_id: params.id ?? null, p_name: params.name, p_sort_order: params.sort_order,
    })
  )

  const [deleteGroup] = useAction((id: string) =>
    rpc('delete_condition_group', { p_campaign_id: campaignId, p_admin_token: adminToken, p_id: id })
  )

  const [upsertCondition] = useAction((params: { id?: string; group_id: string; name: string; sort_order: number }) =>
    rpc<string>('upsert_condition', {
      p_campaign_id: campaignId, p_admin_token: adminToken,
      p_id: params.id ?? null, p_group_id: params.group_id,
      p_name: params.name, p_sort_order: params.sort_order,
    })
  )

  const [deleteCondition] = useAction((id: string) =>
    rpc('delete_condition', { p_campaign_id: campaignId, p_admin_token: adminToken, p_id: id })
  )

  const [upsertPhase] = useAction((params: {
    id?: string; condition_id: string; phase_order: number;
    duration_type: string; duration_expression: string; effect_text: string
  }) =>
    rpc<string>('upsert_condition_phase', {
      p_admin_token: adminToken,
      p_condition_id: params.condition_id,
      p_id: params.id ?? null,
      p_phase_order: params.phase_order,
      p_duration_type: params.duration_type,
      p_duration_expression: params.duration_expression,
      p_effect_text: params.effect_text,
    })
  )

  const [deletePhase] = useAction((conditionId: string, id: string) =>
    rpc('delete_condition_phase', { p_admin_token: adminToken, p_condition_id: conditionId, p_id: id })
  )

  const [addCharacter] = useAction((name: string, isNpc = false) =>
    rpc<{ id: string; player_token: string }>('add_character', {
      p_campaign_id: campaignId, p_admin_token: adminToken, p_name: name, p_is_npc: isNpc,
    })
  )

  const [deactivateCharacter] = useAction((characterId: string) =>
    rpc('deactivate_character', { p_campaign_id: campaignId, p_admin_token: adminToken, p_character_id: characterId })
  )

  const [applyCondition] = useAction((params: {
    character_id: string; condition_id: string; first_phase_turns: number; source_note?: string
  }) =>
    rpc<string>('apply_condition', {
      p_campaign_id: campaignId, p_admin_token: adminToken,
      p_character_id: params.character_id,
      p_condition_id: params.condition_id,
      p_first_phase_turns: params.first_phase_turns,
      p_source_note: params.source_note ?? null,
    })
  )

  const [switchToTactical] = useAction((assignments: { character_id: string; initiative_order: number }[]) =>
    rpc('switch_to_tactical', {
      p_campaign_id: campaignId, p_admin_token: adminToken,
      p_assignments: JSON.stringify(assignments),
    })
  )

  const [switchToExploration] = useAction(() =>
    rpc('switch_to_exploration', { p_campaign_id: campaignId, p_admin_token: adminToken })
  )

  const [endTurnAdvance] = useAction((characterId: string, diceRolls: { character_condition_id: string; rolled_turns: number }[] = []) =>
    rpc('end_turn_advance', {
      p_campaign_id: campaignId, p_admin_token: adminToken,
      p_character_id: characterId,
      p_dice_rolls: JSON.stringify(diceRolls),
    })
  )

  return {
    updateSettings,
    advanceTime,
    upsertGroup,
    deleteGroup,
    upsertCondition,
    deleteCondition,
    upsertPhase,
    deletePhase,
    addCharacter,
    deactivateCharacter,
    applyCondition,
    switchToTactical,
    switchToExploration,
    endTurnAdvance,
  }
}
