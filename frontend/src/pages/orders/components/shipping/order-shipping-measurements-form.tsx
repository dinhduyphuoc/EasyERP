import type { ChangeEvent, ReactElement } from 'react'
import { Button, MenuItem, Stack, TextField, Typography } from '@mui/material'

const weightUnitOptions = [
  { value: 'g', label: 'g' },
  { value: 'kg', label: 'kg' },
] as const

export function OrderShippingMeasurementsForm({
  weight,
  weightUnit,
  length,
  width,
  height,
  dimensionUnit,
  isSaving,
  onWeightChange,
  onWeightUnitChange,
  onLengthChange,
  onWidthChange,
  onHeightChange,
  onSubmit,
}: {
  weight: string
  weightUnit: string
  length: string
  width: string
  height: string
  dimensionUnit: string
  isSaving: boolean
  onWeightChange: (value: string) => void
  onWeightUnitChange: (value: string) => void
  onLengthChange: (value: string) => void
  onWidthChange: (value: string) => void
  onHeightChange: (value: string) => void
  onSubmit: () => void
}): ReactElement {
  const handleNumberChange = (handler: (value: string) => void) => (event: ChangeEvent<HTMLInputElement>) => {
    handler(event.target.value)
  }

  return (
    <Stack
      spacing={1.25}
      sx={{
        p: 1.5,
        borderRadius: 1,
        border: '1px solid #e4e7ec',
        bgcolor: '#fcfcfd',
      }}
    >
      <Typography variant="body2" sx={{ fontWeight: 700, color: '#344054' }}>
        Khối lượng và kích thước
      </Typography>

      <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.5} sx={{ alignItems: { lg: 'flex-end' } }}>
        <Stack direction="row" spacing={1} sx={{ flex: 1, minWidth: 0 }}>
          <TextField
            label="Khối lượng"
            value={weight}
            onChange={handleNumberChange(onWeightChange)}
            size="small"
            type="number"
            fullWidth
            slotProps={{ htmlInput: { min: 0, step: 'any' } }}
          />
          <TextField
            select
            label="Đơn vị"
            value={weightUnit}
            onChange={(event) => onWeightUnitChange(event.target.value)}
            size="small"
            sx={{ width: 110 }}
          >
            {weightUnitOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
        </Stack>

        <Stack direction="row" spacing={1} sx={{ flex: 2, minWidth: 0 }}>
          <TextField
            label="Dài"
            value={length}
            onChange={handleNumberChange(onLengthChange)}
            size="small"
            type="number"
            fullWidth
            slotProps={{ htmlInput: { min: 0, step: 'any' } }}
          />
          <TextField
            label="Rộng"
            value={width}
            onChange={handleNumberChange(onWidthChange)}
            size="small"
            type="number"
            fullWidth
            slotProps={{ htmlInput: { min: 0, step: 'any' } }}
          />
          <TextField
            label="Cao"
            value={height}
            onChange={handleNumberChange(onHeightChange)}
            size="small"
            type="number"
            fullWidth
            slotProps={{ htmlInput: { min: 0, step: 'any' } }}
          />
            <Typography
              sx={{
                height: 40,
                px: 0.5,
                bgcolor: '#f8fafc',
                display: 'flex',
                alignItems: 'center',
                color: '#344054',
                fontWeight: 600,
              }}
            >
              {dimensionUnit}
            </Typography>
        </Stack>

        <Button variant="contained" color="secondary" onClick={onSubmit} disabled={isSaving}>
          {isSaving ? 'Đang cập nhật...' : 'Cập nhật'}
        </Button>
      </Stack>
    </Stack>
  )
}
