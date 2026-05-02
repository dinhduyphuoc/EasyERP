import { useCallback, useState } from 'react'
import { appToast } from '@/shared/ui/toast/toast.helpers'
import { orderApi, type OrderDetailItem } from '../api/order.api'
import { getErrorMessage } from '../lib/error-message'
import { buildConfirmPaidSuccessMessage, buildPaymentRecordedMessage, ORDER_TOAST_MESSAGES } from '../lib/toast-messages'
import type { PaymentCollectionMethod } from '../lib/payment-display.helpers'
import type { PaymentMethod } from '../lib/order-payment'
import { formatCurrencyInput } from '../lib/order.utils'

const getDefaultPaymentCollectionMethod = (paymentMethod: PaymentMethod): PaymentCollectionMethod => {
  if (paymentMethod === 'cod') {
    return 'cod'
  }

  if (paymentMethod === 'bank_transfer') {
    return 'bank_transfer'
  }

  return 'cash'
}

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
  order: OrderDetailItem | null
  canAddPayment: boolean
  currentPaymentMethod: PaymentMethod
  orderRemainingAmount: number
  onOrderUpdated: (order: OrderDetailItem) => void
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
      appToast.warning(ORDER_TOAST_MESSAGES.invalidPaymentAmount)
      return
    }

    if (normalizedAmount > orderRemainingAmount) {
      appToast.warning(ORDER_TOAST_MESSAGES.paymentAmountExceedsRemaining)
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
      appToast.success(buildPaymentRecordedMessage(updatedOrder.order_code))
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
      appToast.warning(ORDER_TOAST_MESSAGES.confirmPaidNoteRequired)
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
      appToast.success(buildConfirmPaidSuccessMessage(updatedOrder.order_code))
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
