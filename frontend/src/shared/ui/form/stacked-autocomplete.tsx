import { type ComponentProps, type FocusEvent, type ReactElement, type ReactNode } from 'react'
import {
  Autocomplete,
  FormLabel,
  TextField,
  type AutocompleteChangeReason,
  type AutocompleteProps,
  type AutocompleteChangeDetails,
} from '@mui/material'
import { Label } from '@/shared/ui/form/form.constants'
import { useFieldValidation, type ValidationTrigger } from '@/shared/ui/form/field-validation'
import { FormGrid } from '@/shared/ui/form/form-grid'

const requiredLabelSx = {
  color: Label,
  '& .MuiFormLabel-asterisk': {
    color: '#d92d20',
  },
}

export type StackedAutocompleteProps<
  Value,
  Multiple extends boolean | undefined = false,
  DisableClearable extends boolean | undefined = false,
  FreeSolo extends boolean | undefined = false,
> = Omit<AutocompleteProps<Value, Multiple, DisableClearable, FreeSolo>, 'renderInput'> & {
  label?: ReactNode
  labelFor?: string
  helperText?: ReactNode
  error?: boolean
  submitError?: ReactNode
  required?: boolean
  sx?: ComponentProps<typeof FormGrid>['sx']
  textFieldSx?: ComponentProps<typeof TextField>['sx']
  layout?: 'stacked' | 'default'
  placeholder?: string
  validate?: (
    value: AutocompleteProps<Value, Multiple, DisableClearable, FreeSolo>['value'] | undefined,
  ) => string | undefined
  validateOnChange?: boolean
  validateOnBlur?: boolean
  validateWhen?: ValidationTrigger
}

export function StackedAutocomplete<
  Value,
  Multiple extends boolean | undefined = false,
  DisableClearable extends boolean | undefined = false,
  FreeSolo extends boolean | undefined = false,
>({
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
  layout = 'stacked',
  placeholder,
  textFieldSx,
  validate,
  validateOnChange = true,
  validateOnBlur = true,
  validateWhen,
  onChange,
  value,
  ...props
}: StackedAutocompleteProps<Value, Multiple, DisableClearable, FreeSolo>): ReactElement {
  const resolvedId = id ?? labelFor
  const resolvedLabel = typeof label === 'string' ? label : undefined
  const resolvedValidationTrigger =
    validateWhen ?? (validateOnChange && validateOnBlur ? 'change-or-blur' : validateOnBlur ? 'blur' : 'change')
  const {
    effectiveError: liveEffectiveError,
    effectiveHelperText: liveEffectiveHelperText,
    handleBlurValidation,
    handleChangeValidation,
  } = useFieldValidation({
    value,
    validate,
    validateWhen: resolvedValidationTrigger,
    submitError,
  })

  const handleChange = (
    event: React.SyntheticEvent,
    nextValue: AutocompleteProps<Value, Multiple, DisableClearable, FreeSolo>['value'],
    reason: AutocompleteChangeReason,
    details?: AutocompleteChangeDetails<Value>,
  ) => {
    handleChangeValidation(nextValue)
    ;(onChange as ((...args: unknown[]) => void) | undefined)?.(event, nextValue, reason, details)
  }

  const handleBlur = (_event: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    handleBlurValidation(value)
  }

  const hasManualError = Boolean(error)
  const effectiveError = hasManualError || liveEffectiveError
  const effectiveHelperText = hasManualError ? helperText : liveEffectiveHelperText ?? helperText

  if (layout === 'default') {
    return (
      <Autocomplete
        {...props}
        id={resolvedId}
        value={value}
        fullWidth={fullWidth}
        onChange={handleChange}
        renderInput={(params) => (
          <TextField
            {...params}
            id={resolvedId ?? params.id}
            label={resolvedLabel}
            placeholder={placeholder}
            error={effectiveError}
            helperText={effectiveHelperText}
            required={required}
            size={size}
            onBlur={handleBlur}
            sx={[
              {
                '& .MuiInputLabel-root': {
                  color: Label,
                },
                '& .MuiInputLabel-root.Mui-focused': {
                  color: Label,
                },
                '& .MuiInputLabel-root .MuiFormLabel-asterisk': {
                  color: '#d92d20',
                },
              },
              ...(Array.isArray(textFieldSx) ? textFieldSx : textFieldSx ? [textFieldSx] : []),
            ]}
          />
        )}
      />
    )
  }

  return (
    <FormGrid sx={{ ...sx, gap: 1 }}>
      {label ? (
        <FormLabel sx={requiredLabelSx} htmlFor={labelFor ?? resolvedId} required={required}>
          {label}
        </FormLabel>
      ) : null}
      <Autocomplete
        {...props}
        id={resolvedId}
        value={value}
        fullWidth={fullWidth}
        onChange={handleChange}
        renderInput={(params) => (
          <TextField
            {...params}
            id={resolvedId ?? params.id}
            placeholder={placeholder}
            error={effectiveError}
            helperText={effectiveHelperText}
            required={required}
            size={size}
            onBlur={handleBlur}
            sx={textFieldSx}
          />
        )}
      />
    </FormGrid>
  )
}
