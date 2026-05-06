import type { ComponentProps, ReactElement, ReactNode } from 'react'
import {
  Autocomplete,
  FormLabel,
  TextField,
  type AutocompleteProps,
} from '@mui/material'
import { Label } from '@/shared/ui/form/form.constants'
import { FormGrid } from '@/shared/ui/form/form-grid'

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
  required?: boolean
  sx?: ComponentProps<typeof FormGrid>['sx']
  textFieldSx?: ComponentProps<typeof TextField>['sx']
  layout?: 'stacked' | 'default'
  placeholder?: string
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
  required,
  sx,
  id,
  fullWidth = true,
  size = 'small',
  layout = 'stacked',
  placeholder,
  textFieldSx,
  ...props
}: StackedAutocompleteProps<Value, Multiple, DisableClearable, FreeSolo>): ReactElement {
  const resolvedId = id ?? labelFor
  const resolvedLabel = typeof label === 'string' ? label : undefined

  if (layout === 'default') {
    return (
      <Autocomplete
        {...props}
        id={resolvedId}
        fullWidth={fullWidth}
        renderInput={(params) => (
          <TextField
            {...params}
            id={resolvedId ?? params.id}
            label={resolvedLabel}
            placeholder={placeholder}
            error={error}
            helperText={helperText}
            required={required}
            size={size}
            sx={[
              {
                '& .MuiInputLabel-root': {
                  color: Label,
                },
                '& .MuiInputLabel-root.Mui-focused': {
                  color: Label,
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
        <FormLabel sx={{ color: Label }} htmlFor={labelFor ?? resolvedId} required={required}>
          {label}
        </FormLabel>
      ) : null}
      <Autocomplete
        {...props}
        id={resolvedId}
        fullWidth={fullWidth}
        renderInput={(params) => (
          <TextField
            {...params}
            id={resolvedId ?? params.id}
            placeholder={placeholder}
            error={error}
            helperText={helperText}
            required={required}
            size={size}
            sx={textFieldSx}
          />
        )}
      />
    </FormGrid>
  )
}
