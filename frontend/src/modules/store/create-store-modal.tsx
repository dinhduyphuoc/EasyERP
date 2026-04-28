import { useState, type ReactElement } from 'react'
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
} from '@mui/material'
import { useStore } from '@/modules/store/use-store'
import { StackedDropdown } from '@/shared/ui/form/stacked-dropdown'
import { StackedTextField } from '@/shared/ui/form/stacked-text-field'

type CreateStoreModalProps = {
  open: boolean
  onClose: () => void
}

const currencies = ['USD', 'VND', 'EUR']
const timezones = ['Asia/Saigon', 'UTC', 'America/New_York']

export function CreateStoreModal({ open, onClose }: CreateStoreModalProps): ReactElement {
  const { createStore } = useStore()
  const [name, setName] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [timezone, setTimezone] = useState('Asia/Saigon')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!name.trim()) {
      return
    }

    setIsSubmitting(true)
    try {
      await createStore({
        name: name.trim(),
        currency,
        timezone,
      })
      setName('')
      onClose()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onClose={isSubmitting ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>Tạo cửa hàng</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <StackedTextField
            fullWidth
            label="Tên cửa hàng"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <StackedDropdown
            fullWidth
            label="Tiền tệ"
            value={currency}
            onChange={(event) => setCurrency(String(event.target.value))}
          >
            {currencies.map((item) => (
              <MenuItem key={item} value={item}>
                {item}
              </MenuItem>
            ))}
          </StackedDropdown>
          <StackedDropdown
            fullWidth
            label="Múi giờ"
            value={timezone}
            onChange={(event) => setTimezone(String(event.target.value))}
          >
            {timezones.map((item) => (
              <MenuItem key={item} value={item}>
                {item}
              </MenuItem>
            ))}
          </StackedDropdown>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={onClose} disabled={isSubmitting}>
          Hủy
        </Button>
        <Button variant="contained" onClick={() => void handleSubmit()} disabled={isSubmitting || !name.trim()}>
          {isSubmitting ? 'Đang tạo...' : 'Tạo cửa hàng'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
