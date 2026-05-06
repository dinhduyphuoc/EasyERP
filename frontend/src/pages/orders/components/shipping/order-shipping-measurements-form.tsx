import type { ChangeEvent, ReactElement } from 'react'
import { Button, MenuItem, Stack, Typography } from '@mui/material'
import { StackedDropdown } from '@/shared/ui/form/stacked-dropdown'
import { StackedTextField } from '@/shared/ui/form/stacked-text-field'

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
        Khá»‘i lÆ°á»£ng vÃ  kÃ­ch thÆ°á»›c
      </Typography>

      <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.5} sx={{ alignItems: { lg: 'flex-end' } }}>
        <Stack direction="row" spacing={1} sx={{ flex: 1, minWidth: 0 }}>
          <StackedTextField
            layout="default"
            label="Khá»‘i lÆ°á»£ng"
            value={weight}
            onChange={handleNumberChange(onWeightChange)}
            type="number"
            fullWidth
            inputProps={{ min: 0, step: 'any' }}
          />
          <StackedDropdown
            layout="default"
            label="ÄÆ¡n vá»‹"
            value={weightUnit}
            onChange={(event) => onWeightUnitChange(String(event.target.value))}
            sx={{ width: 110 }}
          >
            {weightUnitOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </StackedDropdown>
        </Stack>

        <Stack direction="row" spacing={1} sx={{ flex: 2, minWidth: 0 }}>
          <StackedTextField
            layout="default"
            label="DÃ i"
            value={length}
            onChange={handleNumberChange(onLengthChange)}
            type="number"
            fullWidth
            inputProps={{ min: 0, step: 'any' }}
          />
          <StackedTextField
            layout="default"
            label="Rá»™ng"
            value={width}
            onChange={handleNumberChange(onWidthChange)}
            type="number"
            fullWidth
            inputProps={{ min: 0, step: 'any' }}
          />
          <StackedTextField
            layout="default"
            label="Cao"
            value={height}
            onChange={handleNumberChange(onHeightChange)}
            type="number"
            fullWidth
            inputProps={{ min: 0, step: 'any' }}
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
          {isSaving ? 'Äang cáº­p nháº­t...' : 'Cáº­p nháº­t'}
        </Button>
      </Stack>
    </Stack>
  )
}
