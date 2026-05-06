import { Bounce, toast, type ToastOptions } from 'react-toastify'

export const defaultToastOptions: ToastOptions = {
  position: 'top-center',
  autoClose: 5000,
  hideProgressBar: true,
  closeOnClick: true,
  pauseOnHover: false,
  draggable: true,
  progress: undefined,
  theme: 'dark',
  transition: Bounce,
}

let toastSuppressedUntil = 0

const isToastSuppressed = () => Date.now() < toastSuppressedUntil

export const suppressAppToasts = (durationMs = 1500) => {
  toastSuppressedUntil = Math.max(toastSuppressedUntil, Date.now() + durationMs)
}

export const appToast = {
  show: (message: string, options?: ToastOptions) => {
    if (isToastSuppressed()) {
      return null
    }

    return toast(message, { ...defaultToastOptions, ...options })
  },
  success: (message: string, options?: ToastOptions) => {
    if (isToastSuppressed()) {
      return null
    }

    return toast.success(message, { ...defaultToastOptions, ...options })
  },
  error: (message: string, options?: ToastOptions) => {
    if (isToastSuppressed()) {
      return null
    }

    return toast.error(message, { ...defaultToastOptions, ...options })
  },
  info: (message: string, options?: ToastOptions) => {
    if (isToastSuppressed()) {
      return null
    }

    return toast.info(message, { ...defaultToastOptions, ...options })
  },
  warning: (message: string, options?: ToastOptions) => {
    if (isToastSuppressed()) {
      return null
    }

    return toast.warning(message, { ...defaultToastOptions, ...options })
  },
  sessionExpired: (message: string, options?: ToastOptions) =>
    toast.warning(message, {
      ...defaultToastOptions,
      toastId: 'auth-session-expired',
      ...options,
    }),
}
