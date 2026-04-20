import { Bounce, ToastContainer, toast, type ToastOptions } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'

const defaultToastOptions: ToastOptions = {
  position: 'top-right',
  autoClose: 5000,
  hideProgressBar: false,
  closeOnClick: true,
  pauseOnHover: false,
  draggable: true,
  progress: undefined,
  theme: 'dark',
  transition: Bounce,
}

export function GlobalToast() {
  return (
    <ToastContainer
      position="top-right"
      autoClose={5000}
      hideProgressBar={false}
      newestOnTop={false}
      closeOnClick
      rtl={false}
      pauseOnFocusLoss
      draggable
      pauseOnHover={false}
      theme="dark"
      transition={Bounce}
    />
  )
}

export const appToast = {
  show: (message: string, options?: ToastOptions) => toast(message, { ...defaultToastOptions, ...options }),
  success: (message: string, options?: ToastOptions) => toast.success(message, { ...defaultToastOptions, ...options }),
  error: (message: string, options?: ToastOptions) => toast.error(message, { ...defaultToastOptions, ...options }),
  info: (message: string, options?: ToastOptions) => toast.info(message, { ...defaultToastOptions, ...options }),
  warning: (message: string, options?: ToastOptions) => toast.warning(message, { ...defaultToastOptions, ...options }),
}
