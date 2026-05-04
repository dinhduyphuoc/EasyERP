import type { ComponentProps, ReactElement, ReactNode } from 'react'
import {
  FormControl,
  FormHelperText,
  FormLabel,
  InputLabel,
  OutlinedInput,
  Select,
} from '@mui/material'
import { STACKED_LABEL_COLOR } from '@/shared/ui/form/form.constants'
import { FormGrid } from '@/shared/ui/form/form-grid'

type SelectProps = ComponentProps<typeof Select>

export type StackedDropdownProps = Omit<SelectProps, 'label'> & {
  label?: ReactNode
  labelFor?: string
  helperText?: ReactNode
  error?: boolean
  sx?: ComponentProps<typeof FormGrid>['sx']
  layout?: 'stacked' | 'default'
}

export function StackedDropdown({
  label,
  labelFor,
  helperText,
  error,
  required,
  sx,
  id,
  fullWidth = true,
  size = 'small',
  children,
  layout = 'stacked',
  ...props
}: StackedDropdownProps): ReactElement {
  const resolvedId = id ?? labelFor
  const shouldShrinkLabel = layout === 'default' && Boolean(label) && (Boolean(props.displayEmpty) || props.value !== '' && props.value !== undefined && props.value !== null)

  if (layout === 'default') {
    return (
      <FormControl error={error} required={required} fullWidth={fullWidth} size={size} sx={sx}>
        {label ? <InputLabel id={`${resolvedId}-label`} shrink={shouldShrinkLabel} sx={{ color: STACKED_LABEL_COLOR }}>{label}</InputLabel> : null}
        <Select
          {...props}
          id={resolvedId}
          labelId={label ? `${resolvedId}-label` : undefined}
          label={typeof label === 'string' ? label : undefined}
          input={<OutlinedInput label={typeof label === 'string' ? label : undefined} />}
        >
          {children}
        </Select>
        {helperText ? <FormHelperText error={error}>{helperText}</FormHelperText> : null}
      </FormControl>
    )
  }

  return (
    <FormGrid
      sx={{
        ...sx,
        gap: 1,
      }}
    >
      {label ? <FormLabel sx={{ color: STACKED_LABEL_COLOR }} htmlFor={labelFor ?? resolvedId} required={required}>{label}</FormLabel> : null}
      <FormControl error={error} required={required} fullWidth={fullWidth} size={size}>
        <Select
          {...props}
          id={resolvedId}
          input={<OutlinedInput />}
        >
          {children}
        </Select>
        {helperText ? <FormHelperText error={error}>{helperText}</FormHelperText> : null}
      </FormControl>
    </FormGrid>
  )
}
