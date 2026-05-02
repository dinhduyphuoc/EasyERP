import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react'
import { Link as RouterLink, useLoaderData, useNavigate, useParams } from 'react-router'
import axios from 'axios'
import MoreHorizIcon from '@mui/icons-material/MoreHoriz'
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined'
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined'
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined'
import InfoIcon from '@mui/icons-material/Info';
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import {
  alpha,
  CircularProgress,
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  Menu,
  MenuItem,
  Paper,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  Tooltip,
  Typography,
} from '@mui/material'
import { InfoField } from '@/shared/ui/info-field'
import { appToast } from '@/shared/ui/toast/toast.helpers'
import { borderedCardSx } from '@/shared/ui/paper'
import { useStore } from '@/modules/store/use-store'
import { useAuth } from '@/modules/auth/use-auth'
import { generalSettingsApi, type VietQrGenerateResponse } from '@/pages/settings/general-settings.api'
import {
  orderApi,
  type OrderActionName,
  type OrderDetailItem,
  type OrderShippingOrderInfo,
  type OrderShippingTrackingLogItem,
} from '../api'
import {
  DetailPageSkeleton,
  InfoFieldGrid,
  InfoPaper,
  InfoPaperGrid,
  InfoSummaryRows,
  OverviewProductCard,
  OrderShippingMeasurementsForm,
  OrderDetailDialogs,
  OrderDetailPaymentPanel,
  OrderTimelineCard,
  ShippingServiceOptionCard,
  TimelinePanel,
  type VerticalTimelineItem,
  type OrderTimelineStage,
} from '../components'
import { useOrderCustomerEditor, useOrderShipping, usePaymentConfigDraft, usePaymentEntryFlow } from '../hooks'
import {
  buildDuplicatedOrderMessage,
  buildMissingShippingFieldsMessage,
  buildOrderUpdatedMessage,
  buildPaymentHistoryEntries,
  getErrorMessage,
  ORDER_TOAST_MESSAGES,
  getPaymentMethodFromTypeId,
  parsePaymentNoteContent,
} from '../lib'
import {
  formatCurrency,
  formatDateTime,
  getPaymentStatusMeta,
  getProcessingStatusMeta,
} from '../lib'

const stepperStages: OrderTimelineStage[] = [
  { key: 'created', timelineKey: 'created', label: 'Đã tạo', matches: ['draft'] },
  { key: 'placed', timelineKey: 'placed', label: 'Mới', matches: ['placed'] },
  { key: 'shipping', timelineKey: 'delivering', label: 'Đang giao', matches: ['delivering'] },
  { key: 'delivered', timelineKey: 'delivered', label: 'Đã giao', matches: ['delivered'] },
  { key: 'completed', timelineKey: 'completed', label: 'Hoàn thành', matches: ['completed'] },
]

type DetailTabKey = 'overview' | 'products' | 'payment' | 'shipping'

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')

const isPositiveNumber = (value: number | null | undefined): boolean =>
  typeof value === 'number' && Number.isFinite(value) && value > 0

const joinAddressParts = (parts: Array<string | null | undefined>) =>
  parts
    .map((part) => (typeof part === 'string' ? part.trim() : ''))
    .filter(Boolean)
    .join(', ')

const isRequestTimeoutError = (error: unknown) =>
  axios.isAxiosError(error) &&
  (error.code === 'ECONNABORTED' || error.message.toLowerCase().includes('timeout'))

const openPrintWindow = (content: string) => {
  if (typeof window === 'undefined' || !window.document?.body) {
    return false
  }

  const iframe = window.document.createElement('iframe')
  let didTriggerPrint = false
  iframe.setAttribute('aria-hidden', 'true')
  iframe.style.position = 'fixed'
  iframe.style.right = '0'
  iframe.style.bottom = '0'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = '0'

  const cleanup = () => {
    window.setTimeout(() => {
      iframe.remove()
    }, 250)
  }

  iframe.onload = () => {
    if (didTriggerPrint) {
      return
    }

    didTriggerPrint = true
    const frameWindow = iframe.contentWindow

    if (!frameWindow) {
      cleanup()
      return
    }

    frameWindow.focus()

    window.setTimeout(() => {
      frameWindow.print()
      cleanup()
    }, 150)
  }

  window.document.body.appendChild(iframe)

  const frameDocument = iframe.contentWindow?.document

  if (!frameDocument) {
    cleanup()
    return false
  }

  frameDocument.open()
  frameDocument.write(content)
  frameDocument.close()
  return true
}

const buildPackingSlipMarkup = (order: OrderDetailItem) => {
  const rows = order.order_items
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.display_name ?? item.product_name)}</td>
          <td>${escapeHtml(item.variant_label ?? item.variant_sku ?? item.sku)}</td>
          <td style="text-align:right">${item.quantity}</td>
          <td>${escapeHtml(item.notes ?? '')}</td>
        </tr>
      `,
    )
    .join('')

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(`Packing Slip ${order.order_code}`)}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 24px; color: #0f172a; }
          h1, h2, p { margin: 0; }
          .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 24px; }
          .card { border: 1px solid #cbd5e1; border-radius: 12px; padding: 16px; margin-bottom: 16px; }
          .grid { display:grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
          .label { font-size: 12px; color: #64748b; text-transform: uppercase; margin-bottom: 4px; }
          .value { font-size: 14px; font-weight: 600; }
          table { width:100%; border-collapse: collapse; margin-top: 8px; }
          th, td { border-bottom: 1px solid #e2e8f0; padding: 10px 8px; text-align: left; font-size: 14px; }
          th { background: #f8fafc; }
          .footer { margin-top: 24px; display:grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px; }
          .sign { border-top: 1px solid #94a3b8; padding-top: 8px; margin-top: 48px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1>In phiếu đóng gói</h1>
            <p>Đơn hàng ${escapeHtml(order.order_code)}</p>
          </div>
          <div>
            <div class="label">Ngày in</div>
            <div class="value">${escapeHtml(formatDateTime(new Date().toISOString()))}</div>
          </div>
        </div>
        <div class="card grid">
          <div>
            <div class="label">Khách hàng</div>
            <div class="value">${escapeHtml(order.customer_info.name)}</div>
          </div>
          <div>
            <div class="label">Số điện thoại</div>
            <div class="value">${escapeHtml(order.customer_info.phone)}</div>
          </div>
          <div>
            <div class="label">Địa chỉ giao hàng</div>
            <div class="value">${escapeHtml(order.customer_info.address ?? '-')}</div>
          </div>
          <div>
            <div class="label">Kênh bán</div>
            <div class="value">${escapeHtml(order.sales_channel ?? 'Admin')}</div>
          </div>
          <div>
            <div class="label">Đơn vị vận chuyển</div>
            <div class="value">${escapeHtml(order.shipping_service ?? '-')}</div>
          </div>
          <div>
            <div class="label">Tracking</div>
            <div class="value">${escapeHtml(order.tracking_code ?? '-')}</div>
          </div>
        </div>
        <div class="card">
          <h2>Sản phẩm</h2>
          <table>
            <thead>
              <tr>
                <th>Sản phẩm</th>
                <th>SKU</th>
                <th>SL</th>
                <th>Ghi chú</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        <div class="footer">
          <div class="sign">Người giao kho</div>
          <div class="sign">Ngu?i nh?n / Đơn vị vận chuyển</div>
        </div>
      </body>
    </html>
  `
}

