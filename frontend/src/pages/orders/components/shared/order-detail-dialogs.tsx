import { type ReactElement } from 'react'
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  Typography,
} from '@mui/material'
import { StackedTextField } from '@/shared/ui/form/stacked-text-field'
import type { CityItem, DistrictItem, LocationItem } from '@/pages/customers/customer.api'
import type { VietQrGenerateResponse } from '@/pages/settings/general-settings.api'
import {
  CustomerModal,
  PaymentEntryDialog,
  type CustomerModalForm,
} from '..'
import { formatCurrency } from '../../lib'
import { PaymentInformationCard, type PaymentMethod } from '../../lib/order-payment'
import type { PaymentCollectionMethod } from '../../lib/payment-display.helpers'
import type { OrderDetailItem, OrderInvoiceSnapshot } from '../../api'

type OrderDetailDialogsProps = {
  shippingDialog: {
    action: 'push_to_delivery' | 'mark_delivered'
    shippingService: string
    trackingCode: string
    shippingStatus: string
  } | null
  onCloseShippingDialog: () => void
  onShippingDialogChange: (updater: (current: NonNullable<OrderDetailDialogsProps['shippingDialog']>) => NonNullable<OrderDetailDialogsProps['shippingDialog']>) => void
  onSubmitShippingDialog: () => void
  isActing: boolean
  isAddPaymentDialogOpen: boolean
  isConfirmPaidDialogOpen: boolean
  paymentEntryAmount: string
  paymentEntryMethod: PaymentCollectionMethod
  paymentEntryNote: string
  isSubmittingPaymentEntry: boolean
  orderRemainingAmount: number
  onCloseAddPaymentDialog: () => void
  onPaymentEntryAmountChange: (value: string) => void
  onPaymentEntryMethodChange: (value: PaymentCollectionMethod) => void
  onPaymentEntryNoteChange: (value: string) => void
  onSubmitAddPayment: () => void
  onCloseConfirmPaidDialog: () => void
  onSubmitConfirmPaid: () => void
  isPaymentDialogOpen: boolean
  onClosePaymentDialog: () => void
  canEditOrder: boolean
  isSavingPayment: boolean
  order: OrderDetailItem
  paymentMethodDraft: PaymentMethod
  discountAmountDraft: string
  normalizedTaxAmount: number
  paymentSubTotal: number
  paymentShippingFee: number
  paymentTotalAmount: number
  normalizedDepositAmount: number
  vatEnabledDraft: boolean
  vatRatePercentDraft: string
  canEditVat: boolean
  visiblePaymentErrors: Record<string, string>
  onPaymentMethodChange: (method: PaymentMethod) => void
  onDiscountAmountDraftChange: (value: string) => void
  onDepositAmountDraftChange: (value: string) => void
  onVatEnabledDraftChange: (value: boolean) => void
  onVatRatePercentDraftChange: (value: string) => void
  onSavePayment: () => void
  isInvoiceDialogOpen: boolean
  invoiceCodeDraft: string
  invoiceSnapshotDraft: OrderInvoiceSnapshot
  onInvoiceCodeDraftChange: (value: string) => void
  onInvoiceSnapshotDraftChange: (field: keyof OrderInvoiceSnapshot, value: string) => void
  onCloseInvoiceDialog: () => void
  onSubmitInvoiceRequest: () => void
  isQrDialogOpen: boolean
  paymentQr: VietQrGenerateResponse | null
  onCloseQrDialog: () => void
  onCopyQrValue: () => void
  customerModalOpen: boolean
  customerModalForm: CustomerModalForm
  customerModalStates: LocationItem[]
  customerModalCities: CityItem[]
  customerModalDistricts: DistrictItem[]
  isCustomerModalStatesLoading: boolean
  isCustomerModalCitiesLoading: boolean
  isCustomerModalDistrictsLoading: boolean
  isCustomerModalSaving: boolean
  onCloseCustomerModal: () => void
  onSaveCustomerModal: () => void
  onCustomerModalFieldChange: (field: 'fullName' | 'phone' | 'addressLine', value: string) => void
  onCustomerModalDefaultAddressChange: (checked: boolean) => void
  onCustomerModalStateChange: (_event: unknown, value: LocationItem | null) => void
  onCustomerModalCityChange: (_event: unknown, value: CityItem | null) => void
  onCustomerModalDistrictChange: (_event: unknown, value: DistrictItem | null) => void
}

