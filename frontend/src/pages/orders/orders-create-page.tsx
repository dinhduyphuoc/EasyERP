import { useEffect, useMemo, useState, type ReactElement } from 'react'
import { Link as RouterLink, useLocation, useNavigate, useParams } from 'react-router'
import PersonAddAlt1OutlinedIcon from '@mui/icons-material/PersonAddAlt1Outlined'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined'
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined'
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined'
import {
  alpha,
  Autocomplete,
  Avatar,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
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
import { customerApi, type CityItem, type DistrictItem, type LocationItem } from '@/pages/customers/customer.api'
import { appToast } from '@/shared/ui/toast/toast.helpers'
import { borderedCardSx } from '@/shared/ui/paper'
import { StackedTextField } from '@/shared/ui/form/stacked-text-field'
import { StackedDropdown } from '@/shared/ui/form/stacked-dropdown'
import { SummaryPaperHeader } from '@/shared/ui/summary-paper-header'
import { orderApi, type OrderCreatePayload, type OrderListItem, type OrderOptionLookup } from './order.api'
import { formatCurrency } from './order.utils'

type OrderItemForm = {
  variant_sku: string
  product_id: number | null
  product_name: string
  sku: string
  image_url: string | null
  stock_on_hand: number
  stock_available: number
  quantity: string
  unit_price: string
  discount_amount: string
  notes: string
  noteOpen: boolean
}

type OrderCreateLocationState = {
  duplicateFrom?: OrderListItem
}

type DialogKey = 'payment' | 'order' | 'shipping' | 'meta' | null

type CustomerAutocompleteOption =
  | {
      kind: 'create'
      id: 'create'
    }
  | {
      kind: 'customer'
      customer: OrderOptionLookup['customers'][number]
    }

type CustomerModalMode = 'create' | 'edit'
type ProductSearchOption = OrderOptionLookup['products'][number]

type CustomerModalForm = {
  fullName: string
  phone: string
  addressLine: string
  state: LocationItem | null
  city: CityItem | null
  district: DistrictItem | null
  setAsDefaultAddress: boolean
}

type ParsedCustomerAddress = {
  addressLine: string
  districtName: string
  cityName: string
  stateName: string
}

const parseCurrencyValue = (value: string | number | null | undefined): number => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0
  }

  const digits = String(value ?? '').replace(/\D/g, '')
  return Number(digits || '0')
}

const formatCurrencyInput = (value: string | number | null | undefined): string =>
  parseCurrencyValue(value).toLocaleString('vi-VN')

const formatStockNumber = (value: number | null | undefined): string => Number(value ?? 0).toLocaleString('vi-VN')

const createItemFromProduct = (product: ProductSearchOption): OrderItemForm => ({
  variant_sku: product.sku,
  product_id: product.product_id,
  product_name: product.product_name,
  sku: product.sku,
  image_url: product.image_url,
  stock_on_hand: product.stock_on_hand ?? 0,
  stock_available: product.stock_available ?? 0,
  quantity: '1',
  unit_price: formatCurrencyInput(product.selling_price),
  discount_amount: '0',
  notes: '',
  noteOpen: false,
})

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

const createEmptyCustomerModalForm = (): CustomerModalForm => ({
  fullName: '',
  phone: '',
  addressLine: '',
  state: null,
  city: null,
  district: null,
  setAsDefaultAddress: true,
})

const buildCustomerAddress = (form: CustomerModalForm): string =>
  [form.addressLine.trim(), form.district?.name, form.city?.name, form.state?.name].filter(Boolean).join(', ')

const formatDefaultCustomerAddress = (customer: OrderOptionLookup['customers'][number]): string => {
  const address = customer.default_address?.address

  if (!address) {
    return ''
  }

  return [address.address_line, address.district_name, address.city_name, address.state_name]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(', ')
}

const normalizeLocationLookup = (value: string): string => value.trim().toLowerCase()

