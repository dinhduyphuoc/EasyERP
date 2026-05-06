import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { UnsavedChangesBanner, useUnsavedChangesGuard } from '@/shared/ui/unsaved-changes'

type SettingsUnsavedRegistration = {
  isDirty: boolean
  isSaving?: boolean
  onSave: () => void
  onDiscard: () => void
}

type SettingsUnsavedContextValue = {
  setRegistration: (registration: SettingsUnsavedRegistration | null) => void
  attemptNavigate: (to: string) => void
  pulse: () => void
  isDirty: boolean
}

const SettingsUnsavedContext = createContext<SettingsUnsavedContextValue | null>(null)

export function SettingsUnsavedProvider({
  children,
}: {
  children: ReactNode
}) {
  const [registration, setRegistration] = useState<SettingsUnsavedRegistration | null>(null)
  const { attemptNavigate, pulse, shakeTick } = useUnsavedChangesGuard({ isDirty: registration?.isDirty ?? false })

  const value = useMemo(
    () => ({
      setRegistration,
      attemptNavigate,
      pulse,
      isDirty: registration?.isDirty ?? false,
    }),
    [attemptNavigate, pulse, registration?.isDirty],
  )

  return (
    <SettingsUnsavedContext.Provider value={value}>
      {children}
      <UnsavedChangesBanner
        visible={registration?.isDirty ?? false}
        shakeTick={shakeTick}
        isSaving={registration?.isSaving ?? false}
        placement="fixed"
        onDiscard={() => registration?.onDiscard()}
        onSave={() => registration?.onSave()}
      />
    </SettingsUnsavedContext.Provider>
  )
}

export function useSettingsUnsavedRegistration(registration: SettingsUnsavedRegistration | null) {
  const context = useContext(SettingsUnsavedContext)

  useEffect(() => {
    if (!context) {
      return
    }

    context.setRegistration(registration)

    return () => {
      context.setRegistration(null)
    }
  }, [context, registration])

  return {
    attemptNavigate: context?.attemptNavigate ?? (() => undefined),
    pulse: context?.pulse ?? (() => undefined),
    isDirty: context?.isDirty ?? false,
  }
}

export function useSettingsUnsavedActions() {
  const context = useContext(SettingsUnsavedContext)

  return {
    attemptNavigate: context?.attemptNavigate ?? (() => undefined),
    pulse: context?.pulse ?? (() => undefined),
    isDirty: context?.isDirty ?? false,
  }
}
