import type { ReactNode } from 'react'
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined'
import {
  Box,
  InputAdornment,
  MenuItem,
  OutlinedInput,
  Stack,
  TextField,
} from '@mui/material'
import type { ListFilterConfig } from '@/shared/ui/list/common-list.types'

type ListToolbarProps = {
  searchValue?: string
  searchPlaceholder?: string
  onSearchChange?: (value: string) => void
  filters?: ListFilterConfig[]
  filterValues?: Record<string, string>
  onFilterChange?: (key: string, value: string) => void
  actions?: ReactNode
}

export function ListToolbar({
  searchValue = '',
  searchPlaceholder = 'Tìm kiếm',
  onSearchChange,
  filters = [],
  filterValues = {},
  onFilterChange,
  actions,
}: ListToolbarProps) {
  const hasToolbar = onSearchChange || filters.length > 0 || actions

  if (!hasToolbar) {
    return null
  }

  return (
    <Stack
      direction={{ xs: 'column', xl: 'row' }}
      spacing={2}
      sx={{ alignItems: { xs: 'stretch', xl: 'center' }, justifyContent: 'space-between' }}
    >
      <Stack
        direction={{ xs: 'column', xl: 'row' }}
        spacing={1.5}
        sx={{ flex: 1, alignItems: { xs: 'stretch', xl: 'center' } }}
      >
        {onSearchChange ? (
          <Box sx={{ flex: 1 }}>
            <OutlinedInput
              value={searchValue}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder={searchPlaceholder}
              startAdornment={
                <InputAdornment position="start">
                  <SearchOutlinedIcon fontSize="small" />
                </InputAdornment>
              }
              fullWidth
              sx={{
                height: 40,
                bgcolor: 'common.white',
                '& .MuiOutlinedInput-input': {
                  py: 1,
                },
              }}
            />
          </Box>
        ) : null}

        {filters.length > 0 ? (
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ flexShrink: 0 }}>
            {filters.map((filter) => (
              <TextField
                key={filter.key}
                select
                size="small"
                label={filter.label}
                value={filterValues[filter.key] ?? ''}
                onChange={(event) => onFilterChange?.(filter.key, event.target.value)}
                sx={{
                  minWidth: filter.minWidth ?? 180,
                  bgcolor: 'common.white',
                  '& .MuiOutlinedInput-root': {
                    height: 40,
                  },
                }}
              >
                {filter.placeholder ? <MenuItem value="">{filter.placeholder}</MenuItem> : null}
                {filter.options.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>
            ))}
          </Stack>
        ) : null}
      </Stack>

      {actions ? <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>{actions}</Stack> : null}
    </Stack>
  )
}
