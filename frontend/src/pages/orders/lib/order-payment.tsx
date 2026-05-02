import type { ReactElement, ReactNode } from 'react'
import AccountBalanceOutlinedIcon from '@mui/icons-material/AccountBalanceOutlined'
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined'
import { alpha, Box, Checkbox, Divider, FormControlLabel, InputAdornment, Paper, Stack, TextField, Typography } from '@mui/material'
import { borderedCardSx } from '@/shared/ui/paper'
import { SummaryPaperHeader } from '@/shared/ui/summary-paper-header'
import { formatCurrency, formatCurrencyInput } from './order.utils'

export type PaymentMethod = 'unpaid' | 'cod' | 'pay_later' | 'deposit' | 'bank_transfer'
export type DepositInputMode = 'percent' | 'amount'

export type ParsedPaymentDetails = {
  method?: PaymentMethod
  note: string
  dueDate: string
  depositMode: DepositInputMode
  depositPercent: string
  bankName: string
  accountNumber: string
  accountHolder: string
  transferReference: string
}

export const PAYMENT_METHOD_TYPE_IDS: Record<Exclude<PaymentMethod, 'unpaid'>, number> = {
  cod: 1,
  pay_later: 2,
  deposit: 3,
  bank_transfer: 4,
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  unpaid: 'Chưa thanh toán',
  cod: 'Tiền mặt',
  pay_later: 'Thanh toán sau',
  deposit: 'Thanh toán một phần',
  bank_transfer: 'Chuyển khoản',
}

const PAYMENT_NOTE_LABELS = {
  method: 'Hình thức thanh toán:',
  dueDate: 'Hạn thanh toán:',
  depositMode: 'Chế độ đặt cọc:',
  depositPercent: 'Tỷ lệ đặt cọc:',
  bankName: 'Ngân hàng:',
  accountNumber: 'Số tài khoản:',
  accountHolder: 'Chủ tài khoản:',
  transferReference: 'Nội dung chuyển khoản:',
} as const

export const getPaymentMethodFromTypeId = (
  paymentTypeId: number | null | undefined,
  paymentStatus?: 'unpaid' | 'paid' | 'deposit',
): PaymentMethod => {
  if (paymentTypeId === null || paymentTypeId === undefined) {
    return 'unpaid'
  }

  if (paymentTypeId === PAYMENT_METHOD_TYPE_IDS.pay_later) {
    return 'pay_later'
  }

  if (paymentTypeId === PAYMENT_METHOD_TYPE_IDS.deposit || paymentStatus === 'deposit') {
    return 'deposit'
  }

  if (paymentTypeId === PAYMENT_METHOD_TYPE_IDS.bank_transfer) {
    return 'bank_transfer'
  }

  return 'cod'
}

export const getNextPaymentStatus = (
  _method: PaymentMethod,
  currentStatus: 'unpaid' | 'paid' | 'deposit',
): 'unpaid' | 'paid' | 'deposit' => currentStatus

export const getDerivedPaymentStatusValue = ({
  totalAmount,
  paidAmount,
}: {
  totalAmount: number
  paidAmount: number
}): 'unpaid' | 'paid' | 'deposit' => {
  if (totalAmount > 0 && paidAmount >= totalAmount) {
    return 'paid'
  }

  if (paidAmount > 0) {
    return 'deposit'
  }

  return 'unpaid'
}

export const getNormalizedDiscountAmount = ({
  subTotal,
  discountAmount,
}: {
  subTotal: number
  discountAmount: string | number
}): number => {
  const normalizedSubTotal = Math.max(Number(subTotal || 0), 0)
  const normalizedDiscount = Math.max(Number(discountAmount || 0), 0)
  return Math.min(normalizedDiscount, normalizedSubTotal)
}

export const getNormalizedTaxAmount = ({
  subTotal,
  vatEnabled,
  vatRatePercent,
}: {
  subTotal: number
  vatEnabled: boolean
  vatRatePercent: string | number
}): number => {
  if (!vatEnabled) {
    return 0
  }

  const normalizedSubTotal = Math.max(Number(subTotal || 0), 0)
  const normalizedRate = Math.max(Number(vatRatePercent || 0), 0)
  return (normalizedSubTotal * normalizedRate) / 100
}

