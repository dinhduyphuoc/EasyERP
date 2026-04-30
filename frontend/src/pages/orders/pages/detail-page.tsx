import { useCallback, useEffect, useMemo, useState, type ReactElement, type ReactNode } from 'react'
import { Link as RouterLink, useNavigate, useParams } from 'react-router'
import MoreHorizIcon from '@mui/icons-material/MoreHoriz'
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined'
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined'
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined'
import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined'
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined'
import InfoIcon from '@mui/icons-material/Info';
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import {
  alpha,
  CircularProgress,
  Box,
  Button,
  Chip,
  Menu,
  MenuItem,
  Paper,
  Radio,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material'
import { appToast } from '@/shared/ui/toast/toast.helpers'
import { borderedCardSx } from '@/shared/ui/paper'
import { useStore } from '@/modules/store/use-store'
import { useAuth } from '@/modules/auth/use-auth'
import { generalSettingsApi, type VietQrGenerateResponse } from '@/pages/settings/general-settings.api'
import { orderApi, type OrderActionName, type OrderListItem, type OrderProcessingStatus } from '../api'
import {
  DetailPageSkeleton,
  OrderShippingMeasurementsForm,
  OrderDetailDialogs,
  OrderDetailPaymentPanel,
} from '../components'
import { useOrderCustomerEditor, useOrderShipping, usePaymentConfigDraft, usePaymentEntryFlow } from '../hooks'
import {
  buildPaymentHistoryEntries,
  getPaymentMethodFromTypeId,
  parsePaymentNoteContent,
} from '../lib'
import {
  formatCurrency,
  formatDateTime,
  getProcessingStatusMeta,
} from '../lib'

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


const stepperStages: Array<{
  key: string
  timelineKey: string
  label: string
  matches: OrderProcessingStatus[]
}> = [
  { key: 'placed', timelineKey: 'placed', label: 'Chờ xác nhận', matches: ['placed'] },
  { key: 'confirmed', timelineKey: 'confirmed', label: 'Đã xác nhận', matches: ['confirmed'] },
  { key: 'picking', timelineKey: 'picked_up', label: 'Đóng gói', matches: ['picked_up'] },
  { key: 'shipping', timelineKey: 'delivering', label: 'Giao hàng', matches: ['delivering'] },
  { key: 'completed', timelineKey: 'completed', label: 'Hoàn thành', matches: ['completed'] },
]

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')

const getOrderHistoryPaymentAmount = (entry: OrderListItem['order_history'][number]): string | null => {
  const metadata = entry.metadata ?? {}
  const paymentStatus = typeof metadata.payment_status === 'string' ? metadata.payment_status : null

  if (paymentStatus !== 'deposit' && paymentStatus !== 'paid') {
    return null
  }

  const amountCandidates = [metadata.payment_amount, metadata.paid_amount, metadata.deposit_amount]

  for (const candidate of amountCandidates) {
    const amount = Number(candidate)

    if (Number.isFinite(amount) && amount > 0) {
      return formatCurrency(amount)
    }
  }

  return null
}

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

const buildPackingSlipMarkup = (order: OrderListItem) => {
  const rows = order.order_items
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.product_name)}</td>
          <td>${escapeHtml(item.variant_sku ?? item.sku)}</td>
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
          <div class="sign">Người nhận / Đơn vị vận chuyển</div>
        </div>
      </body>
    </html>
  `
}

export function OrdersDetailPage(): ReactElement {
  const navigate = useNavigate()
  const params = useParams()
  const { activeStore } = useStore()
  const { user, hasPermission } = useAuth()
  const [order, setOrder] = useState<OrderListItem | null>(null)
  const [isLoading, setIsLoading] = useState(true)
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
    state_id: number | null
    city_id: number | null
    district_id: number | null
    address_line: string
  } | null>(null)
  const fetchOrder = useCallback(async () => {
    if (!params.id) {
      return
    }

    setIsLoading(true)

    try {
      const data = await orderApi.getOrderById(params.id)
      setOrder(data)
    } catch (error) {
      console.error('Lỗi khi tải chi tiết đơn hàng:', error)
      appToast.error('Không thể tải chi tiết đơn hàng.')
    } finally {
      setIsLoading(false)
    }
  }, [params.id])

  useEffect(() => {
    void fetchOrder()
  }, [fetchOrder])

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

  const nextAction = useMemo(() => {
    if (!order) {
      return null
    }

    if (['draft', 'placed'].includes(order.processing_status)) {
      return {
        action: 'confirm' as OrderActionName,
        label: 'Xác nhận đơn hàng',
        helper:
          order.processing_status === 'draft'
            ? 'Đơn đang ở trạng thái nháp. Xác nhận để chuyển sang bước xử lý kho.'
            : 'Kiểm tra thông tin và xác nhận đơn để kho bắt đầu xử lý.',
        icon: <CheckCircleOutlinedIcon fontSize="small" />,
      }
    }

    if (order.processing_status === 'confirmed') {
      return {
        action: 'confirm_shipping' as OrderActionName,
        label: 'Xác nhận đóng gói',
        helper: 'Đơn đã được xác nhận. Kho có thể đóng gói và chuẩn bị bàn giao vận chuyển.',
        icon: <Inventory2OutlinedIcon fontSize="small" />,
      }
    }

    if (order.processing_status === 'picked_up') {
      return {
        action: 'push_to_delivery' as OrderActionName,
        label: 'Đẩy sang vận chuyển',
        helper: 'Chuyển đơn sang trạng thái đang giao và cập nhật tracking vận chuyển.',
        icon: <LocalShippingOutlinedIcon fontSize="small" />,
      }
    }

    if (order.processing_status === 'delivering') {
      return {
        action: 'complete' as OrderActionName,
        label: 'Đánh dấu hoàn thành',
        helper: 'Đơn đang giao. Theo dõi giao hàng và xác nhận hoàn tất khi thành công.',
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
        appToast.success(`Đã cập nhật đơn hàng ${updated.order_code}.`)
      } catch (error) {
        console.error('Lỗi khi cập nhật action đơn hàng:', error)
        appToast.error(getErrorMessage(error, 'Không thể cập nhật đơn hàng.'))
      } finally {
        setIsActing(false)
      }
    },
    [order, params.id],
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
        appToast.success(`Đã tạo bản sao ${duplicatedOrder.order_code} từ đơn ${order.order_code}.`)
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
      appToast.error('Trình duyệt đã chặn cửa sổ in. Hãy cho phép pop-up để xuất packing slip.')
      return
    }
  }, [order])

  const handleCopyQrValue = useCallback(async () => {
    if (!paymentQr?.transfer_content) {
      return
    }

    try {
      await navigator.clipboard.writeText(paymentQr.transfer_content)
      appToast.success('Đã copy thông tin chuyển khoản.')
    } catch {
      appToast.error('Không thể copy thông tin chuyển khoản trên trình duyệt này.')
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
  const progressIndex = stepperStages.findIndex((stage) => stage.matches.includes(order?.processing_status ?? 'draft'))
  const orderTypeLabel = order?.order_type === 'return' ? 'Đơn trả hàng' : 'Đơn bán hàng'
  const invoiceStatusLabel = order?.invoice_code ? 'Đã tạo e-invoice' : 'Chưa xuất hóa đơn'
  const invoiceStatusColor = order?.invoice_code ? 'success' : 'default'
  const currentActorName = user?.full_name?.trim() || 'Hệ thống'
  const canEditVat = hasPermission('orders.vat.update')
  const displayCreatedBy =
    order?.created_by && !['System', 'Sales Admin', 'Hệ thống'].includes(order.created_by)
      ? order.created_by
      : currentActorName
  const displayConfirmedBy =
    order?.confirmed_by && !['System', 'Sales Admin', 'Hệ thống'].includes(order.confirmed_by)
      ? order.confirmed_by
      : currentActorName
  const canEditOrder = ['draft', 'placed'].includes(order?.processing_status ?? 'draft')
  const shouldShowProductEditButton = order?.processing_status === 'placed'
  const canAddPayment = orderRemainingAmount > 0 && !['cancelled', 'returned'].includes(order?.processing_status ?? '')
  const canGeneratePaymentQr = orderRemainingAmount > 0
  const canCancelOrder =
    ['draft', 'placed', 'confirmed', 'picked_up'].includes(order?.processing_status ?? '') && order?.payment_status !== 'paid'
  const canReturnOrder = order?.processing_status === 'completed'
  const canExportPackingSlip = ['confirmed', 'picked_up', 'delivering', 'completed'].includes(
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
      appToast.error('Vui lòng nhập khối lượng và kích thước lớn hơn 0.')
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
      appToast.success('Đã cập nhật khối lượng và kích thước đơn hàng.')
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
            <Tooltip title={!canEditOrder ? 'Chỉ có thể chỉnh sửa đơn hàng ở bước "Chờ xác nhận"' : ''} disableHoverListener={canEditOrder}>
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
            label={`Hành động tiếp theo: ${nextAction.label}`}
            sx={{ fontWeight: 700, alignSelf: 'flex-start' }}
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
              onClick={() =>
                nextAction.action === 'confirm_shipping' || nextAction.action === 'push_to_delivery'
                  ? openShippingActionDialog(nextAction.action)
                  : void runAction(nextAction.action)
              }
              disabled={isActing || isNextActionBlockedByShippingService}
            >
              {isActing ? 'Đang xử lý...' : nextAction.label}
            </Button>
          ) : null}
        </Stack>
      </Paper>

      <OrderProgressCard currentIndex={progressIndex} />

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 7fr) minmax(320px, 3fr)' },
          gap: 2.5,
          alignItems: 'start',
          mt: 2.5,
        }}
      >
        <Stack spacing={2.5}>
          <Paper sx={borderedCardSx}>
            <CardHeader
              eyebrow="Sản phẩm đơn hàng"
              title="Danh sách sản phẩm"
              description=""
            />

            <Box sx={{ overflowX: 'auto', mt: 2 }}>
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
                        <Stack spacing={0.6}>
                          <Typography sx={{ fontWeight: 700, color: '#0f172a' }}>{item.product_name}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            Biến thể: {item.variant_sku ?? item.sku}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Ghi chú nội tuyến: {item.notes ?? 'Không có ghi chú cho item này'}
                          </Typography>
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
              sx={{ mt: 2, justifyContent: 'space-between', alignItems: { md: 'center' } }}
            >
              <Typography color="text.secondary">
                {order.order_items.length} sản phẩm
              </Typography>

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
          </Paper>

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
            invoiceStatusLabel={invoiceStatusLabel}
            invoiceStatusColor={invoiceStatusColor}
            invoiceCode={order.invoice_code}
            canExportInvoice={canExportInvoice}
            canGeneratePaymentQr={canGeneratePaymentQr}
            canAddPayment={canAddPayment}
            canEditOrder={canEditOrder}
            isActing={isActing}
            isGeneratingQr={isGeneratingQr}
            onOpenInvoiceDialog={() => {
              setInvoiceCodeDraft(order.invoice_code ?? '')
              setIsInvoiceDialogOpen(true)
            }}
            onOpenPaymentQr={() => {
              void handleOpenPaymentQr()
            }}
            onOpenAddPaymentDialog={openAddPaymentDialog}
            onOpenConfirmPaidDialog={openConfirmPaidDialog}
            onOpenPaymentDialog={openPaymentDialog}
          />

          <Paper sx={borderedCardSx}>
            <CardHeader
              eyebrow="Vận chuyển"
              title="Vận chuyển"
              description=""
            />

            <Stack spacing={1.5} sx={{ mt: 2 }}>
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
                    <Button
                      variant="contained"
                      color="secondary"
                      onClick={handleShippingAddressCta}
                    >
                      {shippingAddressCtaLabel}
                    </Button>
                  </Stack>
                </Paper>
              ) : null}

              {hasStoreShippingAddress && hasCustomerShippingAddress ? (
                <Stack spacing={1}>
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

                  {isShippingOptionsLoading ? (
                    <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center', py: 1 }}>
                      <CircularProgress size={18} />
                      <Typography color="text.secondary">Đang tải dịch vụ vận chuyển...</Typography>
                    </Stack>
                  ) : null}

                  {!isShippingOptionsLoading && shippingOptionsError ? (
                    <Typography variant="body2" color="error">
                      {shippingOptionsError}
                    </Typography>
                  ) : null}

                  {!isShippingOptionsLoading && !shippingOptionsError && shippingOptions.filter((option) => option.fee !== null).length > 0 ? (
                    <Stack spacing={1}>
                      {shippingOptions.filter((option) => option.fee !== null).map((option) => {
                        const selected = selectedShippingOptionKey === option.key

                        return (
                          <Box
                            key={option.key}
                            component="button"
                            type="button"
                            onClick={() => {
                              void handleSelectShippingOption(option)
                            }}
                            disabled={isSavingShippingOption}
                            sx={{
                              width: '100%',
                              p: 1.5,
                              borderRadius: 1,
                              border: selected ? '1px solid #2563eb' : '1px solid #d0d5dd',
                              background: selected ? '#eff6ff' : '#ffffff',
                              display: 'grid',
                              gridTemplateColumns: 'auto minmax(0, 1fr) auto',
                              gap: 1.25,
                              alignItems: 'center',
                              textAlign: 'left',
                              cursor: isSavingShippingOption ? 'default' : 'pointer',
                              appearance: 'none',
                            }}
                          >
                            <Radio checked={selected} value={option.key} disableRipple />

                            <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center', minWidth: 0 }}>
                              {option.providerLogoUrl ? (
                                <Box
                                  component="img"
                                  src={option.providerLogoUrl}
                                  alt={option.providerDisplayName}
                                  sx={{ width: 40, height: 40, objectFit: 'contain', borderRadius: 1.5, bgcolor: '#fff' }}
                                />
                              ) : (
                                <Box
                                  sx={{
                                    width: 40,
                                    height: 40,
                                    borderRadius: 1.5,
                                    display: 'grid',
                                    placeItems: 'center',
                                    bgcolor: '#f2f4f7',
                                    color: '#344054',
                                    fontWeight: 700,
                                    fontSize: 12,
                                  }}
                                >
                                  {option.providerDisplayName.slice(0, 3).toUpperCase()}
                                </Box>
                              )}

                              <Box sx={{ minWidth: 0 }}>
                                <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', flexWrap: 'wrap' }} useFlexGap>
                                  <Typography sx={{ fontWeight: 700, color: '#101828' }}>
                                    {option.providerDisplayName}
                                  </Typography>
                                </Stack>
                                <Typography variant="body2" sx={{ color: '#475467' }}>
                                  {option.serviceName}
                                </Typography>
                              </Box>
                            </Stack>

                            <Stack spacing={0.5} sx={{ alignItems: 'flex-end' }}>
                              <Typography sx={{ fontWeight: 700, color: '#101828' }}>
                                {formatCurrency(option.fee ?? 0)}
                              </Typography>
                              {selected && isSavingShippingOption ? (
                                <Typography variant="caption" sx={{ color: '#475467' }}>
                                  Đang lưu...
                                </Typography>
                              ) : null}
                            </Stack>
                          </Box>
                        )
                      })}
                    </Stack>
                  ) : null}
                </Stack>
              ) : null}
            </Stack>
          </Paper>
        </Stack>

        <Stack spacing={2.5}>
          <SidebarCard title="Thông tin đơn hàng">
            <SidebarLine label="Cửa hàng / Chi nhánh" value={activeStore?.name ?? '-'} />
            <SidebarLine label="Nhân viên được giao" value={displayConfirmedBy} />
            <SidebarLine label="Tạo bởi" value={displayCreatedBy} />
            <SidebarLine label="Ngày tạo" value={formatDateTime(order.created_at)} />
            <SidebarLine label="Cập nhật cuối" value={formatDateTime(order.updated_at)} />
          </SidebarCard>
          
          <SidebarCard icon={<PersonOutlineOutlinedIcon fontSize="small" />} title="Khách hàng">
            <Stack spacing={1.25}>
              <SidebarLine label="Mã khách hàng" value={order.customer_info.customer_code ?? 'Khách lẻ'} />
              <SidebarLine label="Tên khách hàng" value={order.customer_info.name} />
              <SidebarLine label="Số điện thoại" value={order.customer_info.phone} />
            </Stack>
          </SidebarCard>

          <SidebarCard title="Ghi chú">
            <Stack spacing={1.25}>
              <NoteBlock label="Ghi chú đơn hàng" value={order.order_notes ?? 'Chưa có ghi chú đơn hàng'} />
              <NoteBlock label="Ghi chú thanh toán" value={order.payment_notes ?? 'Chưa có ghi chú thanh toán'} />
            </Stack>
          </SidebarCard>

          <Paper sx={borderedCardSx}>
            <CardHeader
              eyebrow="Hoạt động đơn hàng"
              title="Nhật ký lịch sử"
              description="Timeline hiển thị action, user và mốc thời gian để đội operations đối chiếu nhanh."
            />

            <Stack spacing={0} sx={{ mt: 2 }}>
              {order.order_history.map((entry, index) => (
                <ActivityRow
                  key={entry.id}
                  title={entry.description}
                  subtitle={`${entry.actor_name ?? 'Hệ thống'}`}
                  timestamp={formatDateTime(entry.timestamp)}
                  isLast={index === order.order_history.length - 1}
                  extra={
                    getOrderHistoryPaymentAmount(entry) ? (
                      <Typography variant="body2" sx={{ mt: 0.35, fontWeight: 700, color: '#0f172a' }}>
                        Số tiền: {getOrderHistoryPaymentAmount(entry)}
                      </Typography>
                    ) : undefined
                  }
                />
              ))}
            </Stack>
          </Paper>
        </Stack>
      </Box>

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
          disabled={isActing || order.processing_status === 'completed' || order.payment_status !== 'paid'}
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

function OrderProgressCard({
  currentIndex,
}: {
  currentIndex: number
}): ReactElement {
  return (
    <Paper sx={borderedCardSx}>
      <CardHeader
        eyebrow="Tiến trình đơn hàng"
        title="Tiến trình đơn hàng"
        description=""
      />

      <Box sx={{ mt: 2.5, display: { xs: 'none', md: 'block' } }}>
        <Stepper id="desktop-stepper" activeStep={Math.max(currentIndex, 0)} sx={{ width: '100%', height: 40 }}>
          {stepperStages.map((stage) => (
            <Step sx={{ ':first-child': { pl: 0 }, ':last-child': { pr: 0 } }} key={stage.key}>
              <StepLabel>{stage.label}</StepLabel>
            </Step>
          ))}
        </Stepper>
      </Box>

      <Stepper
        id="mobile-stepper"
        activeStep={Math.max(currentIndex, 0)}
        alternativeLabel
        sx={{ display: { xs: 'flex', md: 'none' }, mt: 2.5 }}
      >
        {stepperStages.map((stage) => (
          <Step
            sx={{
              ':first-child': { pl: 0 },
              ':last-child': { pr: 0 },
              '& .MuiStepConnector-root': { top: { xs: 6, sm: 12 } },
            }}
            key={stage.key}
          >
            <StepLabel sx={{ '.MuiStepLabel-labelContainer': { maxWidth: '70px' } }}>
              {stage.label}
            </StepLabel>
          </Step>
        ))}
      </Stepper>
    </Paper>
  )
}

function CardHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string
  title: string
  description: string
}): ReactElement {
  return (
    <Box>
      <Typography
        variant="caption"
        sx={{ display: 'block', color: '#98a2b3', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8 }}
      >
        {eyebrow}
      </Typography>
      <Typography variant="h6" sx={{ fontWeight: 600, color: '#101828' }}>
        {title}
      </Typography>
      <Typography sx={{ color: '#667085', mt: 0.5 }}>{description}</Typography>
    </Box>
  )
}

function ActivityRow({
  title,
  subtitle,
  timestamp,
  extra,
  isLast,
}: {
  title: string
  subtitle: string
  timestamp: string
  extra?: ReactNode
  isLast: boolean
}): ReactElement {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: '24px minmax(0, 1fr)', columnGap: 1.5 }}>
      <Stack sx={{ alignItems: 'center' }}>
        <Box
          sx={{
            width: 12,
            height: 12,
            mt: 0.8,
            borderRadius: '50%',
            bgcolor: 'primary.main',
            boxShadow: '0 0 0 4px rgba(20, 184, 166, 0.14)',
          }}
        />
        {!isLast ? <Box sx={{ width: 2, flex: 1, bgcolor: 'divider', minHeight: 58, mt: 0.5 }} /> : null}
      </Stack>

      <Box sx={{ pb: 2 }}>
        <Typography sx={{ fontWeight: 700, color: '#0f172a' }}>{title}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
          {subtitle}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
          {timestamp}
        </Typography>
        {extra ? <Box sx={{ mt: 0.75 }}>{extra}</Box> : null}
      </Box>
    </Box>
  )
}

function SidebarCard({
  title,
  icon,
  description,
  children,
}: {
  title: string
  icon?: ReactNode
  description?: string
  children: ReactNode
}): ReactElement {
  return (
    <Paper sx={borderedCardSx}>
      <Stack spacing={1.5}>
        <Box>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            {icon ? <Box sx={{ color: '#667085', display: 'grid', placeItems: 'center' }}>{icon}</Box> : null}
            <Typography variant="h6" sx={{ fontWeight: 600, color: '#101828' }}>
              {title}
            </Typography>
          </Stack>
          {description ? <Typography sx={{ color: '#667085', mt: 0.5 }}>{description}</Typography> : null}
        </Box>
        {children}
      </Stack>
    </Paper>
  )
}

function SidebarLine({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <Stack direction="row" spacing={1.5} sx={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <Typography variant="body2" color="text.secondary" sx={{ minWidth: 108 }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ textAlign: 'right', color: '#0f172a', fontWeight: 600 }}>
        {value}
      </Typography>
    </Stack>
  )
}

function NoteBlock({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.5,
        bgcolor: (theme) => alpha(theme.palette.background.default, 0.7),
      }}
    >
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography sx={{ mt: 0.8, color: '#0f172a', lineHeight: 1.7 }}>{value}</Typography>
    </Paper>
  )
}
