import type { OrderDetailItem } from '../api/order.api'
import type { PaymentHistoryEntry } from '../components/payment/payment-history-section'
import type { PaymentMethod } from './order-payment'

export type PaymentCollectionMethod = 'bank_transfer' | 'cash' | 'cod' | 'card'

export const PAYMENT_COLLECTION_METHOD_LABELS: Record<PaymentCollectionMethod, string> = {
  bank_transfer: 'Chuyển khoản',
  cash: 'Tiền mặt',
  cod: 'COD',
  card: 'Thẻ',
}

export const FALLBACK_PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  unpaid: 'Chưa chọn',
  cod: 'COD',
  pay_later: 'Thanh toán sau',
  deposit: 'Chưa ghi rõ',
  bank_transfer: 'Chuyển khoản',
}

export const getDerivedPaymentStatusMeta = ({
  totalAmount,
  paidAmount,
}: {
  totalAmount: number
  paidAmount: number
}): {
  label: string
  color: 'success' | 'warning' | 'error'
} => {
  if (totalAmount > 0 && paidAmount >= totalAmount) {
    return { label: 'Đã thanh toán', color: 'success' }
  }

  if (paidAmount > 0) {
    return { label: 'Thanh toán một phần', color: 'warning' }
  }

  return { label: 'Chưa thanh toán', color: 'error' }
}

export const getPaymentTypeLabel = ({
  totalAmount,
  paidAmount,
  currentPaymentMethod,
}: {
  totalAmount: number
  paidAmount: number
  currentPaymentMethod: PaymentMethod
}) => {
  if (totalAmount > 0 && paidAmount >= totalAmount) {
    return 'Thanh toán toàn bộ'
  }

  if (paidAmount > 0) {
    return 'Đặt cọc / thanh toán một phần'
  }

  return currentPaymentMethod === 'cod' ? 'Thanh toán sau / COD' : 'Thanh toán sau'
}

const toNumericMetadataValue = (value: unknown): number | null => {
  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? numericValue : null
}

const toTrimmedMetadataValue = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null

export const getPaymentMethodLabelFromMetadata = (value: unknown, fallbackMethod: PaymentMethod) => {
  const method = toTrimmedMetadataValue(value) as PaymentCollectionMethod | null

  if (method && method in PAYMENT_COLLECTION_METHOD_LABELS) {
    return PAYMENT_COLLECTION_METHOD_LABELS[method]
  }

  return FALLBACK_PAYMENT_METHOD_LABELS[fallbackMethod]
}

export const buildPaymentHistoryEntries = (order: OrderDetailItem, fallbackMethod: PaymentMethod): PaymentHistoryEntry[] => {
  let previousPaid = 0

  const chronologicalEntries = [...(order.order_history ?? [])]
    .filter((entry) => entry.event_type === 'payment_updated')
    .sort((left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime())
    .map((entry) => {
      const metadata = (entry.metadata ?? {}) as Record<string, unknown>
      const cumulativePaidFromMetadata = toNumericMetadataValue(metadata.paid_amount)
      const explicitPaymentAmount = toNumericMetadataValue(metadata.payment_amount)
      const depositAmount = toNumericMetadataValue(metadata.deposit_amount)
      const cumulativePaid = cumulativePaidFromMetadata ?? depositAmount ?? previousPaid + (explicitPaymentAmount ?? 0)
      const amount = explicitPaymentAmount ?? Math.max(cumulativePaid - previousPaid, 0)
      const outstandingAfter =
        toNumericMetadataValue(metadata.outstanding_amount) ?? Math.max(Number(order.total_amount) - cumulativePaid, 0)
      const paymentLabel =
        toTrimmedMetadataValue(metadata.payment_label) ??
        (previousPaid <= 0 && outstandingAfter > 0
          ? 'Đặt cọc'
          : outstandingAfter <= 0
            ? 'Thanh toán đủ'
            : 'Thanh toán thêm')

      previousPaid = cumulativePaid

      return {
        id: entry.id,
        amount,
        cumulativePaid,
        outstandingAfter,
        methodLabel: getPaymentMethodLabelFromMetadata(metadata.payment_method, fallbackMethod),
        paymentLabel,
        note: toTrimmedMetadataValue(metadata.note),
        timestamp: entry.timestamp,
      }
    })

  return chronologicalEntries.reverse()
}
