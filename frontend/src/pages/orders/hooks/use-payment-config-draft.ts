import { useCallback, useMemo, useState } from 'react'
import { appToast } from '@/shared/ui/toast/toast.helpers'
import { orderApi, type OrderListItem } from '../api/order.api'
import {
  buildPaymentNoteContent,
  getDerivedPaymentStatusValue,
  getNormalizedDepositAmount,
  getNormalizedDiscountAmount,
  getNormalizedTaxAmount,
  getPaymentMethodFromTypeId,
  getPaymentValidationErrors,
  getOrderTotalAmount,
  parsePaymentNoteContent,
  PAYMENT_METHOD_TYPE_IDS,
  type DepositInputMode,
  type PaymentMethod,
} from '../lib/order-payment'

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

export function usePaymentConfigDraft({
  orderId,
  order,
  onOrderUpdated,
}: {
  orderId: string | undefined
  order: OrderListItem | null
  onOrderUpdated: (order: OrderListItem) => void
}) {
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false)
  const [isSavingPayment, setIsSavingPayment] = useState(false)
  const [hasAttemptedPaymentSave, setHasAttemptedPaymentSave] = useState(false)
  const [paymentMethodDraft, setPaymentMethodDraft] = useState<PaymentMethod>('unpaid')
  const [paymentNotesDraft, setPaymentNotesDraft] = useState('')
  const [paymentDueDateDraft, setPaymentDueDateDraft] = useState('')
  const [depositInputModeDraft, setDepositInputModeDraft] = useState<DepositInputMode>('amount')
  const [depositPercentDraft, setDepositPercentDraft] = useState('')
  const [depositAmountDraft, setDepositAmountDraft] = useState('0')
  const [bankNameDraft, setBankNameDraft] = useState('')
  const [bankAccountNumberDraft, setBankAccountNumberDraft] = useState('')
  const [bankAccountHolderDraft, setBankAccountHolderDraft] = useState('')
  const [transferReferenceDraft, setTransferReferenceDraft] = useState('')
  const [discountAmountDraft, setDiscountAmountDraft] = useState('0')
  const [vatEnabledDraft, setVatEnabledDraft] = useState(false)
  const [vatRatePercentDraft, setVatRatePercentDraft] = useState('0')

  const syncPaymentDraftFromOrder = useCallback((nextOrder: OrderListItem) => {
    const parsedPaymentDetails = parsePaymentNoteContent(nextOrder.payment_notes)
    const inferredPaymentMethod =
      parsedPaymentDetails.method ?? getPaymentMethodFromTypeId(nextOrder.payment_type_id, nextOrder.payment_status)

    setPaymentMethodDraft(inferredPaymentMethod)
    setPaymentNotesDraft(parsedPaymentDetails.note)
    setPaymentDueDateDraft(parsedPaymentDetails.dueDate)
    setDepositInputModeDraft(parsedPaymentDetails.depositMode)
    setDepositPercentDraft(parsedPaymentDetails.depositPercent)
    setDepositAmountDraft(String(Number(nextOrder.paid_amount || 0)))
    setBankNameDraft(parsedPaymentDetails.bankName)
    setBankAccountNumberDraft(parsedPaymentDetails.accountNumber)
    setBankAccountHolderDraft(parsedPaymentDetails.accountHolder)
    setTransferReferenceDraft(parsedPaymentDetails.transferReference)
    setDiscountAmountDraft(String(Number(nextOrder.discount_amount || 0)))
    setVatEnabledDraft(nextOrder.vat_enabled)
    setVatRatePercentDraft(String(Number(nextOrder.vat_rate_percent || 0)))
    setHasAttemptedPaymentSave(false)
  }, [])

  const openPaymentDialog = useCallback(() => {
    if (!order) {
      return
    }

    syncPaymentDraftFromOrder(order)
    setIsPaymentDialogOpen(true)
  }, [order, syncPaymentDraftFromOrder])

  const closePaymentDialog = useCallback(() => {
    if (isSavingPayment) {
      return
    }

    setIsPaymentDialogOpen(false)
    setHasAttemptedPaymentSave(false)
  }, [isSavingPayment])

  const paymentSubTotal = Number(order?.sub_total || 0)
  const paymentShippingFee = Number(order?.shipping_fee || 0)
  const normalizedDiscountAmount = getNormalizedDiscountAmount({
    subTotal: paymentSubTotal,
    discountAmount: discountAmountDraft,
  })
  const normalizedTaxAmount = getNormalizedTaxAmount({
    subTotal: paymentSubTotal,
    vatEnabled: vatEnabledDraft,
    vatRatePercent: vatRatePercentDraft,
  })
  const paymentTotalAmount = getOrderTotalAmount({
    subTotal: paymentSubTotal,
    discountAmount: normalizedDiscountAmount,
    taxAmount: normalizedTaxAmount,
    shippingFee: paymentShippingFee,
  })

  const normalizedDepositAmount = useMemo(
    () =>
      getNormalizedDepositAmount({
        paymentMethod: paymentMethodDraft,
        depositInputMode: depositInputModeDraft,
        depositPercent: depositPercentDraft,
        depositAmount: depositAmountDraft,
        totalAmount: paymentTotalAmount,
      }),
    [depositAmountDraft, depositInputModeDraft, depositPercentDraft, paymentMethodDraft, paymentTotalAmount],
  )

  const normalizedPaidAmount = useMemo(
    () => (paymentMethodDraft === 'unpaid' ? 0 : normalizedDepositAmount),
    [normalizedDepositAmount, paymentMethodDraft],
  )

  const paymentRemainingAmount = Math.max(paymentTotalAmount - normalizedPaidAmount, 0)
  const derivedPaymentStatus = useMemo(
    () =>
      getDerivedPaymentStatusValue({
        totalAmount: paymentTotalAmount,
        paidAmount: normalizedPaidAmount,
      }),
    [normalizedPaidAmount, paymentTotalAmount],
  )

  const paymentErrors = useMemo(
    () =>
      getPaymentValidationErrors({
        paymentMethod: paymentMethodDraft,
        paymentStatus: derivedPaymentStatus,
        paymentDueDate: paymentDueDateDraft,
        depositInputMode: depositInputModeDraft,
        depositPercent: depositPercentDraft,
        normalizedDepositAmount,
        totalAmount: paymentTotalAmount,
        bankName: bankNameDraft,
        bankAccountNumber: bankAccountNumberDraft,
        bankAccountHolder: bankAccountHolderDraft,
        processingStatus: order?.processing_status,
      }),
    [
      bankAccountHolderDraft,
      bankAccountNumberDraft,
      bankNameDraft,
      depositInputModeDraft,
      depositPercentDraft,
      normalizedDepositAmount,
      order?.processing_status,
      paymentDueDateDraft,
      paymentMethodDraft,
      paymentTotalAmount,
      derivedPaymentStatus,
    ],
  )

  const visiblePaymentErrors = hasAttemptedPaymentSave ? paymentErrors : {}
  const canSavePayment = !isSavingPayment && Object.keys(paymentErrors).length === 0
  const initialVatEnabled = order?.vat_enabled ?? false
  const initialVatRatePercent = Number(order?.vat_rate_percent || 0)
  const normalizedVatRatePercentDraft = Math.max(Number(vatRatePercentDraft || 0), 0)
  const hasVatChanges =
    vatEnabledDraft !== initialVatEnabled ||
    normalizedVatRatePercentDraft !== initialVatRatePercent

  const handlePaymentMethodChange = useCallback((method: PaymentMethod) => {
    setPaymentMethodDraft(method)
  }, [])

  const handleSavePayment = useCallback(async () => {
    if (!orderId) {
      return
    }

    setHasAttemptedPaymentSave(true)

    if (!canSavePayment) {
      appToast.warning('Vui lòng kiểm tra lại thông tin thanh toán trước khi lưu.')
      return
    }

    try {
      setIsSavingPayment(true)

      if (
        hasVatChanges &&
        !window.confirm('Changing VAT will update order total and may affect payment status.')
      ) {
        return
      }

      const updatedOrder = await orderApi.updateOrder(orderId, {
        payment_type_id: paymentMethodDraft === 'unpaid' ? null : PAYMENT_METHOD_TYPE_IDS[paymentMethodDraft],
        payment_status: derivedPaymentStatus,
        payment_notes: buildPaymentNoteContent({
          method: paymentMethodDraft,
          note: paymentNotesDraft,
          dueDate: paymentDueDateDraft,
          depositMode: depositInputModeDraft,
          depositPercent: depositPercentDraft,
          depositAmount: normalizedDepositAmount,
          bankName: bankNameDraft,
          accountNumber: bankAccountNumberDraft,
          accountHolder: bankAccountHolderDraft,
          transferReference: transferReferenceDraft,
        }),
        discount_amount: normalizedDiscountAmount,
        deposit_amount: derivedPaymentStatus === 'deposit' ? normalizedPaidAmount : 0,
        paid_amount: normalizedPaidAmount,
        ...(hasVatChanges
          ? {
              vat_enabled: vatEnabledDraft,
              vat_rate_percent: vatEnabledDraft ? normalizedVatRatePercentDraft : 0,
              vat_changed_by_user: true,
            }
          : {}),
      })

      onOrderUpdated(updatedOrder)
      syncPaymentDraftFromOrder(updatedOrder)
      setIsPaymentDialogOpen(false)
      appToast.success(`Đã cập nhật thanh toán cho đơn ${updatedOrder.order_code}.`)
    } catch (error) {
      console.error('Lỗi khi cập nhật thanh toán:', error)
      appToast.error(getErrorMessage(error, 'Không thể cập nhật thanh toán.'))
    } finally {
      setIsSavingPayment(false)
    }
  }, [
    bankAccountHolderDraft,
    bankAccountNumberDraft,
    bankNameDraft,
    canSavePayment,
    depositInputModeDraft,
    depositPercentDraft,
    derivedPaymentStatus,
    normalizedDepositAmount,
    normalizedDiscountAmount,
    normalizedPaidAmount,
    normalizedTaxAmount,
    onOrderUpdated,
    orderId,
    hasVatChanges,
    paymentDueDateDraft,
    paymentMethodDraft,
    paymentNotesDraft,
    syncPaymentDraftFromOrder,
    transferReferenceDraft,
    vatEnabledDraft,
    normalizedVatRatePercentDraft,
  ])

  return {
    isPaymentDialogOpen,
    isSavingPayment,
    paymentMethodDraft,
    paymentNotesDraft,
    paymentDueDateDraft,
    depositInputModeDraft,
    depositPercentDraft,
    depositAmountDraft,
    bankNameDraft,
    bankAccountNumberDraft,
    bankAccountHolderDraft,
    transferReferenceDraft,
    discountAmountDraft,
    vatEnabledDraft,
    vatRatePercentDraft,
    paymentSubTotal,
    paymentShippingFee,
    normalizedTaxAmount,
    paymentTotalAmount,
    normalizedDepositAmount,
    normalizedPaidAmount,
    paymentRemainingAmount,
    visiblePaymentErrors,
    openPaymentDialog,
    closePaymentDialog,
    handlePaymentMethodChange,
    handleSavePayment,
    setPaymentNotesDraft,
    setPaymentDueDateDraft,
    setDepositInputModeDraft,
    setDepositPercentDraft,
    setDepositAmountDraft,
    setBankNameDraft,
    setBankAccountNumberDraft,
    setBankAccountHolderDraft,
    setTransferReferenceDraft,
    setDiscountAmountDraft,
    setVatEnabledDraft,
    setVatRatePercentDraft,
    hasVatChanges,
  }
}
