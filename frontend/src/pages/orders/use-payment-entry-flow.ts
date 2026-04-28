import { useCallback, useState } from 'react'
import { appToast } from '@/shared/ui/toast/toast.helpers'
import { orderApi, type OrderListItem } from './order.api'
import type { PaymentCollectionMethod } from './payment-display.helpers'
import type { PaymentMethod } from './order-payment'
import { formatCurrencyInput } from './order.utils'

const getDefaultPaymentCollectionMethod = (paymentMethod: PaymentMethod): PaymentCollectionMethod => {
  if (paymentMethod === 'cod') {
    return 'cod'
  }

  if (paymentMethod === 'bank_transfer') {
    return 'bank_transfer'
  }

  return 'cash'
}

const getErrorMessage = (error: unknown, fallback: string) =>
  typeof error === 'object' &&
  error !== null &&
  'response' in error &&
  typeof error.response === 'object' &&
  error.response !== null &&
  'data' in error.response &&
  typeof error.response.data === 'object' &&
  error.response.data !== null &&
  'message' in error.response.data &&
  typeof error.response.data.message === 'string'
    ? error.response.data.message
    : fallback

const normalizeCurrencyInput = (value: string): number => {
  const digits = value.replace(/\D/g, '')
  return Number(digits || '0')
}

export function usePaymentEntryFlow({
  orderId,
  order,
  canAddPayment,
  currentPaymentMethod,
  orderRemainingAmount,
  onOrderUpdated,
}: {
  orderId: string | undefined
  order: OrderListItem | null
  canAddPayment: boolean
  currentPaymentMethod: PaymentMethod
  orderRemainingAmount: number
  onOrderUpdated: (order: OrderListItem) => void
}) {
  const [isAddPaymentDialogOpen, setIsAddPaymentDialogOpen] = useState(false)
  const [isConfirmPaidDialogOpen, setIsConfirmPaidDialogOpen] = useState(false)
  const [paymentEntryAmount, setPaymentEntryAmount] = useState('')
  const [paymentEntryMethod, setPaymentEntryMethod] = useState<PaymentCollectionMethod>('bank_transfer')
  const [paymentEntryNote, setPaymentEntryNote] = useState('')
  const [isSubmittingPaymentEntry, setIsSubmittingPaymentEntry] = useState(false)

  const handlePaymentEntryAmountChange = useCallback(
    (value: string) => {
      const normalizedAmount = normalizeCurrencyInput(value)
      const clampedAmount = Math.min(normalizedAmount, orderRemainingAmount)
      setPaymentEntryAmount(formatCurrencyInput(clampedAmount, { zeroAsEmpty: true }))
    },
    [orderRemainingAmount],
  )

  const openAddPaymentDialog = useCallback(() => {
    if (!order || !canAddPayment) {
      return
    }

    setPaymentEntryAmount(formatCurrencyInput(orderRemainingAmount, { zeroAsEmpty: true }))
    setPaymentEntryMethod(getDefaultPaymentCollectionMethod(currentPaymentMethod))
    setPaymentEntryNote('')
    setIsAddPaymentDialogOpen(true)
  }, [canAddPayment, currentPaymentMethod, order, orderRemainingAmount])

  const closeAddPaymentDialog = useCallback(() => {
    if (isSubmittingPaymentEntry) {
      return
    }

    setIsAddPaymentDialogOpen(false)
  }, [isSubmittingPaymentEntry])

  const openConfirmPaidDialog = useCallback(() => {
    if (!order || !canAddPayment) {
      return
    }

    setPaymentEntryMethod(getDefaultPaymentCollectionMethod(currentPaymentMethod))
    setPaymentEntryNote('')
    setIsConfirmPaidDialogOpen(true)
  }, [canAddPayment, currentPaymentMethod, order])

  const closeConfirmPaidDialog = useCallback(() => {
    if (isSubmittingPaymentEntry) {
      return
    }

    setIsConfirmPaidDialogOpen(false)
  }, [isSubmittingPaymentEntry])

  const submitAddPayment = useCallback(async () => {
    if (!orderId || !order) {
      return
    }

    const normalizedAmount = normalizeCurrencyInput(paymentEntryAmount)

    if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
      appToast.warning('Vui lòng nhập số tiền thanh toán lớn hơn 0.')
      return
    }

    if (normalizedAmount > orderRemainingAmount) {
      appToast.warning('Số tiền thu không được lớn hơn số tiền còn lại.')
      return
    }

    try {
      setIsSubmittingPaymentEntry(true)
      const updatedOrder = await orderApi.runAction(orderId, 'add_payment', {
        payment_amount: normalizedAmount,
        payment_method: paymentEntryMethod,
        note: paymentEntryNote.trim() || undefined,
      })

      onOrderUpdated(updatedOrder)
      setIsAddPaymentDialogOpen(false)
      appToast.success(`Đã ghi nhận thanh toán cho đơn ${updatedOrder.order_code}.`)
    } catch (error) {
      console.error('Lỗi khi thêm thanh toán:', error)
      appToast.error(getErrorMessage(error, 'Không thể ghi nhận thanh toán.'))
    } finally {
      setIsSubmittingPaymentEntry(false)
    }
  }, [onOrderUpdated, order, orderId, orderRemainingAmount, paymentEntryAmount, paymentEntryMethod, paymentEntryNote])

  const submitConfirmPaid = useCallback(async () => {
    if (!orderId || !order) {
      return
    }

    if (!paymentEntryNote.trim()) {
      appToast.warning('Vui lòng nhập ghi chú xác nhận đã thu đủ tiền.')
      return
    }

    try {
      setIsSubmittingPaymentEntry(true)
      const updatedOrder = await orderApi.runAction(orderId, 'confirm_full_payment', {
        payment_method: paymentEntryMethod,
        note: paymentEntryNote.trim(),
      })

      onOrderUpdated(updatedOrder)
      setIsConfirmPaidDialogOpen(false)
      appToast.success(`Đã xác nhận thu đủ tiền cho đơn ${updatedOrder.order_code}.`)
    } catch (error) {
      console.error('Lỗi khi xác nhận thu đủ tiền:', error)
      appToast.error(getErrorMessage(error, 'Không thể xác nhận đã thu đủ tiền.'))
    } finally {
      setIsSubmittingPaymentEntry(false)
    }
  }, [onOrderUpdated, order, orderId, paymentEntryMethod, paymentEntryNote])

  return {
    isAddPaymentDialogOpen,
    isConfirmPaidDialogOpen,
    paymentEntryAmount,
    paymentEntryMethod,
    paymentEntryNote,
    isSubmittingPaymentEntry,
    setPaymentEntryAmount: handlePaymentEntryAmountChange,
    setPaymentEntryMethod,
    setPaymentEntryNote,
    openAddPaymentDialog,
    closeAddPaymentDialog,
    openConfirmPaidDialog,
    closeConfirmPaidDialog,
    submitAddPayment,
    submitConfirmPaid,
  }
}
