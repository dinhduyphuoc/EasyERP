import { type ChangeEvent, type ComponentProps, type FocusEvent, type ReactElement, type ReactNode } from 'react'
import { FormControl, FormHelperText, FormLabel, InputLabel, OutlinedInput } from '@mui/material'
import { Label } from '@/shared/ui/form/form.constants'
import { useFieldValidation, type ValidationTrigger } from '@/shared/ui/form/field-validation'
import { FormGrid } from '@/shared/ui/form/form-grid'

export type StackedTextFieldProps = Omit<ComponentProps<typeof OutlinedInput>, 'label'> & {
  label?: ReactNode
  labelFor?: string
  helperText?: ReactNode
  error?: boolean
  submitError?: ReactNode
  sx?: ComponentProps<typeof FormGrid>['sx']
  inputSx?: ComponentProps<typeof OutlinedInput>['sx']
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

export function StackedTextField({
  label,
  labelFor,
  helperText,
  error,
  submitError,
  required,
  sx,
  inputSx,
  id,
  fullWidth = true,
  size = 'small',
  layout = 'stacked',
  validate,
  validateOnChange = true,
  validateOnBlur = true,
  validateWhen,
  onChange,
  onBlur,
  value,
  ...props
}: StackedTextFieldProps): ReactElement {
  const resolvedId = id ?? labelFor
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

  const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    handleChangeValidation(event.target.value)
    onChange?.(event)
  }

  const handleBlur = (event: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    handleBlurValidation(event.target.value)
    onBlur?.(event)
  }

  const hasManualError = Boolean(error)
  const effectiveError = hasManualError || liveEffectiveError
  const effectiveHelperText = hasManualError ? helperText : liveEffectiveHelperText ?? helperText

  if (layout === 'default') {
    return (
      <FormControl error={effectiveError} required={required} fullWidth={fullWidth} size={size} sx={sx}>
        {label ? <InputLabel htmlFor={labelFor ?? resolvedId} sx={requiredLabelSx}>{label}</InputLabel> : null}
        <OutlinedInput
          {...props}
          id={resolvedId}
          value={value}
          error={effectiveError}
          required={required}
          fullWidth={fullWidth}
          size={size}
          label={typeof label === 'string' ? label : undefined}
          onChange={handleChange}
          onBlur={handleBlur}
          sx={inputSx}
        />
        {effectiveHelperText ? <FormHelperText error={effectiveError}>{effectiveHelperText}</FormHelperText> : null}
      </FormControl>
    )
  }

  return (
    <FormGrid sx={{ ...sx, gap: 1 }}>
      {label ? <FormLabel sx={requiredLabelSx} htmlFor={labelFor ?? resolvedId} required={required}>{label}</FormLabel> : null}
      <OutlinedInput
        {...props}
        id={resolvedId}
        value={value}
        error={effectiveError}
        required={required}
        fullWidth={fullWidth}
        size={size}
        onChange={handleChange}
        onBlur={handleBlur}
        sx={inputSx}
      />
      {effectiveHelperText ? <FormHelperText error={effectiveError}>{effectiveHelperText}</FormHelperText> : null}
    </FormGrid>
  )
}
