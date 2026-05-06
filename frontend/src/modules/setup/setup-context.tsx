import {
  createContext,
  startTransition,
  useEffect,
  useState,
  type PropsWithChildren,
} from 'react'
import { setupApi } from '@/modules/setup/setup.api'
import type { SetupStatusResponse } from '@/modules/setup/setup.types'

type SetupContextValue = {
  status: 'loading' | 'ready' | 'error'
  setup: SetupStatusResponse | null
  errorMessage: string | null
  refreshSetupStatus: () => Promise<SetupStatusResponse>
  markSetupCompleted: () => void
}

export const SetupContext = createContext<SetupContextValue | null>(null)

const INITIAL_SETUP_STATE: SetupStatusResponse = {
  setupCompleted: false,
  hasFirstUser: false,
  hasAdminUser: false,
  hasTenant: false,
  hasStore: false,
}

export function SetupProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [setup, setSetup] = useState<SetupStatusResponse | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const refreshSetupStatus = async () => {
    setErrorMessage(null)
    const result = await setupApi.getStatus()
    startTransition(() => {
      setSetup(result)
      setStatus('ready')
    })
    return result
  }

  useEffect(() => {
    let cancelled = false

    void setupApi
      .getStatus()
      .then((result) => {
        if (cancelled) {
          return
        }

        startTransition(() => {
          setSetup(result)
          setStatus('ready')
        })
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return
        }

        const message =
          error instanceof Error && error.message.trim()
            ? error.message
            : 'Không thể kiểm tra trạng thái khởi tạo hệ thống.'

        startTransition(() => {
          setErrorMessage(message)
          setStatus('error')
        })
      })

    return () => {
      cancelled = true
    }
  }, [])

  const markSetupCompleted = () => {
    startTransition(() => {
      setSetup({
        ...(setup ?? INITIAL_SETUP_STATE),
        setupCompleted: true,
        hasFirstUser: true,
        hasAdminUser: true,
        hasTenant: true,
        hasStore: true,
      })
      setStatus('ready')
    })
  }

  return (
    <SetupContext.Provider
      value={{
        status,
        setup,
        errorMessage,
        refreshSetupStatus,
        markSetupCompleted,
      }}
    >
      {children}
    </SetupContext.Provider>
  )
}
