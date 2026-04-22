import type { ComponentProps, ReactElement, ReactNode } from 'react'
import { FormControl, FormHelperText, FormLabel, TextField } from '@mui/material'

export type StackedTextFieldProps = Omit<ComponentProps<typeof TextField>, 'label'> & {
  label?: ReactNode
  labelFor?: string
}

export function StackedTextField({
  label,
  labelFor,
  helperText,
  error,
  required,
  sx,
  id,
  ...props
}: StackedTextFieldProps): ReactElement {
  const resolvedId = id ?? labelFor

  return (
    <FormControl error={error} required={required} fullWidth={props.fullWidth} sx={sx}>
      {label ? <FormLabel htmlFor={labelFor ?? resolvedId}>{label}</FormLabel> : null}
      <TextField {...props} id={resolvedId} error={error} required={required} helperText={undefined} />
      {helperText ? <FormHelperText>{helperText}</FormHelperText> : null}
    </FormControl>
  )
}
