import type { ComponentProps, ReactElement, ReactNode } from 'react'
import { FormHelperText, FormLabel, OutlinedInput } from '@mui/material'
import { FormGrid } from '@/shared/ui/form/form-grid'

export type StackedTextFieldProps = Omit<ComponentProps<typeof OutlinedInput>, 'label'> & {
  label?: ReactNode
  labelFor?: string
  helperText?: ReactNode
  error?: boolean
  sx?: ComponentProps<typeof FormGrid>['sx']
  inputSx?: ComponentProps<typeof OutlinedInput>['sx']
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
  ...props
}: StackedTextFieldProps): ReactElement {
  const resolvedId = id ?? labelFor

  return (
    <FormGrid sx={{
      ...sx,
      gap: 1,
    }}>
      {label ? <FormLabel htmlFor={labelFor ?? resolvedId} required={required}>{label}</FormLabel> : null}
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
