import type { OrderPaymentStatus, OrderProcessingStatus } from './order.api'

export function formatCurrency(value: string | number | null | undefined): string {
  const numericValue = Number(value ?? 0)
  return `${numericValue.toLocaleString('vi-VN')} đ`
}

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
      return { label: 'Đặt hàng', color: 'info' }
    case 'confirmed':
      return { label: 'Xác nhận', color: 'info' }
    case 'picked_up':
      return { label: 'DVVC lấy hàng', color: 'warning' }
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
