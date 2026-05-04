import type { ComponentProps, ReactElement, ReactNode } from 'react'
import { FormControl, FormHelperText, FormLabel, InputLabel, OutlinedInput } from '@mui/material'
import { STACKED_LABEL_COLOR } from '@/shared/ui/form/form.constants'
import { FormGrid } from '@/shared/ui/form/form-grid'

export type StackedTextFieldProps = Omit<ComponentProps<typeof OutlinedInput>, 'label'> & {
  label?: ReactNode
  labelFor?: string
  helperText?: ReactNode
  error?: boolean
  sx?: ComponentProps<typeof FormGrid>['sx']
  inputSx?: ComponentProps<typeof OutlinedInput>['sx']
  layout?: 'stacked' | 'default'
}

export function StackedTextField({
  label,
  labelFor,
  helperText,
  error,
  required,
  sx,
  inputSx,
  id,
  fullWidth = true,
  size = 'small',
  layout = 'stacked',
  ...props
}: StackedTextFieldProps): ReactElement {
  const resolvedId = id ?? labelFor

  if (layout === 'default') {
    return (
      <FormControl error={error} required={required} fullWidth={fullWidth} size={size} sx={sx}>
        {label ? <InputLabel htmlFor={labelFor ?? resolvedId} sx={{ color: STACKED_LABEL_COLOR }}>{label}</InputLabel> : null}
        <OutlinedInput
          {...props}
          id={resolvedId}
          error={error}
          required={required}
          fullWidth={fullWidth}
          size={size}
          label={typeof label === 'string' ? label : undefined}
          sx={inputSx}
        />
        {helperText ? <FormHelperText error={error}>{helperText}</FormHelperText> : null}
      </FormControl>
    )
  }

  return (
    <FormGrid sx={{ ...sx, gap: 1 }}>
      {label ? <FormLabel sx={{ color: STACKED_LABEL_COLOR }} htmlFor={labelFor ?? resolvedId} required={required}>{label}</FormLabel> : null}
      <OutlinedInput
        {...props}
        id={resolvedId}
        error={error}
        required={required}
        fullWidth={fullWidth}
        size={size}
        sx={inputSx}
      />
      {helperText ? <FormHelperText error={error}>{helperText}</FormHelperText> : null}
    </FormGrid>
  )
}
