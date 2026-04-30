import { useCallback, useEffect, useMemo, useState, type ReactElement, type ReactNode } from 'react'
import { Link as RouterLink, useNavigate, useParams } from 'react-router'
import MoreHorizIcon from '@mui/icons-material/MoreHoriz'
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined'
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined'
import QrCode2OutlinedIcon from '@mui/icons-material/QrCode2Outlined'
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined'
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined'
import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined'
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import {
  alpha,
  CircularProgress,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
import { StackedTextField } from '@/shared/ui/form/stacked-text-field'
import { useStore } from '@/modules/store/use-store'
import { useAuth } from '@/modules/auth/use-auth'
import { generalSettingsApi, type VietQrGenerateResponse } from '@/pages/settings/general-settings.api'
import { shippingApi } from '@/pages/shipping/shipping.api'
import { orderApi, type OrderActionName, type OrderListItem, type OrderProcessingStatus } from '../api'
import {
  DetailPageSkeleton,
  PaymentEntryDialog,
  PaymentHistorySection,
  PaymentSummarySection,
} from '../components'
import { usePaymentConfigDraft, usePaymentEntryFlow } from '../hooks'
import {
  buildPaymentHistoryEntries,
  getPaymentMethodFromTypeId,
  parsePaymentNoteContent,
  PaymentInformationCard,
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

const normalizeShippingProviderName = (value: string | null | undefined) => {
  if (!value) {
    return ''
  }

  return value.split(' - ')[0]?.trim() ?? ''
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

type ShippingActionDialogState = {
  action: 'confirm_shipping' | 'push_to_delivery'
  shippingService: string
  trackingCode: string
  shippingStatus: string
}

type ShippingServiceOption = {
  key: string
  providerCode: string
  providerDisplayName: string
  providerLogoUrl: string | null
  serviceId: number
  serviceTypeId: number
  serviceName: string
  fee: number
}

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

const hasResolvedAddress = (address?: {
  state_id: number
  city_id: number
  district_id: number | null
} | null) => Boolean(address?.state_id && address.city_id && address.district_id)

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
  const [shippingDialog, setShippingDialog] = useState<ShippingActionDialogState | null>(null)
  const [invoiceCodeDraft, setInvoiceCodeDraft] = useState('')
  const [isInvoiceDialogOpen, setIsInvoiceDialogOpen] = useState(false)
  const [isQrDialogOpen, setIsQrDialogOpen] = useState(false)
  const [isGeneratingQr, setIsGeneratingQr] = useState(false)
  const [paymentQr, setPaymentQr] = useState<VietQrGenerateResponse | null>(null)
  const [storeShippingAddress, setStoreShippingAddress] = useState<{
    state_id: number | null
    city_id: number | null
    district_id: number | null
    address_line: string
  } | null>(null)
  const [shippingOptions, setShippingOptions] = useState<ShippingServiceOption[]>([])
  const [isShippingOptionsLoading, setIsShippingOptionsLoading] = useState(false)
  const [isSavingShippingOption, setIsSavingShippingOption] = useState(false)
  const [shippingOptionsError, setShippingOptionsError] = useState('')
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

  useEffect(() => {
    if (!order) {
      setShippingOptions([])
      setShippingOptionsError('')
      return
    }

    const hasStoreAddress =
      Boolean(storeShippingAddress?.state_id) &&
      Boolean(storeShippingAddress?.city_id) &&
      Boolean(storeShippingAddress?.district_id)
    const hasCustomerAddress = hasResolvedAddress(order.to_address_detail)

    if (!hasStoreAddress || !hasCustomerAddress) {
      setShippingOptions([])
      setShippingOptionsError('')
      return
    }

    let cancelled = false

    const fetchShippingOptions = async () => {
      try {
        setIsShippingOptionsLoading(true)
        setShippingOptionsError('')

        const providersResponse = await shippingApi.listProviders(activeStore?.id)
        const connectedProviders = providersResponse.items.filter((item) => item.status.code === 'connected')

        const optionGroups = await Promise.all(
          connectedProviders.map(async (provider) => {
            try {
              const servicesResponse = await shippingApi.listAvailableServicesByLocation(provider.code, {
                store_id: activeStore?.id,
                from_location: {
                  state_id: storeShippingAddress?.state_id ?? null,
                  city_id: storeShippingAddress?.city_id ?? null,
                  district_id: storeShippingAddress?.district_id ?? null,
                },
                to_location: {
                  address_id: order.to_address_detail?.id ?? null,
                  state_id: order.to_address_detail?.state_id ?? null,
                  city_id: order.to_address_detail?.city_id ?? null,
                  district_id: order.to_address_detail?.district_id ?? null,
                },
              })

              const feeResults = await Promise.all(
                servicesResponse.items.map(async (service) => {
                  try {
                    const feeResponse = await shippingApi.calculateFeeByLocation(provider.code, {
                      store_id: activeStore?.id,
                      from_location: {
                        state_id: storeShippingAddress?.state_id ?? null,
                        city_id: storeShippingAddress?.city_id ?? null,
                        district_id: storeShippingAddress?.district_id ?? null,
                      },
                      to_location: {
                        address_id: order.to_address_detail?.id ?? null,
                        state_id: order.to_address_detail?.state_id ?? null,
                        city_id: order.to_address_detail?.city_id ?? null,
                        district_id: order.to_address_detail?.district_id ?? null,
                      },
                      service_id: service.service_id,
                      service_type_id: service.service_type_id,
                      weight: order.weight ?? null,
                      length: order.length ?? null,
                      width: order.width ?? null,
                      height: order.height ?? null,
                      insurance_value: order.insurance_value ? Number(order.insurance_value) : null,
                      cod_value: order.cod_amount ? Number(order.cod_amount) : null,
                      items: order.order_items.map((item) => ({
                        name: item.product_name,
                        quantity: item.quantity,
                      })),
                    })

                    return {
                      key: `${provider.code}:${service.service_id}:${service.service_type_id}`,
                      providerCode: provider.code,
                      providerDisplayName: provider.display_name,
                      providerLogoUrl: provider.logo_url,
                      serviceId: service.service_id,
                      serviceTypeId: service.service_type_id,
                      serviceName: service.short_name,
                      fee: Number(feeResponse.quote?.total ?? 0),
                    } satisfies ShippingServiceOption
                  } catch (error) {
                    console.error(`Không thể tính phí cho ${provider.code}/${service.short_name}:`, error)
                    return null
                  }
                }),
              )

              return feeResults.filter((item): item is ShippingServiceOption => Boolean(item))
            } catch (error) {
              console.error(`Không thể tải dịch vụ vận chuyển cho ${provider.code}:`, error)
              return []
            }
          }),
        )

        if (cancelled) {
          return
        }

        const nextOptions = optionGroups.flat().sort((left, right) => left.fee - right.fee)
        setShippingOptions(nextOptions)

        if (nextOptions.length === 0) {
          setShippingOptionsError('Chưa lấy được dịch vụ vận chuyển phù hợp cho địa chỉ hiện tại.')
        }
      } catch (error) {
        if (cancelled) {
          return
        }

        console.error('Lỗi khi tải danh sách dịch vụ vận chuyển:', error)
        setShippingOptions([])
        setShippingOptionsError('Không thể tải danh sách dịch vụ vận chuyển.')
      } finally {
        if (!cancelled) {
          setIsShippingOptionsLoading(false)
        }
      }
    }

    void fetchShippingOptions()

    return () => {
      cancelled = true
    }
  }, [activeStore?.id, order, storeShippingAddress])

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

  const openShippingActionDialog = useCallback(
    (action: 'confirm_shipping' | 'push_to_delivery') => {
      if (!order) {
        return
      }

      const selectedOption =
        shippingOptions.find(
          (item) => item.serviceId === order.service_id && item.serviceTypeId === order.service_type_id,
        ) ?? null
      const nextShippingService =
        selectedOption
          ? selectedOption.providerDisplayName
          : normalizeShippingProviderName(order.shipping_service) || 'GHN'

      setShippingDialog({
        action,
        shippingService: nextShippingService,
        trackingCode: order.tracking_code ?? '',
        shippingStatus:
          action === 'push_to_delivery' ? order.shipping_status ?? 'delivering' : order.shipping_status ?? '',
      })
    },
    [order, shippingOptions],
  )

  const submitShippingAction = useCallback(async () => {
    if (!shippingDialog) {
      return
    }

    await runAction(shippingDialog.action, {
      shipping_service: shippingDialog.shippingService.trim(),
      tracking_code: shippingDialog.trackingCode.trim(),
      shipping_status: shippingDialog.shippingStatus.trim(),
    })
    setShippingDialog(null)
  }, [runAction, shippingDialog])

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
  const hasStoreShippingAddress =
    Boolean(storeShippingAddress?.state_id) &&
    Boolean(storeShippingAddress?.city_id) &&
    Boolean(storeShippingAddress?.district_id)
  const hasCustomerShippingAddress = hasResolvedAddress(order?.to_address_detail)
  const selectedShippingOptionKey =
    shippingOptions.find(
      (item) =>
        item.serviceId === order?.service_id &&
        item.serviceTypeId === order?.service_type_id &&
        item.providerDisplayName.toLowerCase() ===
          normalizeShippingProviderName(order?.shipping_service).toLowerCase(),
    )?.key ??
    shippingOptions.find(
      (item) => item.serviceId === order?.service_id && item.serviceTypeId === order?.service_type_id,
    )?.key ??
    ''
  const selectedShippingOption =
    shippingOptions.find((item) => item.key === selectedShippingOptionKey) ?? null
  const hasSelectedShippingService =
    Boolean(selectedShippingOption) ||
    Boolean(order?.service_id && order?.service_type_id && order?.shipping_service)
  const requiresSelectedShippingService =
    nextAction?.action === 'confirm_shipping' || nextAction?.action === 'push_to_delivery'
  const isNextActionBlockedByShippingService = requiresSelectedShippingService && !hasSelectedShippingService

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

  const handleSelectShippingOption = useCallback(
    async (option: ShippingServiceOption) => {
      if (!params.id || !order) {
        return
      }

      if (
        order.service_id === option.serviceId &&
        order.service_type_id === option.serviceTypeId &&
        normalizeShippingProviderName(order.shipping_service).toLowerCase() ===
          option.providerDisplayName.toLowerCase()
      ) {
        return
      }

      try {
        setIsSavingShippingOption(true)
        const updatedOrder = await orderApi.updateOrder(params.id, {
          service_id: option.serviceId,
          service_type_id: option.serviceTypeId,
          shipping_fee: option.fee,
          shipping_service: option.providerDisplayName,
        })

        setOrder(updatedOrder)
        appToast.success('Đã cập nhật dịch vụ vận chuyển cho đơn hàng.')
      } catch (error) {
        console.error('Lỗi khi cập nhật dịch vụ vận chuyển:', error)
        appToast.error(getErrorMessage(error, 'Không thể cập nhật dịch vụ vận chuyển.'))
      } finally {
        setIsSavingShippingOption(false)
      }
    },
    [order, params.id],
  )

  useEffect(() => {
    if (!order || isShippingOptionsLoading || isSavingShippingOption) {
      return
    }

    if (hasSelectedShippingService || shippingOptions.length === 0) {
      return
    }

    void handleSelectShippingOption(shippingOptions[0])
  }, [
    handleSelectShippingOption,
    hasSelectedShippingService,
    isSavingShippingOption,
    isShippingOptionsLoading,
    order,
    shippingOptions,
  ])

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

          <Paper sx={borderedCardSx}>
            <CardHeader
              eyebrow="Thanh toán"
              title="Thanh toán"
              description=""
            />

            <Stack spacing={2} sx={{ mt: 2 }}>
              <PaymentSummarySection
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
              />

              <PaymentHistorySection entries={paymentHistoryEntries} />

              <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={1.5}
                sx={{
                  justifyContent: 'space-between',
                  alignItems: { md: 'center' },
                  p: 1.5,
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: 'divider',
                  bgcolor: (theme) => alpha(theme.palette.background.default, 0.5),
                }}
              >
                <Stack spacing={1}>
                  <Chip label={invoiceStatusLabel} color={invoiceStatusColor} sx={{ alignSelf: 'flex-start' }} />
                  <Typography color="text.secondary">
                    Mã hóa đơn: {order.invoice_code ?? 'Chưa có mã hóa đơn điện tử'}
                  </Typography>
                </Stack>

                {canExportInvoice ? (
                  <Button
                    variant="outlined"
                    startIcon={<ReceiptLongOutlinedIcon />}
                    onClick={() => {
                      setInvoiceCodeDraft(order.invoice_code ?? '')
                      setIsInvoiceDialogOpen(true)
                    }}
                    disabled={isActing}
                  >
                    Xuất hóa đơn điện tử
                  </Button>
                ) : null}
              </Stack>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
                {canGeneratePaymentQr ? (
                  <Button
                    variant="outlined"
                    startIcon={<QrCode2OutlinedIcon />}
                    onClick={() => {
                      void handleOpenPaymentQr()
                    }}
                    disabled={isGeneratingQr}
                  >
                    Tạo QR
                  </Button>
                ) : null}
                <Button
                  variant="contained"
                  color="secondary"
                  startIcon={<PaymentsOutlinedIcon />}
                  onClick={openAddPaymentDialog}
                  disabled={isActing || !canAddPayment}
                >
                  Thêm thanh toán
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<CheckCircleOutlinedIcon />}
                  onClick={openConfirmPaidDialog}
                  disabled={isActing || !canAddPayment}
                >
                  Xác nhận đã thu đủ tiền
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<EditOutlinedIcon />}
                  onClick={openPaymentDialog}
                  disabled={isActing || !canEditOrder}
                >
                  Cấu hình thanh toán
                </Button>
              </Stack>
            </Stack>
          </Paper>

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
                    borderRadius: 2,
                    bgcolor: '#fffaf0',
                    borderColor: '#fed7aa',
                  }}
                >
                  <Stack spacing={1.25}>
                    <Typography sx={{ fontWeight: 700, color: '#9a3412' }}>
                      Khách hàng chưa có địa chỉ giao hàng đầy đủ
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#9a3412' }}>
                      Cần có địa chỉ giao hàng của khách để hiển thị dịch vụ và tính phí.
                    </Typography>
                    <Button
                      variant="contained"
                      color="secondary"
                      onClick={() => navigate(order.customer_id ? `/customers/${order.customer_id}` : `/orders/${order.id}/edit`)}
                    >
                      {order.customer_id ? 'Cập nhật địa chỉ khách' : 'Chỉnh sửa đơn hàng'}
                    </Button>
                  </Stack>
                </Paper>
              ) : null}

              {hasStoreShippingAddress && hasCustomerShippingAddress ? (
                <Stack spacing={1}>
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

                  {!isShippingOptionsLoading && !shippingOptionsError && shippingOptions.length > 0 ? (
                    <Stack spacing={1}>
                      {selectedShippingOption ? (
                        <Paper
                          variant="outlined"
                          sx={{
                            p: 1.25,
                            borderRadius: 2,
                            borderColor: '#bfdbfe',
                            bgcolor: '#eff6ff',
                          }}
                        >
                          <Typography sx={{ fontWeight: 700, color: '#1d4ed8' }}>
                            Đang chọn: {selectedShippingOption.providerDisplayName} - {selectedShippingOption.serviceName}
                          </Typography>
                          <Typography variant="body2" sx={{ mt: 0.35, color: '#1e3a8a' }}>
                            Phí vận chuyển: {formatCurrency(selectedShippingOption.fee)}
                          </Typography>
                          <Box
                            sx={{
                              mt: 1.25,
                              display: 'grid',
                              gap: 0.75,
                              gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
                            }}
                          >
                            <Paper
                              variant="outlined"
                              sx={{
                                p: 1,
                                borderRadius: 1.5,
                                borderColor: '#bfdbfe',
                                bgcolor: '#ffffff',
                              }}
                            >
                              <Typography variant="caption" sx={{ color: '#475467' }}>
                                Nhà vận chuyển
                              </Typography>
                              <Typography sx={{ mt: 0.35, fontWeight: 700, color: '#101828' }}>
                                {selectedShippingOption.providerDisplayName}
                              </Typography>
                            </Paper>
                            <Paper
                              variant="outlined"
                              sx={{
                                p: 1,
                                borderRadius: 1.5,
                                borderColor: '#bfdbfe',
                                bgcolor: '#ffffff',
                              }}
                            >
                              <Typography variant="caption" sx={{ color: '#475467' }}>
                                Gói dịch vụ
                              </Typography>
                              <Typography sx={{ mt: 0.35, fontWeight: 700, color: '#101828' }}>
                                {selectedShippingOption.serviceName}
                              </Typography>
                            </Paper>
                            <Paper
                              variant="outlined"
                              sx={{
                                p: 1,
                                borderRadius: 1.5,
                                borderColor: '#bfdbfe',
                                bgcolor: '#ffffff',
                              }}
                            >
                              <Typography variant="caption" sx={{ color: '#475467' }}>
                                Phí vận chuyển
                              </Typography>
                              <Typography sx={{ mt: 0.35, fontWeight: 700, color: '#101828' }}>
                                {formatCurrency(selectedShippingOption.fee)}
                              </Typography>
                            </Paper>
                          </Box>
                        </Paper>
                      ) : null}
                      {shippingOptions.map((option) => {
                        const selected = selectedShippingOptionKey === option.key
                        const isCheapest = shippingOptions[0]?.key === option.key

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
                              borderRadius: 2,
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
                                  {isCheapest ? (
                                    <Chip
                                      label="Tiết kiệm nhất"
                                      size="small"
                                      sx={{
                                        height: 22,
                                        bgcolor: '#ecfdf3',
                                        color: '#027a48',
                                        fontWeight: 700,
                                        border: '1px solid #abefc6',
                                      }}
                                    />
                                  ) : null}
                                </Stack>
                                <Typography variant="body2" sx={{ color: '#475467' }}>
                                  {option.serviceName}
                                </Typography>
                              </Box>
                            </Stack>

                            <Stack spacing={0.5} sx={{ alignItems: 'flex-end' }}>
                              <Typography sx={{ fontWeight: 700, color: '#101828' }}>
                                {formatCurrency(option.fee)}
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

      <Dialog open={Boolean(shippingDialog)} onClose={() => setShippingDialog(null)} fullWidth maxWidth="sm">
        <DialogTitle>{shippingDialog?.action === 'confirm_shipping' ? 'Xác nhận đóng gói' : 'Đẩy sang vận chuyển'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <StackedTextField
              label="Đơn vị vận chuyển"
              value={shippingDialog?.shippingService ?? ''}
              onChange={(event) =>
                setShippingDialog((current) => (current ? { ...current, shippingService: event.target.value } : current))
              }
              fullWidth
            />
            <StackedTextField
              label="Mã tracking"
              value={shippingDialog?.trackingCode ?? ''}
              onChange={(event) =>
                setShippingDialog((current) => (current ? { ...current, trackingCode: event.target.value } : current))
              }
              fullWidth
            />
            <StackedTextField
              label="Trạng thái giao hàng"
              value={shippingDialog?.shippingStatus ?? ''}
              onChange={(event) =>
                setShippingDialog((current) => (current ? { ...current, shippingStatus: event.target.value } : current))
              }
              fullWidth
              placeholder={shippingDialog?.action === 'push_to_delivery' ? 'delivering' : 'packed'}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShippingDialog(null)}>Đóng</Button>
          <Button variant="contained" onClick={() => void submitShippingAction()} disabled={isActing}>
            {shippingDialog?.action === 'confirm_shipping' ? 'Xác nhận đóng gói' : 'Đẩy sang vận chuyển'}
          </Button>
        </DialogActions>
      </Dialog>

      <PaymentEntryDialog
        open={isAddPaymentDialogOpen}
        title="Thêm thanh toán"
        description="Ghi nhận từng lần thu tiền để lịch sử thanh toán luôn rõ ràng và không ghi đè dữ liệu cũ."
        amountLabel="Số tiền thanh toán"
        amountValue={paymentEntryAmount}
        amountEditable
        noteLabel="Ghi chú giao dịch"
        notePlaceholder="Ví dụ: khách chuyển khoản đợt 2"
        noteValue={paymentEntryNote}
        methodValue={paymentEntryMethod}
        remainingAmount={orderRemainingAmount}
        submitLabel="Ghi nhận thanh toán"
        isSubmitting={isSubmittingPaymentEntry}
        onClose={closeAddPaymentDialog}
        onAmountChange={setPaymentEntryAmount}
        onMethodChange={setPaymentEntryMethod}
        onNoteChange={setPaymentEntryNote}
        onSubmit={() => {
          void submitAddPayment()
        }}
      />

      <PaymentEntryDialog
        open={isConfirmPaidDialogOpen}
        title="Xác nhận đã thu đủ tiền"
        description="Dùng khi khách đã thanh toán ngoài hệ thống và bạn muốn xác nhận thủ công phần còn lại. Hành động này vẫn được lưu thành một giao dịch cuối trong lịch sử thanh toán."
        amountLabel="Số tiền xác nhận"
        amountValue={formatCurrency(orderRemainingAmount)}
        noteLabel="Ghi chú xác nhận"
        notePlaceholder="Ví dụ: khách đã chuyển khoản ngoài hệ thống, đã đối soát sao kê"
        noteValue={paymentEntryNote}
        methodValue={paymentEntryMethod}
        remainingAmount={orderRemainingAmount}
        submitLabel="Xác nhận thu đủ tiền"
        isSubmitting={isSubmittingPaymentEntry}
        onClose={closeConfirmPaidDialog}
        onMethodChange={setPaymentEntryMethod}
        onNoteChange={setPaymentEntryNote}
        onSubmit={() => {
          void submitConfirmPaid()
        }}
      />

      <Dialog open={isPaymentDialogOpen} onClose={closePaymentDialog} fullWidth maxWidth="md">
        <DialogTitle>Cấu hình thanh toán</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <PaymentInformationCard
              itemCount={order.order_items.length}
              canEdit={canEditOrder}
              paymentMethod={paymentMethodDraft}
              discountAmount={discountAmountDraft}
              taxAmount={normalizedTaxAmount}
              subTotal={paymentSubTotal}
              shippingFee={paymentShippingFee}
              totalAmount={paymentTotalAmount}
              depositAmount={normalizedDepositAmount}
              vatEnabled={vatEnabledDraft}
              vatRatePercent={Math.max(Number(vatRatePercentDraft || 0), 0)}
              canEditVat={canEditVat}
              errors={visiblePaymentErrors}
              onPaymentStatusChange={() => undefined}
              onPaymentMethodChange={handlePaymentMethodChange}
              onDiscountAmountChange={setDiscountAmountDraft}
              onDepositAmountChange={setDepositAmountDraft}
              onVatEnabledChange={setVatEnabledDraft}
              onVatRatePercentChange={setVatRatePercentDraft}
            />
            {visiblePaymentErrors.processing_status ? (
              <Typography color="error">{visiblePaymentErrors.processing_status}</Typography>
            ) : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closePaymentDialog}>Đóng</Button>
          <Button variant="contained" onClick={() => void handleSavePayment()} disabled={!canEditOrder || isSavingPayment}>
            {isSavingPayment ? 'Đang lưu...' : 'Lưu thanh toán'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={isInvoiceDialogOpen} onClose={() => setIsInvoiceDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Xuất hóa đơn điện tử</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <StackedTextField
              label="Mã hóa đơn"
              value={invoiceCodeDraft}
              onChange={(event) => setInvoiceCodeDraft(event.target.value)}
              fullWidth
              placeholder="Nếu để trống, backend sẽ tạo mã mặc định"
            />
            <Typography variant="body2" color="text.secondary">
              Mã hóa đơn sẽ được lưu vào lịch sử đơn hàng để đội vận hành đối soát sau này.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsInvoiceDialogOpen(false)}>Đóng</Button>
          <Button variant="contained" onClick={() => void submitInvoiceRequest()} disabled={isActing}>
            Lưu mã hóa đơn
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={isQrDialogOpen} onClose={() => setIsQrDialogOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>QR thanh toán</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1, alignItems: 'center' }}>
            {paymentQr?.data.qrDataURL ? (
              <Box
                component="img"
                src={paymentQr.data.qrDataURL}
                alt={`QR thanh toán ${order.order_code}`}
                sx={{ width: 240, height: "100%", borderRadius: 2, border: '1px solid #e2e8f0', bgcolor: '#fff' }}
              />
            ) : null}
            {paymentQr?.transfer_content ? (
              <Paper
                variant="outlined"
                sx={{
                  width: '100%',
                  p: 1.5,
                  borderRadius: 2,
                  bgcolor: '#f8fafc',
                }}
              >
                <Typography
                  component="pre"
                  sx={{
                    m: 0,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    fontFamily: 'inherit',
                    fontSize: 14,
                    color: '#0f172a',
                    lineHeight: 1.7,
                  }}
                >
                  {paymentQr.transfer_content}
                </Typography>
              </Paper>
            ) : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsQrDialogOpen(false)}>Đóng</Button>
          <Button variant="contained" onClick={() => void handleCopyQrValue()}>
            Copy nội dung
          </Button>
        </DialogActions>
      </Dialog>
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
  title,
  description,
}: {
  eyebrow: string
  title: string
  description: string
}): ReactElement {
  return (
    <Box>
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
          <Typography variant="h6" sx={{ fontWeight: 600, color: '#101828' }}>
            {title}
          </Typography>
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
