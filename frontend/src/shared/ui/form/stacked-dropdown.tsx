import { type ComponentProps, type ReactElement, type ReactNode } from 'react'
import {
  FormControl,
  FormHelperText,
  FormLabel,
  InputLabel,
  OutlinedInput,
  Select,
  type SelectChangeEvent,
} from '@mui/material'
import { Label } from '@/shared/ui/form/form.constants'
import { useFieldValidation, type ValidationTrigger } from '@/shared/ui/form/field-validation'
import { FormGrid } from '@/shared/ui/form/form-grid'

type SelectProps = ComponentProps<typeof Select>

export type StackedDropdownProps = Omit<SelectProps, 'label'> & {
  label?: ReactNode
  labelFor?: string
  helperText?: ReactNode
  error?: boolean
  submitError?: ReactNode
  sx?: ComponentProps<typeof FormGrid>['sx']
  layout?: 'stacked' | 'default'
  validate?: (value: string) => string | undefined
  validateOnChange?: boolean
  validateOnBlur?: boolean
  validateWhen?: ValidationTrigger
}

const toValidationValue = (value: unknown): string => {
  if (typeof value === 'string') {
    return value
  }

  if (typeof value === 'number') {
    return value.toString()
  }

  if (Array.isArray(value)) {
    return value.join(',')
  }

  return ''
}

const requiredLabelSx = {
  color: Label,
  '& .MuiFormLabel-asterisk': {
    color: '#d92d20',
  },
}

export function StackedDropdown({
  label,
  labelFor,
  helperText,
  error,
  submitError,
  required,
  sx,
  id,
  fullWidth = true,
  size = 'small',
  children,
  layout = 'stacked',
  validate,
  validateOnChange = true,
  validateOnBlur = true,
  validateWhen,
  onChange,
  onBlur,
  value,
  ...props
}: StackedDropdownProps): ReactElement {
  const resolvedId = id ?? labelFor
  const currentValue = value ?? ''
  const shouldShrinkLabel =
    layout === 'default' &&
    Boolean(label) &&
    (Boolean(props.displayEmpty) || (currentValue !== '' && currentValue !== undefined && currentValue !== null))
  const resolvedValidationTrigger =
    validateWhen ?? (validateOnChange && validateOnBlur ? 'change-or-blur' : validateOnBlur ? 'blur' : 'change')
  const {
    effectiveError: liveEffectiveError,
    effectiveHelperText: liveEffectiveHelperText,
    handleBlurValidation,
    handleChangeValidation,
  } = useFieldValidation({
    value: toValidationValue(value),
    validate,
    validateWhen: resolvedValidationTrigger,
    submitError,
  })

  const handleChange = (event: SelectChangeEvent<unknown>, child: ReactNode) => {
    handleChangeValidation(toValidationValue(event.target.value))
    onChange?.(event, child)
  }

  const handleBlur = (event: React.FocusEvent<HTMLElement>) => {
    handleBlurValidation(toValidationValue(value))
    onBlur?.(event as React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>)
  }

  const hasManualError = Boolean(error)
  const effectiveError = hasManualError || liveEffectiveError
  const effectiveHelperText = hasManualError ? helperText : liveEffectiveHelperText ?? helperText

  if (layout === 'default') {
    return (
      <FormControl error={effectiveError} required={required} fullWidth={fullWidth} size={size} sx={sx}>
        {label ? <InputLabel id={`${resolvedId}-label`} shrink={shouldShrinkLabel} sx={requiredLabelSx}>{label}</InputLabel> : null}
        <Select
          {...props}
          id={resolvedId}
          value={currentValue}
          labelId={label ? `${resolvedId}-label` : undefined}
          label={typeof label === 'string' ? label : undefined}
          input={<OutlinedInput label={typeof label === 'string' ? label : undefined} />}
          error={effectiveError}
          onChange={handleChange}
          onBlur={handleBlur}
        >
          {children}
        </Select>
        {effectiveHelperText ? <FormHelperText error={effectiveError}>{effectiveHelperText}</FormHelperText> : null}
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
      {label ? <FormLabel sx={requiredLabelSx} htmlFor={labelFor ?? resolvedId} required={required}>{label}</FormLabel> : null}
      <FormControl error={effectiveError} required={required} fullWidth={fullWidth} size={size}>
        <Select
          {...props}
          id={resolvedId}
          value={currentValue}
          input={<OutlinedInput />}
          error={effectiveError}
          onChange={handleChange}
          onBlur={handleBlur}
        >
          {children}
        </Select>
        {effectiveHelperText ? <FormHelperText error={effectiveError}>{effectiveHelperText}</FormHelperText> : null}
      </FormControl>
    </FormGrid>
  )
}
