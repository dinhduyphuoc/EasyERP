import type { ReactElement } from 'react'
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  InputAdornment,
  MenuItem,
  Paper,
  TextField,
  Typography,
} from '@mui/material'
import { StackedTextField } from '@/shared/ui/form/stacked-text-field'
import { formatCurrency, formatCurrencyInput } from '../../lib/order.utils'
import { PAYMENT_COLLECTION_METHOD_LABELS, type PaymentCollectionMethod } from '../../lib/payment-display.helpers'

const parseCurrencyInput = (value: string): number => {
  const digits = value.replace(/\D/g, '')
  return Number(digits || '0')
}

export function PaymentEntryDialog({
  open,
  title,
  description,
  amountLabel,
  amountValue,
  amountEditable = false,
  noteLabel,
  notePlaceholder,
  noteValue,
  methodValue,
  remainingAmount,
  submitLabel,
  isSubmitting,
  onClose,
  onAmountChange,
  onMethodChange,
  onNoteChange,
  onSubmit,
}: {
  open: boolean
  title: string
  description: string
  amountLabel: string
  amountValue: string
  amountEditable?: boolean
  noteLabel: string
  notePlaceholder?: string
  noteValue: string
  methodValue: PaymentCollectionMethod
  remainingAmount: number
  submitLabel: string
  isSubmitting: boolean
  onClose: () => void
  onAmountChange?: (value: string) => void
  onMethodChange: (value: PaymentCollectionMethod) => void
  onNoteChange: (value: string) => void
  onSubmit: () => void
}): ReactElement {
  const enteredAmount = amountEditable ? parseCurrencyInput(amountValue) : 0
  const nextRemainingAmount = amountEditable ? Math.max(remainingAmount - enteredAmount, 0) : remainingAmount

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ pt: 1 }}>
          {description}
        </Typography>
        {amountEditable ? (
          <StackedTextField
            fullWidth
            label={amountLabel}
            value={formatCurrencyInput(amountValue, { zeroAsEmpty: true })}
            onChange={(event) => onAmountChange?.(formatCurrencyInput(event.target.value, { zeroAsEmpty: true }))}
            endAdornment={<InputAdornment position="end">₫</InputAdornment>}
            sx={{ mt: 2 }}
          />
        ) : (
          <Paper variant="outlined" sx={{ p: 1.5, mt: 2, bgcolor: '#f8fafc' }}>
            <Typography variant="body2" color="text.secondary">
              {amountLabel}
            </Typography>
            <Typography sx={{ mt: 0.8, fontWeight: 700, color: '#0f172a' }}>{amountValue}</Typography>
          </Paper>
        )}
        <TextField
          select
          fullWidth
          label="Phương thức thanh toán"
          value={methodValue}
          onChange={(event) => onMethodChange(event.target.value as PaymentCollectionMethod)}
          sx={{ mt: 2 }}
        >
          {Object.entries(PAYMENT_COLLECTION_METHOD_LABELS).map(([value, label]) => (
            <MenuItem key={value} value={value}>
              {label}
            </MenuItem>
          ))}
        </TextField>
        <StackedTextField
          fullWidth
          multiline
          minRows={3}
          label={noteLabel}
          value={noteValue}
          onChange={(event) => onNoteChange(event.target.value)}
          placeholder={notePlaceholder}
          sx={{ mt: 2 }}
        />
        <Paper variant="outlined" sx={{ p: 1.5, mt: 2, bgcolor: '#f8fafc' }}>
          <Typography variant="body2" color="text.secondary">
            Còn lại sau thanh toán
          </Typography>
          <Typography sx={{ mt: 0.8, fontWeight: 700, color: '#0f172a' }}>{formatCurrency(nextRemainingAmount)}</Typography>
        </Paper>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Đóng</Button>
        <Button variant="contained" onClick={onSubmit} disabled={isSubmitting}>
          {submitLabel}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

