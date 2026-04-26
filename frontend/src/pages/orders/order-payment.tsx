import type { ReactElement, ReactNode } from 'react'
import AccountBalanceOutlinedIcon from '@mui/icons-material/AccountBalanceOutlined'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined'
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined'
import SellOutlinedIcon from '@mui/icons-material/SellOutlined'
import {
  alpha,
  Box,
  Divider,
  InputAdornment,
  Paper,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import { borderedCardSx } from '@/shared/ui/paper'
import { StackedTextField } from '@/shared/ui/form/stacked-text-field'
import { SummaryPaperHeader } from '@/shared/ui/summary-paper-header'
import { formatCurrency } from './order.utils'

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
  cod: 'COD',
  pay_later: 'Thanh toán sau',
  deposit: 'Đặt cọc',
  bank_transfer: 'Chuyển khoản',
}

export const PAYMENT_FIELD_LABELS = {
  method: 'Phương thức thanh toán:',
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
  method: PaymentMethod,
  currentStatus: 'unpaid' | 'paid' | 'deposit',
): 'unpaid' | 'paid' | 'deposit' => {
  if (method === 'unpaid') {
    return 'unpaid'
  }

  if (method === 'deposit') {
    return 'deposit'
  }

  if (currentStatus === 'deposit') {
    return 'unpaid'
  }

  return currentStatus
}

export const getNormalizedDepositAmount = ({
  paymentMethod,
  depositInputMode,
  depositPercent,
  depositAmount,
  totalAmount,
}: {
  paymentMethod: PaymentMethod
  depositInputMode: DepositInputMode
  depositPercent: string
  depositAmount: string | number
  totalAmount: number
}): number => {
  const normalizedDepositPercent = Number(depositPercent || 0)

  if (paymentMethod !== 'deposit') {
    return 0
  }

  if (depositInputMode === 'percent') {
    return Number(((totalAmount * normalizedDepositPercent) / 100).toFixed(2))
  }

  return Number(depositAmount || 0)
}

export const getNormalizedPaidAmount = ({
  paymentStatus,
  paymentMethod,
  totalAmount,
  depositAmount,
}: {
  paymentStatus: 'unpaid' | 'paid' | 'deposit'
  paymentMethod: PaymentMethod
  totalAmount: number
  depositAmount: number
}): number => {
  if (paymentStatus === 'paid') {
    return totalAmount
  }

  if (paymentMethod === 'deposit') {
    return depositAmount
  }

  return 0
}

