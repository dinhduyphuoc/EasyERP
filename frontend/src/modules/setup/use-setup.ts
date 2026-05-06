import { useContext } from 'react'
import { SetupContext } from '@/modules/setup/setup-context'

export function useSetup() {
  const context = useContext(SetupContext)

  if (!context) {
    throw new Error('useSetup must be used within SetupProvider')
  }

  return context
}
