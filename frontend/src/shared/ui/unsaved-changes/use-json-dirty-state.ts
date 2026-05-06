import { useMemo, useState } from 'react'

export function useJsonDirtyState<T>(value: T, enabled = true) {
  const [initialSnapshot, setInitialSnapshot] = useState('')
  const currentSnapshot = useMemo(() => JSON.stringify(value), [value])
  const isDirty = enabled && Boolean(initialSnapshot) && currentSnapshot !== initialSnapshot

  return {
    initialSnapshot,
    setInitialSnapshot,
    currentSnapshot,
    isDirty,
  }
}
