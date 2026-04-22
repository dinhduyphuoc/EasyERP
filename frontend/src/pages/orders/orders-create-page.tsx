import { useEffect, useMemo, useState, type ReactElement } from 'react'
import { Link as RouterLink, useLocation, useNavigate, useParams } from 'react-router'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import AddOutlinedIcon from '@mui/icons-material/AddOutlined'
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined'
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined'
import {
  alpha,
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
import { appToast } from '@/shared/ui/toast/toast.helpers'
import { borderedCardSx } from '@/shared/ui/paper'
import { StackedTextField } from '@/shared/ui/form/stacked-text-field'
import { StackedDropdown } from '@/shared/ui/form/stacked-dropdown'
import { orderApi, type OrderCreatePayload, type OrderListItem, type OrderOptionLookup } from './order.api'
import { formatCurrency } from './order.utils'

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

type OrderCreateLocationState = {
  duplicateFrom?: OrderListItem
}

type DialogKey = 'customer' | 'payment' | 'order' | 'shipping' | 'meta' | null

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

const parseCurrencyValue = (value: string | number | null | undefined): number => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0
  }

  const digits = String(value ?? '').replace(/\D/g, '')
  return Number(digits || '0')
}

const formatCurrencyInput = (value: string | number | null | undefined): string =>
  parseCurrencyValue(value).toLocaleString('vi-VN')