export const getNormalizedVatRatePercent = (value: string | number): number => {
  return Math.max(Number(value || 0), 0)
}

export const getVatLabel = (vatRatePercent: string | number): string => {
  const normalizedRate = getNormalizedVatRatePercent(vatRatePercent)
  return normalizedRate > 0 ? `Thuế VAT (${normalizedRate}%)` : 'Thuế VAT'
}

export const shouldRenderVatAmount = ({
  vatEnabled,
  taxAmount,
}: {
  vatEnabled: boolean
  taxAmount: number
}): boolean => vatEnabled && Math.max(Number(taxAmount || 0), 0) > 0

export const getOrderTotalAmount = ({
  subTotal,
  discountAmount,
  taxAmount,
  shippingFee,
}: {
  subTotal: number
  discountAmount: number
  taxAmount: number
  shippingFee: number
}): number => {
  return Math.max(subTotal - discountAmount + taxAmount + Math.max(Number(shippingFee || 0), 0), 0)
}

export const getNormalizedDepositAmount = ({
  depositAmount,
  totalAmount,
}: {
  paymentMethod: PaymentMethod
  depositInputMode: DepositInputMode
  depositPercent: string
  depositAmount: string | number
  totalAmount: number
}): number => {
  const normalizedTotal = Math.max(Number(totalAmount || 0), 0)
  return Math.min(Math.max(Number(depositAmount || 0), 0), normalizedTotal)
}

export const getNormalizedPaidAmount = ({
  paymentStatus,
  totalAmount,
  depositAmount,
}: {
  paymentStatus: 'unpaid' | 'paid' | 'deposit'
  paymentMethod: PaymentMethod
  totalAmount: number
  depositAmount: number
}): number => {
  const normalizedTotal = Math.max(totalAmount, 0)

  if (paymentStatus === 'paid') {
    return normalizedTotal
  }

  return Math.min(Math.max(Number(depositAmount || 0), 0), normalizedTotal)
}

export const getPaymentValidationErrors = ({
  paymentStatus,
  normalizedDepositAmount,
  totalAmount,
  processingStatus,
}: {
  paymentMethod: PaymentMethod
  paymentStatus: 'unpaid' | 'paid' | 'deposit'
  paymentDueDate: string
  depositInputMode: DepositInputMode
  depositPercent: string
  normalizedDepositAmount: number
  totalAmount: number
  hasBankAccountConfigured?: boolean
  bankName?: string
  bankAccountNumber?: string
  bankAccountHolder?: string
  processingStatus?: string
}): Record<string, string> => {
  const nextErrors: Record<string, string> = {}
  const normalizedTotal = Math.max(totalAmount, 0)

  if (normalizedDepositAmount > normalizedTotal) {
    nextErrors.deposit_amount = 'Số tiền khách đã trả không được lớn hơn số tiền phải thanh toán.'
  }

  if (paymentStatus === 'unpaid' && processingStatus === 'completed' && normalizedTotal > 0) {
    nextErrors.processing_status = 'Đơn chưa thanh toán không thể đánh dấu hoàn thành.'
  }

  if (normalizedDepositAmount > 0 && normalizedDepositAmount < normalizedTotal && processingStatus === 'completed') {
    nextErrors.processing_status = 'Đơn còn công nợ không thể đánh dấu hoàn thành.'
  }

  return nextErrors
}

