import { Link as RouterLink } from 'react-router'
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined'
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined'
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined'
import {
  alpha,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  InputAdornment,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import { borderedCardSx } from '@/shared/ui/paper'
import { StackedTextField } from '@/shared/ui/form/stacked-text-field'
import { SummaryPaperHeader } from '@/shared/ui/summary-paper-header'
import type { OrderOptionLookup } from '../../api/order.api'
import type { ItemRow } from '../../hooks/use-order-items'
import { formatCurrency, formatCurrencyInput } from '../../lib/order.utils'

type ProductSearchOption = OrderOptionLookup['products'][number]

type ItemPatch = Partial<Pick<ItemRow, 'quantity' | 'unit_price' | 'notes' | 'noteOpen'>>

type ItemsSectionProps = {
  productSearchResetKey: number
  productOptions: ProductSearchOption[]
  productSearchInput: string
  isLoading: boolean
  orderItemsError?: string
  selectedItemCount: number
  areAllItemsSelected: boolean
  areSomeItemsSelected: boolean
  itemRows: ItemRow[]
  selectedItemIndexSet: Set<number>
  onProductSearchChange: (value: string, reason: string) => void
  onProductSelect: (value: ProductSearchOption | null) => void
  onBulkDeleteItems: () => void
  onToggleAllItems: (checked: boolean) => void
  onToggleItemSelection: (index: number) => void
  onUpdateItem: (index: number, patch: ItemPatch) => void
  formatStockNumber: (value: number | null | undefined) => string
}

export function ItemsSection({
  productSearchResetKey,
  productOptions,
  productSearchInput,
  isLoading,
  orderItemsError,
  selectedItemCount,
  areAllItemsSelected,
  areSomeItemsSelected,
  itemRows,
  selectedItemIndexSet,
  onProductSearchChange,
  onProductSelect,
  onBulkDeleteItems,
  onToggleAllItems,
  onToggleItemSelection,
  onUpdateItem,
  formatStockNumber,
}: ItemsSectionProps) {
  return (
    <Paper sx={borderedCardSx}>
      <Stack spacing={2}>
        <SummaryPaperHeader title="Sản phẩm" />

        <Autocomplete
          key={productSearchResetKey}
          options={productOptions}
          value={null}
          inputValue={productSearchInput}
          disabled={isLoading}
          getOptionLabel={(option) => option.label}
          isOptionEqualToValue={(option, value) => option.sku === value.sku}
          onInputChange={(_, value, reason) => onProductSearchChange(value, reason)}
          onChange={(_, value) => onProductSelect(value)}
          renderOption={(props, option) => (
            <Box component="li" {...props} key={option.sku}>
              <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', width: '100%' }}>
                <Box
                  component="img"
                  src={option.image_url ?? 'https://placehold.co/80x80?text=SP'}
                  alt={option.product_name}
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: 1.5,
                    objectFit: 'cover',
                    bgcolor: alpha('#132238', 0.06),
                    flexShrink: 0,
                  }}
                />
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography sx={{ fontWeight: 600 }} noWrap>
                    {option.product_name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" noWrap>
                    {option.sku}
                    {option.variant_kind === 'default' ? ' • Biến thể mặc định' : ''}
                    {' - '}
                    {formatCurrency(option.selling_price)}
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>
                    Có sẵn: {formatStockNumber(option.stock_available)}
                  </Typography>
                </Box>
              </Stack>
            </Box>
          )}
          renderInput={(params) => (
            <TextField
              {...params}
              placeholder="Tìm tên sản phẩm hoặc SKU để thêm vào đơn"
              slotProps={{
                ...params.slotProps,
                input: {
                  ...params.slotProps.input,
                  startAdornment: (
                    <>
                      <InputAdornment position="start">
                        <SearchOutlinedIcon fontSize="small" />
                      </InputAdornment>
                      {params.slotProps.input?.startAdornment}
                    </>
                  ),
                },
              }}
            />
          )}
        />

        {orderItemsError ? <Typography color="error">{orderItemsError}</Typography> : null}

        {selectedItemCount > 0 ? (
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1.5}
            sx={{
              alignItems: { sm: 'center' },
              justifyContent: 'space-between',
              border: (theme) => `1px solid ${alpha(theme.palette.error.main, 0.18)}`,
              borderRadius: 2,
              bgcolor: (theme) => alpha(theme.palette.error.main, 0.04),
              px: 2,
              py: 1.25,
            }}
          >
            <Typography sx={{ fontWeight: 700, color: '#0f172a' }}>Đã chọn {selectedItemCount} sản phẩm</Typography>
            <Button variant="outlined" color="error" startIcon={<DeleteOutlineOutlinedIcon />} onClick={onBulkDeleteItems}>
              Xóa đã chọn
            </Button>
          </Stack>
        ) : null}

        {itemRows.length === 0 ? (
          <Stack
            spacing={1.25}
            sx={{
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 220,
              border: (theme) => `1px dashed ${alpha(theme.palette.text.primary, 0.18)}`,
              borderRadius: 2,
              bgcolor: alpha('#132238', 0.02),
              textAlign: 'center',
            }}
          >
            <Box
              sx={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                bgcolor: 'rgba(15, 118, 110, 0.10)',
                color: 'primary.main',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <Inventory2OutlinedIcon />
            </Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 500, color: '#1d2841' }}>
              Chưa có sản phẩm nào
            </Typography>
          </Stack>
        ) : (
          <Box sx={{ overflowX: 'auto' }}>
            <Table sx={{ minWidth: 680 }}>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox" sx={{ width: 52, whiteSpace: 'nowrap' }}>
                    <Checkbox
                      checked={areAllItemsSelected}
                      indeterminate={areSomeItemsSelected}
                      onChange={(event) => onToggleAllItems(event.target.checked)}
                      disabled={isLoading}
                    />
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>Sản phẩm</TableCell>
                  <TableCell align="center" sx={{ width: 96, whiteSpace: 'nowrap' }}>
                    Số lượng
                  </TableCell>
                  <TableCell align="right" sx={{ width: 180, whiteSpace: 'nowrap' }}>
                    Đơn giá
                  </TableCell>
                  <TableCell align="right" sx={{ width: 140, whiteSpace: 'nowrap' }}>
                    Thành tiền
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {itemRows.map((item, index) => (
                  <TableRow
                    key={`${item.variant_sku}-${index}`}
                    hover
                    sx={{
                      '& td': {
                        py: 1.75,
                        borderBottom: (theme) => `1px solid ${alpha(theme.palette.divider, 0.9)}`,
                        verticalAlign: 'top',
                      },
                    }}
                  >
                    <TableCell padding="checkbox">
                      <Checkbox checked={selectedItemIndexSet.has(index)} onChange={() => onToggleItemSelection(index)} disabled={isLoading} />
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1.5}>
                        <Box
                          component="img"
                          src={item.image_url ?? 'https://placehold.co/80x80?text=SP'}
                          alt={item.product_name || item.sku || 'Sản phẩm'}
                          sx={{
                            width: 48,
                            height: 48,
                            borderRadius: 2,
                            objectFit: 'cover',
                            bgcolor: alpha('#132238', 0.06),
                            flexShrink: 0,
                          }}
                        />

                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography
                            component={item.product_id ? RouterLink : 'span'}
                            to={item.product_id ? `/products/${item.product_id}/edit` : undefined}
                            sx={{ color: '#0f172a', fontWeight: 700, textDecoration: 'none' }}
                          >
                            {item.product_name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
                            Phiên bản: {item.variant_sku || item.sku || 'Chưa chọn phiên bản'}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35, fontVariantNumeric: 'tabular-nums' }}>
                            Có sẵn: {formatStockNumber(item.stock_available)}
                          </Typography>

                          <Button variant="text" sx={{ mt: 0.75, px: 0, minWidth: 0 }} onClick={() => onUpdateItem(index, { noteOpen: !item.noteOpen })}>
                            {item.noteOpen || item.notes ? 'Sửa ghi chú' : 'Thêm ghi chú'}
                          </Button>

                          {item.noteOpen ? (
                            <StackedTextField
                              layout="default"
                              fullWidth
                              multiline
                              minRows={2}
                              sx={{ mt: 1 }}
                              placeholder="Nhập ghi chú cho sản phẩm này"
                              value={item.notes}
                              onChange={(event) => onUpdateItem(index, { notes: event.target.value })}
                              disabled={isLoading}
                            />
                          ) : null}
                        </Box>
                      </Stack>
                    </TableCell>

                    <TableCell align="center">
                      <StackedTextField
                        layout="default"
                        value={item.quantity}
                        onChange={(event) => onUpdateItem(index, { quantity: event.target.value })}
                        disabled={isLoading}
                        sx={{ width: 76, '& input': { textAlign: 'center' } }}
                      />
                    </TableCell>

                    <TableCell align="right">
                      <StackedTextField
                        layout="default"
                        value={item.unit_price}
                        onChange={(event) => onUpdateItem(index, { unit_price: formatCurrencyInput(event.target.value) })}
                        onBlur={(event) => onUpdateItem(index, { unit_price: formatCurrencyInput(event.target.value) })}
                        disabled={isLoading}
                        sx={{
                          width: 150,
                          '& input': {
                            textAlign: 'right',
                            fontVariantNumeric: 'tabular-nums',
                          },
                        }}
                        endAdornment={<InputAdornment position="end">đ</InputAdornment>}
                      />
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1, fontVariantNumeric: 'tabular-nums' }}>
                        Giảm giá: {formatCurrency(item.discount_amount)}
                      </Typography>
                    </TableCell>

                    <TableCell align="right">
                      <Typography sx={{ fontWeight: 600, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>
                        {formatCurrency(item.subTotal)}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        )}
      </Stack>
    </Paper>
  )
}
