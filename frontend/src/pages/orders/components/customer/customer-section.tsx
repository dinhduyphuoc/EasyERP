import PersonAddAlt1OutlinedIcon from '@mui/icons-material/PersonAddAlt1Outlined'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import { alpha, Autocomplete, Avatar, Box, Button, IconButton, Stack, TextField, Typography } from '@mui/material'
import { SummaryPaperHeader } from '@/shared/ui/summary-paper-header'
import type { OrderOptionLookup } from '../../api/order.api'
import { formatCurrency } from '../../lib/order.utils'

export type CustomerAutocompleteOption =
  | {
      kind: 'create'
      id: 'create'
    }
  | {
      kind: 'customer'
      customer: OrderOptionLookup['customers'][number]
    }

type CustomerSectionProps = {
  hasSelectedCustomer: boolean
  customerName: string
  customerPhone: string
  customerCode: string
  customerAddress: string
  customerSearch: string
  customerSearchOptions: CustomerAutocompleteOption[]
  outstandingAmount: number
  isLoading: boolean
  customerNameError?: string
  customerPhoneError?: string
  onCustomerSearchChange: (value: string) => void
  onCreateCustomer: () => void
  onEditCustomer: () => void
  onClearCustomer: () => void
  onSelectCustomer: (customer: OrderOptionLookup['customers'][number] | null) => void
}

export function CustomerSection({
  hasSelectedCustomer,
  customerName,
  customerPhone,
  customerCode,
  customerAddress,
  customerSearch,
  customerSearchOptions,
  outstandingAmount,
  isLoading,
  customerNameError,
  customerPhoneError,
  onCustomerSearchChange,
  onCreateCustomer,
  onEditCustomer,
  onClearCustomer,
  onSelectCustomer,
}: CustomerSectionProps) {
  const visibleOptions = isLoading ? [] : customerSearchOptions
  const customerLookupError = customerNameError || customerPhoneError

  return (
    <Stack spacing={3}>
      <SummaryPaperHeader title="Thông tin khách hàng" />

      {hasSelectedCustomer ? (
        <Stack
          direction="row"
          spacing={1.5}
          sx={{
            alignItems: 'flex-start',
            p: 2,
            borderRadius: 1,
            border: (theme) => `1px solid ${alpha(theme.palette.divider, 0.3)}`,
            backgroundColor: 'background.paper',
          }}
        >
          <Avatar sx={{ width: 48, height: 48, bgcolor: 'rgba(15, 118, 110, 0.12)', color: 'primary.main' }}>
            {(customerName || 'K')
              .split(' ')
              .filter(Boolean)
              .slice(0, 2)
              .map((word) => word[0]?.toUpperCase())
              .join('')}
          </Avatar>

          <Stack spacing={1.25} sx={{ flex: 1, minWidth: 0 }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ justifyContent: 'space-between', alignItems: { sm: 'flex-start' } }}>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontWeight: 800, color: '#0f172a' }}>{customerName || 'Khách hàng'}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
                  {customerPhone || 'Chưa có số điện thoại'}
                  {customerCode ? ` • ${customerCode}` : ''}
                </Typography>
              </Box>

              <Box sx={{ flexShrink: 0 }}>
                <Typography variant="body2" color="text.secondary">
                  Công nợ
                </Typography>
                <Typography sx={{ fontWeight: 800, color: outstandingAmount > 0 ? '#d92d20' : '#0f172a' }}>
                  {formatCurrency(outstandingAmount)}
                </Typography>
              </Box>
            </Stack>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ justifyContent: 'space-between' }}>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Địa chỉ giao hàng
                </Typography>
                <Typography sx={{ color: customerAddress ? '#0f172a' : '#98a2b3', mt: 0.35 }}>
                  {customerAddress || 'Chưa có địa chỉ giao hàng'}
                </Typography>
              </Box>

              <Button
                variant="text"
                startIcon={<EditOutlinedIcon />}
                sx={{ alignSelf: { xs: 'flex-start', sm: 'center' }, px: 0, minWidth: 0 }}
                onClick={onEditCustomer}
              >
                Chỉnh sửa
              </Button>
            </Stack>
          </Stack>

          <IconButton size="small" aria-label="Xóa khách hàng đã chọn" onClick={onClearCustomer}>
            <CloseRoundedIcon fontSize="small" />
          </IconButton>
        </Stack>
      ) : (
        <Autocomplete<CustomerAutocompleteOption, false, false, false>
          options={visibleOptions}
          value={null}
          inputValue={customerSearch}
          loading={isLoading}
          loadingText="Đang cập nhật khách hàng..."
          filterOptions={(availableOptions) => availableOptions}
          getOptionLabel={(option) =>
            option.kind === 'create'
              ? 'Tạo khách hàng'
              : `${option.customer.full_name} - ${option.customer.client_code} - ${option.customer.phone}`
          }
          isOptionEqualToValue={(option, value) =>
            option.kind === 'create' && value.kind === 'create'
              ? true
              : option.kind === 'customer' && value.kind === 'customer'
                ? option.customer.id === value.customer.id
                : false
          }
          onInputChange={(_, value) => onCustomerSearchChange(value)}
          onChange={(_, value) => {
            if (!value) {
              return
            }

            if (value.kind === 'create') {
              onCreateCustomer()
              return
            }

            onSelectCustomer(value.customer)
          }}
          renderOption={(props, option) => {
            const { key, ...optionProps } = props

            if (option.kind === 'create') {
              return (
                <Box key={key} component="li" {...optionProps}>
                  <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center', py: 0.25 }}>
                    <Box
                      sx={{
                        width: 32,
                        height: 32,
                        borderRadius: 2,
                        bgcolor: 'rgba(15, 118, 110, 0.10)',
                        color: 'primary.main',
                        display: 'grid',
                        placeItems: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <PersonAddAlt1OutlinedIcon fontSize="small" />
                    </Box>
                    <Typography sx={{ fontWeight: 700, color: '#0f172a' }}>Tạo khách hàng</Typography>
                  </Stack>
                </Box>
              )
            }

            return (
              <Box key={key} component="li" {...optionProps}>
                <Stack spacing={0.35} sx={{ py: 0.25 }}>
                  <Typography sx={{ fontWeight: 700, color: '#0f172a' }}>
                    {option.customer.full_name} - {option.customer.client_code}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {option.customer.phone}
                  </Typography>
                </Stack>
              </Box>
            )
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              placeholder="Tìm theo tên, mã khách hàng, số điện thoại"
              error={Boolean(customerLookupError)}
              helperText={customerLookupError}
            />
          )}
        />
      )}
    </Stack>
  )
}