export const buildPaymentNoteContent = ({
  method,
  note,
  dueDate,
  depositMode,
  depositPercent,
  depositAmount,
  bankName,
  accountNumber,
  accountHolder,
  transferReference,
}: {
  method: PaymentMethod
  note: string
  dueDate: string
  depositMode: DepositInputMode
  depositPercent: string
  depositAmount: number
  bankName: string
  accountNumber: string
  accountHolder: string
  transferReference: string
}): string | null => {
  const lines: string[] = []

  if (note.trim()) {
    lines.push(note.trim())
  }

  lines.push(`${PAYMENT_NOTE_LABELS.method} ${PAYMENT_METHOD_LABELS[method]}`)

  if ((method === 'pay_later' || method === 'bank_transfer') && dueDate) {
    lines.push(`${PAYMENT_NOTE_LABELS.dueDate} ${dueDate}`)
  }

  if (method === 'deposit') {
    lines.push(`${PAYMENT_NOTE_LABELS.depositMode} ${depositMode === 'percent' ? 'Theo %' : 'Theo số tiền'}`)

    if (depositMode === 'percent' && depositPercent.trim()) {
      lines.push(`${PAYMENT_NOTE_LABELS.depositPercent} ${depositPercent.trim()}%`)
    }

    lines.push(`Số tiền đặt cọc: ${formatCurrency(depositAmount)}`)

    if (dueDate) {
      lines.push(`${PAYMENT_NOTE_LABELS.dueDate} ${dueDate}`)
    }
  }

  if (method === 'bank_transfer') {
    if (bankName.trim()) {
      lines.push(`${PAYMENT_NOTE_LABELS.bankName} ${bankName.trim()}`)
    }

    if (accountNumber.trim()) {
      lines.push(`${PAYMENT_NOTE_LABELS.accountNumber} ${accountNumber.trim()}`)
    }

    if (accountHolder.trim()) {
      lines.push(`${PAYMENT_NOTE_LABELS.accountHolder} ${accountHolder.trim()}`)
    }

    if (transferReference.trim()) {
      lines.push(`${PAYMENT_NOTE_LABELS.transferReference} ${transferReference.trim()}`)
    }
  }

  return lines.filter(Boolean).join('\n').trim() || null
}

export const parsePaymentNoteContent = (value: string | null | undefined): ParsedPaymentDetails => {
  const parsed: ParsedPaymentDetails = {
    note: '',
    dueDate: '',
    depositMode: 'amount',
    depositPercent: '',
    bankName: '',
    accountNumber: '',
    accountHolder: '',
    transferReference: '',
  }

  if (!value?.trim()) {
    return parsed
  }

  const noteLines: string[] = []

  value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      if (line.startsWith(PAYMENT_NOTE_LABELS.method) || line.startsWith('Phương thức thanh toán:')) {
        const methodPrefix = line.startsWith(PAYMENT_NOTE_LABELS.method)
          ? PAYMENT_NOTE_LABELS.method
          : 'Phương thức thanh toán:'
        const methodLabel = line.slice(methodPrefix.length).trim()

        if (methodLabel === 'COD') {
          parsed.method = 'cod'
          return
        }

        parsed.method =
          (Object.entries(PAYMENT_METHOD_LABELS).find(([, label]) => label === methodLabel)?.[0] as PaymentMethod | undefined) ??
          parsed.method
        return
      }

      if (line.startsWith(PAYMENT_NOTE_LABELS.dueDate)) {
        parsed.dueDate = line.slice(PAYMENT_NOTE_LABELS.dueDate.length).trim()
        return
      }

      if (line.startsWith(PAYMENT_NOTE_LABELS.depositMode)) {
        parsed.depositMode = line.includes('Theo %') ? 'percent' : 'amount'
        return
      }

      if (line.startsWith(PAYMENT_NOTE_LABELS.depositPercent)) {
        parsed.depositPercent = line.slice(PAYMENT_NOTE_LABELS.depositPercent.length).replace('%', '').trim()
        return
      }

      if (line.startsWith(PAYMENT_NOTE_LABELS.bankName)) {
        parsed.bankName = line.slice(PAYMENT_NOTE_LABELS.bankName.length).trim()
        return
      }

      if (line.startsWith(PAYMENT_NOTE_LABELS.accountNumber)) {
        parsed.accountNumber = line.slice(PAYMENT_NOTE_LABELS.accountNumber.length).trim()
        return
      }

      if (line.startsWith(PAYMENT_NOTE_LABELS.accountHolder)) {
        parsed.accountHolder = line.slice(PAYMENT_NOTE_LABELS.accountHolder.length).trim()
        return
      }

      if (line.startsWith(PAYMENT_NOTE_LABELS.transferReference)) {
        parsed.transferReference = line.slice(PAYMENT_NOTE_LABELS.transferReference.length).trim()
        return
      }

      if (line.startsWith('Số tiền đặt cọc:') || line.startsWith('Ghi chú COD:') || line.startsWith('Ghi chú thanh toán:')) {
        return
      }

      noteLines.push(line)
    })

  parsed.note = noteLines.join('\n').trim()
  return parsed
}

