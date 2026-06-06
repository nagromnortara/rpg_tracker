import { useState } from 'react'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy, arrayMove, useSortable
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import Modal from '../ui/Modal'
import type { Character } from '../../lib/types'

interface AssignmentRow {
  tempId: string
  characterId: string | null  // null = new NPC
  name: string
  isNpc: boolean
}

interface Props {
  characters: Character[]
  onConfirm: (assignments: AssignmentRow[], npcNames: string[]) => Promise<void>
  onClose: () => void
}

function SortableRow({
  row, index, onNameChange, onRemove
}: {
  row: AssignmentRow
  index: number
  onNameChange: (id: string, name: string) => void
  onRemove: (id: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: row.tempId })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={{ ...style, display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0' }}>
      <span
        {...attributes}
        {...listeners}
        style={{ cursor: 'grab', color: 'var(--text-muted)', fontSize: '1.1rem', userSelect: 'none', touchAction: 'none' }}
        title="Drag to reorder"
      >
        ⠿
      </span>
      <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', width: '1.5rem', textAlign: 'right', flexShrink: 0 }}>
        {index + 1}.
      </span>
      {row.isNpc ? (
        <input
          className="input"
          value={row.name}
          onChange={e => onNameChange(row.tempId, e.target.value)}
          placeholder="NPC name"
          style={{ flex: 1 }}
        />
      ) : (
        <span style={{ flex: 1, color: 'var(--text-primary)', fontSize: '0.9rem' }}>{row.name}</span>
      )}
      {row.isNpc && (
        <>
          <span className="badge" style={{ fontSize: '0.65rem', flexShrink: 0 }}>NPC</span>
          <button
            className="btn btn-ghost"
            type="button"
            onClick={() => onRemove(row.tempId)}
            style={{ padding: '0.2rem 0.4rem', color: 'var(--text-danger)', flexShrink: 0 }}
          >
            ✕
          </button>
        </>
      )}
    </div>
  )
}

let _id = 0
function tempId() { return `row-${++_id}` }

export default function InitiativeSetupModal({ characters, onConfirm, onClose }: Props) {
  const [rows, setRows] = useState<AssignmentRow[]>(() =>
    characters
      .filter(c => c.is_active && !c.is_npc)
      .map(c => ({ tempId: tempId(), characterId: c.id, name: c.name, isNpc: false }))
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setRows(prev => {
      const oldIdx = prev.findIndex(r => r.tempId === active.id)
      const newIdx = prev.findIndex(r => r.tempId === over.id)
      return arrayMove(prev, oldIdx, newIdx)
    })
  }

  function addNpc() {
    setRows(prev => [...prev, { tempId: tempId(), characterId: null, name: '', isNpc: true }])
  }

  function updateName(id: string, name: string) {
    setRows(prev => prev.map(r => r.tempId === id ? { ...r, name } : r))
  }

  function removeRow(id: string) {
    setRows(prev => prev.filter(r => r.tempId !== id))
  }

  async function handleConfirm() {
    for (const row of rows) {
      if (row.isNpc && !row.name.trim()) {
        setError('All NPC rows need a name.')
        return
      }
    }
    setSaving(true)
    setError(null)
    try {
      const npcNames = rows.filter(r => r.isNpc).map(r => r.name.trim())
      await onConfirm(rows, npcNames)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to switch to tactical mode')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Set Initiative Order" onClose={onClose} wide>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>
          Drag to set turn order. Add NPCs to track their conditions during this tactical phase.
        </p>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={rows.map(r => r.tempId)} strategy={verticalListSortingStrategy}>
            <div style={{ borderTop: '1px solid var(--border-color)' }}>
              {rows.map((row, i) => (
                <SortableRow
                  key={row.tempId}
                  row={row}
                  index={i}
                  onNameChange={updateName}
                  onRemove={removeRow}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        <button className="btn btn-secondary" type="button" onClick={addNpc}
          style={{ alignSelf: 'flex-start', fontSize: '0.85rem' }}>
          + Add NPC
        </button>

        {error && <p style={{ color: 'var(--text-danger)', fontSize: '0.875rem' }}>{error}</p>}

        <div style={{ display: 'flex', gap: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-color)' }}>
          <button className="btn btn-secondary" type="button" onClick={onClose} style={{ flex: 1 }}>Cancel</button>
          <button className="btn btn-primary" type="button" onClick={handleConfirm} disabled={saving || rows.length === 0}
            style={{ flex: 2 }}>
            {saving ? 'Starting...' : 'Start Tactical Mode'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
