import { useEffect, useMemo, useState, type ReactElement, type ReactNode } from 'react'
import { Link as RouterLink, useParams } from 'react-router'
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
  Menu,
  MenuItem,
  OutlinedInput,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import { appToast } from '@/shared/ui/toast/toast'
import { orderApi, type OrderListItem, type OrderProcessingStatus } from './order.api'
import {
  formatCurrency,
  formatDateTime,
  getPaymentStatusMeta,
  getProcessingStatusMeta,
} from './order.shared'

const cardSx = {
  p: { xs: 2, md: 2.5 },
  borderRadius: 4,
  border: (theme: { palette: { divider: string } }) => `1px solid ${theme.palette.divider}`,
  boxShadow: '0 18px 45px rgba(15, 23, 42, 0.06)',
  backgroundImage: 'none',
}

const stepperStages: Array<{
  key: string
  label: string
  matches: OrderProcessingStatus[]
}> = [
  { key: 'placed', label: 'Order placed', matches: ['placed'] },
  { key: 'confirmed', label: 'Confirmed', matches: ['confirmed'] },
  { key: 'picking', label: 'Picking', matches: ['picked_up'] },
  { key: 'shipping', label: 'Shipping', matches: ['delivering'] },
  { key: 'completed', label: 'Completed', matches: ['completed'] },
]

