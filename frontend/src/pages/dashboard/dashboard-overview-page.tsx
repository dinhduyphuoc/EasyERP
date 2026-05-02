import { useEffect, useMemo, useState, type ReactElement } from 'react'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined'
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined'
import PaidOutlinedIcon from '@mui/icons-material/PaidOutlined'
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined'
import RemoveOutlinedIcon from '@mui/icons-material/RemoveOutlined'
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined'
import TrendingDownRoundedIcon from '@mui/icons-material/TrendingDownRounded'
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded'
import { Box, MenuItem, Paper, Skeleton, Stack, TextField, Typography, alpha } from '@mui/material'
import type { SvgIconComponent } from '@mui/icons-material'
import { orderApi, type OrderOverviewPeriod, type OrderOverviewResponse } from '@/pages/orders/api'
import { appToast } from '@/shared/ui/toast/toast.helpers'
import { formatCurrency as sharedFormatCurrency } from '@/shared/utils/currency'

type DashboardOverviewCardProps = {
  label: string
  value: string | number
  helperText?: string | null
  deltaText?: string | null
  deltaTone?: 'neutral' | 'positive' | 'negative'
  icon: SvgIconComponent
  accent: {
    color: string
    bg: string
    cardBg: string
  }
}

type DeltaDisplay = {
  text: string
  tone: 'neutral' | 'positive' | 'negative'
}

const periodOptions: Array<{ value: OrderOverviewPeriod; label: string }> = [
  { value: 'this_week', label: 'Tuần này' },
  { value: 'today', label: 'Hôm nay' },
  { value: 'this_month', label: 'Tháng này' },
  { value: 'all_time', label: 'Tất cả thời gian' },
]

const formatCurrency = (value: string | number) => sharedFormatCurrency(value)

const formatDate = (date: Date) =>
  date.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })

const getComparisonLabel = (period: OrderOverviewPeriod) => {
  const now = new Date()

  if (period === 'all_time') {
    return 'Không áp dụng so sánh kỳ trước cho toàn bộ dữ liệu'
  }

  if (period === 'today') {
    const previousDay = new Date(now)
    previousDay.setDate(previousDay.getDate() - 1)
    return `So với hôm qua (${formatDate(previousDay)} - ${formatDate(previousDay)})`
  }

  if (period === 'this_month') {
    const currentStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const previousEnd = new Date(currentStart)
    previousEnd.setDate(0)
    const previousStart = new Date(previousEnd.getFullYear(), previousEnd.getMonth(), 1)
    return `So với kỳ trước (${formatDate(previousStart)} - ${formatDate(previousEnd)})`
  }

  const currentStart = new Date(now)
  const day = currentStart.getDay()
  const diffToMonday = day === 0 ? -6 : 1 - day
  currentStart.setDate(currentStart.getDate() + diffToMonday)
  currentStart.setHours(0, 0, 0, 0)

  const previousEnd = new Date(currentStart)
  previousEnd.setDate(previousEnd.getDate() - 1)

  const previousStart = new Date(previousEnd)
  previousStart.setDate(previousStart.getDate() - 6)

  return `So với kỳ trước (${formatDate(previousStart)} - ${formatDate(previousEnd)})`
}

const getDeltaDisplay = (
  current: number,
  previous: number,
  kind: 'number' | 'currency',
): DeltaDisplay => {
  const delta = current - previous

  if (delta === 0) {
    return {
      text: kind === 'currency' ? formatCurrency(0) : '0',
      tone: 'neutral',
    }
  }

  const tone: DeltaDisplay['tone'] = delta > 0 ? 'positive' : 'negative'
  const absoluteDelta = Math.abs(delta)

  return {
    text:
      kind === 'currency'
        ? formatCurrency(absoluteDelta)
        : absoluteDelta.toLocaleString('vi-VN'),
    tone,
  }
}

function DashboardOverviewCard({
  label,
  value,
  helperText = null,
  deltaText = null,
  deltaTone = 'neutral',
  icon: Icon,
  accent,
}: DashboardOverviewCardProps) {
  const deltaColor =
    deltaTone === 'positive'
      ? '#0f766e'
      : deltaTone === 'negative'
        ? '#b42318'
        : '#98a2b3'
  const DeltaIcon =
    deltaTone === 'positive'
      ? TrendingUpRoundedIcon
      : deltaTone === 'negative'
        ? TrendingDownRoundedIcon
        : RemoveOutlinedIcon

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2.5,
        borderRadius: 3,
        border: '1px solid rgba(16, 24, 40, 0.08)',
        bgcolor: accent.cardBg,
        minHeight: 168,
        display: 'flex',
      }}
    >
      <Stack spacing={1.5} sx={{ width: '100%' }}>
        <Stack direction="row" sx={{ alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: 2,
              bgcolor: accent.bg,
              color: accent.color,
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
            }}
          >
            <Icon sx={{ fontSize: 18 }} />
          </Box>

          <Typography
            sx={{
              color: '#667085',
              fontSize: 12,
              lineHeight: 1.3,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            {label}
          </Typography>
        </Stack>

        <Stack direction="row" spacing={1} sx={{ alignItems: 'baseline', flexWrap: 'wrap' }}>
          <Typography
            sx={{
              color: '#1570ef',
              fontSize: 36,
              lineHeight: 1,
              fontWeight: 800,
            }}
          >
            {value}
          </Typography>
          <Typography sx={{ color: '#667085', fontSize: 13, fontWeight: 500 }}>
            {helperText ?? '—'}
          </Typography>
        </Stack>

        <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', mt: 'auto', flexWrap: 'wrap' }}>
          <DeltaIcon sx={{ color: deltaColor, fontSize: 16 }} />
          <Typography sx={{ color: deltaColor, fontSize: 12, fontWeight: 700 }}>{deltaText ?? '0'}</Typography>
          <Typography sx={{ color: '#667085', fontSize: 12, fontWeight: 500 }}>
            So với kỳ trước
          </Typography>
        </Stack>
      </Stack>
    </Paper>
  )
}

