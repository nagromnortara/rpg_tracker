import { useEffect, useReducer, useRef } from 'react'
import { supabase } from '../lib/supabase'
import type {
  Campaign, ConditionGroup, Condition, ConditionPhase,
  Character, CharacterCondition, CampaignData
} from '../lib/types'

type Action =
  | { type: 'INITIAL_LOAD'; payload: CampaignData }
  | { type: 'CAMPAIGN_UPDATE'; payload: Partial<Campaign> }
  | { type: 'GROUP_UPSERT'; payload: ConditionGroup }
  | { type: 'GROUP_DELETE'; payload: string }
  | { type: 'CONDITION_UPSERT'; payload: Condition }
  | { type: 'CONDITION_DELETE'; payload: string }
  | { type: 'PHASE_UPSERT'; payload: ConditionPhase }
  | { type: 'PHASE_DELETE'; payload: string }
  | { type: 'CHARACTER_UPSERT'; payload: Character }
  | { type: 'CHARACTER_DELETE'; payload: string }
  | { type: 'CHAR_CONDITION_UPSERT'; payload: CharacterCondition }
  | { type: 'CHAR_CONDITION_DELETE'; payload: string }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }

interface State extends CampaignData {
  loading: boolean
  error: string | null
}

const initial: State = {
  campaign: null,
  groups: [],
  conditions: [],
  phases: [],
  characters: [],
  charConditions: [],
  loading: true,
  error: null,
}

function upsertById<T extends { id: string }>(arr: T[], item: T): T[] {
  const idx = arr.findIndex(x => x.id === item.id)
  if (idx >= 0) {
    const next = [...arr]
    next[idx] = item
    return next
  }
  return [...arr, item]
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'INITIAL_LOAD':
      return { ...state, ...action.payload, loading: false, error: null }
    case 'CAMPAIGN_UPDATE':
      return { ...state, campaign: state.campaign ? { ...state.campaign, ...action.payload } : null }
    case 'GROUP_UPSERT':
      return { ...state, groups: upsertById(state.groups, action.payload) }
    case 'GROUP_DELETE':
      return { ...state, groups: state.groups.filter(x => x.id !== action.payload) }
    case 'CONDITION_UPSERT':
      return { ...state, conditions: upsertById(state.conditions, action.payload) }
    case 'CONDITION_DELETE':
      return { ...state, conditions: state.conditions.filter(x => x.id !== action.payload) }
    case 'PHASE_UPSERT':
      return { ...state, phases: upsertById(state.phases, action.payload) }
    case 'PHASE_DELETE':
      return { ...state, phases: state.phases.filter(x => x.id !== action.payload) }
    case 'CHARACTER_UPSERT':
      return { ...state, characters: upsertById(state.characters, action.payload) }
    case 'CHARACTER_DELETE':
      return { ...state, characters: state.characters.filter(x => x.id !== action.payload) }
    case 'CHAR_CONDITION_UPSERT':
      return { ...state, charConditions: upsertById(state.charConditions, action.payload) }
    case 'CHAR_CONDITION_DELETE':
      return { ...state, charConditions: state.charConditions.filter(x => x.id !== action.payload) }
    case 'SET_LOADING':
      return { ...state, loading: action.payload }
    case 'SET_ERROR':
      return { ...state, error: action.payload, loading: false }
    default:
      return state
  }
}

export function useCampaignData(campaignId: string | undefined) {
  const [state, dispatch] = useReducer(reducer, initial)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  useEffect(() => {
    if (!campaignId) return

    let cancelled = false

    async function load() {
      dispatch({ type: 'SET_LOADING', payload: true })
      const [
        { data: campaign, error: e1 },
        { data: groups },
        { data: conditions },
        { data: phases },
        { data: characters },
        { data: charConditions },
      ] = await Promise.all([
        supabase.from('campaigns').select('*').eq('id', campaignId).single(),
        supabase.from('condition_groups').select('*').eq('campaign_id', campaignId).order('sort_order'),
        supabase.from('conditions').select('*').eq('campaign_id', campaignId).order('sort_order'),
        supabase.from('condition_phases').select('*').order('phase_order'),
        supabase.from('characters').select('*').eq('campaign_id', campaignId).order('created_at'),
        supabase.from('character_conditions').select('*').order('applied_at'),
      ])

      if (cancelled) return
      if (e1) { dispatch({ type: 'SET_ERROR', payload: e1.message }); return }

      // Filter phases and charConditions to only those belonging to this campaign
      const conditionIds = new Set((conditions ?? []).map(c => c.id))
      const characterIds = new Set((characters ?? []).map(c => c.id))

      dispatch({
        type: 'INITIAL_LOAD',
        payload: {
          campaign: campaign as Campaign,
          groups: (groups ?? []) as ConditionGroup[],
          conditions: (conditions ?? []) as Condition[],
          phases: ((phases ?? []) as ConditionPhase[]).filter(p => conditionIds.has(p.condition_id)),
          characters: (characters ?? []) as Character[],
          charConditions: ((charConditions ?? []) as CharacterCondition[]).filter(cc => characterIds.has(cc.character_id)),
        },
      })
    }

    load()

    // Realtime subscriptions
    const channel = supabase.channel(`campaign:${campaignId}`)

    channel
      .on('postgres_changes', { event: '*', schema: 'public', table: 'campaigns', filter: `id=eq.${campaignId}` },
        (payload) => {
          if (payload.eventType === 'UPDATE') dispatch({ type: 'CAMPAIGN_UPDATE', payload: payload.new as Partial<Campaign> })
        })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'condition_groups', filter: `campaign_id=eq.${campaignId}` },
        (payload) => {
          if (payload.eventType === 'DELETE') dispatch({ type: 'GROUP_DELETE', payload: (payload.old as { id: string }).id })
          else dispatch({ type: 'GROUP_UPSERT', payload: payload.new as ConditionGroup })
        })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conditions', filter: `campaign_id=eq.${campaignId}` },
        (payload) => {
          if (payload.eventType === 'DELETE') dispatch({ type: 'CONDITION_DELETE', payload: (payload.old as { id: string }).id })
          else dispatch({ type: 'CONDITION_UPSERT', payload: payload.new as Condition })
        })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'condition_phases' },
        (payload) => {
          if (payload.eventType === 'DELETE') dispatch({ type: 'PHASE_DELETE', payload: (payload.old as { id: string }).id })
          else dispatch({ type: 'PHASE_UPSERT', payload: payload.new as ConditionPhase })
        })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'characters', filter: `campaign_id=eq.${campaignId}` },
        (payload) => {
          if (payload.eventType === 'DELETE') dispatch({ type: 'CHARACTER_DELETE', payload: (payload.old as { id: string }).id })
          else dispatch({ type: 'CHARACTER_UPSERT', payload: payload.new as Character })
        })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'character_conditions' },
        (payload) => {
          if (payload.eventType === 'DELETE') dispatch({ type: 'CHAR_CONDITION_DELETE', payload: (payload.old as { id: string }).id })
          else dispatch({ type: 'CHAR_CONDITION_UPSERT', payload: payload.new as CharacterCondition })
        })
      .subscribe()

    channelRef.current = channel

    return () => {
      cancelled = true
      channel.unsubscribe()
    }
  }, [campaignId])

  return state
}
