'use client'

import type { ReactNode } from 'react'
import type { DraggableSyntheticListeners } from '@dnd-kit/core'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface SortableFieldRenderProps {
  attributes: ReturnType<typeof useSortable>['attributes']
  listeners: DraggableSyntheticListeners | undefined
  isDragging: boolean
}

interface SortableFieldProps {
  id: string
  children: (props: SortableFieldRenderProps) => ReactNode
}

export function SortableField({ id, children }: SortableFieldProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        position: 'relative',
        zIndex: isDragging ? 20 : undefined,
      }}
    >
      {children({ attributes, listeners, isDragging })}
    </div>
  )
}