function DashboardOverviewCardSkeleton() {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2.5,
        borderRadius: 3,
        border: '1px solid rgba(16, 24, 40, 0.08)',
        bgcolor: '#f8fafc',
        minHeight: 168,
      }}
    >
      <Stack spacing={1.5}>
        <Stack direction="row" sx={{ alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <Skeleton variant="rounded" width={36} height={36} />
          <Skeleton variant="text" width="36%" height={18} />
        </Stack>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'baseline' }}>
          <Skeleton variant="text" width="40%" height={42} />
          <Skeleton variant="text" width="24%" height={18} />
        </Stack>
        <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
          <Skeleton variant="circular" width={16} height={16} />
          <Skeleton variant="text" width="20%" height={16} />
          <Skeleton variant="text" width="34%" height={16} />
        </Stack>
      </Stack>
    </Paper>
  )
}

export function DashboardOverviewPage(): ReactElement {
  const [source, setSource] = useState('all')
  const [period, setPeriod] = useState<OrderOverviewPeriod>('this_week')
  const [overview, setOverview] = useState<OrderOverviewResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isCancelled = false

    const fetchOverview = async () => {
      try {
        setIsLoading(true)
        const response = await orderApi.getOrderOverview({
          source,
          period,
        })

        if (!isCancelled) {
          setOverview(response)
        }
      } catch (error) {
        if (!isCancelled) {
          console.error('Lỗi khi tải tổng quan đơn hàng:', error)
          appToast.error('Không thể tải số liệu tổng quan.')
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false)
        }
      }
    }

    void fetchOverview()

    return () => {
      isCancelled = true
    }
  }, [period, source])

  const summary = overview?.summary ?? null
  const previousSummary = overview?.previous_summary ?? null
  const sourceOptions = useMemo(() => ['all', ...(overview?.source_options ?? [])], [overview?.source_options])
  const comparisonLabel = useMemo(() => getComparisonLabel(period), [period])

  const deltas = useMemo(() => {
    if (!summary || !previousSummary) {
      return null
    }

    return {
      netRevenue: getDeltaDisplay(Number(summary.net_revenue), Number(previousSummary.net_revenue), 'currency'),
      totalOrders: getDeltaDisplay(summary.total_orders, previousSummary.total_orders, 'number'),
      unpaidOrders: getDeltaDisplay(summary.unpaid_orders, previousSummary.unpaid_orders, 'number'),
      averageOrderValue: getDeltaDisplay(
        Number(summary.average_order_value),
        Number(previousSummary.average_order_value),
        'currency',
      ),
      soldQuantity: getDeltaDisplay(summary.sold_quantity, previousSummary.sold_quantity, 'number'),
      pendingShippingOrders: getDeltaDisplay(
        summary.pending_shipping_orders,
        previousSummary.pending_shipping_orders,
        'number',
      ),
      deliveringOrders: getDeltaDisplay(summary.delivering_orders, previousSummary.delivering_orders, 'number'),
      cancelledOrders: getDeltaDisplay(summary.cancelled_orders, previousSummary.cancelled_orders, 'number'),
    }
  }, [previousSummary, summary])

  const overviewCards = summary
    ? [
        {
          key: 'net_revenue',
          label: 'Doanh thu thuần',
          value: formatCurrency(summary.net_revenue),
          helperText: `(${summary.total_orders.toLocaleString('vi-VN')} đơn)`,
          deltaText: deltas?.netRevenue.text ?? '0đ',
          deltaTone: deltas?.netRevenue.tone ?? 'neutral',
          icon: PaidOutlinedIcon,
          accent: {
            color: '#0e7490',
            bg: alpha('#06b6d4', 0.12),
            cardBg: '#f5fbff',
          },
        },
        {
          key: 'total_orders',
          label: 'Tổng đơn',
          value: summary.total_orders.toLocaleString('vi-VN'),
          helperText: '(đơn bán)',
          deltaText: deltas?.totalOrders.text ?? '0',
          deltaTone: deltas?.totalOrders.tone ?? 'neutral',
          icon: DescriptionOutlinedIcon,
          accent: {
            color: '#2563eb',
            bg: alpha('#3b82f6', 0.12),
            cardBg: '#f8fbff',
          },
        },
        {
          key: 'unpaid_orders',
          label: 'Chưa thanh toán',
          value: summary.unpaid_orders.toLocaleString('vi-VN'),
          helperText: '(cần theo dõi)',
          deltaText: deltas?.unpaidOrders.text ?? '0',
          deltaTone: deltas?.unpaidOrders.tone ?? 'neutral',
          icon: ReportProblemOutlinedIcon,
          accent: {
            color: '#b54708',
            bg: alpha('#f59e0b', 0.14),
            cardBg: '#fffaf3',
          },
        },
        {
          key: 'average_order_value',
          label: 'Giá trị trung bình đơn',
          value: formatCurrency(summary.average_order_value),
          helperText: '(doanh thu / đơn)',
          deltaText: deltas?.averageOrderValue.text ?? '0đ',
          deltaTone: deltas?.averageOrderValue.tone ?? 'neutral',
          icon: ReceiptLongOutlinedIcon,
          accent: {
            color: '#7c3aed',
            bg: alpha('#8b5cf6', 0.12),
            cardBg: '#faf7ff',
          },
        },
        {
          key: 'sold_quantity',
          label: 'SL hàng thực bán',
          value: summary.sold_quantity.toLocaleString('vi-VN'),
          helperText: '(sản phẩm)',
          deltaText: deltas?.soldQuantity.text ?? '0',
          deltaTone: deltas?.soldQuantity.tone ?? 'neutral',
          icon: Inventory2OutlinedIcon,
          accent: {
            color: '#15803d',
            bg: alpha('#22c55e', 0.12),
            cardBg: '#f5fcf7',
          },
        },
        {
          key: 'pending_shipping_orders',
          label: 'Chưa giao',
          value: summary.pending_shipping_orders.toLocaleString('vi-VN'),
          helperText: '(chờ đẩy giao)',
          deltaText: deltas?.pendingShippingOrders.text ?? '0',
          deltaTone: deltas?.pendingShippingOrders.tone ?? 'neutral',
          icon: LocalShippingOutlinedIcon,
          accent: {
            color: '#c2410c',
            bg: alpha('#f97316', 0.12),
            cardBg: '#fff8f3',
          },
        },
        {
          key: 'delivering_orders',
          label: 'Đang giao',
          value: summary.delivering_orders.toLocaleString('vi-VN'),
          helperText: '(đơn vận chuyển)',
          deltaText: deltas?.deliveringOrders.text ?? '0',
          deltaTone: deltas?.deliveringOrders.tone ?? 'neutral',
          icon: LocalShippingOutlinedIcon,
          accent: {
            color: '#1d4ed8',
            bg: alpha('#60a5fa', 0.14),
            cardBg: '#f5f9ff',
          },
        },
        {
          key: 'cancelled_orders',
          label: 'Hủy',
          value: summary.cancelled_orders.toLocaleString('vi-VN'),
          helperText: '(đơn đã hủy)',
          deltaText: deltas?.cancelledOrders.text ?? '0',
          deltaTone: deltas?.cancelledOrders.tone ?? 'neutral',
          icon: DescriptionOutlinedIcon,
          accent: {
            color: '#b42318',
            bg: alpha('#ef4444', 0.12),
            cardBg: '#fff6f6',
          },
        },
      ]
    : []

  return (
    <Box sx={{ px: { xs: 2, md: 3, xl: 4 }, pb: 8 }}>
      <Stack spacing={2.5}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ alignItems: { md: 'center' } }}>
          <TextField
            select
            size="small"
            value={source}
            onChange={(event) => setSource(event.target.value)}
            sx={{ minWidth: 180 }}
          >
            {sourceOptions.map((option) => (
              <MenuItem key={option} value={option}>
                {option === 'all' ? 'Tất cả' : option}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            size="small"
            value={period}
            onChange={(event) => setPeriod(event.target.value as OrderOverviewPeriod)}
            sx={{ minWidth: 160 }}
          >
            {periodOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>

          <Typography variant="body2" sx={{ color: '#667085' }}>
            {comparisonLabel}
          </Typography>
        </Stack>

        <Stack spacing={2}>
          <Typography sx={{ color: '#101828', fontWeight: 700 }}>Kết quả kinh doanh</Typography>

          <Box
            sx={{
              display: 'grid',
              gap: 1.5,
              gridTemplateColumns: {
                xs: '1fr',
                md: 'repeat(2, minmax(0, 1fr))',
                xl: 'repeat(4, minmax(0, 1fr))',
              },
            }}
          >
            {isLoading || !summary
              ? Array.from({ length: 8 }).map((_, index) => <DashboardOverviewCardSkeleton key={index} />)
              : overviewCards.map((card) => (
                  <DashboardOverviewCard
                    key={card.key}
                    label={card.label}
                    value={card.value}
                    helperText={card.helperText}
                    deltaText={card.deltaText}
                    deltaTone={card.deltaTone}
                    icon={card.icon}
                    accent={card.accent}
                  />
                ))}
          </Box>
        </Stack>
      </Stack>
    </Box>
  )
}

export default DashboardOverviewPage