const formatDateOnly = (value: string): string => {
  if (!value) {
    return '-'
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return parsed.toLocaleDateString('vi-VN')
}

const getErrorMessage = (error: unknown, fallback: string) => {
  return typeof error === 'object' &&
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
    : fallback
}

export function OrdersCreatePage(): ReactElement {
  const location = useLocation()
  const navigate = useNavigate()
  const params = useParams()
  const orderId = params.id
  const isEditMode = Boolean(orderId)
  const duplicateSource = (location.state as OrderCreateLocationState | null)?.duplicateFrom ?? null

  const [options, setOptions] = useState<OrderOptionLookup | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [hasAttemptedSave, setHasAttemptedSave] = useState(false)
  const [loadedOrder, setLoadedOrder] = useState<OrderListItem | null>(null)
  const [activeDialog, setActiveDialog] = useState<DialogKey>(null)

  const [orderCode, setOrderCode] = useState('')
  const [orderDate, setOrderDate] = useState(new Date().toISOString().slice(0, 10))
  const [orderType, setOrderType] = useState<'sale' | 'return'>('sale')
  const [paymentStatus, setPaymentStatus] = useState<'unpaid' | 'paid' | 'deposit'>('unpaid')
  const [processingStatus, setProcessingStatus] = useState<
    'draft' | 'placed' | 'confirmed' | 'picked_up' | 'delivering' | 'completed' | 'cancelled' | 'returned'
  >('draft')
  const [salesChannel, setSalesChannel] = useState('')

  const [customerSearch, setCustomerSearch] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [customerCode, setCustomerCode] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerAddress, setCustomerAddress] = useState('')

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
  const [statusTimeline, setStatusTimeline] = useState<Record<string, unknown>>({})
  const [items, setItems] = useState<OrderItemForm[]>([createEmptyItem()])

  useEffect(() => {
    const fetchFormData = async () => {
      setIsLoading(true)

      try {
        const [optionsData, orderData] = await Promise.all([
          orderApi.getOrderOptions(),
          isEditMode && orderId ? orderApi.getOrderById(orderId) : Promise.resolve(null),
        ])

        setOptions(optionsData)

        if (orderData) {
          setLoadedOrder(orderData)
          setOrderCode(orderData.order_code)
          setOrderDate(orderData.order_date.slice(0, 10))
          setOrderType(orderData.order_type)
          setCustomerId(orderData.customer_id ? String(orderData.customer_id) : '')
          setCustomerCode(orderData.customer_info.customer_code ?? '')
          setCustomerName(orderData.customer_info.name)
          setCustomerPhone(orderData.customer_info.phone)
          setCustomerAddress(orderData.customer_info.address ?? '')
          setCustomerSearch(
            [orderData.customer_info.name, orderData.customer_info.phone, orderData.customer_info.customer_code]
              .filter(Boolean)
              .join(' • '),
          )
          setPaymentStatus(orderData.payment_status)
          setProcessingStatus(orderData.processing_status)
          setSalesChannel(orderData.sales_channel ?? '')
          setShippingService(orderData.shipping_service ?? '')
          setShippingFee(orderData.shipping_fee)
          setTaxAmount(orderData.tax_amount)
          setDepositAmount(orderData.deposit_amount)
          setWarehouseStatus(orderData.warehouse_status ?? '')
          setTrackingCode(orderData.tracking_code ?? '')
          setShippingStatus(orderData.shipping_status ?? '')
          setInvoiceCode(orderData.invoice_code ?? '')
          setCreatedBy(orderData.created_by ?? 'Sales Admin')
          setConfirmedBy(orderData.confirmed_by ?? '')
          setOrderNotes(orderData.order_notes ?? '')
          setPaymentNotes(orderData.payment_notes ?? '')
          setStatusTimeline(orderData.status_timeline ?? {})
          setItems(
            orderData.order_items.length > 0
              ? orderData.order_items.map((item) => ({
                  variant_sku: item.variant_sku ?? '',
                  product_id: item.product_id,
                  product_name: item.product_name,
                  sku: item.sku,
                  quantity: String(item.quantity),
                  unit_price: formatCurrencyInput(item.unit_price),
                  discount_amount: item.discount_amount,
                  notes: item.notes ?? '',
                  noteOpen: Boolean(item.notes),
                }))
              : [createEmptyItem()],
          )
          return
        }

        if (duplicateSource) {
          setLoadedOrder(null)
          setOrderCode('')
          setOrderDate(new Date().toISOString().slice(0, 10))
          setOrderType(duplicateSource.order_type)
          setCustomerId(duplicateSource.customer_id ? String(duplicateSource.customer_id) : '')
          setCustomerCode(duplicateSource.customer_info.customer_code ?? '')
          setCustomerName(duplicateSource.customer_info.name)
          setCustomerPhone(duplicateSource.customer_info.phone)
          setCustomerAddress(duplicateSource.customer_info.address ?? '')
          setCustomerSearch(
            [
              duplicateSource.customer_info.name,
              duplicateSource.customer_info.phone,
              duplicateSource.customer_info.customer_code,
            ]
              .filter(Boolean)
              .join(' • '),
          )
          setPaymentStatus('unpaid')
          setProcessingStatus('draft')
          setSalesChannel(duplicateSource.sales_channel ?? '')
          setShippingService(duplicateSource.shipping_service ?? '')
          setShippingFee(duplicateSource.shipping_fee)
          setTaxAmount(duplicateSource.tax_amount)
          setDepositAmount('0')
          setWarehouseStatus('')
          setTrackingCode('')
          setShippingStatus('')
          setInvoiceCode('')
          setCreatedBy('Sales Admin')
          setConfirmedBy('')
          setOrderNotes(duplicateSource.order_notes ?? '')
          setPaymentNotes('')
          setStatusTimeline({})
          setItems(
            duplicateSource.order_items.length > 0
              ? duplicateSource.order_items.map((item) => ({
                  variant_sku: item.variant_sku ?? '',
                  product_id: item.product_id,
                  product_name: item.product_name,
                  sku: item.sku,
                  quantity: String(item.quantity),
                  unit_price: formatCurrencyInput(item.unit_price),
                  discount_amount: item.discount_amount,
                  notes: item.notes ?? '',
                  noteOpen: Boolean(item.notes),
                }))
              : [createEmptyItem()],
          )
          appToast.info(`Da nap du lieu tu don ${duplicateSource.order_code}. Ban dang tao mot ban sao moi.`)
        }
      } catch (error) {
        console.error('Loi khi tai du lieu don hang:', error)
        appToast.error(getErrorMessage(error, 'Khong the tai du lieu don hang.'))
      } finally {
        setIsLoading(false)
      }
    }

    void fetchFormData()
  }, [duplicateSource, isEditMode, orderId])

  const itemRows = useMemo(
    () =>
      items.map((item) => {
        const quantity = Number(item.quantity || 0)
        const unitPrice = parseCurrencyValue(item.unit_price)
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
  const canEditOrder = !isEditMode || !loadedOrder || ['draft', 'placed'].includes(loadedOrder.processing_status)
  const paymentStatusLabel =
    paymentStatus === 'paid' ? 'Da thanh toan du' : paymentStatus === 'deposit' ? 'Dat coc' : 'Chua thanh toan'
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
          unit_price: formatCurrencyInput(selectedProduct.selling_price),
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
      cancelled: 4,
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
        status_timeline: isEditMode ? statusTimeline : buildStatusTimeline(),
        order_items: itemRows
          .filter((item) => item.product_name.trim() || item.sku.trim())
          .map((item) => ({
            product_id: item.product_id,
            variant_sku: item.variant_sku || null,
            product_name: item.product_name.trim(),
            sku: item.sku.trim(),
            quantity: Number(item.quantity),
            unit_price: parseCurrencyValue(item.unit_price),
            discount_amount: Number(item.discount_amount || 0),
            notes: item.notes.trim() || undefined,
          })),
      }

      if (orderCode.trim()) {
        payload.order_code = orderCode.trim()
      }

      const order =
        isEditMode && orderId ? await orderApi.updateOrder(orderId, payload) : await orderApi.createOrder(payload)

      appToast.success(
        isEditMode ? `Cap nhat don hang ${order.order_code} thanh cong.` : `Tao don hang ${order.order_code} thanh cong.`,
      )
      navigate(`/orders/${order.id}`)
    } catch (error) {
      console.error('Loi khi tao don hang:', error)
      appToast.error(
        getErrorMessage(
          error,
          isEditMode ? 'Khong the cap nhat don hang. Vui long thu lai.' : 'Khong the tao don hang. Vui long thu lai.',
        ),
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Box sx={{ px: { xs: 2, md: 3, xl: 4 }, pb: 8 }}>
      <Paper sx={{ ...borderedCardSx, mb: 2 }}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={2}
          sx={{ justifyContent: 'space-between', alignItems: { md: 'center' } }}
        >
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a' }}>
              {isEditMode ? 'Chinh sua don hang' : duplicateSource ? 'Nhan ban don hang' : 'Tao don hang'}
            </Typography>
            <Typography sx={{ color: '#667085', mt: 0.5 }}>
              Giao dien tao don da duoc rut gon: ben trai xu ly san pham, ben phai chi hien thi thong tin tong hop va
              chinh sua qua modal.
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
              disabled={!canSave || !canEditOrder}
            >
              {isSaving ? 'Dang luu...' : isEditMode ? 'Luu thay doi' : 'Luu don hang'}
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
          <Paper sx={borderedCardSx}>
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
                  Ban line item van giu nhap truc tiep de thao tac nhanh.
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
                    <TableCell sx={{ width: '55%' }}>San pham</TableCell>
                    <TableCell align="center">So luong</TableCell>
                    <TableCell align="right">Don gia</TableCell>
                    <TableCell align="right">Thanh tien</TableCell>
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
                                renderInput={(params) => <TextField {...params} placeholder="Tim ten san pham hoac SKU" />}
                              />

                              {item.product_name ? (
                                <Box sx={{ mt: 1 }}>
                                  <Typography
                                    component={item.product_id ? RouterLink : 'span'}
                                    to={item.product_id ? `/products/${item.product_id}/edit` : undefined}
                                    sx={{ color: '#0f172a', fontWeight: 700, textDecoration: 'none' }}
                                  >
                                    {item.product_name}
                                  </Typography>
                                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
                                    Bien the: {item.variant_sku || item.sku || 'Chua chon bien the'}
                                  </Typography>
                                </Box>
                              ) : null}

                              <Button
                                variant="text"
                                sx={{ mt: 0.75, px: 0, minWidth: 0 }}
                                onClick={() => updateItem(index, { noteOpen: !item.noteOpen })}
                              >
                                {item.noteOpen || item.notes ? 'Sua ghi chu' : 'Them ghi chu'}
                              </Button>

                              {item.noteOpen ? (
                                <TextField
                                  fullWidth
                                  multiline
                                  minRows={2}
                                  sx={{ mt: 1 }}
                                  placeholder="Nhap ghi chu cho san pham nay"
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
                            value={item.quantity}
                            onChange={(event) => updateItem(index, { quantity: event.target.value })}
                            disabled={isLoading}
                            sx={{ width: 76, '& input': { textAlign: 'center' } }}
                          />
                        </TableCell>

                        <TableCell align="right">
                          <TextField
                            size="small"
                            value={item.unit_price}
                            onChange={(event) => updateItem(index, { unit_price: formatCurrencyInput(event.target.value) })}
                            onBlur={(event) => updateItem(index, { unit_price: formatCurrencyInput(event.target.value) })}
                            disabled={isLoading}
                            sx={{
                              width: 150,
                              '& input': {
                                textAlign: 'right',
                                fontVariantNumeric: 'tabular-nums',
                              },
                            }}
                            slotProps={{
                              input: {
                                endAdornment: <InputAdornment position="end">₫</InputAdornment>,
                              },
                            }}
                          />
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 1, fontVariantNumeric: 'tabular-nums' }}>
                            Discount: {formatCurrency(item.discount_amount)}
                          </Typography>
                        </TableCell>

                        <TableCell align="right">
                          <Typography sx={{ fontWeight: 600, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>
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
        </Stack>

        <Stack spacing={2.5}>
          <Paper sx={borderedCardSx}>
            <Stack spacing={1.5}>
              <SummaryPaperHeader title="Khach hang" onEdit={() => setActiveDialog('customer')} />
              <SummaryRow label="Khach hang" value={customerName || 'Chua chon khach hang'} />
              <SummaryRow label="Ma khach" value={customerCode || 'Khach le'} />
              <SummaryRow label="So dien thoai" value={customerPhone || 'Chua co so dien thoai'} />
              <SummaryRow label="Dia chi giao hang" value={customerAddress || 'Chua co dia chi giao hang'} multiline />
              <SummaryRow label="Nhom khach" value={customerId ? 'Khach thanh vien' : 'Chua gan khach hang'} />
              {visibleErrors.customer_name ? <Typography color="error">{visibleErrors.customer_name}</Typography> : null}
              {visibleErrors.customer_phone ? <Typography color="error">{visibleErrors.customer_phone}</Typography> : null}
            </Stack>
          </Paper>

          <Paper sx={borderedCardSx}>
            <Stack spacing={1.5}>
              <SummaryPaperHeader title="Thanh toan" onEdit={() => setActiveDialog('payment')} />
              <SummaryRow label="Trang thai" value={paymentStatusLabel} />
              <SummaryRow label="Tam tinh" value={formatCurrency(subTotal)} />
              <SummaryRow label="Thue" value={formatCurrency(taxAmount)} />
              <SummaryRow label="Phi van chuyen" value={formatCurrency(shippingFee)} />
              <SummaryRow label="Tong don" value={formatCurrency(totalAmount)} />
              {paymentStatus === 'deposit' ? <SummaryRow label="Tien coc" value={formatCurrency(normalizedDepositAmount)} /> : null}
              <SummaryRow
                label={paymentStatus === 'paid' ? 'Da thu' : 'Con phai thu'}
                value={formatCurrency(paymentStatus === 'paid' ? totalAmount : paymentStatus === 'deposit' ? outstandingAmount : totalAmount)}
              />
              <SummaryRow label="Ghi chu thanh toan" value={paymentNotes || 'Chua co ghi chu'} multiline />
              {visibleErrors.deposit_amount ? <Typography color="error">{visibleErrors.deposit_amount}</Typography> : null}
            </Stack>
          </Paper>

          <Paper sx={borderedCardSx}>
            <Stack spacing={1.5}>
              <SummaryPaperHeader title="Thong tin don" onEdit={() => setActiveDialog('order')} />
              <SummaryRow label="Ma don hang" value={orderCode || 'De trong de he thong tu tao'} />
              <SummaryRow label="Ngay tao don" value={formatDateOnly(orderDate)} />
              <SummaryRow label="Loai don" value={orderType === 'sale' ? 'Ban hang' : 'Tra hang'} />
              <SummaryRow
                label="Trang thai xu ly"
                value={options?.processing_statuses.find((status) => status.value === processingStatus)?.label ?? processingStatus}
              />
              <SummaryRow label="Kenh ban hang" value={salesChannel || 'Chua chon kenh'} />
              {visibleErrors.processing_status ? <Typography color="error">{visibleErrors.processing_status}</Typography> : null}
            </Stack>
          </Paper>

          <Paper sx={borderedCardSx}>
            <Stack spacing={1.5}>
              <SummaryPaperHeader title="Van chuyen" onEdit={() => setActiveDialog('shipping')} />
              <SummaryRow label="Don vi van chuyen" value={shippingService || 'Chua chon don vi'} />
              <SummaryRow label="Trang thai giao hang" value={shippingStatus || 'Chua co trang thai'} />
              <SummaryRow label="Ma tracking" value={trackingCode || 'Chua co tracking'} />
              <SummaryRow label="Trang thai kho" value={warehouseStatus || 'Chua co trang thai kho'} />
            </Stack>
          </Paper>

          <Paper sx={borderedCardSx}>
            <Stack spacing={1.5}>
              <SummaryPaperHeader title="Ghi chu va metadata" onEdit={() => setActiveDialog('meta')} />
              <SummaryRow label="Ghi chu don hang" value={orderNotes || 'Chua co ghi chu'} multiline />
              <SummaryRow label="Nguoi tao" value={createdBy || 'Chua co nguoi tao'} />
              <SummaryRow label="Nguoi xu ly" value={confirmedBy || 'Chua co nguoi xu ly'} />
              <SummaryRow label="Ma hoa don" value={invoiceCode || 'Chua co ma hoa don'} />
            </Stack>
          </Paper>
        </Stack>
      </Box>

      <Dialog open={activeDialog === 'customer'} onClose={() => setActiveDialog(null)} fullWidth maxWidth="sm">
        <DialogTitle>Chinh sua khach hang</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Autocomplete
              options={options?.customers ?? []}
              value={selectedCustomer}
              inputValue={customerSearch}
              getOptionLabel={(option) =>
                typeof option === 'string' ? option : `${option.full_name} • ${option.phone} • ${option.client_code}`
              }
              onInputChange={(_, value) => {
                setCustomerSearch(value)
                if (!customerId) {
                  setCustomerName(value)
                }
              }}
              onChange={(_, value) => handleCustomerSelect(value)}
              renderInput={(params) => <TextField {...params} label="Khach hang" placeholder="Tim theo ten, SDT, ma khach hang" />}
            />
            <StackedTextField fullWidth label="So dien thoai" value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} />
            <StackedTextField fullWidth multiline minRows={2} label="Dia chi giao hang" value={customerAddress} onChange={(event) => setCustomerAddress(event.target.value)} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setActiveDialog(null)}>Dong</Button>
          <Button variant="contained" onClick={() => setActiveDialog(null)}>Luu</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={activeDialog === 'payment'} onClose={() => setActiveDialog(null)} fullWidth maxWidth="sm">
        <DialogTitle>Chinh sua thanh toan</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <StackedDropdown fullWidth label="Trang thai thanh toan" value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value as 'unpaid' | 'paid' | 'deposit')}>
              <MenuItem value="unpaid">Chua thanh toan</MenuItem>
              <MenuItem value="paid">Thanh toan du</MenuItem>
              <MenuItem value="deposit">Dat coc</MenuItem>
            </StackedDropdown>
            <StackedTextField fullWidth label="Thue" type="number" value={taxAmount} onChange={(event) => setTaxAmount(event.target.value)} />
            <StackedTextField fullWidth label="Phi van chuyen" type="number" value={shippingFee} onChange={(event) => setShippingFee(event.target.value)} />
            {paymentStatus === 'deposit' ? (
              <StackedTextField fullWidth label="Tien coc" type="number" value={depositAmount} onChange={(event) => setDepositAmount(event.target.value)} />
            ) : null}
            <StackedTextField fullWidth multiline minRows={2} label="Ghi chu thanh toan" value={paymentNotes} onChange={(event) => setPaymentNotes(event.target.value)} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setActiveDialog(null)}>Dong</Button>
          <Button variant="contained" onClick={() => setActiveDialog(null)}>Luu</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={activeDialog === 'order'} onClose={() => setActiveDialog(null)} fullWidth maxWidth="sm">
        <DialogTitle>Chinh sua thong tin don</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <StackedTextField fullWidth label="Ma don hang" value={orderCode} onChange={(event) => setOrderCode(event.target.value)} />
            <StackedTextField fullWidth label="Ngay tao don" type="date" value={orderDate} onChange={(event) => setOrderDate(event.target.value)} />
            <StackedDropdown fullWidth label="Loai don" value={orderType} onChange={(event) => setOrderType(event.target.value as 'sale' | 'return')}>
              <MenuItem value="sale">Ban hang</MenuItem>
              <MenuItem value="return">Tra hang</MenuItem>
            </StackedDropdown>
            <StackedDropdown
              fullWidth
              label="Trang thai xu ly"
              value={processingStatus}
              onChange={(event) =>
                setProcessingStatus(
                  event.target.value as 'draft' | 'placed' | 'confirmed' | 'picked_up' | 'delivering' | 'completed' | 'cancelled' | 'returned',
                )
              }
            >
              {options?.processing_statuses.map((status) => (
                <MenuItem key={status.value} value={status.value}>
                  {status.label}
                </MenuItem>
              ))}
            </StackedDropdown>
            <StackedTextField fullWidth label="Kenh ban hang" value={salesChannel} onChange={(event) => setSalesChannel(event.target.value)} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setActiveDialog(null)}>Dong</Button>
          <Button variant="contained" onClick={() => setActiveDialog(null)}>Luu</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={activeDialog === 'shipping'} onClose={() => setActiveDialog(null)} fullWidth maxWidth="sm">
        <DialogTitle>Chinh sua van chuyen</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <StackedTextField fullWidth label="Don vi van chuyen" value={shippingService} onChange={(event) => setShippingService(event.target.value)} />
            <StackedTextField fullWidth label="Trang thai giao hang" value={shippingStatus} onChange={(event) => setShippingStatus(event.target.value)} />
            <StackedTextField fullWidth label="Ma tracking" value={trackingCode} onChange={(event) => setTrackingCode(event.target.value)} />
            <StackedTextField fullWidth label="Trang thai kho" value={warehouseStatus} onChange={(event) => setWarehouseStatus(event.target.value)} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setActiveDialog(null)}>Dong</Button>
          <Button variant="contained" onClick={() => setActiveDialog(null)}>Luu</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={activeDialog === 'meta'} onClose={() => setActiveDialog(null)} fullWidth maxWidth="sm">
        <DialogTitle>Chinh sua ghi chu va metadata</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <StackedTextField fullWidth multiline minRows={3} label="Ghi chu don hang" value={orderNotes} onChange={(event) => setOrderNotes(event.target.value)} />
            <StackedTextField fullWidth label="Nguoi tao" value={createdBy} onChange={(event) => setCreatedBy(event.target.value)} />
            <StackedTextField fullWidth label="Nguoi xu ly" value={confirmedBy} onChange={(event) => setConfirmedBy(event.target.value)} />
            <StackedTextField fullWidth label="Ma hoa don" value={invoiceCode} onChange={(event) => setInvoiceCode(event.target.value)} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setActiveDialog(null)}>Dong</Button>
          <Button variant="contained" onClick={() => setActiveDialog(null)}>Luu</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

function SummaryPaperHeader({ title, onEdit }: { title: string; onEdit: () => void }): ReactElement {
  return (
    <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
      <Typography sx={{ fontWeight: 800, color: '#0f172a' }}>{title}</Typography>
      <IconButton size="small" onClick={onEdit} sx={{ color: '#98a2b3' }}>
        <EditOutlinedIcon fontSize="small" />
      </IconButton>
    </Stack>
  )
}

function SummaryRow({
  label,
  value,
  multiline = false,
}: {
  label: string
  value: string
  multiline?: boolean
}): ReactElement {
  return (
    <Stack spacing={0.35}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography
        sx={{
          color: value.toLowerCase().startsWith('chua') || value.toLowerCase().startsWith('de trong') ? '#98a2b3' : '#0f172a',
          lineHeight: multiline ? 1.6 : 1.45,
          whiteSpace: multiline ? 'pre-wrap' : 'normal',
        }}
      >
        {value}
      </Typography>
      <Divider />
    </Stack>
  )
}
