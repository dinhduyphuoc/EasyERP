import type { ToastOptions } from 'react-toastify'
import { getErrorMessage } from '@/shared/lib/errors'
import { appToast } from './toast.helpers'

export const showErrorToast = (error: unknown, fallback: string, options?: ToastOptions) => {
  return appToast.error(getErrorMessage(error, fallback), options)
}
