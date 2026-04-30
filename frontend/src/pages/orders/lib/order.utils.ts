import type { OrderPaymentStatus, OrderProcessingStatus } from '../api/order.api'

export { formatCurrency, formatCurrencyInput, formatNumber } from '@/shared/utils/currency'

export function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return '-'
  }

  return new Date(value).toLocaleString('vi-VN')
}

export function getPaymentStatusMeta(status: OrderPaymentStatus): {
  label: string
  color: 'default' | 'warning' | 'success' | 'info'
} {
  if (status === 'paid') {
    return { label: 'Đã thanh toán', color: 'success' }
  }

  if (status === 'deposit') {
    return { label: 'Đặt cọc', color: 'info' }
  }

  return { label: 'Chưa thanh toán', color: 'warning' }
}

export function getProcessingStatusMeta(status: OrderProcessingStatus): {
  label: string
  color: 'default' | 'warning' | 'success' | 'info'
} {
  switch (status) {
    case 'draft':
      return { label: 'Nháp', color: 'default' }
    case 'placed':
      return { label: 'Chờ xác nhận', color: 'info' }
    case 'confirmed':
      return { label: 'Đã xác nhận', color: 'info' }
    case 'picked_up':
      return { label: 'Đóng gói', color: 'warning' }
    case 'delivering':
      return { label: 'Đang giao', color: 'warning' }
    case 'completed':
      return { label: 'Hoàn thành', color: 'success' }
    case 'cancelled':
      return { label: 'Đã hủy', color: 'default' }
    case 'returned':
      return { label: 'Trả hàng', color: 'default' }
    default:
      return { label: status, color: 'default' }
  }
}