export function OrdersDetailPage(): ReactElement {
  const params = useParams()
  const [order, setOrder] = useState<OrderListItem | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)

  useEffect(() => {
    const fetchOrder = async () => {
      if (!params.id) {
        return
      }

      setIsLoading(true)

      try {
        const data = await orderApi.getOrderById(params.id)
        setOrder(data)
      } catch (error) {
        console.error('Loi khi tai chi tiet don hang:', error)
        appToast.error('Khong the tai chi tiet don hang.')
      } finally {
        setIsLoading(false)
      }
    }

    void fetchOrder()
  }, [params.id])

  const nextAction = useMemo(() => {
    if (!order) {
      return null
    }

    if (order.processing_status === 'placed') {
      return {
        label: 'Confirm order',
        helper: 'Kiem tra thong tin va chuyen don sang xac nhan de kho bat dau xu ly.',
        icon: <CheckCircleOutlinedIcon fontSize="small" />,
      }
    }

    if (order.processing_status === 'confirmed') {
      return {
        label: 'Confirm shipping',
        helper: 'Don da san sang cho kho dong goi va tao lenh giao.',
        icon: <Inventory2OutlinedIcon fontSize="small" />,
      }
    }

    if (order.processing_status === 'picked_up') {
      return {
        label: 'Push to delivery',
        helper: 'Day don sang don vi van chuyen va cap nhat tracking ngay.',
        icon: <LocalShippingOutlinedIcon fontSize="small" />,
      }
    }

    if (order.processing_status === 'delivering') {
      return {
        label: 'Mark as completed',
        helper: 'Don dang giao. Theo doi giao hang va xac nhan hoan tat khi thanh cong.',
        icon: <CheckCircleOutlinedIcon fontSize="small" />,
      }
    }

    return {
      label: 'View audit trail',
      helper: 'Don da hoan tat. Kiem tra lai lich su xu ly, thanh toan va hoa don khi can.',
      icon: <ReceiptLongOutlinedIcon fontSize="small" />,
    }
  }, [order])

  if (isLoading) {
    return (
      <Box sx={{ px: { xs: 2, md: 3, xl: 4 }, py: 8 }}>
        <Typography>Dang tai chi tiet don hang...</Typography>
      </Box>
    )
  }

  if (!order || !nextAction) {
    return (
      <Box sx={{ px: { xs: 2, md: 3, xl: 4 }, py: 8 }}>
        <Typography>Khong tim thay don hang.</Typography>
      </Box>
    )
  }

  const paymentMeta = getPaymentStatusMeta(order.payment_status)
  const processingMeta = getProcessingStatusMeta(order.processing_status)
  const progressIndex = stepperStages.findIndex((stage) => stage.matches.includes(order.processing_status))
  const orderTypeLabel = order.order_type === 'return' ? 'Don tra hang' : 'Don ban hang'
  const invoiceStatusLabel = order.invoice_code ? 'Da tao e-invoice' : 'Chua xuat hoa don'
  const invoiceStatusColor = order.invoice_code ? 'success' : 'default'
  const sourceLabel = order.sales_channel ?? 'Admin'
  const customerGroup = order.customer_id ? 'Khach thanh vien' : 'Khach le'

  return (
    <Box sx={{ px: { xs: 2, md: 3, xl: 4 }, pb: 8 }}>
      <Paper
        sx={{
          ...cardSx,
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
                Tao luc {formatDateTime(order.order_date)} • Last update {formatDateTime(order.updated_at)}
              </Typography>
            </Stack>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
              <Button variant="outlined" startIcon={<EditOutlinedIcon />} component={RouterLink} to="/orders/create">
                Edit order
              </Button>
              <Button variant="outlined" startIcon={<PrintOutlinedIcon />} onClick={() => window.print()}>
                Print
              </Button>
              <Button
                variant="text"
                endIcon={<MoreHorizIcon />}
                onClick={(event) => setAnchorEl(event.currentTarget)}
              >
                More actions
              </Button>
            </Stack>
          </Stack>

          <Paper
            variant="outlined"
            sx={{
              p: 1.5,
              borderRadius: 3,
              bgcolor: (theme) => alpha(theme.palette.primary.light, 0.08),
              borderColor: (theme) => alpha(theme.palette.primary.main, 0.18),
            }}
          >
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ alignItems: { md: 'center' } }}>
              <Chip
                color="secondary"
                icon={nextAction.icon}
                label={`Next Action: ${nextAction.label}`}
                sx={{ fontWeight: 700, alignSelf: 'flex-start' }}
              />
              <Typography color="text.secondary">{nextAction.helper}</Typography>
            </Stack>
          </Paper>
        </Stack>
      </Paper>

      <OrderProgressCard order={order} currentIndex={progressIndex} />

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
          <Paper sx={cardSx}>
            <CardHeader
              eyebrow="Order Items"
              title="Item list ready for fulfillment"
              description="Tap trung vao san pham, ghi chu theo dong va hanh dong giao van ngay tren cung mot card."
            />

            <Box sx={{ overflowX: 'auto', mt: 2 }}>
              <Table sx={{ minWidth: 640 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Product</TableCell>
                    <TableCell align="right">Qty</TableCell>
                    <TableCell align="right">Price</TableCell>
                    <TableCell align="right">Total</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {order.order_items.map((item) => (
                    <TableRow key={item.id} hover>
                      <TableCell sx={{ py: 1.75 }}>
                        <Stack spacing={0.6}>
                          <Typography sx={{ fontWeight: 700, color: '#0f172a' }}>{item.product_name}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            Variant: {item.variant_sku ?? item.sku}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Inline note: {item.notes ?? 'Khong co ghi chu cho item nay'}
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
                {order.order_items.length} item • Kho status: {order.warehouse_status ?? 'Dang cho xu ly'}
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
                <Button variant="contained" startIcon={<Inventory2OutlinedIcon />}>
                  Confirm shipping
                </Button>
                <Button variant="outlined" startIcon={<LocalShippingOutlinedIcon />}>
                  Push to delivery
                </Button>
              </Stack>
            </Stack>
          </Paper>

          <Paper sx={cardSx}>
            <CardHeader
              eyebrow="Payment"
              title="Payment control"
              description="Nhan vien co the scan nhanh trang thai thanh toan, tong tien va thao tac tiep theo."
            />

            <Stack spacing={2} sx={{ mt: 2 }}>
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
                <Chip label={paymentMeta.label} color={paymentMeta.color} />
                <Chip label={`Paid ${formatCurrency(order.paid_amount)}`} variant="outlined" />
                <Chip label={`Outstanding ${formatCurrency(order.outstanding_amount)}`} variant="outlined" />
              </Stack>

              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
                  gap: 1.5,
                }}
              >
                <MetricTile label="Subtotal" value={formatCurrency(order.sub_total)} />
                <MetricTile label="Shipping fee" value={formatCurrency(order.shipping_fee)} />
                <MetricTile label="Tax" value={formatCurrency(order.tax_amount)} />
                <MetricTile label="Total" value={formatCurrency(order.total_amount)} emphasis />
              </Box>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
                <Button variant="outlined" startIcon={<QrCode2OutlinedIcon />}>
                  Generate QR
                </Button>
                <Button variant="contained" color="secondary" startIcon={<PaymentsOutlinedIcon />}>
                  Mark as paid
                </Button>
              </Stack>
            </Stack>
          </Paper>

          <Paper sx={cardSx}>
            <CardHeader
              eyebrow="Invoice"
              title="Invoice status"
              description="Tach rieng hoa don de doi van hanh biet khi nao can request e-invoice cho khach."
            />

            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={1.5}
              sx={{ mt: 2, justifyContent: 'space-between', alignItems: { md: 'center' } }}
            >
              <Stack spacing={1}>
                <Chip label={invoiceStatusLabel} color={invoiceStatusColor} />
                <Typography color="text.secondary">
                  Invoice code: {order.invoice_code ?? 'Chua co ma hoa don dien tu'}
                </Typography>
              </Stack>

              <Button variant="outlined" startIcon={<ReceiptLongOutlinedIcon />}>
                Request e-invoice
              </Button>
            </Stack>
          </Paper>

          <Paper sx={cardSx}>
            <CardHeader
              eyebrow="Order Activity"
              title="History log"
              description="Timeline hien thi action, user va moc thoi gian de doi operations doi chieu nhanh."
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
          <SidebarCard icon={<StorefrontOutlinedIcon fontSize="small" />} title="Order Source">
            <SidebarLine label="Channel" value={sourceLabel} />
            <SidebarLine label="Service" value={order.shipping_service ?? 'No delivery partner yet'} />
          </SidebarCard>

          <SidebarCard icon={<PersonOutlineOutlinedIcon fontSize="small" />} title="Customer">
            <Stack spacing={1.25}>
              <OutlinedInput
                size="small"
                value={order.customer_info.name}
                fullWidth
                readOnly
                placeholder="Search + select customer"
              />
              <Paper
                variant="outlined"
                sx={{
                  p: 1.5,
                  borderRadius: 3,
                  bgcolor: (theme) => alpha(theme.palette.background.default, 0.7),
                }}
              >
                <Typography sx={{ fontWeight: 700 }}>{order.customer_info.name}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {order.customer_info.customer_code ?? 'Khach le'}
                </Typography>
                <Chip size="small" label={customerGroup} sx={{ mt: 1.25 }} />
              </Paper>
            </Stack>
          </SidebarCard>

          <SidebarCard title="Contact Info">
            <SidebarLine label="Email" value={order.customer_info.email ?? '-'} />
            <SidebarLine label="Phone" value={order.customer_info.phone} />
          </SidebarCard>

          <SidebarCard title="Shipping Address">
            <Typography sx={{ color: '#0f172a', lineHeight: 1.6 }}>
              {order.customer_info.address ?? 'Chua co dia chi giao hang'}
            </Typography>
            <Divider sx={{ my: 1.5 }} />
            <SidebarLine label="Tracking" value={order.tracking_code ?? '-'} />
            <SidebarLine label="Shipping status" value={order.shipping_status ?? 'Pending'} />
          </SidebarCard>

          <SidebarCard title="Notes">
            <Stack spacing={1.25}>
              <NoteBlock label="Order note" value={order.order_notes ?? 'Chua co ghi chu don hang'} />
              <NoteBlock label="Payment note" value={order.payment_notes ?? 'Chua co ghi chu thanh toan'} />
            </Stack>
          </SidebarCard>

          <SidebarCard title="Metadata">
            <SidebarLine label="Store / Branch" value="Main branch" />
            <SidebarLine label="Staff assigned" value={order.confirmed_by ?? 'Chua phan cong'} />
            <SidebarLine label="Created by" value={order.created_by ?? 'System'} />
            <SidebarLine label="Created date" value={formatDateTime(order.created_at)} />
          </SidebarCard>
        </Stack>
      </Box>

      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
        <MenuItem onClick={() => setAnchorEl(null)}>Duplicate order</MenuItem>
        <MenuItem onClick={() => setAnchorEl(null)}>Export packing slip</MenuItem>
        <MenuItem onClick={() => setAnchorEl(null)}>Cancel order</MenuItem>
      </Menu>
    </Box>
  )
}

function OrderProgressCard({
  order,
  currentIndex,
}: {
  order: OrderListItem
  currentIndex: number
}): ReactElement {
  const timeline = (order.status_timeline ?? {}) as Record<string, unknown>

  const getTimestampForStage = (stageKey: string): string => {
    const stageData = timeline[stageKey]

    if (!stageData) {
      return 'Pending'
    }

    if (typeof stageData === 'string') {
      return formatDateTime(stageData)
    }

    if (typeof stageData === 'object') {
      const stageRecord = stageData as Record<string, unknown>
      const candidate = ['timestamp', 'updated_at', 'created_at', 'at'].find(
        (key) => typeof stageRecord[key] === 'string',
      )

      if (candidate) {
        return formatDateTime(stageRecord[candidate] as string)
      }
    }

    return 'Pending'
  }

  return (
    <Paper sx={cardSx}>
      <CardHeader
        eyebrow="Order Progress"
        title="Fulfillment stepper"
        description="Nhan vien scan ngang de biet don dang o dau va timestamp cua moi moc."
      />

      <Box
        sx={{
          mt: 2.5,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: `repeat(${stepperStages.length}, minmax(0, 1fr))` },
          gap: 1.5,
        }}
      >
        {stepperStages.map((stage, index) => {
          const isComplete = currentIndex >= index && currentIndex !== -1
          const isCurrent = currentIndex === index

          return (
            <Box key={stage.key} sx={{ position: 'relative' }}>
              <Paper
                variant="outlined"
                sx={{
                  p: 1.75,
                  minHeight: 122,
                  borderRadius: 3,
                  borderColor: (theme) =>
                    isCurrent ? theme.palette.primary.main : alpha(theme.palette.divider, 0.9),
                  bgcolor: (theme) =>
                    isCurrent
                      ? alpha(theme.palette.primary.light, 0.1)
                      : isComplete
                        ? alpha(theme.palette.success.light, 0.12)
                        : '#fff',
                }}
              >
                <Stack spacing={1.1}>
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                    <Box
                      sx={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        display: 'grid',
                        placeItems: 'center',
                        fontWeight: 800,
                        bgcolor: isCurrent ? 'primary.main' : isComplete ? 'success.main' : '#dbe4ea',
                        color: isCurrent || isComplete ? '#fff' : '#516071',
                      }}
                    >
                      {index + 1}
                    </Box>
                    <Typography sx={{ fontWeight: 700, color: '#0f172a' }}>{stage.label}</Typography>
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    {getTimestampForStage(stage.key)}
                  </Typography>
                  <Chip
                    size="small"
                    label={isCurrent ? 'Current step' : isComplete ? 'Done' : 'Waiting'}
                    color={isCurrent ? 'primary' : isComplete ? 'success' : 'default'}
                    sx={{ alignSelf: 'flex-start' }}
                  />
                </Stack>
              </Paper>
            </Box>
          )
        })}
      </Box>
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
        borderRadius: 3,
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
    <Paper sx={cardSx}>
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
        borderRadius: 3,
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
