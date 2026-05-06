import { useContext } from 'react'
import { StoreContext } from '@/modules/store/store-context'

export function useStore() {
  const context = useContext(StoreContext)

  if (!context) {
    throw new Error('useStore must be used within a StoreProvider')
  }

  return context
}
