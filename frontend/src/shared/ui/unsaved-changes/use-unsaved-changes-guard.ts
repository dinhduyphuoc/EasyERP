import { useEffect, useState } from 'react'
import { useBlocker, useNavigate } from 'react-router'

type UseUnsavedChangesGuardOptions = {
  isDirty: boolean
}

export function useUnsavedChangesGuard({ isDirty }: UseUnsavedChangesGuardOptions) {
  const navigate = useNavigate()
  const blocker = useBlocker(isDirty)
  const [shakeTick, setShakeTick] = useState(0)

  useEffect(() => {
    if (blocker.state !== 'blocked') {
      return
    }

    setShakeTick((current) => current + 1)
    blocker.reset()
  }, [blocker])

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty) {
        return
      }

      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [isDirty])

  const pulse = () => {
    setShakeTick((current) => current + 1)
  }

  const attemptNavigate = (to: string) => {
    if (isDirty) {
      pulse()
      return
    }

    navigate(to)
  }

  return {
    shakeTick,
    pulse,
    attemptNavigate,
  }
}

type UseUnsavedChangesPromptOptions = {
  isDirty: boolean
  isSaving?: boolean
  onSave: () => void
  onDiscard: () => void
  saveLabel?: string
  savingLabel?: string
  discardLabel?: string
  message?: string
}

export function useUnsavedChangesPrompt({
  isDirty,
  isSaving = false,
  onSave,
  onDiscard,
  saveLabel,
  savingLabel,
  discardLabel,
  message,
}: UseUnsavedChangesPromptOptions) {
  const { shakeTick, attemptNavigate, pulse } = useUnsavedChangesGuard({ isDirty })

  return {
    attemptNavigate,
    pulse,
    bannerProps: {
      visible: isDirty,
      shakeTick,
      isSaving,
      onSave,
      onDiscard,
      saveLabel,
      savingLabel,
      discardLabel,
      message,
    },
  }
}