type PricingCardProps = {
  items: Array<{
    id: string | number
    productName: string
    quantity: number
    lineTotal: number
    secondary?: string
  }>
  subTotal: number
  shippingFee: number
  discountAmount: number
  taxAmount?: number
  vatRatePercent?: number
  totalAmount: number
}

export function OrderPricingCard({
  items,
  subTotal,
  shippingFee,
  discountAmount,
  taxAmount = 0,
  vatRatePercent = 0,
  totalAmount,
}: PricingCardProps): ReactElement {
  return (
    <Paper sx={borderedCardSx}>
      <Stack spacing={2.25}>
        <SummaryPaperHeader title="Bảng giá" />

        <Stack spacing={1.25}>
          {items.map((item) => (
            <Box
              key={item.id}
              sx={{
                p: 1.5,
                borderRadius: 3,
                border: '1px solid',
                borderColor: alpha('#0f172a', 0.08),
                bgcolor: '#fff',
              }}
            >
              <Stack direction="row" spacing={1.5} sx={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 700, color: '#0f172a' }}>
                    {item.productName || 'Sản phẩm chưa đặt tên'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
                    SL {item.quantity}
                    {item.secondary ? ` • ${item.secondary}` : ''}
                  </Typography>
                </Box>
                <Typography sx={{ fontWeight: 700, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>
                  {formatCurrency(item.lineTotal)}
                </Typography>
              </Stack>
            </Box>
          ))}
        </Stack>

        <Stack spacing={1}>
          <PaymentDetailRow label="Tạm tính" value={formatCurrency(subTotal)} />
          <PaymentDetailRow label="Giảm giá" value={discountAmount > 0 ? `- ${formatCurrency(discountAmount)}` : formatCurrency(0)} />
          {taxAmount > 0 ? (
            <PaymentDetailRow
              label={getVatLabel(vatRatePercent)}
              value={formatCurrency(taxAmount)}
            />
          ) : null}
          <PaymentDetailRow label="Phí vận chuyển" value={formatCurrency(shippingFee)} />
          <Divider />
          <PaymentDetailRow label="Tổng cộng" value={formatCurrency(totalAmount)} highlight />
        </Stack>
      </Stack>
    </Paper>
  )
}

type PaymentInformationCardProps = {
  title?: string
  headerAction?: ReactNode
  itemCount?: number
  renderVatToggleOnly?: boolean
  canEdit: boolean
  paymentMethod: PaymentMethod
  discountAmount: string
  taxAmount: number
  subTotal: number
  shippingFee: number
  totalAmount: number
  depositAmount: number
  vatEnabled: boolean
  vatRatePercent: number
  canEditDiscount?: boolean
  canEditVat?: boolean
  errors: Record<string, string>
  onPaymentStatusChange?: (status: 'unpaid' | 'paid' | 'deposit') => void
  onPaymentMethodChange: (method: PaymentMethod) => void
  onDiscountAmountChange: (value: string) => void
  onDepositAmountChange: (value: string) => void
  onVatEnabledChange?: (value: boolean) => void
  onVatRatePercentChange?: (value: string) => void
}

export function PaymentInformationCard({
  title = 'Thanh toán',
  headerAction,
  itemCount = 0,
  renderVatToggleOnly = false,
  canEdit,
  paymentMethod,
  discountAmount,
  taxAmount,
  subTotal,
  shippingFee,
  totalAmount,
  depositAmount,
  vatEnabled,
  vatRatePercent,
  canEditDiscount = true,
  canEditVat = false,
  errors,
  onPaymentStatusChange = () => undefined,
  onPaymentMethodChange,
  onDiscountAmountChange,
  onDepositAmountChange,
  onVatEnabledChange = () => undefined,
  onVatRatePercentChange = () => undefined,
}: PaymentInformationCardProps): ReactElement {
  const paidAmount = Math.max(Number(depositAmount || 0), 0)
  const normalizedDiscountAmount = getNormalizedDiscountAmount({
    subTotal,
    discountAmount,
  })
  const payableAmount = Math.max(totalAmount, 0)
  const remainingAmount = Math.max(payableAmount - paidAmount, 0)
  const selectedMethod = paymentMethod === 'bank_transfer' ? 'bank_transfer' : 'cod'
  const vatLabel = getVatLabel(vatRatePercent)

  const handleDiscountChange = (value: string) => {
    const nextDiscount = getNormalizedDiscountAmount({
      subTotal,
      discountAmount: Number(String(value).replace(/\D/g, '') || 0),
    })
    onDiscountAmountChange(String(nextDiscount))
  }

  const handlePaidAmountChange = (value: string) => {
    const nextPaidAmount = Math.min(Number(String(value).replace(/\D/g, '') || 0), payableAmount)
    onDepositAmountChange(String(nextPaidAmount))
    onPaymentStatusChange(
      getDerivedPaymentStatusValue({
        totalAmount: payableAmount,
        paidAmount: nextPaidAmount,
      }),
    )
  }

  const formattedDiscountValue = formatCurrencyInput(normalizedDiscountAmount, { zeroAsEmpty: false })
  const formattedPaidAmountValue = formatCurrencyInput(paidAmount, { zeroAsEmpty: false })
  const discountInputWidth = `${Math.max(formattedDiscountValue.length, 9)}ch`
  const paidAmountInputWidth = `${Math.max(formattedPaidAmountValue.length, 9)}ch`

  return (
    <Paper sx={borderedCardSx}>
      <Stack spacing={2.5}>
        {headerAction ? (
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={1.5}
            sx={{ justifyContent: 'space-between', alignItems: { md: 'center' } }}
          >
            <SummaryPaperHeader title={title} />
            {headerAction}
          </Stack>
        ) : (
          <SummaryPaperHeader title={title} />
        )}

        <Stack spacing={1.5}>
          <Stack direction="row" spacing={1.5} sx={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 700 }}>
              Tạm tính ({Math.max(Number(itemCount || 0), 0)} sản phẩm)
            </Typography>
            <Typography sx={{ color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>
              {formatCurrency(subTotal)}
            </Typography>
          </Stack>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'minmax(120px, 0.9fr) minmax(0, 1.1fr)' },
              gap: 1.5,
              alignItems: 'end',
            }}
          >
            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 700 }}>
              Giảm giá
            </Typography>
            <TextField
              variant="standard"
              value={formattedDiscountValue}
              onChange={(event) => handleDiscountChange(event.target.value)}
              disabled={!canEdit || !canEditDiscount}
              sx={{
                justifySelf: { sm: 'end' },
                width: `calc(${discountInputWidth} + 56px)`,
                minWidth: 'calc(9ch + 56px)',
                maxWidth: '100%',
                '& input': {
                  textAlign: 'right',
                },
              }}
              slotProps={{
                input: {
                  endAdornment: <InputAdornment position="end">₫</InputAdornment>,
                },
              }}
            />
          </Box>

          {shouldRenderVatAmount({ vatEnabled, taxAmount }) ? (
            <PaymentDetailRow label={vatLabel} value={formatCurrency(taxAmount)} />
          ) : null}

          {!renderVatToggleOnly ? (
            <Stack
              spacing={1}
              sx={{
                p: 1.5,
                borderRadius: 2,
                border: '1px solid',
                borderColor: alpha('#0f172a', 0.08),
                bgcolor: alpha('#f8fafc', 0.9),
              }}
            >
              <FormControlLabel
                control={
                  <Checkbox
                    checked={vatEnabled}
                    onChange={(event) => onVatEnabledChange(event.target.checked)}
                    disabled={!canEdit || !canEditVat}
                  />
                }
                label="Apply VAT"
                sx={{ m: 0 }}
              />
              <TextField
                label="VAT %"
                type="number"
                value={vatRatePercent}
                onChange={(event) => onVatRatePercentChange(event.target.value)}
                disabled={!canEdit || !canEditVat || !vatEnabled}
                slotProps={{ htmlInput: { min: 0, step: 0.01 } }}
                sx={{ maxWidth: 180 }}
              />
              {canEdit && !canEditVat ? (
                <Typography variant="caption" color="text.secondary">
                  Bạn không có quyền thay đổi VAT của đơn hàng.
                </Typography>
              ) : null}
            </Stack>
          ) : null}

          <PaymentDetailRow label="Phí vận chuyển" value={formatCurrency(shippingFee)} />

          <Divider />

          <PaymentDetailRow label="Tổng cộng" value={formatCurrency(payableAmount)} highlight />

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'minmax(120px, 0.9fr) minmax(0, 1.1fr)' },
              gap: 1.5,
              alignItems: 'end',
            }}
          >
            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 700 }}>
              Khách đã trả
            </Typography>
            <TextField
              variant="standard"
              value={formattedPaidAmountValue}
              onChange={(event) => handlePaidAmountChange(event.target.value)}
              disabled={!canEdit}
              error={Boolean(errors.deposit_amount)}
              helperText={errors.deposit_amount}
              sx={{
                justifySelf: { sm: 'end' },
                width: `calc(${paidAmountInputWidth} + 56px)`,
                minWidth: 'calc(9ch + 56px)',
                maxWidth: '100%',
                '& input': {
                  textAlign: 'right',
                },
              }}
              slotProps={{
                input: {
                  endAdornment: <InputAdornment position="end">₫</InputAdornment>,
                },
              }}
            />
          </Box>

          <Divider />

          <Stack direction="row" spacing={1.5} sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              Còn lại
            </Typography>
            <Typography
              sx={{
                fontWeight: 800,
                color: remainingAmount > 0 ? '#d92d20' : '#027a48',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {formatCurrency(remainingAmount)}
            </Typography>
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
            <PaymentMethodMiniCard
              title="Tiền mặt"
              icon={<PaymentsOutlinedIcon fontSize="small" />}
              selected={selectedMethod === 'cod'}
              disabled={!canEdit}
              onClick={() => onPaymentMethodChange('cod')}
            />
            <PaymentMethodMiniCard
              title="Chuyển khoản"
              icon={<AccountBalanceOutlinedIcon fontSize="small" />}
              selected={selectedMethod === 'bank_transfer'}
              disabled={!canEdit}
              onClick={() => onPaymentMethodChange('bank_transfer')}
            />
          </Stack>
        </Stack>
      </Stack>
    </Paper>
  )
}