export function OrderDetailDialogs(props: OrderDetailDialogsProps): ReactElement {
  const {
    shippingDialog,
    onCloseShippingDialog,
    onShippingDialogChange,
    onSubmitShippingDialog,
    isActing,
    isAddPaymentDialogOpen,
    isConfirmPaidDialogOpen,
    paymentEntryAmount,
    paymentEntryMethod,
    paymentEntryNote,
    isSubmittingPaymentEntry,
    orderRemainingAmount,
    onCloseAddPaymentDialog,
    onPaymentEntryAmountChange,
    onPaymentEntryMethodChange,
    onPaymentEntryNoteChange,
    onSubmitAddPayment,
    onCloseConfirmPaidDialog,
    onSubmitConfirmPaid,
    isPaymentDialogOpen,
    onClosePaymentDialog,
    canEditOrder,
    isSavingPayment,
    order,
    paymentMethodDraft,
    discountAmountDraft,
    normalizedTaxAmount,
    paymentSubTotal,
    paymentShippingFee,
    paymentTotalAmount,
    normalizedDepositAmount,
    vatEnabledDraft,
    vatRatePercentDraft,
    canEditVat,
    visiblePaymentErrors,
    onPaymentMethodChange,
    onDiscountAmountDraftChange,
    onDepositAmountDraftChange,
    onVatEnabledDraftChange,
    onVatRatePercentDraftChange,
    onSavePayment,
    isInvoiceDialogOpen,
    invoiceCodeDraft,
    invoiceSnapshotDraft,
    onInvoiceCodeDraftChange,
    onInvoiceSnapshotDraftChange,
    onCloseInvoiceDialog,
    onSubmitInvoiceRequest,
    isQrDialogOpen,
    paymentQr,
    onCloseQrDialog,
    onCopyQrValue,
    customerModalOpen,
    customerModalForm,
    customerModalStates,
    customerModalCities,
    customerModalDistricts,
    isCustomerModalStatesLoading,
    isCustomerModalCitiesLoading,
    isCustomerModalDistrictsLoading,
    isCustomerModalSaving,
    onCloseCustomerModal,
    onSaveCustomerModal,
    onCustomerModalFieldChange,
    onCustomerModalDefaultAddressChange,
    onCustomerModalStateChange,
    onCustomerModalCityChange,
    onCustomerModalDistrictChange,
  } = props

  return (
    <>
      <Dialog open={Boolean(shippingDialog)} onClose={onCloseShippingDialog} fullWidth maxWidth="sm">
        <DialogTitle>{shippingDialog?.action === 'mark_delivered' ? 'Xác nhận đã giao' : 'Đẩy sang vận chuyển'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <StackedTextField
              label="Đơn vị vận chuyển"
              value={shippingDialog?.shippingService ?? ''}
              onChange={(event) =>
                onShippingDialogChange((current) => ({ ...current, shippingService: event.target.value }))
              }
              fullWidth
            />
            <StackedTextField
              label="Mã tracking"
              value={shippingDialog?.trackingCode ?? ''}
              onChange={(event) =>
                onShippingDialogChange((current) => ({ ...current, trackingCode: event.target.value }))
              }
              fullWidth
            />
            <StackedTextField
              label="Trạng thái giao hàng"
              value={shippingDialog?.shippingStatus ?? ''}
              onChange={(event) =>
                onShippingDialogChange((current) => ({ ...current, shippingStatus: event.target.value }))
              }
              fullWidth
              placeholder={shippingDialog?.action === 'push_to_delivery' ? 'delivering' : 'delivered'}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onCloseShippingDialog}>Đóng</Button>
          <Button variant="contained" onClick={onSubmitShippingDialog} disabled={isActing}>
            {shippingDialog?.action === 'mark_delivered' ? 'Xác nhận đã giao' : 'Đẩy sang vận chuyển'}
          </Button>
        </DialogActions>
      </Dialog>

      <PaymentEntryDialog
        open={isAddPaymentDialogOpen}
        title="Thêm thanh toán"
        description="Ghi nhận từng lần thu tiền để lịch sử thanh toán luôn rõ ràng và không ghi đè dữ liệu cũ."
        amountLabel="Số tiền thanh toán"
        amountValue={paymentEntryAmount}
        amountEditable
        noteLabel="Ghi chú giao dịch"
        notePlaceholder="Ví dụ: khách chuyển khoản thêm"
        noteValue={paymentEntryNote}
        methodValue={paymentEntryMethod}
        remainingAmount={orderRemainingAmount}
        submitLabel="Ghi nhận thanh toán"
        isSubmitting={isSubmittingPaymentEntry}
        onClose={onCloseAddPaymentDialog}
        onAmountChange={onPaymentEntryAmountChange}
        onMethodChange={onPaymentEntryMethodChange}
        onNoteChange={onPaymentEntryNoteChange}
        onSubmit={onSubmitAddPayment}
      />

      <PaymentEntryDialog
        open={isConfirmPaidDialogOpen}
        title="Xác nhận đã thu đủ tiền"
        description="Dùng khi khách đã thanh toán ngoài hệ thống và bạn muốn xác nhận thủ công phần còn lại. Hành động này vẫn được lưu thành một giao dịch cuối trong lịch sử thanh toán."
        amountLabel="Số tiền xác nhận"
        amountValue={formatCurrency(orderRemainingAmount)}
        noteLabel="Ghi chú xác nhận"
        notePlaceholder="Ví dụ: khách đã chuyển khoản ngoài hệ thống, đã đối soát sao kê"
        noteValue={paymentEntryNote}
        methodValue={paymentEntryMethod}
        remainingAmount={orderRemainingAmount}
        submitLabel="Xác nhận thu đủ tiền"
        isSubmitting={isSubmittingPaymentEntry}
        onClose={onCloseConfirmPaidDialog}
        onMethodChange={onPaymentEntryMethodChange}
        onNoteChange={onPaymentEntryNoteChange}
        onSubmit={onSubmitConfirmPaid}
      />

      <Dialog open={isPaymentDialogOpen} onClose={onClosePaymentDialog} fullWidth maxWidth="md">
        <DialogTitle>Cấu hình thanh toán</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <PaymentInformationCard
              itemCount={order.order_items.length}
              canEdit={canEditOrder}
              paymentMethod={paymentMethodDraft}
              discountAmount={discountAmountDraft}
              taxAmount={normalizedTaxAmount}
              subTotal={paymentSubTotal}
              shippingFee={paymentShippingFee}
              totalAmount={paymentTotalAmount}
              depositAmount={normalizedDepositAmount}
              vatEnabled={vatEnabledDraft}
              vatRatePercent={Math.max(Number(vatRatePercentDraft || 0), 0)}
              canEditVat={canEditVat}
              errors={visiblePaymentErrors}
              onPaymentStatusChange={() => undefined}
              onPaymentMethodChange={onPaymentMethodChange}
              onDiscountAmountChange={onDiscountAmountDraftChange}
              onDepositAmountChange={onDepositAmountDraftChange}
              onVatEnabledChange={onVatEnabledDraftChange}
              onVatRatePercentChange={onVatRatePercentDraftChange}
            />
            {visiblePaymentErrors.processing_status ? (
              <Typography color="error">{visiblePaymentErrors.processing_status}</Typography>
            ) : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClosePaymentDialog}>Đóng</Button>
          <Button variant="contained" onClick={onSavePayment} disabled={!canEditOrder || isSavingPayment}>
            {isSavingPayment ? 'Đang lưu...' : 'Lưu thanh toán'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={isInvoiceDialogOpen} onClose={onCloseInvoiceDialog} fullWidth maxWidth="sm">
        <DialogTitle>Xuất hóa đơn điện tử</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <StackedTextField
              label="Mã hóa đơn"
              value={invoiceCodeDraft}
              onChange={(event) => onInvoiceCodeDraftChange(event.target.value)}
              fullWidth
              placeholder="Nếu để trống, backend sẽ tạo mã mặc định"
            />
            <StackedTextField
              label="Loại hóa đơn"
              value={invoiceSnapshotDraft.invoice_type}
              onChange={(event) => onInvoiceSnapshotDraftChange('invoice_type', event.target.value)}
              fullWidth
              placeholder="b2b hoặc b2c"
            />
            <StackedTextField
              label="Người mua / người nhận hóa đơn"
              value={invoiceSnapshotDraft.buyer_name}
              onChange={(event) => onInvoiceSnapshotDraftChange('buyer_name', event.target.value)}
              fullWidth
            />
            <StackedTextField
              label="Tên công ty"
              value={invoiceSnapshotDraft.company_name}
              onChange={(event) => onInvoiceSnapshotDraftChange('company_name', event.target.value)}
              fullWidth
            />
            <StackedTextField
              label="Mã số thuế"
              value={invoiceSnapshotDraft.tax_code}
              onChange={(event) => onInvoiceSnapshotDraftChange('tax_code', event.target.value)}
              fullWidth
            />
            <StackedTextField
              label="Số định danh cá nhân"
              value={invoiceSnapshotDraft.personal_id}
              onChange={(event) => onInvoiceSnapshotDraftChange('personal_id', event.target.value)}
              fullWidth
            />
            <StackedTextField
              label="Mã đơn vị NSNN"
              value={invoiceSnapshotDraft.budget_unit_code}
              onChange={(event) => onInvoiceSnapshotDraftChange('budget_unit_code', event.target.value)}
              fullWidth
            />
            <StackedTextField
              label="Email nhận hóa đơn"
              value={invoiceSnapshotDraft.email}
              onChange={(event) => onInvoiceSnapshotDraftChange('email', event.target.value)}
              fullWidth
            />
            <StackedTextField
              label="Số điện thoại"
              value={invoiceSnapshotDraft.phone}
              onChange={(event) => onInvoiceSnapshotDraftChange('phone', event.target.value)}
              fullWidth
            />
            <StackedTextField
              label="Địa chỉ xuất hóa đơn"
              value={invoiceSnapshotDraft.address_line}
              onChange={(event) => onInvoiceSnapshotDraftChange('address_line', event.target.value)}
              fullWidth
            />
            <StackedTextField
              label="Ghi chú"
              value={invoiceSnapshotDraft.note}
              onChange={(event) => onInvoiceSnapshotDraftChange('note', event.target.value)}
              fullWidth
            />
            <Typography variant="body2" color="text.secondary">
              Mã hóa đơn và snapshot người mua sẽ được lưu vào lịch sử đơn hàng để đội vận hành đối soát sau này.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onCloseInvoiceDialog}>Đóng</Button>
          <Button variant="contained" onClick={onSubmitInvoiceRequest} disabled={isActing}>
            Lưu mã hóa đơn
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={isQrDialogOpen} onClose={onCloseQrDialog} fullWidth maxWidth="xs">
        <DialogTitle>QR thanh toán</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1, alignItems: 'center' }}>
            {paymentQr?.data.qrDataURL ? (
              <Box
                component="img"
                src={paymentQr.data.qrDataURL}
                alt={`QR thanh toán ${order.order_code}`}
                sx={{ width: 240, height: '100%', borderRadius: 2, border: '1px solid #e2e8f0', bgcolor: '#fff' }}
              />
            ) : null}
            {paymentQr?.transfer_content ? (
              <Paper
                variant="outlined"
                sx={{
                  width: '100%',
                  p: 1.5,
                  borderRadius: 2,
                  bgcolor: '#f8fafc',
                }}
              >
                <Typography
                  component="pre"
                  sx={{
                    m: 0,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    fontFamily: 'inherit',
                    fontSize: 14,
                    color: '#0f172a',
                    lineHeight: 1.7,
                  }}
                >
                  {paymentQr.transfer_content}
                </Typography>
              </Paper>
            ) : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onCloseQrDialog}>Đóng</Button>
          <Button variant="contained" onClick={onCopyQrValue}>
            Copy nội dung
          </Button>
        </DialogActions>
      </Dialog>

      <CustomerModal
        open={customerModalOpen}
        mode="edit"
        form={customerModalForm}
        states={customerModalStates}
        cities={customerModalCities}
        districts={customerModalDistricts}
        isStatesLoading={isCustomerModalStatesLoading}
        isCitiesLoading={isCustomerModalCitiesLoading}
        isDistrictsLoading={isCustomerModalDistrictsLoading}
        isSaving={isCustomerModalSaving}
        onClose={onCloseCustomerModal}
        onSave={onSaveCustomerModal}
        onFieldChange={onCustomerModalFieldChange}
        onDefaultAddressChange={onCustomerModalDefaultAddressChange}
        onStateChange={onCustomerModalStateChange}
        onCityChange={onCustomerModalCityChange}
        onDistrictChange={onCustomerModalDistrictChange}
      />
    </>
  )
}
