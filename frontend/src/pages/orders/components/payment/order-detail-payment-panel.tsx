import type { ReactElement } from 'react'
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined'
import QrCode2OutlinedIcon from '@mui/icons-material/QrCode2Outlined'
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined'
import { alpha, Button, Chip, Paper, Stack, Typography } from '@mui/material'
import { borderedCardSx } from '@/shared/ui/paper'
import type { PaymentHistoryEntry } from './payment-history-section'
import { PaymentHistorySection } from './payment-history-section'
import { PaymentSummarySection } from './payment-summary-section'

export function OrderDetailPaymentPanel({
  itemCount,
  subTotal,
  discountAmount,
  taxAmount,
  vatRatePercent,
  shippingFee,
  totalAmount,
  paidAmount,
  remainingAmount,
  forceShowTaxLine = false,
  paymentHistoryEntries,
  isPaymentHistoryLoading = false,
  invoiceStatusLabel,
  invoiceStatusColor,
  invoiceCode,
  canExportInvoice,
  canGeneratePaymentQr,
  canAddPayment,
  canEditOrder,
  isActing,
  isGeneratingQr,
  onOpenInvoiceDialog,
  onOpenPaymentQr,
  onOpenAddPaymentDialog,
  onOpenConfirmPaidDialog,
  onOpenPaymentDialog,
}: {
  itemCount: number
  subTotal: number
  discountAmount: number
  taxAmount: number
  vatRatePercent: number
  shippingFee: number
  totalAmount: number
  paidAmount: number
  remainingAmount: number
  forceShowTaxLine?: boolean
  paymentHistoryEntries: PaymentHistoryEntry[]
  isPaymentHistoryLoading?: boolean
  invoiceStatusLabel: string
  invoiceStatusColor: 'default' | 'success'
  invoiceCode: string | null
  canExportInvoice: boolean
  canGeneratePaymentQr: boolean
  canAddPayment: boolean
  canEditOrder: boolean
  isActing: boolean
  isGeneratingQr: boolean
  onOpenInvoiceDialog: () => void
  onOpenPaymentQr: () => void
  onOpenAddPaymentDialog: () => void
  onOpenConfirmPaidDialog: () => void
  onOpenPaymentDialog: () => void
}): ReactElement {
  return (
    <Paper sx={borderedCardSx}>
      <Stack spacing={2.5}>
        <Typography variant="h6" sx={{ fontWeight: 700, color: '#101828' }}>
          Thanh toán
        </Typography>

        <Stack spacing={2}>
          <PaymentSummarySection
            itemCount={itemCount}
            subTotal={subTotal}
            discountAmount={discountAmount}
            taxAmount={taxAmount}
            vatRatePercent={vatRatePercent}
            shippingFee={shippingFee}
            totalAmount={totalAmount}
            paidAmount={paidAmount}
            remainingAmount={remainingAmount}
            forceShowTaxLine={forceShowTaxLine}
          />

          <PaymentHistorySection entries={paymentHistoryEntries} isLoading={isPaymentHistoryLoading} />

          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={1.5}
            sx={{
              justifyContent: 'space-between',
              alignItems: { md: 'center' },
              p: 1.5,
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: (theme) => alpha(theme.palette.background.default, 0.5),
            }}
          >
            <Stack spacing={1}>
              <Chip label={invoiceStatusLabel} color={invoiceStatusColor} sx={{ alignSelf: 'flex-start' }} />
              <Typography color="text.secondary">
                Mã hóa đơn: {invoiceCode ?? 'Chưa có mã hóa đơn điện tử'}
              </Typography>
            </Stack>

            {canExportInvoice ? (
              <Button
                variant="outlined"
                startIcon={<ReceiptLongOutlinedIcon />}
                onClick={onOpenInvoiceDialog}
                disabled={isActing}
              >
                Xuất hóa đơn điện tử
              </Button>
            ) : null}
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
            {canGeneratePaymentQr ? (
              <Button
                variant="outlined"
                startIcon={<QrCode2OutlinedIcon />}
                onClick={onOpenPaymentQr}
                disabled={isGeneratingQr}
              >
                Tạo QR
              </Button>
            ) : null}
            <Button
              variant="contained"
              color="secondary"
              startIcon={<PaymentsOutlinedIcon />}
              onClick={onOpenAddPaymentDialog}
              disabled={isActing || !canAddPayment}
            >
              Thêm thanh toán
            </Button>
            <Button
              variant="outlined"
              startIcon={<CheckCircleOutlinedIcon />}
              onClick={onOpenConfirmPaidDialog}
              disabled={isActing || !canAddPayment}
            >
              Xác nhận đã thu đủ tiền
            </Button>
            <Button
              variant="outlined"
              startIcon={<EditOutlinedIcon />}
              onClick={onOpenPaymentDialog}
              disabled={isActing || !canEditOrder}
            >
              Cấu hình thanh toán
            </Button>
          </Stack>
        </Stack>
      </Stack>
    </Paper>
  )
}