function PaymentMethodMiniCard({
  title,
  icon,
  selected,
  disabled,
  onClick,
}: {
  title: string
  icon: ReactNode
  selected: boolean
  disabled: boolean
  onClick: () => void
}): ReactElement {
  return (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      disabled={disabled}
      sx={{
        flex: 1,
        border: '1px solid',
        borderColor: selected ? '#0f766e' : '#d0d5dd',
        borderRadius: 3,
        bgcolor: selected ? alpha('#0f766e', 0.08) : '#fff',
        color: selected ? '#0f766e' : '#344054',
        px: 1.5,
        py: 1.4,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        transition: 'all 0.2s ease',
      }}
    >
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'center' }}>
        {icon}
        <Typography sx={{ fontWeight: 700 }}>{title}</Typography>
      </Stack>
    </Box>
  )
}

function PaymentDetailRow({
  label,
  value,
  highlight = false,
  emphasize = false,
}: {
  label: string
  value: string
  highlight?: boolean
  emphasize?: boolean
}): ReactElement {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: 'minmax(120px, 0.9fr) minmax(0, 1.1fr)' },
        gap: 1,
        alignItems: 'start',
      }}
    >
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography
        sx={{
          justifySelf: { sm: 'end' },
          textAlign: { sm: 'right' },
          color: emphasize ? '#d92d20' : highlight ? '#0f172a' : '#344054',
          fontWeight: emphasize || highlight ? 700 : 500,
          lineHeight: 1.45,
        }}
      >
        {value}
      </Typography>
    </Box>
  )
}
