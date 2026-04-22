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
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined'
import {
  alpha,
  Box,
  Button,
  Chip,
  Divider,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Menu,
  MenuItem,
  OutlinedInput,
  Paper,
  Stack,
  Step,
  StepLabel,
  Stepper,
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
import { orderApi, type OrderActionName, type OrderListItem, type OrderProcessingStatus } from './order.api'
import {
  formatCurrency,
  formatDateTime,
  getPaymentStatusMeta,
  getProcessingStatusMeta,
} from './order.utils'

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
  { key: 'placed', timelineKey: 'placed', label: 'Đặt hàng', matches: ['placed'] },
  { key: 'confirmed', timelineKey: 'confirmed', label: 'Xác nhận', matches: ['confirmed'] },
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

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')

const buildOrderQrValue = (order: OrderListItem) =>
  [
    `order_code=${order.order_code}`,
    `customer=${order.customer_info.name}`,
    `phone=${order.customer_info.phone}`,
    `total=${order.total_amount}`,
    `outstanding=${order.outstanding_amount}`,
  ].join('\n')

const openPrintWindow = (content: string) => {
  const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=1024,height=768')

  if (!printWindow) {
    return false
  }

  printWindow.document.write(content)
  printWindow.document.close()
  printWindow.focus()
  printWindow.print()
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
            <h1>Packing Slip</h1>
            <p>Đơn hàng ${escapeHtml(order.order_code)}</p>
          </div>
          <div>
            <div class="label">Ngay in</div>
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
  const [order, setOrder] = useState<OrderListItem | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isActing, setIsActing] = useState(false)
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [shippingDialog, setShippingDialog] = useState<ShippingActionDialogState | null>(null)
  const [invoiceCodeDraft, setInvoiceCodeDraft] = useState('')
  const [isInvoiceDialogOpen, setIsInvoiceDialogOpen] = useState(false)
  const [isQrDialogOpen, setIsQrDialogOpen] = useState(false)

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

  const nextAction = useMemo(() => {
    if (!order) {
      return null
    }

    if (order.processing_status === 'placed') {
      return {
        action: 'confirm' as OrderActionName,
        label: 'Xác nhận đơn hàng',
        helper: 'Kiểm tra thông tin và chuyển đơn sang xác nhận để kho bắt đầu xử lý.',
        icon: <CheckCircleOutlinedIcon fontSize="small" />,
      }
    }

    if (order.processing_status === 'confirmed') {
      return {
        action: 'confirm_shipping' as OrderActionName,
        label: 'Xác nhận giao kho',
        helper: 'Đơn đã sẵn sàng cho kho đóng gói và tạo lệnh giao.',
        icon: <Inventory2OutlinedIcon fontSize="small" />,
      }
    }

    if (order.processing_status === 'picked_up') {
      return {
        action: 'push_to_delivery' as OrderActionName,
        label: 'Đẩy sang vận chuyển',
        helper: 'Đẩy đơn sang đơn vị vận chuyển và cập nhật tracking ngay.',
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
    async (action: OrderActionName, payload: Record<string, string> = {}) => {
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

  const qrValue = useMemo(() => (order ? buildOrderQrValue(order) : ''), [order])
  const qrImageUrl = useMemo(
    () => (qrValue ? `https://quickchart.io/qr?size=240&text=${encodeURIComponent(qrValue)}` : ''),
    [qrValue],
  )

  const openShippingActionDialog = useCallback(
    (action: 'confirm_shipping' | 'push_to_delivery') => {
      if (!order) {
        return
      }

      setShippingDialog({
        action,
        shippingService: order.shipping_service ?? 'GHN',
        trackingCode: order.tracking_code ?? '',
        shippingStatus:
          action === 'push_to_delivery' ? order.shipping_status ?? 'delivering' : order.shipping_status ?? '',
      })
    },
    [order],
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
          actor_name: 'Sales Admin',
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
  }, [navigate, order])

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

    appToast.success(`Đã mở packing slip cho đơn ${order.order_code}.`)
  }, [order])

  const handleCopyQrValue = useCallback(async () => {
    if (!qrValue) {
      return
    }

    try {
      await navigator.clipboard.writeText(qrValue)
      appToast.success('Đã copy nội dung QR.')
    } catch {
      appToast.error('Không thể copy nội dung QR trên trình duyệt này.')
    }
  }, [qrValue])

  if (isLoading) {
    return (
      <Box sx={{ px: { xs: 2, md: 3, xl: 4 }, py: 8 }}>
        <Typography>Đang tải chi tiết đơn hàng...</Typography>
      </Box>
    )
  }

  if (!order || !nextAction) {
    return (
      <Box sx={{ px: { xs: 2, md: 3, xl: 4 }, py: 8 }}>
        <Typography>Không tìm thấy đơn hàng.</Typography>
      </Box>
    )
  }

  const paymentMeta = getPaymentStatusMeta(order.payment_status)
  const processingMeta = getProcessingStatusMeta(order.processing_status)
  const progressIndex = stepperStages.findIndex((stage) => stage.matches.includes(order.processing_status))
  const orderTypeLabel = order.order_type === 'return' ? 'Đơn trả hàng' : 'Đơn bán hàng'
  const invoiceStatusLabel = order.invoice_code ? 'Đã tạo e-invoice' : 'Chưa xuất hóa đơn'
  const invoiceStatusColor = order.invoice_code ? 'success' : 'default'
  const sourceLabel = order.sales_channel ?? 'Admin'
  const customerGroup = order.customer_id ? 'Khách thành viên' : 'Khách lẻ'
  const canEditOrder = ['draft', 'placed'].includes(order.processing_status)
  const canCancelOrder =
    ['draft', 'placed', 'confirmed', 'picked_up'].includes(order.processing_status) && order.payment_status !== 'paid'
  const canReturnOrder = order.processing_status === 'completed'

  return (
    <Box sx={{ px: { xs: 2, md: 3, xl: 4 }, pb: 8 }}>
      <Paper
        sx={{
          ...borderedCardSx,
          position: 'sticky',
          top: { xs: 78, lg: 88 },
          zIndex: 20,
          mb: 2,
          background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(244,249,248,0.96) 100%)',
          backdropFilter: 'blur(16px)',
        }}
      >
        <Stack spacing={2}>
          <Stack
            direction={{ xs: 'column', lg: 'row' }}
            spacing={2}
            sx={{ justifyContent: 'space-between', alignItems: { lg: 'center' } }}
          >
            <Stack spacing={1}>
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
                <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a' }}>
                  {order.order_code}
                </Typography>
                <Chip label={processingMeta.label} color={processingMeta.color} />
                <Chip label={orderTypeLabel} variant="outlined" />
              </Stack>
              <Typography color="text.secondary">
                Tạo lúc {formatDateTime(order.order_date)} • Cập nhật cuối {formatDateTime(order.updated_at)}
              </Typography>
            </Stack>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
              <Button
                variant="outlined"
                startIcon={<EditOutlinedIcon />}
                component={RouterLink}
                to={`/orders/${order.id}/edit`}
                disabled={!canEditOrder}
              >
                Chỉnh sửa đơn hàng
              </Button>
              <Button variant="outlined" startIcon={<PrintOutlinedIcon />} onClick={handleExportPackingSlip}>
                Packing slip
              </Button>
              <Button
                variant="text"
                endIcon={<MoreHorizIcon />}
                onClick={(event) => setAnchorEl(event.currentTarget)}
              >
                Thao tác khác
              </Button>
            </Stack>
          </Stack>

          <Paper
            variant="outlined"
            sx={{
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
              <Typography color="text.secondary">{nextAction.helper}</Typography>
              {nextAction.action ? (
                <Button
                  variant="contained"
                  size="small"
                  onClick={() =>
                    nextAction.action === 'confirm_shipping' || nextAction.action === 'push_to_delivery'
                      ? openShippingActionDialog(nextAction.action)
                      : void runAction(nextAction.action)
                  }
                  disabled={isActing}
                >
                  {isActing ? 'Đang xử lý...' : nextAction.label}
                </Button>
              ) : null}
            </Stack>
          </Paper>
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
              title="Danh sách sản phẩm sẵn sàng để thực hiện"
              description="Tập trung vào sản phẩm, ghi chú theo dòng và hành động giao vận ngay trên cùng một card."
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
                {order.order_items.length} item • Kho status: {order.warehouse_status ?? 'Đang chờ xử lý'}
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
                <Button
                  variant="contained"
                  startIcon={<Inventory2OutlinedIcon />}
                  onClick={() => openShippingActionDialog('confirm_shipping')}
                  disabled={isActing || order.processing_status !== 'confirmed'}
                >
                  Xác nhận giao kho
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<LocalShippingOutlinedIcon />}
                  onClick={() => openShippingActionDialog('push_to_delivery')}
                  disabled={isActing || !['confirmed', 'picked_up'].includes(order.processing_status)}
                >
                  Đẩy sang vận chuyển
                </Button>
              </Stack>
            </Stack>
          </Paper>

          <Paper sx={borderedCardSx}>
            <CardHeader
              eyebrow="Thanh toán"
              title="Kiểm soát thanh toán"
              description="Nhân viên có thể scan nhanh trạng thái thanh toán, tổng tiền và thao tác tiếp theo."
            />

            <Stack spacing={2} sx={{ mt: 2 }}>
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
                <Chip label={paymentMeta.label} color={paymentMeta.color} />
                <Chip label={`Đã thanh toán ${formatCurrency(order.paid_amount)}`} variant="outlined" />
                <Chip label={`Nợ còn ${formatCurrency(order.outstanding_amount)}`} variant="outlined" />
              </Stack>

              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
                  gap: 1.5,
                }}
              >
                <MetricTile label="Tổng phụ" value={formatCurrency(order.sub_total)} />
                <MetricTile label="Phí vận chuyển" value={formatCurrency(order.shipping_fee)} />
                <MetricTile label="Thuế" value={formatCurrency(order.tax_amount)} />
                <MetricTile label="Tổng" value={formatCurrency(order.total_amount)} emphasis />
              </Box>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
                <Button variant="outlined" startIcon={<QrCode2OutlinedIcon />} onClick={() => setIsQrDialogOpen(true)}>
                  Tạo QR
                </Button>
                <Button
                  variant="contained"
                  color="secondary"
                  startIcon={<PaymentsOutlinedIcon />}
                  onClick={() => void runAction('mark_paid')}
                  disabled={isActing || order.payment_status === 'paid'}
                >
                  Đánh dấu đã thanh toán
                </Button>
              </Stack>
            </Stack>
          </Paper>

          <Paper sx={borderedCardSx}>
            <CardHeader
              eyebrow="Hóa đơn"
              title="Trạng thái hóa đơn"
              description="Tách riêng hóa đơn để đội vận hành biết khi nào cần request e-invoice cho khách."
            />

            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={1.5}
              sx={{ mt: 2, justifyContent: 'space-between', alignItems: { md: 'center' } }}
            >
              <Stack spacing={1}>
                <Chip label={invoiceStatusLabel} color={invoiceStatusColor} />
                <Typography color="text.secondary">
                  Mã hóa đơn: {order.invoice_code ?? 'Chưa có mã hóa đơn điện tử'}
                </Typography>
              </Stack>

              <Button
                variant="outlined"
                startIcon={<ReceiptLongOutlinedIcon />}
                onClick={() => {
                  setInvoiceCodeDraft(order.invoice_code ?? '')
                  setIsInvoiceDialogOpen(true)
                }}
                disabled={isActing}
              >
                Yêu cầu e-invoice
              </Button>
            </Stack>
          </Paper>

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
                  subtitle={`${entry.actor_name ?? 'System'} • ${entry.event_type}`}
                  timestamp={formatDateTime(entry.timestamp)}
                  isLast={index === order.order_history.length - 1}
                  extra={
                    entry.metadata ? (
                      <Typography variant="body2" color="text.secondary">
                        {JSON.stringify(entry.metadata)}
                      </Typography>
                    ) : null
                  }
                />
              ))}
            </Stack>
          </Paper>
        </Stack>

        <Stack spacing={2.5}>
          <SidebarCard icon={<StorefrontOutlinedIcon fontSize="small" />} title="Nguồn đơn hàng">
            <SidebarLine label="Kênh" value={sourceLabel} />
            <SidebarLine label="Dịch vụ" value={order.shipping_service ?? 'Chưa có đối tác giao hàng'} />
          </SidebarCard>

          <SidebarCard icon={<PersonOutlineOutlinedIcon fontSize="small" />} title="Khách hàng">
            <Stack spacing={1.25}>
              <OutlinedInput
                size="small"
                value={order.customer_info.name}
                fullWidth
                readOnly
                placeholder="Tìm kiếm + chọn khách hàng"
              />
              <Paper
                variant="outlined"
                sx={{
                  p: 1.5,
                  bgcolor: (theme) => alpha(theme.palette.background.default, 0.7),
                }}
              >
                <Typography sx={{ fontWeight: 700 }}>{order.customer_info.name}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {order.customer_info.customer_code ?? 'Khách lẻ'}
                </Typography>
                <Chip size="small" label={customerGroup} sx={{ mt: 1.25 }} />
              </Paper>
            </Stack>
          </SidebarCard>

          <SidebarCard title="Thông tin liên hệ">
            <SidebarLine label="Email" value={order.customer_info.email ?? '-'} />
            <SidebarLine label="Điện thoại" value={order.customer_info.phone} />
          </SidebarCard>

          <SidebarCard title="Địa chỉ giao hàng">
            <Typography sx={{ color: '#0f172a', lineHeight: 1.6 }}>
              {order.customer_info.address ?? 'Chưa có địa chỉ giao hàng'}
            </Typography>
            <Divider sx={{ my: 1.5 }} />
            <SidebarLine label="Tracking" value={order.tracking_code ?? '-'} />
            <SidebarLine label="Trạng thái giao hàng" value={order.shipping_status ?? 'Đang chờ'} />
          </SidebarCard>

          <SidebarCard title="Ghi chú">
            <Stack spacing={1.25}>
              <NoteBlock label="Ghi chú đơn hàng" value={order.order_notes ?? 'Chưa có ghi chú đơn hàng'} />
              <NoteBlock label="Ghi chú thanh toán" value={order.payment_notes ?? 'Chưa có ghi chú thanh toán'} />
            </Stack>
          </SidebarCard>

          <SidebarCard title="Metadata">
            <SidebarLine label="Cửa hàng / Chi nhánh" value="Main branch" />
            <SidebarLine label="Nhân viên được giao" value={order.confirmed_by ?? 'Chưa phân công'} />
            <SidebarLine label="Tạo bởi" value={order.created_by ?? 'System'} />
            <SidebarLine label="Ngày tạo" value={formatDateTime(order.created_at)} />
          </SidebarCard>
        </Stack>
      </Box>

      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
        <MenuItem onClick={handleDuplicateOrder}>Nhân bản đơn hàng</MenuItem>
        <MenuItem onClick={handleExportPackingSlip}>Xuất packing slip</MenuItem>
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
        <DialogTitle>{shippingDialog?.action === 'confirm_shipping' ? 'Xác nhận giao kho' : 'Đẩy sang vận chuyển'}</DialogTitle>
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
              placeholder={shippingDialog?.action === 'push_to_delivery' ? 'delivering' : 'ready_to_ship'}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShippingDialog(null)}>Đóng</Button>
          <Button variant="contained" onClick={() => void submitShippingAction()} disabled={isActing}>
            {shippingDialog?.action === 'confirm_shipping' ? 'Xác nhận giao kho' : 'Đẩy sang vận chuyển'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={isInvoiceDialogOpen} onClose={() => setIsInvoiceDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Yêu cầu e-invoice</DialogTitle>
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
        <DialogTitle>QR đơn hàng</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1, alignItems: 'center' }}>
            {qrImageUrl ? (
              <Box
                component="img"
                src={qrImageUrl}
                alt={`QR ${order.order_code}`}
                sx={{ width: 240, height: 240, borderRadius: 2, border: '1px solid #e2e8f0', bgcolor: '#fff' }}
              />
            ) : null}
            <TextField value={qrValue} multiline minRows={5} fullWidth slotProps={{ input: { readOnly: true } }} />
            <Typography variant="body2" color="text.secondary">
              QR này mã hóa thông tin đơn cơ bản để đội vận hành hoặc thu ngân scan nhanh.
            </Typography>
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
        eyebrow="Tiến độ đơn hàng"
        title="Stepper thực hiện"
        description="Nhân viên scan ngang để biết đơn đang ở đâu và timestamp của mỗi mốc."
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
    <Stack spacing={0.65}>
      <Typography variant="caption" sx={{ fontWeight: 800, letterSpacing: '0.08em', color: '#0f766e' }}>
        {eyebrow.toUpperCase()}
      </Typography>
      <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a' }}>
        {title}
      </Typography>
      <Typography color="text.secondary">{description}</Typography>
    </Stack>
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
        bgcolor: emphasis ? 'rgba(15, 118, 110, 0.08)' : '#fff',
        borderColor: emphasis ? 'rgba(15, 118, 110, 0.24)' : undefined,
      }}
    >
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography sx={{ mt: 0.75, fontWeight: 800, color: '#0f172a' }}>{value}</Typography>
    </Paper>
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
  children,
}: {
  title: string
  icon?: ReactNode
  children: ReactNode
}): ReactElement {
  return (
    <Paper sx={borderedCardSx}>
      <Stack spacing={1.5}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          {icon ? (
            <Box
              sx={{
                width: 30,
                height: 30,
                borderRadius: 2,
                display: 'grid',
                placeItems: 'center',
                bgcolor: 'rgba(15, 118, 110, 0.1)',
                color: 'primary.main',
              }}
            >
              {icon}
            </Box>
          ) : null}
          <Typography sx={{ fontWeight: 800, color: '#0f172a' }}>{title}</Typography>
        </Stack>
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
