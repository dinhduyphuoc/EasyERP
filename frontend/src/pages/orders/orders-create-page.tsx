import { useEffect, useMemo, useState, type ReactElement } from 'react'
import { Link as RouterLink, useNavigate } from 'react-router'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import AddOutlinedIcon from '@mui/icons-material/AddOutlined'
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined'
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined'
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined'
import {
  alpha,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  InputAdornment,
  MenuItem,
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
import { appToast } from '@/shared/ui/toast/toast'
import { orderApi, type OrderCreatePayload, type OrderOptionLookup } from './order.api'
import { formatCurrency } from './order.shared'

type OrderItemForm = {
  variant_sku: string
  product_id: number | null
  product_name: string
  sku: string
  quantity: string
  unit_price: string
  discount_amount: string
  notes: string
  noteOpen: boolean
}

const cardSx = {
  p: { xs: 2, md: 2.5 },
  borderRadius: 4,
  border: (theme: { palette: { divider: string } }) => `1px solid ${theme.palette.divider}`,
  boxShadow: '0 18px 45px rgba(15, 23, 42, 0.06)',
  backgroundImage: 'none',
}

const createEmptyItem = (): OrderItemForm => ({
  variant_sku: '',
  product_id: null,
  product_name: '',
  sku: '',
  quantity: '1',
  unit_price: '0',
  discount_amount: '0',
  notes: '',
  noteOpen: false,
})

export function OrdersCreatePage(): ReactElement {
  const navigate = useNavigate()
  const [options, setOptions] = useState<OrderOptionLookup | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [hasAttemptedSave, setHasAttemptedSave] = useState(false)
  const [orderCode, setOrderCode] = useState('')
  const [orderDate, setOrderDate] = useState(new Date().toISOString().slice(0, 16))
  const [orderType, setOrderType] = useState<'sale' | 'return'>('sale')
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [customerCode, setCustomerCode] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerAddress, setCustomerAddress] = useState('')
  const [isEditingPhone, setIsEditingPhone] = useState(false)
  const [isEditingAddress, setIsEditingAddress] = useState(false)
  const [paymentStatus, setPaymentStatus] = useState<'unpaid' | 'paid' | 'deposit'>('unpaid')
  const [processingStatus, setProcessingStatus] = useState<
    'draft' | 'placed' | 'confirmed' | 'picked_up' | 'delivering' | 'completed' | 'returned'
  >('draft')
  const [salesChannel, setSalesChannel] = useState('')
  const [shippingService, setShippingService] = useState('')
  const [shippingFee, setShippingFee] = useState('0')
  const [taxAmount, setTaxAmount] = useState('0')
  const [depositAmount, setDepositAmount] = useState('0')
  const [warehouseStatus, setWarehouseStatus] = useState('')
  const [trackingCode, setTrackingCode] = useState('')
  const [shippingStatus, setShippingStatus] = useState('')
  const [invoiceCode, setInvoiceCode] = useState('')
  const [createdBy, setCreatedBy] = useState('Sales Admin')
  const [confirmedBy, setConfirmedBy] = useState('')
  const [orderNotes, setOrderNotes] = useState('')
  const [paymentNotes, setPaymentNotes] = useState('')
  const [items, setItems] = useState<OrderItemForm[]>([createEmptyItem()])

  useEffect(() => {
    const fetchOptions = async () => {
      setIsLoading(true)

      try {
        const data = await orderApi.getOrderOptions()
        setOptions(data)
      } catch (error) {
        console.error('Loi khi tai du lieu tao don hang:', error)
        appToast.error('Khong the tai du lieu tao don hang.')
      } finally {
        setIsLoading(false)
      }
    }

    void fetchOptions()
  }, [])

  const itemRows = useMemo(
    () =>
      items.map((item) => {
        const quantity = Number(item.quantity || 0)
        const unitPrice = Number(item.unit_price || 0)
        const discountAmount = Number(item.discount_amount || 0)
        const subTotal = Math.max(quantity * unitPrice - discountAmount, 0)

        return {
          ...item,
          subTotal,
        }
      }),
    [items],
  )

  const subTotal = useMemo(() => itemRows.reduce((sum, item) => sum + item.subTotal, 0), [itemRows])
  const totalAmount = subTotal + Number(taxAmount || 0) + Number(shippingFee || 0)
  const normalizedDepositAmount = paymentStatus === 'deposit' ? Number(depositAmount || 0) : 0
  const normalizedPaidAmount =
    paymentStatus === 'paid' ? totalAmount : paymentStatus === 'deposit' ? normalizedDepositAmount : 0
  const outstandingAmount = Math.max(totalAmount - normalizedPaidAmount, 0)

  const errors = useMemo(() => {
    const nextErrors: Record<string, string> = {}

    if (!customerName.trim()) {
      nextErrors.customer_name = 'Ten khach hang la bat buoc.'
    }

    if (!customerPhone.trim()) {
      nextErrors.customer_phone = 'So dien thoai la bat buoc.'
    }

    const validItems = itemRows.filter((item) => item.product_name.trim() || item.sku.trim())

    if (processingStatus !== 'draft' && validItems.length === 0) {
      nextErrors.order_items = 'Don hang can it nhat mot san pham.'
    }

    if (
      processingStatus !== 'draft' &&
      validItems.some((item) => !item.product_name.trim() || !item.sku.trim() || Number(item.quantity) <= 0)
    ) {
      nextErrors.order_items = 'Moi dong san pham can co ten, SKU va so luong hop le.'
    }

    if (paymentStatus === 'deposit' && normalizedDepositAmount <= 0) {
      nextErrors.deposit_amount = 'Vui long nhap so tien coc lon hon 0.'
    }

    if (paymentStatus === 'deposit' && normalizedDepositAmount > totalAmount) {
      nextErrors.deposit_amount = 'Tien coc khong duoc lon hon tong don.'
    }

    if (paymentStatus === 'unpaid' && processingStatus === 'completed') {
      nextErrors.processing_status = 'Don chua thanh toan khong the danh dau hoan thanh.'
    }

    if (paymentStatus === 'deposit' && processingStatus === 'completed') {
      nextErrors.processing_status = 'Don dat coc chua the hoan thanh khi van con cong no.'
    }

    return nextErrors
  }, [customerName, customerPhone, itemRows, normalizedDepositAmount, paymentStatus, processingStatus, totalAmount])

  const visibleErrors = hasAttemptedSave ? errors : {}
  const canSave = !isLoading && !isSaving && Object.keys(errors).length === 0

  const selectedCustomer =
    options?.customers.find((customer) => String(customer.id) === customerId) ?? null

  const handleCustomerSelect = (value: OrderOptionLookup['customers'][number] | null) => {
    if (!value) {
      setCustomerId('')
      setCustomerCode('')
      setCustomerSearch('')
      return
    }

    setCustomerId(String(value.id))
    setCustomerCode(value.client_code)
    setCustomerName(value.full_name)
    setCustomerPhone(value.phone)
    setCustomerSearch(`${value.full_name} • ${value.phone}`)
  }

  const handleItemProductChange = (index: number, value: string | null) => {
    const selectedProduct = options?.products.find((product) => product.sku === value)

    setItems((current) =>
      current.map((item, currentIndex) => {
        if (currentIndex !== index) {
          return item
        }

        if (!selectedProduct) {
          return {
            ...item,
            variant_sku: value ?? '',
          }
        }

        return {
          ...item,
          variant_sku: selectedProduct.sku,
          product_id: selectedProduct.product_id,
          product_name: selectedProduct.product_name,
          sku: selectedProduct.sku,
          unit_price: selectedProduct.selling_price,
        }
      }),
    )
  }

  const updateItem = (index: number, patch: Partial<OrderItemForm>) => {
    setItems((current) =>
      current.map((item, currentIndex) => (currentIndex === index ? { ...item, ...patch } : item)),
    )
  }

  const removeItem = (index: number) => {
    setItems((current) => current.filter((_, currentIndex) => currentIndex !== index))
  }

  const addItem = () => {
    setItems((current) => [...current, createEmptyItem()])
  }

  const buildStatusTimeline = (): Record<string, string> => {
    const stages = ['placed', 'confirmed', 'picking', 'shipping', 'completed']
    const currentStageMap: Record<string, number> = {
      draft: -1,
      placed: 0,
      confirmed: 1,
      picked_up: 2,
      delivering: 3,
      completed: 4,
      returned: 4,
    }
    const currentIndex = currentStageMap[processingStatus]
    const createdAt = new Date(orderDate).toISOString()

    return stages.reduce<Record<string, string>>((accumulator, stage, index) => {
      if (index <= currentIndex) {
        accumulator[stage] = createdAt
      }

      return accumulator
    }, {})
  }

  const handleSave = async () => {
    setHasAttemptedSave(true)

    if (!canSave) {
      appToast.warning('Vui long kiem tra lai thong tin truoc khi luu don hang.')
      return
    }

    setIsSaving(true)

    try {
      const payload: OrderCreatePayload = {
        order_type: orderType,
        order_date: new Date(orderDate).toISOString(),
        customer_id: customerId ? Number(customerId) : null,
        customer_info: {
          customer_code: customerCode.trim() || null,
          name: customerName.trim(),
          phone: customerPhone.trim(),
          address: customerAddress.trim() || null,
        },
        tax_amount: Number(taxAmount || 0),
        shipping_fee: Number(shippingFee || 0),
        deposit_amount: normalizedDepositAmount,
        paid_amount: normalizedPaidAmount,
        payment_status: paymentStatus,
        processing_status: processingStatus,
        shipping_service: shippingService.trim() || null,
        sales_channel: salesChannel.trim() || null,
        order_notes: orderNotes.trim() || null,
        payment_notes: paymentNotes.trim() || null,
        warehouse_status: warehouseStatus.trim() || null,
        tracking_code: trackingCode.trim() || null,
        shipping_status: shippingStatus.trim() || null,
        invoice_code: invoiceCode.trim() || null,
        created_by: createdBy.trim() || null,
        confirmed_by: confirmedBy.trim() || null,
        status_timeline: buildStatusTimeline(),
        order_items: itemRows
          .filter((item) => item.product_name.trim() || item.sku.trim())
          .map((item) => ({
            product_id: item.product_id,
            variant_sku: item.variant_sku || null,
            product_name: item.product_name.trim(),
            sku: item.sku.trim(),
            quantity: Number(item.quantity),
            unit_price: Number(item.unit_price),
            discount_amount: Number(item.discount_amount || 0),
            notes: item.notes.trim() || undefined,
          })),
      }

      if (orderCode.trim()) {
        payload.order_code = orderCode.trim()
      }

      const order = await orderApi.createOrder(payload)
      appToast.success(`Tao don hang ${order.order_code} thanh cong.`)
      navigate(`/orders/${order.id}`)
    } catch (error) {
      console.error('Loi khi tao don hang:', error)
      const message =
        typeof error === 'object' &&
        error !== null &&
        'response' in error &&
        typeof error.response === 'object' &&
        error.response !== null &&
        'data' in error.response &&
        typeof error.response.data === 'object' &&
        error.response.data !== null &&
        'message' in error.response.data &&
        typeof error.response.data.message === 'string'
          ? error.response.data.message
          : 'Khong the tao don hang. Vui long thu lai.'

      appToast.error(message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Box sx={{ px: { xs: 2, md: 3, xl: 4 }, pb: 8 }}>
      <Paper sx={{ ...cardSx, mb: 2 }}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={2}
          sx={{ justifyContent: 'space-between', alignItems: { md: 'center' } }}
        >
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a' }}>
              Tao don hang
            </Typography>
            <Typography sx={{ color: '#667085', mt: 0.5 }}>
              Luong tao don duoc toi uu de scan nhanh: ben trai xu ly san pham va thanh toan, ben phai la
              khach hang va thong tin van hanh can thiet.
            </Typography>
          </Box>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => navigate('/orders')}>
              Quay lai
            </Button>
            <Button
              variant="contained"
              color="secondary"
              startIcon={isSaving ? <CircularProgress size={16} color="inherit" /> : <SaveOutlinedIcon />}
              onClick={() => void handleSave()}
              disabled={!canSave}
            >
              {isSaving ? 'Dang luu...' : 'Luu don hang'}
            </Button>
          </Stack>
        </Stack>
      </Paper>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 7fr) minmax(320px, 3fr)' },
          gap: 2.5,
          alignItems: 'start',
        }}
      >
        <Stack spacing={2.5}>
          <Paper sx={cardSx}>
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={2}
              sx={{ justifyContent: 'space-between', alignItems: { md: 'center' }, mb: 2 }}
            >
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a' }}>
                  San pham
                </Typography>
                <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                  Bang ngang toi gian de scan nhanh san pham, so luong, don gia va thanh tien.
                </Typography>
              </Box>

              <Button variant="outlined" startIcon={<AddOutlinedIcon />} onClick={addItem} disabled={isLoading}>
                Them san pham
              </Button>
            </Stack>

            {visibleErrors.order_items ? (
              <Typography color="error" sx={{ mb: 2 }}>
                {visibleErrors.order_items}
              </Typography>
            ) : null}

            <Box sx={{ overflowX: 'auto' }}>
              <Table sx={{ minWidth: 760 }}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ width: '60%' }}>Product info</TableCell>
                    <TableCell align="center">Quantity</TableCell>
                    <TableCell align="right">Unit price</TableCell>
                    <TableCell align="right">Total price</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {itemRows.map((item, index) => {
                    const productOption =
                      options?.products.find((product) => product.sku === item.variant_sku) ?? null

                    return (
                      <TableRow
                        key={`${item.variant_sku}-${index}`}
                        hover
                        sx={{
                          '& td': {
                            py: 1.75,
                            borderBottom: (theme) => `1px solid ${alpha(theme.palette.divider, 0.9)}`,
                            verticalAlign: 'top',
                          },
                          '&:hover': {
                            bgcolor: 'rgba(15, 118, 110, 0.035)',
                          },
                          opacity: isLoading ? 0.7 : 1,
                        }}
                      >
                        <TableCell>
                          <Stack direction="row" spacing={1.5}>
                            <Box
                              sx={{
                                width: 40,
                                height: 40,
                                borderRadius: 2,
                                bgcolor: 'rgba(15, 118, 110, 0.10)',
                                color: 'primary.main',
                                display: 'grid',
                                placeItems: 'center',
                                flexShrink: 0,
                              }}
                            >
                              <Inventory2OutlinedIcon fontSize="small" />
                            </Box>

                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Autocomplete
                                size="small"
                                options={options?.products ?? []}
                                value={productOption}
                                disabled={isLoading}
                                getOptionLabel={(option) => option.label}
                                onChange={(_, value) => handleItemProductChange(index, value?.sku ?? null)}
                                renderInput={(params) => (
                                  <TextField
                                    {...params}
                                    placeholder="Tim va chon san pham / variant"
                                    variant="outlined"
                                  />
                                )}
                              />

                              {item.product_name ? (
                                <Box sx={{ mt: 1 }}>
                                  <Typography
                                    component={item.product_id ? RouterLink : 'span'}
                                    to={item.product_id ? `/products/${item.product_id}/edit` : undefined}
                                    sx={{
                                      color: '#0f172a',
                                      fontWeight: 700,
                                      textDecoration: item.product_id ? 'none' : 'none',
                                      '&:hover': item.product_id ? { color: 'primary.main' } : undefined,
                                    }}
                                  >
                                    {item.product_name}
                                  </Typography>
                                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
                                    Variant: {item.variant_sku || item.sku || 'Chua chon variant'}
                                  </Typography>
                                </Box>
                              ) : null}

                              <Button
                                variant="text"
                                size="small"
                                sx={{ mt: 0.75, px: 0, minWidth: 0 }}
                                onClick={() => updateItem(index, { noteOpen: !item.noteOpen })}
                                disabled={isLoading}
                              >
                                {item.noteOpen || item.notes ? 'Sua ghi chu' : 'Them ghi chu'}
                              </Button>

                              {item.noteOpen ? (
                                <TextField
                                  fullWidth
                                  size="small"
                                  multiline
                                  minRows={2}
                                  sx={{ mt: 1 }}
                                  placeholder="Nhap ghi chu inline cho san pham nay"
                                  value={item.notes}
                                  onChange={(event) => updateItem(index, { notes: event.target.value })}
                                  disabled={isLoading}
                                />
                              ) : null}

                              <Button
                                variant="text"
                                color="error"
                                startIcon={<DeleteOutlineOutlinedIcon />}
                                sx={{ mt: 0.5, px: 0 }}
                                onClick={() => removeItem(index)}
                                disabled={items.length === 1}
                              >
                                Xoa dong
                              </Button>
                            </Box>
                          </Stack>
                        </TableCell>

                        <TableCell align="center">
                          <TextField
                            size="small"
                            type="number"
                            value={item.quantity}
                            onChange={(event) => updateItem(index, { quantity: event.target.value })}
                            disabled={isLoading}
                            sx={{
                              width: 96,
                              '& input': {
                                textAlign: 'center',
                              },
                            }}
                          />
                        </TableCell>

                        <TableCell align="right">
                          <Stack spacing={1} sx={{ alignItems: 'flex-end' }}>
                            <TextField
                              size="small"
                              type="number"
                              value={item.unit_price}
                              onChange={(event) => updateItem(index, { unit_price: event.target.value })}
                              disabled={isLoading}
                              sx={{ width: 150 }}
                            />
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              sx={{ fontVariantNumeric: 'tabular-nums' }}
                            >
                              Discount: {formatCurrency(item.discount_amount)}
                            </Typography>
                          </Stack>
                        </TableCell>

                        <TableCell align="right">
                          <Typography
                            sx={{
                              fontWeight: 800,
                              color: '#0f172a',
                              fontVariantNumeric: 'tabular-nums',
                              fontSize: '1rem',
                            }}
                          >
                            {formatCurrency(item.subTotal)}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </Box>
          </Paper>

          <Paper sx={cardSx}>
            <Stack spacing={2}>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a' }}>
                  Phuong thuc thanh toan
                </Typography>
                <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                  Tach rieng flow thanh toan de nhan vien xu ly nhanh tung truong hop: chua thu, thu du, hoac
                  dat coc truoc.
                </Typography>
              </Box>

              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
                  gap: 1.5,
                }}
              >
                {[
                  { value: 'unpaid', title: 'Chua thanh toan', description: 'Chua ghi nhan giao dich nao.' },
                  { value: 'paid', title: 'Thanh toan du', description: 'He thong tu dong thu du theo tong don.' },
                  { value: 'deposit', title: 'Dat coc', description: 'Nhap truoc so tien coc, phan con lai theo doi sau.' },
                ].map((option) => {
                  const isActive = paymentStatus === option.value

                  return (
                    <Paper
                      key={option.value}
                      variant="outlined"
                      onClick={() => setPaymentStatus(option.value as 'unpaid' | 'paid' | 'deposit')}
                      sx={{
                        p: 1.75,
                        borderRadius: 3,
                        cursor: 'pointer',
                        borderColor: isActive ? 'primary.main' : undefined,
                        bgcolor: isActive ? 'rgba(15, 118, 110, 0.08)' : '#fff',
                      }}
                    >
                      <Typography sx={{ fontWeight: 700, color: '#0f172a' }}>{option.title}</Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                        {option.description}
                      </Typography>
                    </Paper>
                  )
                })}
              </Box>

              {visibleErrors.payment_status ? <Typography color="error">{visibleErrors.payment_status}</Typography> : null}

              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
                  gap: 1.5,
                }}
              >
                <MetricTile label="Tam tinh" value={formatCurrency(subTotal)} />
                <MetricTile label="Tong don" value={formatCurrency(totalAmount)} emphasis />
                <TextField
                  label="Thue"
                  type="number"
                  value={taxAmount}
                  onChange={(event) => setTaxAmount(event.target.value)}
                  disabled={isLoading}
                />
                <TextField
                  label="Phi van chuyen"
                  type="number"
                  value={shippingFee}
                  onChange={(event) => setShippingFee(event.target.value)}
                  disabled={isLoading}
                />
              </Box>

              {paymentStatus === 'deposit' ? (
                <Paper
                  variant="outlined"
                  sx={{
                    p: 2,
                    borderRadius: 3,
                    bgcolor: 'rgba(249, 115, 22, 0.06)',
                    borderColor: 'rgba(249, 115, 22, 0.2)',
                  }}
                >
                  <Stack spacing={1.5}>
                    <Typography sx={{ fontWeight: 700, color: '#0f172a' }}>Flow dat coc</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Nhan vien nhap truoc so tien coc. He thong tu dong ghi nhan da thu bang tien coc va tinh so
                      tien con lai can thu.
                    </Typography>
                    <TextField
                      label="So tien coc"
                      type="number"
                      value={depositAmount}
                      onChange={(event) => setDepositAmount(event.target.value)}
                      error={Boolean(visibleErrors.deposit_amount)}
                      helperText={visibleErrors.deposit_amount}
                      disabled={isLoading}
                    />
                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
                      <MetricTile label="Da thu" value={formatCurrency(normalizedPaidAmount)} />
                      <MetricTile label="Con phai thu" value={formatCurrency(outstandingAmount)} emphasis />
                    </Stack>
                    <TextField
                      label="Ghi chu thanh toan"
                      multiline
                      minRows={2}
                      value={paymentNotes}
                      onChange={(event) => setPaymentNotes(event.target.value)}
                      disabled={isLoading}
                    />
                  </Stack>
                </Paper>
              ) : paymentStatus === 'paid' ? (
                <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
                  <Stack spacing={1}>
                    <Typography sx={{ fontWeight: 700, color: '#0f172a' }}>Da thanh toan du</Typography>
                    <Typography variant="body2" color="text.secondary">
                      He thong se luu so tien da thu bang tong gia tri don hang.
                    </Typography>
                    <MetricTile label="Da thu" value={formatCurrency(totalAmount)} emphasis />
                  </Stack>
                </Paper>
              ) : (
                <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
                  <Stack spacing={1}>
                    <Typography sx={{ fontWeight: 700, color: '#0f172a' }}>Chua ghi nhan thanh toan</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Don se duoc tao voi cong no bang tong gia tri can thu.
                    </Typography>
                    <MetricTile label="Con phai thu" value={formatCurrency(totalAmount)} emphasis />
                  </Stack>
                </Paper>
              )}
            </Stack>
          </Paper>
        </Stack>

        <Stack spacing={2.5}>
          <Paper sx={cardSx}>
            <Stack spacing={1.5}>
              <Typography sx={{ fontWeight: 800, color: '#0f172a' }}>Thong tin don</Typography>
              <TextField
                fullWidth
                label="Ma don hang"
                placeholder="De trong de he thong tu tao"
                value={orderCode}
                onChange={(event) => setOrderCode(event.target.value)}
                disabled={isLoading}
              />
              <TextField
                fullWidth
                label="Ngay don"
                type="datetime-local"
                value={orderDate}
                onChange={(event) => setOrderDate(event.target.value)}
                disabled={isLoading}
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <TextField
                select
                fullWidth
                label="Loai don"
                value={orderType}
                onChange={(event) => setOrderType(event.target.value as 'sale' | 'return')}
                disabled={isLoading}
              >
                <MenuItem value="sale">Ban hang</MenuItem>
                <MenuItem value="return">Tra hang</MenuItem>
              </TextField>
              <TextField
                select
                fullWidth
                label="Trang thai xu ly"
                value={processingStatus}
                onChange={(event) =>
                  setProcessingStatus(
                    event.target.value as
                      | 'draft'
                      | 'placed'
                      | 'confirmed'
                      | 'picked_up'
                      | 'delivering'
                      | 'completed'
                      | 'returned',
                  )
                }
                error={Boolean(visibleErrors.processing_status)}
                helperText={visibleErrors.processing_status}
                disabled={isLoading}
              >
                {options?.processing_statuses.map((status) => (
                  <MenuItem key={status.value} value={status.value}>
                    {status.label}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                fullWidth
                label="Kenh ban hang"
                value={salesChannel}
                onChange={(event) => setSalesChannel(event.target.value)}
                disabled={isLoading}
                placeholder={options?.sales_channels[0] ?? 'POS, Website, Facebook'}
              />
            </Stack>
          </Paper>

          <Paper sx={cardSx}>
            <Stack spacing={2}>
              <Typography sx={{ fontWeight: 800, color: '#0f172a' }}>Khach hang</Typography>

              <Autocomplete
                options={options?.customers ?? []}
                value={selectedCustomer}
                inputValue={customerSearch}
                disabled={isLoading}
                getOptionLabel={(option) =>
                  typeof option === 'string'
                    ? option
                    : `${option.full_name} • ${option.phone} • ${option.client_code}`
                }
                onInputChange={(_, value) => {
                  setCustomerSearch(value)
                  if (!customerId) {
                    setCustomerName(value)
                  }
                }}
                onChange={(_, value) => handleCustomerSelect(value)}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    placeholder="Tim theo ten, SDT, ma khach hang"
                    error={Boolean(visibleErrors.customer_name)}
                    helperText={visibleErrors.customer_name}
                    slotProps={{
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

              <Divider />

              <SidebarSection
                title="Customer group"
                value={
                  customerId ? (
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                      <Typography sx={{ fontWeight: 600, color: '#0f172a' }}>Khach thanh vien</Typography>
                      <Chip size="small" label="Filled" color="success" />
                    </Stack>
                  ) : (
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                      <Typography sx={{ fontWeight: 600, color: '#516071' }}>Chua gan khach hang</Typography>
                      <Chip size="small" label="Empty" />
                    </Stack>
                  )
                }
              />

              <Divider />

              <SidebarSection
                title="Contact info"
                value={
                  isEditingPhone ? (
                    <TextField
                      fullWidth
                      size="small"
                      label="So dien thoai"
                      value={customerPhone}
                      onChange={(event) => setCustomerPhone(event.target.value)}
                      error={Boolean(visibleErrors.customer_phone)}
                      helperText={visibleErrors.customer_phone}
                      disabled={isLoading}
                    />
                  ) : (
                    <EditableValue
                      value={customerPhone || 'Chua co so dien thoai'}
                      isEmpty={!customerPhone}
                      onEdit={() => setIsEditingPhone(true)}
                    />
                  )
                }
              />

              <Divider />

              <SidebarSection
                title="Shipping address"
                value={
                  isEditingAddress ? (
                    <TextField
                      fullWidth
                      size="small"
                      multiline
                      minRows={2}
                      label="Dia chi giao hang"
                      value={customerAddress}
                      onChange={(event) => setCustomerAddress(event.target.value)}
                      disabled={isLoading}
                    />
                  ) : (
                    <EditableValue
                      value={customerAddress || 'Chua co dia chi giao hang'}
                      isEmpty={!customerAddress}
                      onEdit={() => setIsEditingAddress(true)}
                    />
                  )
                }
              />
            </Stack>
          </Paper>

          <Paper sx={cardSx}>
            <Stack spacing={1.5}>
              <Typography sx={{ fontWeight: 800, color: '#0f172a' }}>Don vi van chuyen</Typography>
              <TextField
                fullWidth
                label="Don vi van chuyen"
                value={shippingService}
                onChange={(event) => setShippingService(event.target.value)}
                disabled={isLoading}
                placeholder={options?.shipping_services[0] ?? 'GHN, GHTK, Viettel Post'}
              />
              <TextField
                fullWidth
                label="Trang thai giao hang"
                value={shippingStatus}
                onChange={(event) => setShippingStatus(event.target.value)}
                disabled={isLoading}
                placeholder="pending / ready_to_ship / shipping"
              />
              <TextField
                fullWidth
                label="Ma tracking"
                value={trackingCode}
                onChange={(event) => setTrackingCode(event.target.value)}
                disabled={isLoading}
              />
              <TextField
                fullWidth
                label="Trang thai kho"
                value={warehouseStatus}
                onChange={(event) => setWarehouseStatus(event.target.value)}
                disabled={isLoading}
                placeholder="reserved / pending"
              />
            </Stack>
          </Paper>

          <Paper sx={cardSx}>
            <Stack spacing={1.5}>
              <Typography sx={{ fontWeight: 800, color: '#0f172a' }}>Ghi chu va metadata</Typography>
              <TextField
                fullWidth
                label="Ghi chu don hang"
                multiline
                minRows={3}
                value={orderNotes}
                onChange={(event) => setOrderNotes(event.target.value)}
                disabled={isLoading}
              />
              <TextField
                fullWidth
                label="Nguoi tao"
                value={createdBy}
                onChange={(event) => setCreatedBy(event.target.value)}
                disabled={isLoading}
              />
              <TextField
                fullWidth
                label="Nguoi xu ly"
                value={confirmedBy}
                onChange={(event) => setConfirmedBy(event.target.value)}
                disabled={isLoading}
              />
              <TextField
                fullWidth
                label="Ma hoa don"
                value={invoiceCode}
                onChange={(event) => setInvoiceCode(event.target.value)}
                disabled={isLoading}
              />
            </Stack>
          </Paper>
        </Stack>
      </Box>
    </Box>
  )
}

function MetricTile({
  label,
  value,
  emphasis = false,
}: {
  label: string
  value: string
  emphasis?: boolean
}): ReactElement {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.75,
        borderRadius: 3,
        bgcolor: emphasis ? 'rgba(15, 118, 110, 0.08)' : '#fff',
        borderColor: emphasis ? 'rgba(15, 118, 110, 0.24)' : undefined,
      }}
    >
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography sx={{ mt: 0.75, fontWeight: 800, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </Typography>
    </Paper>
  )
}

function SidebarSection({
  title,
  value,
}: {
  title: string
  value: ReactElement
}): ReactElement {
  return (
    <Stack spacing={1}>
      <Typography variant="body2" color="text.secondary">
        {title}
      </Typography>
      {value}
    </Stack>
  )
}

function EditableValue({
  value,
  isEmpty,
  onEdit,
}: {
  value: string
  isEmpty: boolean
  onEdit: () => void
}): ReactElement {
  return (
    <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <Typography sx={{ color: isEmpty ? '#98a2b3' : '#0f172a', lineHeight: 1.6 }}>{value}</Typography>
      <IconButton size="small" onClick={onEdit} sx={{ color: '#98a2b3' }}>
        <EditOutlinedIcon fontSize="small" />
      </IconButton>
    </Stack>
  )
}
