import type { ReactElement } from 'react'
import { useAuth } from '@/modules/auth/use-auth'
import { StoreSwitcherDropdown } from '@/modules/store/store-switcher-dropdown'
import { useStore } from '@/modules/store/use-store'
import { appToast } from '@/shared/ui/toast/toast.helpers'

type ConnectedStoreSwitcherDropdownProps = {
  onCreateStore: () => void
}

export function ConnectedStoreSwitcherDropdown({
  onCreateStore,
}: ConnectedStoreSwitcherDropdownProps): ReactElement | null {
  const { user, logout } = useAuth()
  const { stores, activeStore, switchStore } = useStore()

  if (!user) {
    return null
  }

  return (
    <StoreSwitcherDropdown
      stores={stores.map((store) => ({
        id: store.id,
        name: store.name,
        slug: store.slug,
        avatarUrl: null,
      }))}
      activeStoreId={activeStore?.id ?? user.active_store_id ?? ''}
      user={{
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        avatarUrl: null,
      }}
      onSwitchStore={async (storeId) => {
        try {
          await switchStore(storeId)
        } catch (error) {
          console.error('Failed to switch store:', error)
          appToast.error('Unable to switch store. Please try again.')
          throw error
        }
      }}
      onCreateStore={onCreateStore}
      onLogout={async () => {
        await logout()
      }}
    />
  )
}