export function OrdersDetailPage(): ReactElement {
  const navigate = useNavigate()
  const params = useParams()
  const initialOrder = useLoaderData() as OrderDetailItem
  const { activeStore } = useStore()
  const { user, hasPermission } = useAuth()
  const [activeTab, setActiveTab] = useState<DetailTabKey>('overview')
  const [order, setOrder] = useState<OrderDetailItem | null>(initialOrder)
  const [isLoading, setIsLoading] = useState(false)
  const [isActing, setIsActing] = useState(false)
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [invoiceCodeDraft, setInvoiceCodeDraft] = useState('')
  const [isInvoiceDialogOpen, setIsInvoiceDialogOpen] = useState(false)
  const [isQrDialogOpen, setIsQrDialogOpen] = useState(false)
  const [isGeneratingQr, setIsGeneratingQr] = useState(false)
  const [isSavingShippingMeasurements, setIsSavingShippingMeasurements] = useState(false)
  const [paymentQr, setPaymentQr] = useState<VietQrGenerateResponse | null>(null)
  const [shippingWeightDraft, setShippingWeightDraft] = useState('')
  const [shippingWeightUnit, setShippingWeightUnit] = useState<'g' | 'kg'>('g')
  const [shippingLengthDraft, setShippingLengthDraft] = useState('')
  const [shippingWidthDraft, setShippingWidthDraft] = useState('')
  const [shippingHeightDraft, setShippingHeightDraft] = useState('')
  const [shippingDimensionUnit, setShippingDimensionUnit] = useState<'cm' | 'm'>('cm')
  const [storeShippingAddress, setStoreShippingAddress] = useState<{
    contact_name: string
    phone: string
    state_id: number | null
    city_id: number | null
    district_id: number | null
    address_line: string
  } | null>(null)
  const [ghnOrderInfo, setGhnOrderInfo] = useState<OrderShippingOrderInfo | null>(null)
  const [ghnTrackingLogs, setGhnTrackingLogs] = useState<OrderShippingTrackingLogItem[]>([])
  const [isGhnOrderInfoLoading, setIsGhnOrderInfoLoading] = useState(false)
  const [ghnOrderInfoError, setGhnOrderInfoError] = useState('')
  const [ghnOrderInfoCacheKey, setGhnOrderInfoCacheKey] = useState('')
  const [isOrderHistoryLoading, setIsOrderHistoryLoading] = useState(false)
  const fetchOrderHistory = useCallback(async (orderId: string) => {
    try {
      setIsOrderHistoryLoading(true)
      const history = await orderApi.getOrderHistory(orderId)
      setOrder((current) =>
        current && String(current.id) === orderId
          ? {
              ...current,
              order_history: history,
            }
          : current,
      )
    } catch (error) {
      console.error('Lỗi khi tải lịch sử đơn hàng:', error)
    } finally {
      setIsOrderHistoryLoading(false)
    }
  }, [])

  useEffect(() => {
    setOrder(initialOrder)
    setIsLoading(false)

    if (params.id) {
      void fetchOrderHistory(params.id)
    }
  }, [fetchOrderHistory, initialOrder, params.id])

  useEffect(() => {
    const loadVatSettings = async () => {
      try {
        const settings = await generalSettingsApi.getGeneralSettings()
        setStoreShippingAddress(settings.defaults.shipping_address)
      } catch (error) {
        console.error('Lỗi khi tải cấu hình VAT:', error)
      }
    }

    void loadVatSettings()
  }, [])

  useEffect(() => {
    const normalizedProvider = order?.shipping_service?.split(' - ')[0]?.trim().toLowerCase() ?? ''
    const trackingCode = order?.tracking_code?.trim() ?? ''
    const orderId = params.id
    const cacheKey = orderId && normalizedProvider && trackingCode ? `${orderId}:${normalizedProvider}:${trackingCode}` : ''

    if (!orderId || normalizedProvider !== 'ghn' || !trackingCode) {
      setGhnOrderInfo(null)
      setGhnTrackingLogs([])
      setIsGhnOrderInfoLoading(false)
      setGhnOrderInfoError('')
      setGhnOrderInfoCacheKey('')
      return
    }

    if (activeTab !== 'shipping') {
      return
    }

    if (ghnOrderInfoCacheKey === cacheKey && (ghnOrderInfo || ghnTrackingLogs.length > 0 || ghnOrderInfoError)) {
      return
    }

    let cancelled = false

    const fetchGhnOrderInfo = async () => {
      try {
        setIsGhnOrderInfoLoading(true)
        setGhnOrderInfoError('')
        const [orderInfo, trackingLogs] = await Promise.all([
          orderApi.getGHNOrderInfo(orderId),
          orderApi.getGHNTrackingLogs(orderId),
        ])

        if (!cancelled) {
          setGhnOrderInfo(orderInfo)
          setGhnTrackingLogs(
            [...trackingLogs.logs].sort((left, right) => {
              if (!left.updated_at || !right.updated_at) {
                return 0
              }

              return new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime()
            }),
          )
          setGhnOrderInfoCacheKey(cacheKey)
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Lỗi khi tải tiến trình GHN:', error)
          setGhnOrderInfo(null)
          setGhnTrackingLogs([])
          setGhnOrderInfoError(getErrorMessage(error, 'Không thể tải tiến trình vận chuyển từ GHN.'))
          setGhnOrderInfoCacheKey(cacheKey)
        }
      } finally {
        if (!cancelled) {
          setIsGhnOrderInfoLoading(false)
        }
      }
    }

    void fetchGhnOrderInfo()

    return () => {
      cancelled = true
    }
  }, [activeTab, ghnOrderInfo, ghnOrderInfoCacheKey, ghnOrderInfoError, ghnTrackingLogs.length, order?.shipping_service, order?.tracking_code, params.id])

  const nextAction = useMemo(() => {
    if (!order) {
      return null
    }

    if (order.processing_status === 'draft') {
      return {
        action: 'confirm' as OrderActionName,
        label: 'Chuyển sang mới',
        helper: 'Đơn đang ở trạng thái nháp. Xác nhận để chuyển sang trạng thái Mới.',
        icon: <CheckCircleOutlinedIcon fontSize="small" />,
      }
    }

    if (order.processing_status === 'placed') {
      return {
        action: 'push_to_delivery' as OrderActionName,
        label: 'Lên đơn vận chuyển',
        helper: 'Tạo vận đơn và chuyển đơn sang trạng thái Đang giao.',
        icon: <LocalShippingOutlinedIcon fontSize="small" />,
      }
    }

    if (order.processing_status === 'delivering') {
      return {
        action: 'mark_delivered' as OrderActionName,
        label: 'Đánh dấu đã giao',
        helper: 'Đơn đang giao. Xác nhận khi đơn đã giao thành công cho khách.',
        icon: <LocalShippingOutlinedIcon fontSize="small" />,
      }
    }

    if (order.processing_status === 'delivered') {
      return {
        action: 'complete' as OrderActionName,
        label: 'Đánh dấu hoàn thành',
        helper: 'Kết thúc đơn khi đã thu đủ tiền hoặc cần chốt nghiệp vụ.',
        icon: <CheckCircleOutlinedIcon fontSize="small" />,
      }
    }

    return {
      action: null,
      label: 'Đã cập nhật',
      helper: 'Đơn đã hoàn tất. Kiểm tra lại lịch sử xử lý, thanh toán và hóa đơn khi cần.',
      icon: <ReceiptLongOutlinedIcon fontSize="small" />,
    }
  }, [order])

  const runAction = useCallback(
    async (action: OrderActionName, payload: Record<string, string | number | null | undefined> = {}) => {
      if (!params.id || !order) {
        return
      }

      try {
        setIsActing(true)

        const updated = await orderApi.runAction(params.id, action, payload)
        setOrder(updated)
        setIsOrderHistoryLoading(false)
        appToast.success(buildOrderUpdatedMessage(updated.order_code))
      } catch (error) {
        console.error('Lỗi khi cập nhật action đơn hàng:', error)
        if (isRequestTimeoutError(error)) {
          try {
            const refreshedOrder = await orderApi.getOrderById(params.id)
            setOrder(refreshedOrder)
            void fetchOrderHistory(params.id)

            if (
              refreshedOrder.processing_status !== order.processing_status ||
              refreshedOrder.tracking_code !== order.tracking_code ||
              refreshedOrder.shipping_status !== order.shipping_status
            ) {
              appToast.success('Yêu cầu xử lý chậm hơn 10 giây nhưng đơn hàng đã được cập nhật.')
              return
            }
          } catch (refreshError) {
            console.error('Lỗi khi đồng bộ lại đơn hàng sau timeout:', refreshError)
          }
        }

        appToast.error(getErrorMessage(error, 'Không thể cập nhật đơn hàng.'))
      } finally {
        setIsActing(false)
      }
    },
    [fetchOrderHistory, order, params.id],
  )

  const {
    shippingDialog,
    shippingOptions,
    isShippingOptionsLoading,
    isSavingShippingOption,
    shippingOptionsError,
    hasStoreShippingAddress,
    hasCustomerShippingAddress,
    selectedShippingOptionKey,
    hasSelectedShippingService,
    isNextActionBlockedByShippingService,
    handleSelectShippingOption,
    openShippingActionDialog,
    submitShippingAction,
    updateShippingDialog,
    closeShippingDialog,
  } = useOrderShipping({
    order,
    orderId: params.id,
    activeStoreId: activeStore?.id,
    storeShippingAddress,
    nextActionAction: nextAction?.action ?? null,
    onOrderUpdated: setOrder,
    runAction,
    getErrorMessage,
  })

  const validatePushToDelivery = useCallback(() => {
    if (!order) {
      appToast.error(ORDER_TOAST_MESSAGES.missingOrderForShipping)
      return null
    }

    const resolvedFromName = order.from_name?.trim() || storeShippingAddress?.contact_name?.trim() || ''
    const resolvedFromPhone = order.from_phone?.trim() || storeShippingAddress?.phone?.trim() || ''
    const missingFields: string[] = []

    if (!hasSelectedShippingService) {
      missingFields.push('dịch vụ vận chuyển')
    }

    if (!hasStoreShippingAddress) {
      missingFields.push('địa chỉ lấy hàng của shop')
    }

    if (!resolvedFromName) {
      missingFields.push('tên người gửi')
    }

    if (!resolvedFromPhone) {
      missingFields.push('số điện thoại người gửi')
    }

    if (!hasCustomerShippingAddress) {
      missingFields.push('địa chỉ giao hàng của khách')
    }

    if (!order.customer_info.name?.trim()) {
      missingFields.push('tên người nhận')
    }

    if (!order.customer_info.phone?.trim()) {
      missingFields.push('số điện thoại người nhận')
    }

    if (!order.to_address_detail?.address_line?.trim() && !order.customer_info.address?.trim()) {
      missingFields.push('địa chỉ chi tiết giao hàng')
    }

    if (!isPositiveNumber(order.weight)) {
      missingFields.push('khối lượng')
    }

    if (!isPositiveNumber(order.length)) {
      missingFields.push('chiều dài')
    }

    if (!isPositiveNumber(order.width)) {
      missingFields.push('chiều rộng')
    }

    if (!isPositiveNumber(order.height)) {
      missingFields.push('chiều cao')
    }

    if (missingFields.length > 0) {
      appToast.error(buildMissingShippingFieldsMessage(missingFields))
      return null
    }

    return {
      from_name: resolvedFromName,
      from_phone: resolvedFromPhone,
    }
  }, [
    hasCustomerShippingAddress,
    hasSelectedShippingService,
    hasStoreShippingAddress,
    order,
    storeShippingAddress,
  ])

  const submitInvoiceRequest = useCallback(async () => {
    await runAction('request_invoice', {
      invoice_code: invoiceCodeDraft.trim(),
    })
    setIsInvoiceDialogOpen(false)
  }, [invoiceCodeDraft, runAction])

  const handleDuplicateOrder = useCallback(() => {
    if (!order) {
      return
    }

    setAnchorEl(null)

    void (async () => {
      try {
        setIsActing(true)
        const duplicatedOrder = await orderApi.duplicateOrder(order.id, {
          actor_name: user?.full_name?.trim() || 'Hệ thống',
        })
        appToast.success(buildDuplicatedOrderMessage(duplicatedOrder.order_code, order.order_code))
        navigate(`/orders/${duplicatedOrder.id}/edit`)
      } catch (error) {
        console.error('Lỗi khi nhân bản đơn hàng:', error)
        appToast.error(getErrorMessage(error, 'Không thể nhân bản đơn hàng.'))
      } finally {
        setIsActing(false)
      }
    })()
  }, [navigate, order, user?.full_name])

  const handleExportPackingSlip = useCallback(() => {
    if (!order) {
      return
    }

    setAnchorEl(null)
    const didOpen = openPrintWindow(buildPackingSlipMarkup(order))

    if (!didOpen) {
      appToast.error(ORDER_TOAST_MESSAGES.printPopupBlocked)
      return
    }
  }, [order])

  const handleCopyQrValue = useCallback(async () => {
    if (!paymentQr?.transfer_content) {
      return
    }

    try {
      await navigator.clipboard.writeText(paymentQr.transfer_content)
      appToast.success(ORDER_TOAST_MESSAGES.copiedTransferInfo)
    } catch {
      appToast.error(ORDER_TOAST_MESSAGES.copyTransferInfoFailed)
    }
  }, [paymentQr])

  useEffect(() => {
    if (!order) {
      return
    }

    setShippingWeightDraft(order.weight ? String(order.weight) : '500')
    setShippingWeightUnit('g')
    setShippingLengthDraft(order.length ? String(order.length) : '20')
    setShippingWidthDraft(order.width ? String(order.width) : '15')
    setShippingHeightDraft(order.height ? String(order.height) : '10')
    setShippingDimensionUnit('cm')
  }, [order])

  const processingMeta = getProcessingStatusMeta(order?.processing_status ?? 'draft')
  const parsedOrderPaymentDetails = parsePaymentNoteContent(order?.payment_notes)
  const currentPaymentMethod =
    parsedOrderPaymentDetails.method ?? getPaymentMethodFromTypeId(order?.payment_type_id, order?.payment_status)
  const orderPaidAmount = Number(order?.paid_amount || 0)
  const orderTotalAmount = Number(order?.total_amount || 0)
  const orderRemainingAmount = Math.max(orderTotalAmount - orderPaidAmount, 0)
  const paymentHistoryEntries = order ? buildPaymentHistoryEntries(order, currentPaymentMethod) : []
  const orderItemCount = order?.order_items.reduce((sum, item) => sum + Number(item.quantity || 0), 0) ?? 0
  const orderSubTotal = Number(order?.sub_total || 0)
  const orderDiscountAmount = Number(order?.discount_amount || 0)
  const orderTaxAmount = Number(order?.tax_amount || 0)
  const orderVatEnabled = order?.vat_enabled ?? false
  const orderVatRatePercent = Number(order?.vat_rate_percent || 0)
  const orderShippingFee = Number(order?.shipping_fee || 0)
  const shouldShowLockedVatLine =
    !['draft', 'placed'].includes(order?.processing_status ?? 'draft') && orderVatEnabled
  const progressIndex = (() => {
    switch (order?.processing_status ?? 'draft') {
      case 'placed':
        return 1
      case 'delivering':
        return 2
      case 'delivered':
        return 3
      case 'completed':
        return 4
      default:
        return 0
    }
  })()
  const orderTypeLabel = order?.order_type === 'return' ? 'Đơn trả hàng' : 'Đơn bán hàng'
  const invoiceStatusLabel = order?.invoice_code ? 'Đã tạo e-invoice' : 'Chưa xuất hóa đơn'
  const invoiceStatusColor = order?.invoice_code ? 'success' : 'default'
  const canEditVat = hasPermission('orders.vat.update')
  const canEditOrder = ['draft', 'placed'].includes(order?.processing_status ?? 'draft')
  const shouldShowProductEditButton = ['draft', 'placed'].includes(order?.processing_status ?? '')
  const canAddPayment = orderRemainingAmount > 0 && !['cancelled', 'returned'].includes(order?.processing_status ?? '')
  const canGeneratePaymentQr = orderRemainingAmount > 0
  const canCancelOrder =
    ['draft', 'placed', 'delivering'].includes(order?.processing_status ?? '') && order?.payment_status !== 'paid'
  const canReturnOrder = order?.processing_status === 'completed'
  const canExportPackingSlip = ['delivering', 'delivered', 'completed'].includes(
    order?.processing_status ?? '',
  )
  const canExportInvoice = order?.payment_status === 'paid'
  const isMissingStoreShippingAddress = !hasStoreShippingAddress
  const isMissingCustomerShippingAddress = !hasCustomerShippingAddress
  const shippingAddressWarningTitle =
    isMissingStoreShippingAddress && isMissingCustomerShippingAddress
      ? 'Chưa cập nhật địa chỉ khách/cửa hàng'
      : isMissingStoreShippingAddress
        ? 'Chưa cập nhật địa chỉ cửa hàng'
        : 'Chưa cập nhật địa chỉ khách'
  const shippingAddressCtaLabel = isMissingStoreShippingAddress
    ? 'Cập nhật địa chỉ cửa hàng'
    : order?.customer_id
      ? 'Cập nhật địa chỉ khách'
      : 'Chỉnh sửa đơn hàng'
  const {
    customerModalOpen,
    customerModalForm,
    customerModalStates,
    customerModalCities,
    customerModalDistricts,
    isCustomerModalStatesLoading,
    isCustomerModalCitiesLoading,
    isCustomerModalDistrictsLoading,
    isCustomerModalSaving,
    handleCustomerModalFieldChange,
    handleCustomerModalDefaultAddressChange,
    handleCustomerModalStateChange,
    handleCustomerModalCityChange,
    handleCustomerModalDistrictChange,
    handleCloseCustomerModal,
    handleOpenEditCustomerModal,
    handleSaveCustomerModal,
  } = useOrderCustomerEditor({
    order,
    orderId: params.id,
    onOrderUpdated: setOrder,
    getErrorMessage,
  })
  const handleShippingAddressCta = useCallback(() => {
    if (!order) {
      return
    }

    if (isMissingStoreShippingAddress) {
      navigate('/settings/address-management', { state: { overlayFrom: '/' } })
      return
    }

    if (order.customer_id) {
      void handleOpenEditCustomerModal()
      return
    }

    navigate(`/orders/${order.id}/edit`)
  }, [handleOpenEditCustomerModal, isMissingStoreShippingAddress, navigate, order])

  const handleOpenPaymentQr = useCallback(async () => {
    if (!order || orderRemainingAmount <= 0) {
      return
    }

    try {
      setIsGeneratingQr(true)
      setPaymentQr(null)
      const transferMemo = [order.order_code, order.customer_info.phone]
        .map((value) => value.trim())
        .filter(Boolean)
        .join(' ')
      const qrResponse = await generalSettingsApi.generateVietQr({
        amount: orderRemainingAmount,
        memo: transferMemo,
        template: 'compact2',
      })

      setPaymentQr(qrResponse)
      setIsQrDialogOpen(true)
    } catch (error) {
      console.error('Lỗi khi tạo QR thanh toán:', error)
      appToast.error(getErrorMessage(error, 'Không thể tạo QR thanh toán.'))
    } finally {
      setIsGeneratingQr(false)
    }
  }, [order, orderRemainingAmount])

  const handleSaveShippingMeasurements = useCallback(async () => {
    if (!order) {
      return
    }

    const parsedWeight = Number(shippingWeightDraft)
    const parsedLength = Number(shippingLengthDraft)
    const parsedWidth = Number(shippingWidthDraft)
    const parsedHeight = Number(shippingHeightDraft)

    if (
      !Number.isFinite(parsedWeight) || parsedWeight <= 0 ||
      !Number.isFinite(parsedLength) || parsedLength <= 0 ||
      !Number.isFinite(parsedWidth) || parsedWidth <= 0 ||
      !Number.isFinite(parsedHeight) || parsedHeight <= 0
    ) {
      appToast.error(ORDER_TOAST_MESSAGES.invalidShippingMeasurements)
      return
    }

    const normalizedWeight = shippingWeightUnit === 'kg' ? Math.round(parsedWeight * 1000) : Math.round(parsedWeight)
    const dimensionMultiplier = shippingDimensionUnit === 'm' ? 100 : 1

    try {
      setIsSavingShippingMeasurements(true)
      const updatedOrder = await orderApi.updateOrder(String(order.id), {
        weight: normalizedWeight,
        length: Math.round(parsedLength * dimensionMultiplier),
        width: Math.round(parsedWidth * dimensionMultiplier),
        height: Math.round(parsedHeight * dimensionMultiplier),
      })

      setOrder(updatedOrder)
      appToast.success(ORDER_TOAST_MESSAGES.shippingMeasurementsUpdated)
    } catch (error) {
      console.error('Lỗi khi cập nhật khối lượng và kích thước:', error)
      appToast.error(getErrorMessage(error, 'Không thể cập nhật khối lượng và kích thước.'))
    } finally {
      setIsSavingShippingMeasurements(false)
    }
  }, [
    getErrorMessage,
    order,
    shippingDimensionUnit,
    shippingHeightDraft,
    shippingLengthDraft,
    shippingWeightDraft,
    shippingWeightUnit,
    shippingWidthDraft,
  ])
  const {
    isPaymentDialogOpen,
    isSavingPayment,
    paymentMethodDraft,
    discountAmountDraft,
    vatEnabledDraft,
    vatRatePercentDraft,
    paymentSubTotal,
    paymentShippingFee,
    normalizedTaxAmount,
    paymentTotalAmount,
    normalizedDepositAmount,
    visiblePaymentErrors,
    openPaymentDialog,
    closePaymentDialog,
    handlePaymentMethodChange,
    handleSavePayment,
    setDepositAmountDraft,
    setDiscountAmountDraft,
    setVatEnabledDraft,
    setVatRatePercentDraft,
  } = usePaymentConfigDraft({
    orderId: params.id,
    order,
    onOrderUpdated: setOrder,
  })

  const {
    isAddPaymentDialogOpen,
    isConfirmPaidDialogOpen,
    paymentEntryAmount,
    paymentEntryMethod,
    paymentEntryNote,
    isSubmittingPaymentEntry,
    setPaymentEntryAmount,
    setPaymentEntryMethod,
    setPaymentEntryNote,
    openAddPaymentDialog,
    closeAddPaymentDialog,
    openConfirmPaidDialog,
    closeConfirmPaidDialog,
    submitAddPayment,
    submitConfirmPaid,
  } = usePaymentEntryFlow({
    orderId: params.id,
    order,
    canAddPayment,
    currentPaymentMethod,
    orderRemainingAmount,
    onOrderUpdated: setOrder,
  })

  if (isLoading) {
    return <DetailPageSkeleton />
  }

  if (!order || !nextAction) {
    return <DetailPageSkeleton />
  }

  const paymentStatusMeta = getPaymentStatusMeta(order.payment_status)
  const overviewProductSummaryRows = [
    { label: 'Tổng số lượng', value: String(orderItemCount), valueWeight: 700 },
    { label: 'Tổng tiền', value: formatCurrency(orderSubTotal), valueWeight: 700 },
  ]
  const overviewPaymentSummaryRows = [
    { label: 'Trạng thái', value: paymentStatusMeta.label, valueWeight: 600 },
    {
      label: `Tạm tính (${order.order_items.length} sản phẩm)`,
      value: formatCurrency(order.sub_total),
      valueWeight: 500,
    },
    { label: 'Giảm giá', value: formatCurrency(order.discount_amount), valueWeight: 500 },
    {
      label: order.vat_enabled ? `Thuế VAT (${order.vat_rate_percent}%)` : 'Thuế VAT',
      value: formatCurrency(order.tax_amount),
      valueWeight: 500,
    },
    { label: 'Phí vận chuyển', value: formatCurrency(order.shipping_fee), valueWeight: 500 },
    { label: 'Tổng cộng', value: formatCurrency(order.total_amount), valueWeight: 600 },
  ]
  const overviewPaymentSettlementRows = [
    { label: 'Khách đã trả', value: formatCurrency(order.paid_amount), valueWeight: 500 },
    { label: 'Còn lại', value: formatCurrency(order.outstanding_amount), valueWeight: 700 },
  ]

  const customerOverviewSection = (
    <InfoPaper
      title="Thông tin khách hàng"
      rows={[]}
      headerAction={
        <IconButton size="small" onClick={() => void handleOpenEditCustomerModal()}>
          <EditOutlinedIcon fontSize="small" />
        </IconButton>
      }
    >
      <>
        <Stack spacing={2.5} sx={{ flex: 1, justifyContent: 'space-between' }}>
          <InfoFieldGrid
            items={[
              { label: 'Tên khách hàng', value: order.customer_info.name || 'Khách lẻ' },
              { label: 'Số điện thoại', value: order.customer_info.phone || '-' },
              { label: 'Địa chỉ giao', value: order.customer_info.address || 'Chưa có địa chỉ giao hàng' },
            ]}
          />
          <InfoFieldGrid
            items={[
              { label: 'Mã khách hàng', value: order.customer_info.customer_code || 'Khách lẻ' },
              { label: 'Loại đơn', value: orderTypeLabel },
              { label: 'Kênh bán', value: order.sales_channel || 'Admin' },
            ]}
          />
        </Stack>
        <InfoFieldGrid
          items={[
            { label: 'Ngày tạo', value: formatDateTime(order.created_at) },
            { label: 'Cập nhật cuối', value: formatDateTime(order.updated_at) },
            { label: 'Kênh bán hàng', value: order.sales_channel ?? '-' },
          ]}
        />
      </>
    </InfoPaper>
  )

  const overviewProductsSection = (
    <InfoPaper
      title="Sản phẩm"
      rows={[]}
      paperSx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Stack spacing={1.5} sx={{ height: '100%' }}>
        <Stack spacing={0.75} sx={{ flex: 1 }}>
          {order.order_items.map((item) => (
            <OverviewProductCard
              key={item.id}
              item={{
                id: item.id,
                imageUrl: item.image_url ?? null,
                productName: item.product_name,
                displayName: item.display_name ?? null,
                sku: item.sku,
                variantSku: item.variant_sku ?? null,
                variantLabel: item.variant_label ?? null,
                unitPriceLabel: formatCurrency(item.unit_price),
                quantityLabel: String(item.quantity),
              }}
            />
          ))}
        </Stack>

        <Divider />

        <InfoSummaryRows rows={overviewProductSummaryRows} />
      </Stack>
    </InfoPaper>
  )

  const productsSection = (
    <Paper
      sx={{
        ...borderedCardSx,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Stack spacing={2.5} sx={{ height: '100%' }}>
        <Box sx={{ overflowX: 'auto', flex: 1 }}>
          <Table sx={{ minWidth: 640 }}>
            <TableHead>
              <TableRow>
                <TableCell>Sản phẩm</TableCell>
                <TableCell align="right">SL</TableCell>
                <TableCell align="right">Giá</TableCell>
                <TableCell align="right">Tổng</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {order.order_items.map((item) => (
                <TableRow key={item.id} hover>
                  <TableCell sx={{ py: 1.75 }}>
                    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'flex-start' }}>
                      <Box
                        component="img"
                        src={item.image_url ?? 'https://placehold.co/80x80?text=SP'}
                        alt={item.display_name ?? item.product_name}
                        sx={{
                          width: 48,
                          height: 48,
                          borderRadius: 2,
                          objectFit: 'cover',
                          bgcolor: alpha('#132238', 0.06),
                          flexShrink: 0,
                        }}
                      />
                      <Stack spacing={0.6} sx={{ minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 700, color: '#0f172a' }}>{item.display_name ?? item.product_name}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          SKU: {item.variant_label ?? item.variant_sku ?? item.sku}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {item.notes && `Ghi chú: ${item.notes}`}
                        </Typography>
                      </Stack>
                    </Stack>
                  </TableCell>
                  <TableCell align="right">{item.quantity}</TableCell>
                  <TableCell align="right">{formatCurrency(item.unit_price)}</TableCell>
                  <TableCell align="right">
                    <Typography sx={{ fontWeight: 700 }}>{formatCurrency(item.sub_total)}</Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>

        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={1.25}
          sx={{ justifyContent: 'space-between', alignItems: { md: 'center' } }}
        >
          <Typography color="text.secondary">{order.order_items.length} sản phẩm</Typography>

          {shouldShowProductEditButton ? (
            <Button
              variant="outlined"
              startIcon={<EditOutlinedIcon />}
              component={RouterLink}
              to={`/orders/${order.id}/edit`}
              disabled={!canEditOrder}
            >
              Chỉnh sửa đơn hàng
            </Button>
          ) : null}
          {canExportPackingSlip ? (
            <Button variant="outlined" startIcon={<PrintOutlinedIcon />} onClick={handleExportPackingSlip}>
              In phiếu đóng gói
            </Button>
          ) : null}
        </Stack>
      </Stack>
    </Paper>
  )

  const paymentSection = (
    <OrderDetailPaymentPanel
      itemCount={orderItemCount}
      subTotal={orderSubTotal}
      discountAmount={orderDiscountAmount}
      taxAmount={orderTaxAmount}
      vatRatePercent={orderVatRatePercent}
      shippingFee={orderShippingFee}
      totalAmount={orderTotalAmount}
      paidAmount={orderPaidAmount}
      remainingAmount={orderRemainingAmount}
      forceShowTaxLine={shouldShowLockedVatLine}
      paymentHistoryEntries={paymentHistoryEntries}
      isPaymentHistoryLoading={isOrderHistoryLoading}
      invoiceStatusLabel={invoiceStatusLabel}
      invoiceStatusColor={invoiceStatusColor}
      invoiceCode={order.invoice_code}
      canExportInvoice={canExportInvoice}
      canGeneratePaymentQr={canGeneratePaymentQr}
      canAddPayment={canAddPayment}
      canEditOrder={canEditOrder}
      isActing={isActing}
      isGeneratingQr={isGeneratingQr}
      onOpenInvoiceDialog={() => setIsInvoiceDialogOpen(true)}
      onOpenPaymentQr={() => void handleOpenPaymentQr()}
      onOpenAddPaymentDialog={openAddPaymentDialog}
      onOpenConfirmPaidDialog={openConfirmPaidDialog}
      onOpenPaymentDialog={openPaymentDialog}
    />
  )

  const overviewPaymentSummarySection = (
    <InfoPaper title="Thanh toán" labelMinWidth={88} rows={[]}>
      <InfoSummaryRows rows={overviewPaymentSummaryRows} />
      <Divider sx={{ my: 0.25 }} />
      <InfoSummaryRows rows={overviewPaymentSettlementRows} />
    </InfoPaper>
  )

  const normalizedShippingProvider = order.shipping_service?.split(' - ')[0]?.trim().toLowerCase() ?? ''
  const hasCreatedShipment =
    ['delivering', 'delivered', 'completed', 'returned'].includes(order.processing_status) ||
    Boolean(order.tracking_code?.trim())
  const shouldShowShippingServiceSelector =
    hasStoreShippingAddress && hasCustomerShippingAddress && !hasCreatedShipment
  const shouldShowShippingTrackingPaper =
    normalizedShippingProvider === 'ghn' && Boolean(order.tracking_code?.trim()) && hasCreatedShipment
  const senderAddress = joinAddressParts([
    order.from_address_detail?.address_line,
    order.from_address_detail?.district_name,
    order.from_address_detail?.city_name,
    order.from_address_detail?.state_name,
  ])
  const receiverAddress = joinAddressParts([
    order.to_address_detail?.address_line,
    order.to_address_detail?.district_name,
    order.to_address_detail?.city_name,
    order.to_address_detail?.state_name,
  ])
  const shippingOrderCode = order.tracking_code?.trim() || ghnOrderInfo?.tracking_code?.trim() || ghnOrderInfo?.order_code?.trim() || order.order_code
  const latestTrackingStatusName =
    ghnTrackingLogs[0]?.status_name?.trim() ||
    (typeof ghnTrackingLogs[0]?.raw?.status_name === 'string' ? ghnTrackingLogs[0].raw.status_name.trim() : '') ||
    ghnTrackingLogs[0]?.status?.trim() ||
    ''
  const shippingStatusName = latestTrackingStatusName || ghnOrderInfo?.status_name?.trim() || ghnOrderInfo?.current_status?.trim() || order.shipping_status?.trim() || null
  const parcelDimensionLabel =
    isPositiveNumber(order.length) && isPositiveNumber(order.width) && isPositiveNumber(order.height)
      ? `${order.length} x ${order.width} x ${order.height} cm`
      : null
  const orderInfoRows = [
    { label: 'Mã đơn hàng', value: shippingOrderCode },
    { label: 'Ngày lấy dự kiến', value: null },
    { label: 'Ngày giao dự kiến', value: ghnOrderInfo?.leadtime ? formatDateTime(ghnOrderInfo.leadtime) : null },
    {
      label: 'Trạng thái đơn hàng',
      value: shippingStatusName,
    },
  ].filter((item) => item.value)
  const detailInfoRows = [
    { label: 'Mã đơn hàng', value: order.order_code },
    {
      label: 'Cân nặng',
      value: typeof order.weight === 'number' && Number.isFinite(order.weight) ? `${order.weight} g` : null,
    },
    { label: 'Kích thước', value: parcelDimensionLabel },
    { label: 'Lưu ý giao hàng', value: order.required_note?.trim() || null },
  ].filter((item) => item.value)
  const senderInfoRows = [
    { label: 'Họ và tên', value: order.from_name?.trim() || null },
    { label: 'Điện thoại', value: order.from_phone?.trim() || null },
    { label: 'Địa chỉ', value: senderAddress || null },
  ].filter((item) => item.value)
  const receiverInfoRows = [
    { label: 'Họ và tên', value: order.customer_info.name?.trim() || null },
    { label: 'Điện thoại', value: order.customer_info.phone?.trim() || null },
    { label: 'Địa chỉ', value: receiverAddress || null },
  ].filter((item) => item.value)
  const shippingTimelineItems: VerticalTimelineItem[] = ghnTrackingLogs.map((entry, index) => ({
    key: `${entry.status ?? 'tracking'}-${entry.updated_at ?? index}`,
    label: entry.label,
    timestamp: entry.updated_at,
    highlighted: index === 0,
  }))
  const cheapestShippingOptionKey = shippingOptions[0]?.key ?? null
  const fastestShippingOptionKey =
    shippingOptions.reduce<(typeof shippingOptions)[number] | null>((best, current) => {
      if (!current.expectedDeliveryTime) {
        return best
      }

      if (!best?.expectedDeliveryTime) {
        return current
      }

      return new Date(current.expectedDeliveryTime).getTime() < new Date(best.expectedDeliveryTime).getTime()
        ? current
        : best
    }, null)?.key ?? null
  const shippingSection = (
    <Stack spacing={2.5}>
      <Paper sx={borderedCardSx}>
        <Stack spacing={2.5}>
          <Stack spacing={1.5}>
          {!hasStoreShippingAddress ? (
          <Paper
            variant="outlined"
            sx={{
              p: 1.5,
              borderRadius: 2,
              bgcolor: '#fffaf0',
              borderColor: '#fed7aa',
            }}
          >
            <Stack spacing={1.25}>
              <Typography sx={{ fontWeight: 700, color: '#9a3412' }}>
                Shop chưa cấu hình địa chỉ mặc định
              </Typography>
              <Typography variant="body2" sx={{ color: '#9a3412' }}>
                Cần thiết lập địa chỉ giao hàng của shop trước khi lấy dịch vụ.
              </Typography>
              <Button variant="contained" color="secondary" onClick={() => navigate('/settings/general')}>
                Đi tới cài đặt
              </Button>
            </Stack>
          </Paper>
        ) : null}

        {hasStoreShippingAddress && !hasCustomerShippingAddress ? (
          <Paper
            variant="outlined"
            sx={{
              p: 1.5,
              bgcolor: '#fffaf0',
              borderColor: '#fed7aa',
            }}
          >
            <Stack spacing={1.25}>
              <Stack direction="row" spacing={1} sx={{ fontSize: '1rem', alignItems: 'center' }}>
                <InfoIcon sx={{ color: '#9a3412' }} />
                <Stack spacing={0.25}>
                  <Typography variant="body2" sx={{ color: '#9a3412', fontWeight: 700 }}>
                    {shippingAddressWarningTitle}
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#9a3412' }}>
                    Cập nhật địa chỉ giao hàng để lựa chọn đơn vị vận chuyển.
                  </Typography>
                </Stack>
              </Stack>
              <Button variant="contained" color="secondary" onClick={handleShippingAddressCta}>
                {shippingAddressCtaLabel}
              </Button>
            </Stack>
          </Paper>
        ) : null}

        {hasStoreShippingAddress && hasCustomerShippingAddress ? (
          <Stack spacing={1}>
            {shouldShowShippingServiceSelector ? (
              <OrderShippingMeasurementsForm
                weight={shippingWeightDraft}
                weightUnit={shippingWeightUnit}
                length={shippingLengthDraft}
                width={shippingWidthDraft}
                height={shippingHeightDraft}
                dimensionUnit={shippingDimensionUnit}
                isSaving={isSavingShippingMeasurements}
                onWeightChange={setShippingWeightDraft}
                onWeightUnitChange={(value) => setShippingWeightUnit(value as 'g' | 'kg')}
                onLengthChange={setShippingLengthDraft}
                onWidthChange={setShippingWidthDraft}
                onHeightChange={setShippingHeightDraft}
                onSubmit={() => {
                  void handleSaveShippingMeasurements()
                }}
              />
            ) : null}

            {shouldShowShippingServiceSelector && isShippingOptionsLoading ? (
              <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center', py: 1 }}>
                <CircularProgress size={18} />
                <Typography color="text.secondary">Đang tải dịch vụ vận chuyển...</Typography>
              </Stack>
            ) : null}

            {shouldShowShippingServiceSelector && !isShippingOptionsLoading && shippingOptionsError ? (
              <Typography variant="body2" color="error">
                {shippingOptionsError}
              </Typography>
            ) : null}

            {shouldShowShippingServiceSelector && !isShippingOptionsLoading && !shippingOptionsError && shippingOptions.length > 0 ? (
              <Stack spacing={1}>
                {shippingOptions.map((option) => (
                  <ShippingServiceOptionCard
                    key={option.key}
                    item={{
                      key: option.key,
                      providerDisplayName: option.providerDisplayName,
                      providerLogoUrl: option.providerLogoUrl,
                      serviceName: option.serviceName,
                      expectedDeliveryLabel: option.expectedDeliveryTime ? formatDateTime(option.expectedDeliveryTime) : '-',
                      feeLabel: option.fee !== null ? formatCurrency(option.fee) : null,
                    }}
                    selected={selectedShippingOptionKey === option.key}
                    isSaving={isSavingShippingOption}
                    disabled={isSavingShippingOption}
                    isLowestFee={cheapestShippingOptionKey === option.key}
                    isFastest={fastestShippingOptionKey === option.key}
                    onSelect={() => {
                      void handleSelectShippingOption(option)
                    }}
                  />
                ))}
              </Stack>
            ) : null}

            {shouldShowShippingTrackingPaper ? (
              <Stack spacing={2}>
                <InfoPaperGrid>
                  {orderInfoRows.length > 0 ? <InfoPaper title="Thông tin đơn hàng" rows={orderInfoRows} labelMinWidth={132} /> : null}

                  {detailInfoRows.length > 0 || order.order_items.length > 0 ? (
                    <InfoPaper title="Thông tin chi tiết" rows={detailInfoRows} labelMinWidth={132}>
                      {order.order_items.length > 0 ? (
                        <InfoField
                          label="Sản phẩm"
                          variant="row"
                          labelMinWidth={132}
                          value={
                            <Stack spacing={0.5}>
                              {order.order_items.map((item) => (
                                <Box
                                  key={item.id}
                                  sx={{
                                    display: 'flex',
                                    alignItems: 'flex-end',
                                    justifyContent: 'flex-end',
                                    gap: 0.75,
                                  }}
                                >
                                  <Typography
                                    variant="body2"
                                    sx={{
                                      color: '#101828',
                                      fontWeight: 600,
                                      lineHeight: '20px',
                                      wordBreak: 'break-word',
                                    }}
                                  >
                                    {item.display_name ?? item.product_name}
                                  </Typography>
                                  <Typography
                                    variant="body2"
                                    sx={{
                                      color: '#98a2b3',
                                      lineHeight: '20px',
                                      flexShrink: 0,
                                    }}
                                  >
                                    x{item.quantity}
                                  </Typography>
                                </Box>
                              ))}
                            </Stack>
                          }
                        />
                      ) : null}
                    </InfoPaper>
                  ) : null}

                  {senderInfoRows.length > 0 ? <InfoPaper title="Người gửi" rows={senderInfoRows} labelMinWidth={100} /> : null}

                  {receiverInfoRows.length > 0 ? <InfoPaper title="Người nhận" rows={receiverInfoRows} labelMinWidth={100} /> : null}
                </InfoPaperGrid>

                {isGhnOrderInfoLoading || ghnOrderInfoError || ghnOrderInfo ? (
                  <TimelinePanel
                    title="Lịch sử đơn hàng"
                    description={""}
                    isLoading={isGhnOrderInfoLoading}
                    loadingMessage="Đang tải timeline vận chuyển..."
                    errorMessage={ghnOrderInfoError || null}
                    emptyMessage="GHN chưa trả về timeline chi tiết cho vận đơn này."
                    items={shippingTimelineItems}
                  />
                ) : null}

              </Stack>
            ) : null}

          </Stack>
        ) : null}
          </Stack>
        </Stack>
      </Paper>
    </Stack>
  )

  return (
    <Box sx={{ px: { xs: 2, md: 3, xl: 4 }, pb: 8 }}>
      <Box sx={{ mb: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ justifyContent: 'space-between', alignItems: { md: 'center' } }}>
          <Stack
            direction="row"
            spacing={2}
            sx={{ alignItems: 'center' }}
          >
            <Paper
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                p: 1,
                cursor: 'pointer'
              }}
              onClick={() => navigate('/orders')}
            >
              <ArrowBackIcon sx={{ color: '#344054' }} />
            </Paper>
            <Stack spacing={0.75}>
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', alignItems: 'center' }} useFlexGap>
                <Typography variant="h5" sx={{ fontWeight: 600, color: '#101828' }}>
                  Đơn hàng: {order.order_code}
                </Typography>
                <Chip label={processingMeta.label} color={processingMeta.color} />
                <Chip label={orderTypeLabel} variant="outlined" />
              </Stack>
            </Stack>
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
            {
              shouldShowProductEditButton &&
              <Tooltip title={!canEditOrder ? 'Chỉ có thể chỉnh sửa đơn hàng ở bước "Nháp" hoặc "Mới"' : ''} disableHoverListener={canEditOrder}>
              <span>
                <Button
                  variant="outlined"
                  startIcon={<EditOutlinedIcon />}
                  component={RouterLink}
                  to={`/orders/${order.id}/edit`}
                  disabled={!canEditOrder}
                >
                  Chỉnh sửa đơn hàng
                </Button>
              </span>
            </Tooltip>
            }
            <Button
              variant="text"
              endIcon={<MoreHorizIcon />}
              onClick={(event) => setAnchorEl(event.currentTarget)}
            >
              Thao tác khác
            </Button>
          </Stack>
        </Stack>
      </Box>

      <Paper
        variant="outlined"
        sx={{
          ...borderedCardSx,
          mb: 2,
          p: 1.5,
          bgcolor: (theme) => alpha(theme.palette.primary.light, 0.08),
          borderColor: (theme) => alpha(theme.palette.primary.main, 0.18),
        }}
      >
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ alignItems: { md: 'center' } }}>
          <Chip
            color="secondary"
            icon={nextAction.icon}
            label={`Tiếp theo: ${nextAction.label}`}
            sx={{ fontWeight: 700 }}
          />
          <Stack spacing={0.5} sx={{ flex: 1 }}>
            <Typography color="text.secondary">{nextAction.helper}</Typography>
            {isNextActionBlockedByShippingService ? (
              <Typography variant="body2" color="error">
                Cần chọn dịch vụ vận chuyển trước khi tiếp tục thao tác này.
              </Typography>
            ) : null}
          </Stack>
          {nextAction.action ? (
            <Button
              variant="contained"
              size="small"
              onClick={() => {
                if (nextAction.action === 'push_to_delivery' && hasSelectedShippingService) {
                  const payload = validatePushToDelivery()

                  if (!payload) {
                    return
                  }

                  void runAction(nextAction.action, payload)
                  return
                }

                if (nextAction.action === 'push_to_delivery' || nextAction.action === 'mark_delivered') {
                  openShippingActionDialog(nextAction.action)
                  return
                }

                void runAction(nextAction.action)
              }}
              disabled={isActing || isNextActionBlockedByShippingService}
            >
              {isActing ? 'Đang xử lý...' : nextAction.label}
            </Button>
          ) : null}
        </Stack>
      </Paper>

      <Paper sx={{ ...borderedCardSx, mt: 2.5, p: 0 }}>
        <Tabs
          value={activeTab}
          onChange={(_event, value: DetailTabKey) => setActiveTab(value)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            px: 1.5,
            pt: 1,
            '& .MuiTab-root': {
              textTransform: 'none',
              minHeight: 44,
              fontWeight: 600,
            },
          }}
        >
          <Tab label="Tổng quan" value="overview" />
          <Tab label="Sản phẩm" value="products" />
          <Tab label="Thanh toán" value="payment" />
          <Tab label="Vận chuyển" value="shipping" />
        </Tabs>
      </Paper>

      {activeTab === 'overview' ? (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 3fr) minmax(360px, 1.4fr)' },
            gap: 2.5,
            alignItems: 'start',
            mt: 2.5,
          }}
        >
          <Stack spacing={2.5}>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' },
                gap: 2.5,
                alignItems: 'stretch',
              }}
            >
              {customerOverviewSection}
              {overviewProductsSection}
            </Box>

            <OrderTimelineCard order={order} currentIndex={progressIndex} stages={stepperStages} />
          </Stack>

          <Stack spacing={2.5}>
            {overviewPaymentSummarySection}
          </Stack>
        </Box>
      ) : null}

      {activeTab === 'products' ? <Box sx={{ mt: 2.5 }}>{productsSection}</Box> : null}

      {activeTab === 'payment' ? <Box sx={{ mt: 2.5 }}>{paymentSection}</Box> : null}

      {activeTab === 'shipping' ? (
        <Stack spacing={2.5} sx={{ mt: 2.5 }}>
          <Box>{shippingSection}</Box>
        </Stack>
      ) : null}

      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
        <MenuItem onClick={handleDuplicateOrder}>Nhân bản đơn hàng</MenuItem>

        <MenuItem
          onClick={() => {
            setAnchorEl(null)
            void runAction('cancel')
          }}
          disabled={isActing || !canCancelOrder}
        >
          Hủy đơn hàng
        </MenuItem>
        <MenuItem
          onClick={() => {
            setAnchorEl(null)
            void runAction('return_order')
          }}
          disabled={isActing || !canReturnOrder}
        >
          Trả đơn hàng
        </MenuItem>
        <MenuItem
          onClick={() => {
            setAnchorEl(null)
            void runAction('complete')
          }}
          disabled={isActing || order.processing_status !== 'delivered' || order.payment_status !== 'paid'}
        >
          Đánh dấu hoàn thành
        </MenuItem>
      </Menu>

      <OrderDetailDialogs
        shippingDialog={shippingDialog}
        onCloseShippingDialog={closeShippingDialog}
        onShippingDialogChange={updateShippingDialog}
        onSubmitShippingDialog={() => void submitShippingAction()}
        isActing={isActing}
        isAddPaymentDialogOpen={isAddPaymentDialogOpen}
        isConfirmPaidDialogOpen={isConfirmPaidDialogOpen}
        paymentEntryAmount={paymentEntryAmount}
        paymentEntryMethod={paymentEntryMethod}
        paymentEntryNote={paymentEntryNote}
        isSubmittingPaymentEntry={isSubmittingPaymentEntry}
        orderRemainingAmount={orderRemainingAmount}
        onCloseAddPaymentDialog={closeAddPaymentDialog}
        onPaymentEntryAmountChange={setPaymentEntryAmount}
        onPaymentEntryMethodChange={setPaymentEntryMethod}
        onPaymentEntryNoteChange={setPaymentEntryNote}
        onSubmitAddPayment={() => void submitAddPayment()}
        onCloseConfirmPaidDialog={closeConfirmPaidDialog}
        onSubmitConfirmPaid={() => void submitConfirmPaid()}
        isPaymentDialogOpen={isPaymentDialogOpen}
        onClosePaymentDialog={closePaymentDialog}
        canEditOrder={canEditOrder}
        isSavingPayment={isSavingPayment}
        order={order}
        paymentMethodDraft={paymentMethodDraft}
        discountAmountDraft={discountAmountDraft}
        normalizedTaxAmount={normalizedTaxAmount}
        paymentSubTotal={paymentSubTotal}
        paymentShippingFee={paymentShippingFee}
        paymentTotalAmount={paymentTotalAmount}
        normalizedDepositAmount={normalizedDepositAmount}
        vatEnabledDraft={vatEnabledDraft}
        vatRatePercentDraft={vatRatePercentDraft}
        canEditVat={canEditVat}
        visiblePaymentErrors={visiblePaymentErrors}
        onPaymentMethodChange={handlePaymentMethodChange}
        onDiscountAmountDraftChange={setDiscountAmountDraft}
        onDepositAmountDraftChange={setDepositAmountDraft}
        onVatEnabledDraftChange={setVatEnabledDraft}
        onVatRatePercentDraftChange={setVatRatePercentDraft}
        onSavePayment={() => void handleSavePayment()}
        isInvoiceDialogOpen={isInvoiceDialogOpen}
        invoiceCodeDraft={invoiceCodeDraft}
        onInvoiceCodeDraftChange={setInvoiceCodeDraft}
        onCloseInvoiceDialog={() => setIsInvoiceDialogOpen(false)}
        onSubmitInvoiceRequest={() => void submitInvoiceRequest()}
        isQrDialogOpen={isQrDialogOpen}
        paymentQr={paymentQr}
        onCloseQrDialog={() => setIsQrDialogOpen(false)}
        onCopyQrValue={() => void handleCopyQrValue()}
        customerModalOpen={customerModalOpen}
        customerModalForm={customerModalForm}
        customerModalStates={customerModalStates}
        customerModalCities={customerModalCities}
        customerModalDistricts={customerModalDistricts}
        isCustomerModalStatesLoading={isCustomerModalStatesLoading}
        isCustomerModalCitiesLoading={isCustomerModalCitiesLoading}
        isCustomerModalDistrictsLoading={isCustomerModalDistrictsLoading}
        isCustomerModalSaving={isCustomerModalSaving}
        onCloseCustomerModal={handleCloseCustomerModal}
        onSaveCustomerModal={() => void handleSaveCustomerModal()}
        onCustomerModalFieldChange={handleCustomerModalFieldChange}
        onCustomerModalDefaultAddressChange={handleCustomerModalDefaultAddressChange}
        onCustomerModalStateChange={handleCustomerModalStateChange}
        onCustomerModalCityChange={handleCustomerModalCityChange}
        onCustomerModalDistrictChange={handleCustomerModalDistrictChange}
      />
    </Box>
  )
}