export const getPaymentValidationErrors = ({
  paymentMethod,
  paymentStatus,
  paymentDueDate,
  depositInputMode,
  depositPercent,
  normalizedDepositAmount,
  totalAmount,
  bankName,
  bankAccountNumber,
  bankAccountHolder,
  processingStatus,
}: {
  paymentMethod: PaymentMethod
  paymentStatus: 'unpaid' | 'paid' | 'deposit'
  paymentDueDate: string
  depositInputMode: DepositInputMode
  depositPercent: string
  normalizedDepositAmount: number
  totalAmount: number
  bankName: string
  bankAccountNumber: string
  bankAccountHolder: string
  processingStatus?: string
}): Record<string, string> => {
  const nextErrors: Record<string, string> = {}
  const normalizedDepositPercent = Number(depositPercent || 0)

  if (paymentMethod === 'pay_later' && !paymentDueDate.trim()) {
    nextErrors.payment_due_date = 'Phương thức thanh toán sau cần có hạn thanh toán.'
  }

  if (paymentMethod === 'deposit' && depositInputMode === 'percent' && normalizedDepositPercent > 100) {
    nextErrors.deposit_percent = 'Tỷ lệ đặt cọc không được vượt quá 100%.'
  }

  if (paymentMethod === 'deposit' && depositInputMode === 'percent' && normalizedDepositPercent <= 0) {
    nextErrors.deposit_percent = 'Vui long nhap ty le dat coc lon hon 0%.'
  }

  if (paymentMethod === 'deposit' && normalizedDepositAmount <= 0) {
    nextErrors.deposit_amount = 'Vui long nhap so tien coc lon hon 0.'
  }

  if (paymentMethod === 'deposit' && normalizedDepositAmount > totalAmount) {
    nextErrors.deposit_amount = 'Tien coc khong duoc lon hon tong don hang.'
  }

  if (paymentMethod === 'bank_transfer' && !bankName.trim()) {
    nextErrors.bank_name = 'Vui long nhap ten ngan hang.'
  }

  if (paymentMethod === 'bank_transfer' && !bankAccountNumber.trim()) {
    nextErrors.bank_account_number = 'Vui long nhap so tai khoan.'
  }

  if (paymentMethod === 'bank_transfer' && !bankAccountHolder.trim()) {
    nextErrors.bank_account_holder = 'Vui long nhap ten chu tai khoan.'
  }

  if (paymentStatus === 'unpaid' && processingStatus === 'completed') {
    nextErrors.processing_status = 'Don chua thanh toan khong the danh dau hoan thanh.'
  }

  if (paymentStatus === 'deposit' && processingStatus === 'completed') {
    nextErrors.processing_status = 'Don dat coc chua the hoan thanh khi van con cong no.'
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

  lines.push(`${PAYMENT_FIELD_LABELS.method} ${PAYMENT_METHOD_LABELS[method]}`)

  if (method === 'unpaid') {
    lines.push('Ghi chu thanh toan: Chua xac dinh phuong thuc, se bo sung sau')
  }

  if (method === 'cod') {
    lines.push('Ghi chu COD: Thanh toan khi nhan hang')
  }

  if (method === 'pay_later' && dueDate) {
    lines.push(`${PAYMENT_FIELD_LABELS.dueDate} ${dueDate}`)
  }

  if (method === 'deposit') {
    lines.push(`${PAYMENT_FIELD_LABELS.depositMode} ${depositMode === 'percent' ? 'Theo %' : 'So tien co dinh'}`)

    if (depositMode === 'percent' && depositPercent.trim()) {
      lines.push(`${PAYMENT_FIELD_LABELS.depositPercent} ${depositPercent.trim()}%`)
    }

    lines.push(`So tien dat coc: ${formatCurrency(depositAmount)}`)
  }

  if (method === 'bank_transfer') {
    if (bankName.trim()) {
      lines.push(`${PAYMENT_FIELD_LABELS.bankName} ${bankName.trim()}`)
    }

    if (accountNumber.trim()) {
      lines.push(`${PAYMENT_FIELD_LABELS.accountNumber} ${accountNumber.trim()}`)
    }

    if (accountHolder.trim()) {
      lines.push(`${PAYMENT_FIELD_LABELS.accountHolder} ${accountHolder.trim()}`)
    }

    if (transferReference.trim()) {
      lines.push(`${PAYMENT_FIELD_LABELS.transferReference} ${transferReference.trim()}`)
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
      if (line.startsWith(PAYMENT_FIELD_LABELS.method)) {
        const methodLabel = line.slice(PAYMENT_FIELD_LABELS.method.length).trim()
        parsed.method =
          (Object.entries(PAYMENT_METHOD_LABELS).find(([, label]) => label === methodLabel)?.[0] as PaymentMethod | undefined) ??
          parsed.method
        return
      }

      if (line.startsWith(PAYMENT_FIELD_LABELS.dueDate)) {
        parsed.dueDate = line.slice(PAYMENT_FIELD_LABELS.dueDate.length).trim()
        return
      }

      if (line.startsWith(PAYMENT_FIELD_LABELS.depositMode)) {
        parsed.depositMode = line.includes('Theo %') ? 'percent' : 'amount'
        return
      }

      if (line.startsWith(PAYMENT_FIELD_LABELS.depositPercent)) {
        parsed.depositPercent = line
          .slice(PAYMENT_FIELD_LABELS.depositPercent.length)
          .replace('%', '')
          .trim()
        return
      }

      if (line.startsWith(PAYMENT_FIELD_LABELS.bankName)) {
        parsed.bankName = line.slice(PAYMENT_FIELD_LABELS.bankName.length).trim()
        return
      }

      if (line.startsWith(PAYMENT_FIELD_LABELS.accountNumber)) {
        parsed.accountNumber = line.slice(PAYMENT_FIELD_LABELS.accountNumber.length).trim()
        return
      }

      if (line.startsWith(PAYMENT_FIELD_LABELS.accountHolder)) {
        parsed.accountHolder = line.slice(PAYMENT_FIELD_LABELS.accountHolder.length).trim()
        return
      }

      if (line.startsWith(PAYMENT_FIELD_LABELS.transferReference)) {
        parsed.transferReference = line.slice(PAYMENT_FIELD_LABELS.transferReference.length).trim()
        return
      }

      if (line.startsWith('Ghi chu COD:') || line.startsWith('So tien dat coc:')) {
        return
      }

      noteLines.push(line)
    })

  parsed.note = noteLines.join('\n').trim()
  return parsed
}

const getPaymentMethodIcon = (method: PaymentMethod): ReactElement => {
  switch (method) {
    case 'unpaid':
      return <CloseRoundedIcon fontSize="small" />
    case 'cod':
      return <LocalShippingOutlinedIcon fontSize="small" />
    case 'pay_later':
      return <ScheduleOutlinedIcon fontSize="small" />
    case 'deposit':
      return <SellOutlinedIcon fontSize="small" />
    case 'bank_transfer':
      return <AccountBalanceOutlinedIcon fontSize="small" />
  }
}

type PaymentInformationCardProps = {
  title?: string
  headerAction?: ReactNode
  canEdit: boolean
  paymentMethod: PaymentMethod
  paymentStatus: 'unpaid' | 'paid' | 'deposit'
  paymentNotes: string
  paymentDueDate: string
  depositInputMode: DepositInputMode
  depositPercent: string
  bankName: string
  bankAccountNumber: string
  bankAccountHolder: string
  transferReference: string
  taxAmount: string
  subTotal: number
  totalAmount: number
  paidAmount: number
  remainingAmount: number
  depositAmount: number
  errors: Record<string, string>
  onPaymentMethodChange: (method: PaymentMethod) => void
  onTaxAmountChange: (value: string) => void
  onPaymentNotesChange: (value: string) => void
  onPaymentDueDateChange: (value: string) => void
  onDepositInputModeChange: (mode: DepositInputMode) => void
  onDepositPercentChange: (value: string) => void
  onDepositAmountChange: (value: string) => void
  onBankNameChange: (value: string) => void
  onBankAccountNumberChange: (value: string) => void
  onBankAccountHolderChange: (value: string) => void
  onTransferReferenceChange: (value: string) => void
}

export function PaymentInformationCard({
  title = 'Thanh toán',
  headerAction,
  canEdit,
  paymentMethod,
  paymentNotes,
  paymentDueDate,
  depositInputMode,
  depositPercent,
  bankName,
  bankAccountNumber,
  bankAccountHolder,
  transferReference,
  taxAmount,
  subTotal,
  totalAmount,
  paidAmount,
  depositAmount,
  errors,
  onPaymentMethodChange,
  onTaxAmountChange,
  onPaymentNotesChange,
  onPaymentDueDateChange,
  onDepositInputModeChange,
  onDepositPercentChange,
  onDepositAmountChange,
  onBankNameChange,
  onBankAccountNumberChange,
  onBankAccountHolderChange,
  onTransferReferenceChange,
}: PaymentInformationCardProps): ReactElement {
  const methodOptions: PaymentMethod[] = ['unpaid', 'cod', 'pay_later', 'deposit', 'bank_transfer']

  return (
    <Paper sx={borderedCardSx}>
      <Stack spacing={2.5}>
        {headerAction ? (
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ justifyContent: 'space-between', alignItems: { md: 'center' } }}>
            <SummaryPaperHeader title={title} />
            {headerAction}
          </Stack>
        ) : (
          <SummaryPaperHeader title={title} />
        )}

        <Stack spacing={2.5}>
          <Stack spacing={1.25}>
            <Typography sx={{ fontWeight: 700, color: '#0f172a' }}>Phuong thuc thanh toan</Typography>
            <Box
              sx={{
                display: 'flex',
                gap: 1,
                flexWrap: 'wrap',
                justifyContent: 'space-evenly',
                opacity: canEdit ? 1 : 0.7,
                pointerEvents: canEdit ? 'auto' : 'none',
              }}
            >
              {methodOptions.map((option) => {
                const selected = option === paymentMethod

                return (
                  <Box
                    key={option}
                    role="button"
                    tabIndex={0}
                    onClick={() => onPaymentMethodChange(option)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        onPaymentMethodChange(option)
                      }
                    }}
                    sx={{
                      borderRadius: 3,
                      border: '1px solid',
                      borderColor: selected ? '#0f766e' : alpha('#0f172a', 0.12),
                      bgcolor: selected ? alpha('#0f766e', 0.08) : 'background.paper',
                      px: 1.5,
                      py: 1,
                      cursor: 'pointer',
                      transition: 'all 120ms ease',
                      minWidth: 'fit-content',
                      flex: { xs: '1 1 calc(50% - 8px)', sm: '1 1 0' },
                    }}
                  >
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                      <Box
                        sx={{
                          width: 30,
                          height: 30,
                          borderRadius: 2,
                          display: 'grid',
                          placeItems: 'center',
                          bgcolor: selected ? '#fff' : alpha('#0f172a', 0.04),
                          color: selected ? '#0f766e' : '#344054',
                        }}
                      >
                        {getPaymentMethodIcon(option)}
                      </Box>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 700, color: '#0f172a' }}>{PAYMENT_METHOD_LABELS[option]}</Typography>
                      </Box>
                    </Stack>
                  </Box>
                )
              })}
            </Box>
          </Stack>

          <Stack spacing={2}>
            <Typography sx={{ fontWeight: 700, color: '#0f172a' }}>Payment Details</Typography>
            <PaymentDetailRow label="Payment method" value={PAYMENT_METHOD_LABELS[paymentMethod]} highlight />
            <StackedTextField
              fullWidth
              label="Tax"
              value={taxAmount}
              onChange={(event) => onTaxAmountChange(event.target.value)}
              endAdornment={<InputAdornment position="end">d</InputAdornment>}
              disabled={!canEdit}
            />
          </Stack>

          {paymentMethod === 'unpaid' ? (
            <Box
              sx={{
                borderRadius: 3,
                bgcolor: alpha('#0f766e', 0.05),
                border: (theme) => `1px solid ${alpha(theme.palette.divider, 0.9)}`,
                p: 2,
              }}
            >
              <Typography sx={{ fontWeight: 700, color: '#0f172a' }}>Chua thanh toan</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Giu don o trang thai chua thanh toan va bo sung phuong thuc sau trong buoc xu ly don hang.
              </Typography>
            </Box>
          ) : null}

          {paymentMethod === 'cod' ? (
            <Box
              sx={{
                borderRadius: 3,
                bgcolor: alpha('#0f766e', 0.05),
                border: (theme) => `1px solid ${alpha(theme.palette.divider, 0.9)}`,
                p: 2,
              }}
            >
              <Typography sx={{ fontWeight: 700, color: '#0f172a' }}>COD</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Minimal inputs. He thong se ghi nhan thanh toan khi giao hang thanh cong.
              </Typography>
            </Box>
          ) : null}

          {paymentMethod === 'pay_later' ? (
            <Stack spacing={2}>
              <Typography sx={{ fontWeight: 700, color: '#0f172a' }}>Pay Later</Typography>
              <StackedTextField
                fullWidth
                type="date"
                label="Due date"
                value={paymentDueDate}
                onChange={(event) => onPaymentDueDateChange(event.target.value)}
                error={Boolean(errors.payment_due_date)}
                helperText={errors.payment_due_date}
                disabled={!canEdit}
              />
              <StackedTextField
                fullWidth
                multiline
                minRows={3}
                label="Notes"
                value={paymentNotes}
                onChange={(event) => onPaymentNotesChange(event.target.value)}
                disabled={!canEdit}
              />
            </Stack>
          ) : null}

          {paymentMethod === 'deposit' ? (
            <Stack spacing={2}>
              <Typography sx={{ fontWeight: 700, color: '#0f172a' }}>Deposit</Typography>
              <Box>
                <Typography variant="body2" sx={{ mb: 1, color: '#344054', fontWeight: 500 }}>
                  Deposit input mode
                </Typography>
                <ToggleButtonGroup
                  value={depositInputMode}
                  exclusive
                  onChange={(_, value: DepositInputMode | null) => {
                    if (value) {
                      onDepositInputModeChange(value)
                    }
                  }}
                  disabled={!canEdit}
                  size="small"
                  sx={{ flexWrap: 'wrap', gap: 1 }}
                >
                  <ToggleButton value="percent">% of total</ToggleButton>
                  <ToggleButton value="amount">Fixed amount</ToggleButton>
                </ToggleButtonGroup>
              </Box>

              {depositInputMode === 'percent' ? (
                <StackedTextField
                  fullWidth
                  label="Deposit percentage"
                  value={depositPercent}
                  onChange={(event) => onDepositPercentChange(event.target.value)}
                  error={Boolean(errors.deposit_percent)}
                  helperText={errors.deposit_percent}
                  endAdornment={<InputAdornment position="end">%</InputAdornment>}
                  disabled={!canEdit}
                />
              ) : (
                <StackedTextField
                  fullWidth
                  label="Deposit amount"
                  value={String(Number.isFinite(depositAmount) ? depositAmount : 0)}
                  onChange={(event) => onDepositAmountChange(event.target.value)}
                  error={Boolean(errors.deposit_amount)}
                  helperText={errors.deposit_amount}
                  endAdornment={<InputAdornment position="end">d</InputAdornment>}
                  disabled={!canEdit}
                />
              )}

              {depositInputMode === 'percent' && errors.deposit_amount ? (
                <Typography color="error">{errors.deposit_amount}</Typography>
              ) : null}
            </Stack>
          ) : null}

          {paymentMethod === 'bank_transfer' ? (
            <Stack spacing={2}>
              <Typography sx={{ fontWeight: 700, color: '#0f172a' }}>Bank Transfer</Typography>
              <StackedTextField
                fullWidth
                label="Bank name"
                value={bankName}
                onChange={(event) => onBankNameChange(event.target.value)}
                error={Boolean(errors.bank_name)}
                helperText={errors.bank_name}
                disabled={!canEdit}
              />
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                <StackedTextField
                  fullWidth
                  label="Account number"
                  value={bankAccountNumber}
                  onChange={(event) => onBankAccountNumberChange(event.target.value)}
                  error={Boolean(errors.bank_account_number)}
                  helperText={errors.bank_account_number}
                  disabled={!canEdit}
                />
                <StackedTextField
                  fullWidth
                  label="Account holder"
                  value={bankAccountHolder}
                  onChange={(event) => onBankAccountHolderChange(event.target.value)}
                  error={Boolean(errors.bank_account_holder)}
                  helperText={errors.bank_account_holder}
                  disabled={!canEdit}
                />
              </Stack>
              <StackedTextField
                fullWidth
                multiline
                minRows={2}
                label="Transfer note/reference"
                value={transferReference}
                onChange={(event) => onTransferReferenceChange(event.target.value)}
                disabled={!canEdit}
              />
            </Stack>
          ) : null}

          {paymentMethod === 'cod' || paymentMethod === 'deposit' || paymentMethod === 'bank_transfer' ? (
            <StackedTextField
              fullWidth
              multiline
              minRows={3}
              label="Payment note"
              value={paymentNotes}
              onChange={(event) => onPaymentNotesChange(event.target.value)}
              disabled={!canEdit}
            />
          ) : null}

            <Stack spacing={1.25}>
              <Typography sx={{ fontWeight: 700, color: '#0f172a' }}>Tổng đơn hàng</Typography>
              <PaymentDetailRow label="Tổng giá trị sản phẩm" value={formatCurrency(totalAmount)} />
              <PaymentDetailRow label="Đã thanh toán" value={formatCurrency(paidAmount)} />
              <Divider />
              <PaymentDetailRow label="Tạm tính" value={formatCurrency(subTotal)} highlight/>
            </Stack>
        </Stack>
      </Stack>
    </Paper>
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
