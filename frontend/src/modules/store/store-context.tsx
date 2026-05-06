import {
  createContext,
  startTransition,
  useEffect,
  useState,
  type PropsWithChildren,
} from 'react'
import { ACTIVE_STORE_STORAGE_KEY } from '@/api/api-client'
import { useAuth } from '@/modules/auth/use-auth'
import { storeApi, type StoreRecord } from '@/modules/store/store.api'

type StoreContextValue = {
  stores: StoreRecord[]
  activeStore: StoreRecord | null
  isReady: boolean
  isSwitchingStore: boolean
  switchStore: (storeId: string) => Promise<void>
  createStore: (payload: { name: string; currency: string; timezone: string }) => Promise<StoreRecord>
  refreshStores: () => Promise<StoreRecord[]>
}

export const StoreContext = createContext<StoreContextValue | null>(null)

const EMPTY_STORE_PROFILE = {
  business_type: 'individual',
  legal_full_name: '',
  contact_email: '',
  contact_phone: '',
  avatar_url: '',
  state_id: null,
  city_id: null,
  district_id: null,
  address_line: '',
}

const EMPTY_STORE_ADDRESSES = {
  default: {},
  billing: {},
  return: {},
}

const persistActiveStoreId = (storeId: string | null) => {
  if (!storeId) {
    localStorage.removeItem(ACTIVE_STORE_STORAGE_KEY)
    return
  }

  localStorage.setItem(ACTIVE_STORE_STORAGE_KEY, storeId)
}

const buildStoresFromAuthUser = (
  user: ReturnType<typeof useAuth>['user'],
): StoreRecord[] =>
  (user?.stores ?? []).map((store) => ({
    id: store.id,
    name: store.name,
    slug: store.slug,
    owner_user_id: '',
    default_currency: store.default_currency,
    default_timezone: store.default_timezone,
    role: store.role,
    profile: EMPTY_STORE_PROFILE,
    addresses: EMPTY_STORE_ADDRESSES,
    created_at: '',
    updated_at: '',
  }))

export function StoreProvider({ children }: PropsWithChildren) {
  const { status, user, refreshUser } = useAuth()
  const [stores, setStores] = useState<StoreRecord[]>([])
  const [activeStore, setActiveStore] = useState<StoreRecord | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [isSwitchingStore, setIsSwitchingStore] = useState(false)

  const syncStoresFromServer = async () => {
    const nextStores = await storeApi.getStores()
    const storedStoreId = localStorage.getItem(ACTIVE_STORE_STORAGE_KEY)
    const nextActiveStore =
      nextStores.find((store) => store.id === user?.active_store_id) ??
      nextStores.find((store) => store.id === storedStoreId) ??
      nextStores[0] ??
      null

    persistActiveStoreId(nextActiveStore?.id ?? null)
    startTransition(() => {
      setStores(nextStores)
      setActiveStore(nextActiveStore)
      setIsReady(true)
    })

    return nextStores
  }

  useEffect(() => {
    if (status !== 'authenticated') {
      persistActiveStoreId(null)
      setStores([])
      setActiveStore(null)
      setIsReady(status === 'anonymous')
      return
    }

    const authStores = buildStoresFromAuthUser(user)
    const storedStoreId = localStorage.getItem(ACTIVE_STORE_STORAGE_KEY)
    const authActiveStore =
      authStores.find((store) => store.id === user?.active_store_id) ??
      authStores.find((store) => store.id === storedStoreId) ??
      authStores[0] ??
      null

    persistActiveStoreId(authActiveStore?.id ?? null)
    setStores(authStores)
    setActiveStore(authActiveStore)
    setIsReady(true)

    let cancelled = false

    void syncStoresFromServer()
      .catch(() => {
        if (cancelled) {
          return
        }

        setStores(authStores)
        setActiveStore(authActiveStore)
        setIsReady(true)
      })

    return () => {
      cancelled = true
    }
  }, [status, user?.active_store_id])

  const switchStore = async (storeId: string) => {
    setIsSwitchingStore(true)

    try {
      const nextStore = await storeApi.switchStore(storeId)
      persistActiveStoreId(nextStore.id)
      setActiveStore(nextStore)
      await refreshUser()
      await syncStoresFromServer()
      window.dispatchEvent(new CustomEvent('store-context-changed', { detail: { storeId: nextStore.id } }))
      window.location.reload()
    } finally {
      setIsSwitchingStore(false)
    }
  }

  const createStore = async (payload: { name: string; currency: string; timezone: string }) => {
    const createdStore = await storeApi.createStore(payload)
    persistActiveStoreId(createdStore.id)
    setActiveStore(createdStore)
    await refreshUser()
    await syncStoresFromServer()
    window.location.reload()
    return createdStore
  }

  const refreshStores = async () => syncStoresFromServer()

  return (
    <StoreContext.Provider
      value={{
        stores,
        activeStore,
        isReady,
        isSwitchingStore,
        switchStore,
        createStore,
        refreshStores,
      }}
    >
      {children}
    </StoreContext.Provider>
  )
}