const parseCustomerAddress = (address: string): ParsedCustomerAddress => {
  const parts = address
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)

  if (parts.length === 0) {
    return {
      addressLine: '',
      districtName: '',
      cityName: '',
      stateName: '',
    }
  }

  if (parts.length === 1) {
    return {
      addressLine: parts[0],
      districtName: '',
      cityName: '',
      stateName: '',
    }
  }

  if (parts.length === 2) {
    return {
      addressLine: '',
      districtName: '',
      cityName: parts[0],
      stateName: parts[1],
    }
  }

  if (parts.length === 3) {
    return {
      addressLine: '',
      districtName: parts[0],
      cityName: parts[1],
      stateName: parts[2],
    }
  }

  return {
    addressLine: parts.slice(0, parts.length - 3).join(', '),
    districtName: parts[parts.length - 3],
    cityName: parts[parts.length - 2],
    stateName: parts[parts.length - 1],
  }
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
  const [states, setStates] = useState<LocationItem[]>([])
  const [cities, setCities] = useState<CityItem[]>([])
  const [districts, setDistricts] = useState<DistrictItem[]>([])
  const [isStatesLoading, setIsStatesLoading] = useState(false)
  const [isCitiesLoading, setIsCitiesLoading] = useState(false)
  const [isDistrictsLoading, setIsDistrictsLoading] = useState(false)
  const [customerModalOpen, setCustomerModalOpen] = useState(false)
  const [customerModalMode, setCustomerModalMode] = useState<CustomerModalMode>('create')
  const [customerModalForm, setCustomerModalForm] = useState<CustomerModalForm>(createEmptyCustomerModalForm)
  const [customerModalPrefill, setCustomerModalPrefill] = useState<ParsedCustomerAddress | null>(null)
  const [isCustomerModalSaving, setIsCustomerModalSaving] = useState(false)

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
  const [items, setItems] = useState<OrderItemForm[]>([])
  const [productSearchInput, setProductSearchInput] = useState('')
  const [productSearchResetKey, setProductSearchResetKey] = useState(0)
  const [selectedItemIndexes, setSelectedItemIndexes] = useState<number[]>([])

  useEffect(() => {
    const fetchFormData = async () => {
      setIsLoading(true)
      setIsStatesLoading(true)

      try {
        const [optionsData, statesData, orderData] = await Promise.all([
          orderApi.getOrderOptions(),
          customerApi.getStates({ is_active: true }),
          isEditMode && orderId ? orderApi.getOrderById(orderId) : Promise.resolve(null),
        ])

        setOptions(optionsData)
        setStates(statesData)

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
          const productOptionMap = new Map(optionsData.products.map((product) => [product.sku, product]))

          setItems(
            orderData.order_items.length > 0
              ? orderData.order_items.map((item) => {
                  const productOption = productOptionMap.get(item.variant_sku ?? item.sku)

                  return {
                    variant_sku: item.variant_sku ?? '',
                    product_id: item.product_id,
                    product_name: item.product_name,
                    sku: item.sku,
                    image_url: productOption?.image_url ?? null,
                    stock_on_hand: productOption?.stock_on_hand ?? 0,
                    stock_available: productOption?.stock_available ?? 0,
                    quantity: String(item.quantity),
                    unit_price: formatCurrencyInput(item.unit_price),
                    discount_amount: item.discount_amount,
                    notes: item.notes ?? '',
                    noteOpen: Boolean(item.notes),
                  }
                })
              : [],
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
          const productOptionMap = new Map(optionsData.products.map((product) => [product.sku, product]))

          setItems(
            duplicateSource.order_items.length > 0
              ? duplicateSource.order_items.map((item) => {
                  const productOption = productOptionMap.get(item.variant_sku ?? item.sku)

                  return {
                    variant_sku: item.variant_sku ?? '',
                    product_id: item.product_id,
                    product_name: item.product_name,
                    sku: item.sku,
                    image_url: productOption?.image_url ?? null,
                    stock_on_hand: productOption?.stock_on_hand ?? 0,
                    stock_available: productOption?.stock_available ?? 0,
                    quantity: String(item.quantity),
                    unit_price: formatCurrencyInput(item.unit_price),
                    discount_amount: item.discount_amount,
                    notes: item.notes ?? '',
                    noteOpen: Boolean(item.notes),
                  }
                })
              : [],
          )
          appToast.info(`Đã sao chép từ đơn hàng ${duplicateSource.order_code}. Bạn đang tạo một bản sao mới.`)
        }
      } catch (error) {
        console.error('Lỗi khi tải dữ liệu đơn hàng:', error)
        appToast.error(getErrorMessage(error, 'Không thể tải dữ liệu đơn hàng.'))
      } finally {
        setIsStatesLoading(false)
        setIsLoading(false)
      }
    }

    void fetchFormData()
  }, [duplicateSource, isEditMode, orderId])

  useEffect(() => {
    if (!customerModalOpen || !customerModalForm.state) {
      setCities([])
      return
    }

    const fetchCities = async () => {
      setIsCitiesLoading(true)

      try {
        const nextCities = await customerApi.getCities({
          state_id: customerModalForm.state?.id,
          is_active: true,
        })
        setCities(nextCities)
      } catch (error) {
        console.error('Lỗi khi tải danh sách Huyện/Quận:', error)
        appToast.error(getErrorMessage(error, 'Không thể tải danh sách Huyện/Quận.'))
      } finally {
        setIsCitiesLoading(false)
      }
    }

    void fetchCities()
  }, [customerModalForm.state, customerModalOpen])

  useEffect(() => {
    if (!customerModalOpen || !customerModalForm.city) {
      setDistricts([])
      return
    }

    const fetchDistricts = async () => {
      setIsDistrictsLoading(true)

      try {
        const nextDistricts = await customerApi.getDistricts({
          city_id: customerModalForm.city?.id,
          is_active: true,
        })
        setDistricts(nextDistricts)
      } catch (error) {
        console.error('Lỗi khi tải danh sách Xa/Phường:', error)
        appToast.error(getErrorMessage(error, 'Không thể tải danh sách Xa/Phường.'))
      } finally {
        setIsDistrictsLoading(false)
      }
    }

    void fetchDistricts()
  }, [customerModalForm.city, customerModalOpen])

  useEffect(() => {
    if (!customerModalOpen || !customerModalPrefill?.stateName || customerModalForm.state || states.length === 0) {
      return
    }

    const matchedState =
      states.find((item) => normalizeLocationLookup(item.name) === normalizeLocationLookup(customerModalPrefill.stateName)) ??
      null

    if (!matchedState) {
      return
    }

    setCustomerModalForm((current) => ({
      ...current,
      state: matchedState,
    }))
  }, [customerModalForm.state, customerModalOpen, customerModalPrefill, states])

  useEffect(() => {
    if (!customerModalOpen || !customerModalPrefill?.cityName || !customerModalForm.state || customerModalForm.city || cities.length === 0) {
      return
    }

    const matchedCity =
      cities.find((item) => normalizeLocationLookup(item.name) === normalizeLocationLookup(customerModalPrefill.cityName)) ??
      null

    if (!matchedCity) {
      return
    }

    setCustomerModalForm((current) => ({
      ...current,
      city: matchedCity,
    }))
  }, [cities, customerModalForm.city, customerModalForm.state, customerModalOpen, customerModalPrefill])

  useEffect(() => {
    if (!customerModalOpen || !customerModalPrefill?.districtName || !customerModalForm.city || customerModalForm.district || districts.length === 0) {
      return
    }

    const matchedDistrict =
      districts.find(
        (item) => normalizeLocationLookup(item.name) === normalizeLocationLookup(customerModalPrefill.districtName),
      ) ?? null

    if (!matchedDistrict) {
      return
    }

    setCustomerModalForm((current) => ({
      ...current,
      district: matchedDistrict,
    }))
  }, [customerModalForm.city, customerModalForm.district, customerModalOpen, customerModalPrefill, districts])

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
  const selectedItemIndexSet = useMemo(() => new Set(selectedItemIndexes), [selectedItemIndexes])
  const selectedItemCount = selectedItemIndexes.length
  const areAllItemsSelected = itemRows.length > 0 && selectedItemCount === itemRows.length
  const areSomeItemsSelected = selectedItemCount > 0 && selectedItemCount < itemRows.length

  const errors = useMemo(() => {
    const nextErrors: Record<string, string> = {}

    if (!customerName.trim()) {
      nextErrors.customer_name = 'Tên khách hàng là bắt buộc.'
    }

    if (!customerPhone.trim()) {
      nextErrors.customer_phone = 'Số điện thoại là bắt buộc.'
    }

    const validItems = itemRows.filter((item) => item.product_name.trim() || item.sku.trim())

    if (processingStatus !== 'draft' && validItems.length === 0) {
      nextErrors.order_items = 'Đơn hàng cần ít nhất một sản phẩm.'
    }

    if (
      processingStatus !== 'draft' &&
      validItems.some((item) => !item.product_name.trim() || !item.sku.trim() || Number(item.quantity) <= 0)
    ) {
      nextErrors.order_items = 'Mỗi dòng sản phẩm cần có tên, SKU và số lượng hợp lệ.'
    }

    if (paymentStatus === 'deposit' && normalizedDepositAmount <= 0) {
      nextErrors.deposit_amount = 'Vui lòng nhập số tiền cọc lớn hơn 0.'
    }

    if (paymentStatus === 'deposit' && normalizedDepositAmount > totalAmount) {
      nextErrors.deposit_amount = 'Tiền cọc không được lớn hơn tổng đơn hàng.'
    }

    if (paymentStatus === 'unpaid' && processingStatus === 'completed') {
      nextErrors.processing_status = 'Đơn chưa thanh toán không thể đánh dấu hoàn thành.'
    }

    if (paymentStatus === 'deposit' && processingStatus === 'completed') {
      nextErrors.processing_status = 'Đơn đặt cọc chưa thể hoàn thành khi vẫn còn công nợ.'
    }

    return nextErrors
  }, [customerName, customerPhone, itemRows, normalizedDepositAmount, paymentStatus, processingStatus, totalAmount])

  const visibleErrors = hasAttemptedSave ? errors : {}
  const canSave = !isLoading && !isSaving && Object.keys(errors).length === 0
  const canEditOrder = !isEditMode || !loadedOrder || ['draft', 'placed'].includes(loadedOrder.processing_status)
  const paymentStatusLabel =
    paymentStatus === 'paid' ? 'Đã thanh toán đủ' : paymentStatus === 'deposit' ? 'Đặt cọc' : 'Chưa thanh toán'
  const hasSelectedCustomer = Boolean(customerName.trim() || customerPhone.trim() || customerAddress.trim() || customerId)
  const customerSearchOptions = useMemo<CustomerAutocompleteOption[]>(() => {
    const normalizedKeyword = customerSearch.trim().toLowerCase()
    const matchedCustomers =
      options?.customers.filter((customer) => {
        if (!normalizedKeyword) {
          return true
        }

        const haystack = [customer.full_name, customer.client_code, customer.phone].join(' ').toLowerCase()
        return haystack.includes(normalizedKeyword)
      }) ?? []

    return [
      {
        kind: 'create',
        id: 'create',
      },
      ...matchedCustomers.map((customer) => ({
        kind: 'customer' as const,
        customer,
      })),
    ]
  }, [customerSearch, options?.customers])

  const handleCustomerSelect = (value: OrderOptionLookup['customers'][number] | null) => {
    if (!value) {
      setCustomerId('')
      setCustomerCode('')
      setCustomerName('')
      setCustomerPhone('')
      setCustomerAddress('')
      setCustomerSearch('')
      return
    }

    setCustomerId(String(value.id))
    setCustomerCode(value.client_code)
    setCustomerName(value.full_name)
    setCustomerPhone(value.phone)
    setCustomerAddress(formatDefaultCustomerAddress(value))
    setCustomerSearch(`${value.full_name} - ${value.client_code} - ${value.phone}`)
  }

  const handleCustomerModalFieldChange = (field: 'fullName' | 'phone' | 'addressLine', value: string) => {
    setCustomerModalForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  const handleCustomerModalDefaultAddressChange = (checked: boolean) => {
    setCustomerModalForm((current) => ({
      ...current,
      setAsDefaultAddress: checked,
    }))
  }

  const handleCustomerModalStateChange = (_event: unknown, value: LocationItem | null) => {
    setCustomerModalForm((current) => ({
      ...current,
      state: value,
      city: null,
      district: null,
    }))
  }

  const handleCustomerModalCityChange = (_event: unknown, value: CityItem | null) => {
    setCustomerModalForm((current) => ({
      ...current,
      city: value,
      district: null,
    }))
  }

  const handleCustomerModalDistrictChange = (_event: unknown, value: DistrictItem | null) => {
    setCustomerModalForm((current) => ({
      ...current,
      district: value,
    }))
  }

  const handleOpenCreateCustomerModal = () => {
    const parsedAddress = parseCustomerAddress(customerAddress)
    setCustomerModalMode('create')
    setCustomerModalForm({
      ...createEmptyCustomerModalForm(),
      fullName: customerSearch.trim(),
      phone: customerPhone.trim(),
      addressLine: parsedAddress.addressLine,
      setAsDefaultAddress: true,
    })
    setCustomerModalPrefill(parsedAddress)
    setCustomerModalOpen(true)
  }

  const handleOpenEditCustomerModal = () => {
    const parsedAddress = parseCustomerAddress(customerAddress)
    setCustomerModalMode('edit')
    setCustomerModalForm({
      fullName: customerName,
      phone: customerPhone,
      addressLine: parsedAddress.addressLine,
      state: null,
      city: null,
      district: null,
      setAsDefaultAddress: true,
    })
    setCustomerModalPrefill(parsedAddress)
    setCustomerModalOpen(true)
  }

  const handleCloseCustomerModal = () => {
    if (isCustomerModalSaving) {
      return
    }

    setCustomerModalOpen(false)
    setCustomerModalPrefill(null)
  }

  const handleClearCustomer = () => {
    handleCustomerSelect(null)
    setCustomerModalForm(createEmptyCustomerModalForm())
    setCustomerModalPrefill(null)
  }

  const handleSaveCustomerModal = async () => {
    const fullName = customerModalForm.fullName.trim()
    const phone = customerModalForm.phone.trim()
    const address = buildCustomerAddress(customerModalForm)
    const shouldSetDefaultAddress =
      customerModalForm.setAsDefaultAddress &&
      Boolean(customerModalForm.addressLine.trim() && customerModalForm.state && customerModalForm.city)

    if (!fullName || !phone) {
      appToast.warning('Vui lòng nhập họ tên và số điện thoại khách hàng.')
      return
    }

    if (customerModalMode === 'edit') {
      setCustomerName(fullName)
      setCustomerPhone(phone)
      setCustomerAddress(address)
      setCustomerSearch(`${fullName}${customerCode ? ` - ${customerCode}` : ''} - ${phone}`)
      if (shouldSetDefaultAddress && customerId) {
        setIsCustomerModalSaving(true)
        try {
          const updatedCustomer = await customerApi.updateCustomer(customerId, {
            full_name: fullName,
            phone,
            addresses: [
              {
                type: 'shipping',
                label: 'Địa chỉ chính',
                is_default: true,
                recipient_name: fullName,
                recipient_phone: phone,
                address: {
                  state_id: customerModalForm.state?.id,
                  city_id: customerModalForm.city?.id,
                  district_id: customerModalForm.district?.id ?? null,
                  address_line: customerModalForm.addressLine.trim(),
                },
              },
            ],
          })
          setOptions((current) =>
            current
              ? {
                  ...current,
                  customers: current.customers.map((item) =>
                    item.id === updatedCustomer.id
                      ? {
                          ...item,
                          full_name: updatedCustomer.full_name,
                          phone: updatedCustomer.phone ?? phone,
                          default_address: updatedCustomer.addresses.find((entry) => entry.is_default)
                            ? {
                                id: updatedCustomer.addresses.find((entry) => entry.is_default)!.id,
                                address: updatedCustomer.addresses.find((entry) => entry.is_default)!.address,
                              }
                            : item.default_address,
                        }
                      : item,
                  ),
                }
              : current,
          )
        } catch (error) {
          console.error('Lỗi khi cập nhật địa chỉ mặc định:', error)
          appToast.error(getErrorMessage(error, 'Không thể cập nhật địa chỉ mặc định.'))
          setIsCustomerModalSaving(false)
          return
        } finally {
          setIsCustomerModalSaving(false)
        }
      }
      setCustomerModalOpen(false)
      appToast.success('Đã cập nhật thông tin khách hàng trên đơn hàng.')
      return
    }

    setIsCustomerModalSaving(true)

    try {
      const createdCustomer = await customerApi.createCustomer({
        full_name: fullName,
        phone,
        status: 'active',
        addresses: shouldSetDefaultAddress
          ? [
              {
                type: 'shipping',
                label: 'Địa chỉ chính',
                is_default: true,
                recipient_name: fullName,
                recipient_phone: phone,
                address: {
                  state_id: customerModalForm.state?.id,
                  city_id: customerModalForm.city?.id,
                  district_id: customerModalForm.district?.id ?? null,
                  address_line: customerModalForm.addressLine.trim(),
                },
              },
            ]
          : undefined,
      })

      setOptions((current) =>
        current
          ? {
              ...current,
              customers: [
                {
                  id: createdCustomer.id,
                  client_code: createdCustomer.client_code,
                  full_name: createdCustomer.full_name,
                  phone: createdCustomer.phone ?? phone,
                  default_address: createdCustomer.addresses.find((entry) => entry.is_default)
                    ? {
                        id: createdCustomer.addresses.find((entry) => entry.is_default)!.id,
                        address: createdCustomer.addresses.find((entry) => entry.is_default)!.address,
                      }
                    : null,
                },
                ...current.customers.filter((item) => item.id !== createdCustomer.id),
              ],
            }
          : current,
      )
      setCustomerId(String(createdCustomer.id))
      setCustomerCode(createdCustomer.client_code)
      setCustomerName(createdCustomer.full_name)
      setCustomerPhone(createdCustomer.phone ?? phone)
      setCustomerAddress(address)
      setCustomerSearch(`${createdCustomer.full_name} - ${createdCustomer.client_code} - ${createdCustomer.phone ?? phone}`)
      setCustomerModalOpen(false)
      appToast.success(`Đã thêm khách hàng ${createdCustomer.full_name} vào đơn hàng.`)
    } catch (error) {
      console.error('Lỗi khi tạo khách hàng:', error)
      appToast.error(getErrorMessage(error, 'Không thể tạo khách hàng mới.'))
    } finally {
      setIsCustomerModalSaving(false)
    }
  }

  const handleProductSearchSelect = (value: ProductSearchOption | null) => {
    if (!value) {
      setProductSearchInput('')
      return
    }

    setItems((current) => [...current, createItemFromProduct(value)])
    setSelectedItemIndexes([])
    setProductSearchInput('')
    setProductSearchResetKey((current) => current + 1)
  }

  const updateItem = (index: number, patch: Partial<OrderItemForm>) => {
    setItems((current) =>
      current.map((item, currentIndex) => (currentIndex === index ? { ...item, ...patch } : item)),
    )
  }

  const removeItem = (index: number) => {
    setItems((current) => current.filter((_, currentIndex) => currentIndex !== index))
    setSelectedItemIndexes([])
  }

  const handleToggleItemSelection = (index: number) => {
    setSelectedItemIndexes((current) =>
      current.includes(index) ? current.filter((itemIndex) => itemIndex !== index) : [...current, index].sort((a, b) => a - b),
    )
  }

  const handleToggleAllItems = (checked: boolean) => {
    setSelectedItemIndexes(checked ? itemRows.map((_, index) => index) : [])
  }

  const handleBulkDeleteItems = () => {
    if (selectedItemIndexes.length === 0) {
      return
    }

    const selectedIndexes = new Set(selectedItemIndexes)
    setItems((current) => current.filter((_, index) => !selectedIndexes.has(index)))
    setSelectedItemIndexes([])
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
      appToast.warning('Vui lòng kiểm tra lại thông tin trước khi lưu đơn hàng.')
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
        isEditMode ? `Cập nhật đơn hàng ${order.order_code} thành công.` : `Tạo đơn hàng ${order.order_code} thành công.`,
      )
      navigate(`/orders/${order.id}`)
    } catch (error) {
      console.error('Loi khi tao don hang:', error)
      appToast.error(
        getErrorMessage(
          error,
          isEditMode ? 'Không thể cập nhật đơn hàng. Vui lòng thử lại.' : 'Không thể tạo đơn hàng. Vui lòng thử lại.',
        ),
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Box sx={{ px: { xs: 2, md: 3, xl: 4 }, pb: 8 }}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={2}
          sx={{ marginBottom: 2, justifyContent: 'space-between', alignItems: { md: 'center' } }}
        >
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
            <Paper onClick={() => (navigate('/orders'))} sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              p: 1
            }}>
              <ArrowBackIcon sx={{color: '#344054' }} />
            </Paper>
            <Typography variant="h5" sx={{ fontWeight: 600, color: '#0f172a' }}>
              {isEditMode ? 'Chỉnh sửa đơn hàng' : duplicateSource ? 'Sao chép đơn hàng' : 'Tạo đơn hàng'}
            </Typography>
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <Button
              variant="contained"
              color="secondary"
              startIcon={isSaving ? <CircularProgress size={16} color="inherit" /> : <SaveOutlinedIcon />}
              onClick={() => void handleSave()}
              disabled={!canSave || !canEditOrder}
            >
              Lưu
            </Button>
          </Stack>
        </Stack>

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
            <Stack spacing={3}>
              <SummaryPaperHeader title="Thông tin khách hàng" />

              {hasSelectedCustomer ? (
                <Stack
                  direction="row"
                  spacing={1.5}
                  sx={{
                    alignItems: 'flex-start',
                    p: 2,
                    borderRadius: 3,
                    border: (theme) => `1px solid ${alpha(theme.palette.divider, 0.9)}`,
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
                    <Stack
                      direction={{ xs: 'column', sm: 'row' }}
                      spacing={1}
                      sx={{ justifyContent: 'space-between', alignItems: { sm: 'flex-start' } }}
                    >
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 800, color: '#0f172a' }}>
                          {customerName || 'Khách hàng'}
                        </Typography>
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
                        onClick={handleOpenEditCustomerModal}
                      >
                        Chỉnh sửa
                      </Button>
                    </Stack>
                  </Stack>

                  <IconButton size="small" aria-label="Xóa khách hàng đã chọn" onClick={handleClearCustomer}>
                    <CloseRoundedIcon fontSize="small" />
                  </IconButton>
                </Stack>
              ) : (
                <Autocomplete<CustomerAutocompleteOption, false, false, false>
                  options={customerSearchOptions}
                  value={null}
                  inputValue={customerSearch}
                  loading={isLoading}
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
                  onInputChange={(_, value) => setCustomerSearch(value)}
                  onChange={(_, value) => {
                    if (!value) {
                      return
                    }

                    if (value.kind === 'create') {
                      handleOpenCreateCustomerModal()
                      return
                    }

                    handleCustomerSelect(value.customer)
                  }}
                  renderOption={(props, option) => {
                    if (option.kind === 'create') {
                      return (
                        <Box component="li" {...props}>
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
                      <Box component="li" {...props}>
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
                      error={Boolean(visibleErrors.customer_name || visibleErrors.customer_phone)}
                    />
                  )}
                />
              )}

              {visibleErrors.customer_name ? <Typography color="error">{visibleErrors.customer_name}</Typography> : null}
              {visibleErrors.customer_phone ? <Typography color="error">{visibleErrors.customer_phone}</Typography> : null}
            </Stack>
          </Paper>

          <Paper sx={borderedCardSx}>
            <Stack spacing={2}>
              <SummaryPaperHeader title="Sản phẩm" />

              <Autocomplete
                key={productSearchResetKey}
                options={options?.products ?? []}
                value={null}
                inputValue={productSearchInput}
                disabled={isLoading}
                getOptionLabel={(option) => option.label}
                isOptionEqualToValue={(option, value) => option.sku === value.sku}
                onInputChange={(_, value, reason) => {
                  setProductSearchInput(reason === 'reset' ? '' : value)
                }}
                onChange={(_, value) => handleProductSearchSelect(value)}
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
                          {option.sku} - {formatCurrency(option.selling_price)}
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

            {visibleErrors.order_items ? (
              <Typography color="error">
                {visibleErrors.order_items}
              </Typography>
            ) : null}

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
                <Typography sx={{ fontWeight: 700, color: '#0f172a' }}>
                  Đã chọn {selectedItemCount} sản phẩm
                </Typography>
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<DeleteOutlineOutlinedIcon />}
                  onClick={handleBulkDeleteItems}
                >
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
              <Table sx={{ minWidth: 820 }}>
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={areAllItemsSelected}
                        indeterminate={areSomeItemsSelected}
                        onChange={(event) => handleToggleAllItems(event.target.checked)}
                        disabled={isLoading}
                      />
                    </TableCell>
                    <TableCell sx={{ width: '50%' }}>Sản phẩm</TableCell>
                    <TableCell align="center">Số lượng</TableCell>
                    <TableCell align="right">Đơn giá</TableCell>
                    <TableCell align="right">Thành tiền</TableCell>
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
                          <Checkbox
                            checked={selectedItemIndexSet.has(index)}
                            onChange={() => handleToggleItemSelection(index)}
                            disabled={isLoading}
                          />
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

                              <Button
                                variant="text"
                                sx={{ mt: 0.75, px: 0, minWidth: 0 }}
                                onClick={() => updateItem(index, { noteOpen: !item.noteOpen })}
                              >
                                {item.noteOpen || item.notes ? 'Sửa ghi chú' : 'Thêm ghi chú'}
                              </Button>

                              {item.noteOpen ? (
                                <TextField
                                  fullWidth
                                  multiline
                                  minRows={2}
                                  sx={{ mt: 1 }}
                                  placeholder="Nhập ghi chú cho sản phẩm này"
                                  value={item.notes}
                                  onChange={(event) => updateItem(index, { notes: event.target.value })}
                                  disabled={isLoading}
                                />
                              ) : null}
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
                                endAdornment: <InputAdornment position="end">đ</InputAdornment>,
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
                  ))}
                </TableBody>
              </Table>
            </Box>
            )}
            </Stack>
          </Paper>

          <Paper sx={borderedCardSx}>
            <Stack spacing={1.5}>
              <SummaryPaperHeader title="Thanh toán" onEdit={() => setActiveDialog('payment')} />
              <SummaryRow label="Trạng thái" value={paymentStatusLabel} />
              <SummaryRow label="Tạm tính" value={formatCurrency(subTotal)} />
              <SummaryRow label="Thuế" value={formatCurrency(taxAmount)} />
              <SummaryRow label="Phí vận chuyển" value={formatCurrency(shippingFee)} />
              <SummaryRow label="Tổng đơn" value={formatCurrency(totalAmount)} />
              {paymentStatus === 'deposit' ? <SummaryRow label="Tiền cọc" value={formatCurrency(normalizedDepositAmount)} /> : null}
              <SummaryRow
                label={paymentStatus === 'paid' ? 'Đã thu' : 'Còn phải thu'}
                value={formatCurrency(paymentStatus === 'paid' ? totalAmount : paymentStatus === 'deposit' ? outstandingAmount : totalAmount)}
              />
              <SummaryRow label="Ghi chú thanh toán" value={paymentNotes || 'Chưa có ghi chú'} multiline />
              {visibleErrors.deposit_amount ? <Typography color="error">{visibleErrors.deposit_amount}</Typography> : null}
            </Stack>
          </Paper>
        </Stack>

        <Stack spacing={2.5}>
          <Paper sx={borderedCardSx}>
            <Stack spacing={1.5}>
              <SummaryPaperHeader title="Thông tin đơn hàng" onEdit={() => setActiveDialog('order')} />
              <SummaryRow label="Mã đơn hàng" value={orderCode || 'Đang được hệ thống tự tạo'} />
              <SummaryRow label="Ngày tạo đơn" value={formatDateOnly(orderDate)} />
              <SummaryRow label="Loại đơn" value={orderType === 'sale' ? 'Bán hàng' : 'Trả hàng'} />
              <SummaryRow
                label="Trạng thái xử lý"
                value={options?.processing_statuses.find((status) => status.value === processingStatus)?.label ?? processingStatus}
              />
              <SummaryRow label="Kênh bán hàng" value={salesChannel || 'Chưa chọn kênh'} />
              {visibleErrors.processing_status ? <Typography color="error">{visibleErrors.processing_status}</Typography> : null}
            </Stack>
          </Paper>

          <Paper sx={borderedCardSx}>
            <Stack spacing={1.5}>
              <SummaryPaperHeader title="Vận chuyển" onEdit={() => setActiveDialog('shipping')} />
              <SummaryRow label="Đơn vị vận chuyển" value={shippingService || 'Chưa chọn đơn vị'} />
              <SummaryRow label="Trạng thái giao hàng" value={shippingStatus || 'Chưa có trạng thái'} />
              <SummaryRow label="Mã tracking" value={trackingCode || 'Chưa có tracking'} />
              <SummaryRow label="Trạng thái kho" value={warehouseStatus || 'Chưa có trạng thái kho'} />
            </Stack>
          </Paper>

          <Paper sx={borderedCardSx}>
            <Stack spacing={1.5}>
              <SummaryPaperHeader title="Ghi chú và metadata" onEdit={() => setActiveDialog('meta')} />
              <SummaryRow label="Ghi chú đơn hàng" value={orderNotes || 'Chưa có ghi chú'} multiline />
              <SummaryRow label="Người tạo" value={createdBy || 'Chưa có người tạo'} />
              <SummaryRow label="Người xử lý" value={confirmedBy || 'Chưa có người xử lý'} />
              <SummaryRow label="Mã hóa đơn" value={invoiceCode || 'Chưa có mã hóa đơn'} />
            </Stack>
          </Paper>
        </Stack>
      </Box>

      <Dialog open={customerModalOpen} onClose={handleCloseCustomerModal} fullWidth maxWidth="md">
        <DialogTitle>{customerModalMode === 'create' ? 'Tạo khách hàng mới' : 'Chỉnh sửa khách hàng'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <StackedTextField
                fullWidth
                label="Họ và tên"
                value={customerModalForm.fullName}
                onChange={(event) => handleCustomerModalFieldChange('fullName', event.target.value)}
              />
              <StackedTextField
                fullWidth
                label="Số điện thoại"
                value={customerModalForm.phone}
                onChange={(event) => handleCustomerModalFieldChange('phone', event.target.value)}
              />
            </Stack>
            <StackedTextField
              fullWidth
              label="Địa chỉ"
              placeholder="Số nhà, tên đường"
              value={customerModalForm.addressLine}
              onChange={(event) => handleCustomerModalFieldChange('addressLine', event.target.value)}
            />
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="body2" sx={{ mb: 1, color: '#344054', fontWeight: 500 }}>
                  Tỉnh/Thành phố
                </Typography>
                <Autocomplete
                  options={states}
                  value={customerModalForm.state}
                  loading={isStatesLoading}
                  onChange={handleCustomerModalStateChange}
                  getOptionLabel={(option) => option.name}
                  isOptionEqualToValue={(option, value) => option.id === value.id}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      size="small"
                      placeholder="Chọn tỉnh/thành phố"
                    />
                  )}
                />
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant="body2" sx={{ mb: 1, color: '#344054', fontWeight: 500 }}>
                  Huyện/Quận
                </Typography>
                <Autocomplete
                  options={cities}
                  value={customerModalForm.city}
                  loading={isCitiesLoading}
                  onChange={handleCustomerModalCityChange}
                  getOptionLabel={(option) => option.name}
                  isOptionEqualToValue={(option, value) => option.id === value.id}
                  disabled={!customerModalForm.state}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      size="small"
                      placeholder="Chọn Huyện/Quận"
                    />
                  )}
                />
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant="body2" sx={{ mb: 1, color: '#344054', fontWeight: 500 }}>
                  Xã/Phường
                </Typography>
                <Autocomplete
                  options={districts}
                  value={customerModalForm.district}
                  loading={isDistrictsLoading}
                  onChange={handleCustomerModalDistrictChange}
                  getOptionLabel={(option) => option.name}
                  isOptionEqualToValue={(option, value) => option.id === value.id}
                  disabled={!customerModalForm.city}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      size="small"
                      placeholder="Chọn Xã/Phường"
                    />
                  )}
                />
              </Box>
            </Stack>
            <FormControlLabel
              control={
                <Checkbox
                  checked={customerModalForm.setAsDefaultAddress}
                  onChange={(event) => handleCustomerModalDefaultAddressChange(event.target.checked)}
                />
              }
              label="Đặt địa chỉ này làm mặc định"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseCustomerModal} disabled={isCustomerModalSaving}>
            Đóng
          </Button>
          <Button
            variant="contained"
            onClick={() => void handleSaveCustomerModal()}
            disabled={isCustomerModalSaving}
            startIcon={isCustomerModalSaving ? <CircularProgress size={16} color="inherit" /> : <SaveOutlinedIcon />}
          >
            {isCustomerModalSaving ? 'Đang lưu...' : customerModalMode === 'create' ? 'Tạo khách hàng' : 'Cập nhật'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={activeDialog === 'payment'} onClose={() => setActiveDialog(null)} fullWidth maxWidth="sm">
        <DialogTitle>Chỉnh sửa thanh toán</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <StackedDropdown fullWidth label="Trạng thái thanh toán" value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value as 'unpaid' | 'paid' | 'deposit')}>
              <MenuItem value="unpaid">Chưa thanh toán</MenuItem>
              <MenuItem value="paid">Thanh toán đủ</MenuItem>
              <MenuItem value="deposit">Đặt cọc</MenuItem>
            </StackedDropdown>
            <StackedTextField fullWidth label="Thuế" type="number" value={taxAmount} onChange={(event) => setTaxAmount(event.target.value)} />
            <StackedTextField fullWidth label="Phí vận chuyển" type="number" value={shippingFee} onChange={(event) => setShippingFee(event.target.value)} />
            {paymentStatus === 'deposit' ? (
              <StackedTextField fullWidth label="Tiền cọc" type="number" value={depositAmount} onChange={(event) => setDepositAmount(event.target.value)} />
            ) : null}
            <StackedTextField fullWidth multiline minRows={2} label="Ghi chú thanh toán" value={paymentNotes} onChange={(event) => setPaymentNotes(event.target.value)} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setActiveDialog(null)}>Đóng</Button>
          <Button variant="contained" onClick={() => setActiveDialog(null)}>Lưu</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={activeDialog === 'order'} onClose={() => setActiveDialog(null)} fullWidth maxWidth="sm">
        <DialogTitle>Chỉnh sửa thông tin đơn</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <StackedTextField fullWidth label="Mã đơn hàng" value={orderCode} onChange={(event) => setOrderCode(event.target.value)} />
            <StackedTextField fullWidth label="Ngày tạo đơn" type="date" value={orderDate} onChange={(event) => setOrderDate(event.target.value)} />
            <StackedDropdown fullWidth label="Loại đơn" value={orderType} onChange={(event) => setOrderType(event.target.value as 'sale' | 'return')}>
              <MenuItem value="sale">Bán hàng</MenuItem>
              <MenuItem value="return">Trả hàng</MenuItem>
            </StackedDropdown>
            <StackedDropdown
              fullWidth
              label="Trạng thái xử lý"
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
            <StackedTextField fullWidth label="Kênh bán hàng" value={salesChannel} onChange={(event) => setSalesChannel(event.target.value)} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setActiveDialog(null)}>Đóng</Button>
          <Button variant="contained" onClick={() => setActiveDialog(null)}>Lưu</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={activeDialog === 'shipping'} onClose={() => setActiveDialog(null)} fullWidth maxWidth="sm">
        <DialogTitle>Chỉnh sửa vận chuyển</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <StackedTextField fullWidth label="Đơn vị vận chuyển" value={shippingService} onChange={(event) => setShippingService(event.target.value)} />
            <StackedTextField fullWidth label="Trạng thái giao hàng" value={shippingStatus} onChange={(event) => setShippingStatus(event.target.value)} />
            <StackedTextField fullWidth label="Mã tracking" value={trackingCode} onChange={(event) => setTrackingCode(event.target.value)} />
            <StackedTextField fullWidth label="Trạng thái kho" value={warehouseStatus} onChange={(event) => setWarehouseStatus(event.target.value)} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setActiveDialog(null)}>Đóng</Button>
          <Button variant="contained" onClick={() => setActiveDialog(null)}>Lưu</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={activeDialog === 'meta'} onClose={() => setActiveDialog(null)} fullWidth maxWidth="sm">
        <DialogTitle>Chỉnh sửa ghi chú và metadata</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <StackedTextField fullWidth multiline minRows={3} label="Ghi chú đơn hàng" value={orderNotes} onChange={(event) => setOrderNotes(event.target.value)} />
            <StackedTextField fullWidth label="Người tạo" value={createdBy} onChange={(event) => setCreatedBy(event.target.value)} />
            <StackedTextField fullWidth label="Người xử lý" value={confirmedBy} onChange={(event) => setConfirmedBy(event.target.value)} />
            <StackedTextField fullWidth label="Mã hóa đơn" value={invoiceCode} onChange={(event) => setInvoiceCode(event.target.value)} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setActiveDialog(null)}>Đóng</Button>
          <Button variant="contained" onClick={() => setActiveDialog(null)}>Lưu</Button>
        </DialogActions>
      </Dialog>
    </Box>
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


