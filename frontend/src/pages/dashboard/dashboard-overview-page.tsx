import { useEffect, useMemo, useState, type ReactElement } from 'react'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined'
import MonetizationOnOutlinedIcon from '@mui/icons-material/MonetizationOnOutlined'
import PercentOutlinedIcon from '@mui/icons-material/PercentOutlined'
import SavingsOutlinedIcon from '@mui/icons-material/SavingsOutlined'
import RemoveOutlinedIcon from '@mui/icons-material/RemoveOutlined'
import TrendingDownRoundedIcon from '@mui/icons-material/TrendingDownRounded'
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded'
import { Box, MenuItem, Paper, Skeleton, Stack, TextField, Typography } from '@mui/material'
import type { SvgIconComponent } from '@mui/icons-material'
import { orderApi, type OrderOverviewPeriod, type OrderOverviewResponse } from '@/pages/orders/api'
import { PageContentContainer } from '@/shared/ui/page'
import { showErrorToast } from '@/shared/ui/toast/toast-error'
import { formatCurrency as sharedFormatCurrency } from '@/shared/utils/currency'

type DeltaDisplay = {
  text: string
  tone: 'neutral' | 'positive' | 'negative'
}

type MetricTone = {
  color: string
  bg: string
  border: string
}

type DashboardOverviewCardProps = {
  label: string
  value: string
  deltaText?: string | null
  deltaTone?: DeltaDisplay['tone']
  comparisonText: string
  metricTone: MetricTone
  icon: SvgIconComponent
}

const periodOptions: Array<{ value: OrderOverviewPeriod; label: string }> = [
  { value: 'today', label: 'Ngày' },
  { value: 'this_month', label: 'Tháng' },
  { value: 'this_quarter', label: 'Quý' },
  { value: 'last_6_months', label: '6 tháng' },
  { value: 'this_year', label: 'Năm' },
]

const formatCurrency = (value: string | number) => sharedFormatCurrency(value)
const formatNumber = (value: number) => value.toLocaleString('vi-VN')
const formatPercent = (value: number) => `${value.toLocaleString('vi-VN', { maximumFractionDigits: 2 })}%`

const getMetricTone = (value: number): MetricTone => {
  if (value > 0) {
    return {
      color: '#15803d',
      bg: '#f0fdf4',
      border: '#bbf7d0',
    }
  }

  if (value < 0) {
    return {
      color: '#b42318',
      bg: '#fef2f2',
      border: '#fecaca',
    }
  }

  return {
    color: '#000000',
    bg: '#f8fafc',
    border: '#e5e7eb',
  }
}

const getComparisonLabel = (period: OrderOverviewPeriod) => {
  if (period === 'today') return 'so với ngày trước'
  if (period === 'this_month') return 'so với tháng trước'
  if (period === 'this_quarter') return 'so với quý trước'
  if (period === 'last_6_months') return 'so với 6 tháng trước'
  return 'so với năm trước'
}

const getDeltaDisplay = (current: number, previous: number, type: 'number' | 'currency' | 'percent'): DeltaDisplay => {
  const delta = current - previous

  if (delta === 0) {
    return {
      text: type === 'currency' ? formatCurrency(0) : type === 'percent' ? formatPercent(0) : '0',
      tone: 'neutral',
    }
  }

  const absoluteDelta = Math.abs(delta)

  return {
    text:
      type === 'currency'
        ? formatCurrency(absoluteDelta)
        : type === 'percent'
          ? formatPercent(absoluteDelta)
          : formatNumber(absoluteDelta),
    tone: delta > 0 ? 'positive' : 'negative',
  }
}

function DashboardOverviewCard({
  label,
  value,
  deltaText = null,
  deltaTone = 'neutral',
  comparisonText,
  metricTone,
  icon: Icon,
}: DashboardOverviewCardProps) {
  const DeltaIcon =
    deltaTone === 'positive' ? TrendingUpRoundedIcon : deltaTone === 'negative' ? TrendingDownRoundedIcon : RemoveOutlinedIcon

  const deltaColor =
    deltaTone === 'positive' ? '#15803d' : deltaTone === 'negative' ? '#b42318' : '#ca8a04'

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2.5,
        borderRadius: 3,
        border: `1px solid ${metricTone.border}`,
        bgcolor: '#ffffff',
        minHeight: 164,
        display: 'flex',
      }}
    >
      <Stack spacing={1.5} sx={{ width: '100%' }}>
        <Stack direction="row" sx={{ alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 2.5,
              bgcolor: metricTone.bg,
              color: metricTone.color,
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
            }}
          >
            <Icon sx={{ fontSize: 20 }} />
          </Box>

          <Typography
            sx={{
              color: '#667085',
              fontSize: 12,
              lineHeight: 1.3,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              textAlign: 'right',
            }}
          >
            {label}
          </Typography>
        </Stack>

        <Typography
          sx={{
            color: metricTone.color,
            fontSize: { xs: 28, md: 32 },
            lineHeight: 1.05,
            fontWeight: 700,
          }}
        >
          {value}
        </Typography>

        <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', mt: 'auto', flexWrap: 'wrap' }}>
          <DeltaIcon sx={{ color: deltaColor, fontSize: 16 }} />
          <Typography sx={{ color: deltaColor, fontSize: 12, fontWeight: 700 }}>{deltaText ?? '0'}</Typography>
          <Typography sx={{ color: '#667085', fontSize: 12, fontWeight: 500 }}>{comparisonText}</Typography>
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
        border: '1px solid #eaecf0',
        bgcolor: '#ffffff',
        minHeight: 164,
      }}
    >
      <Stack spacing={1.5}>
        <Stack direction="row" sx={{ alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <Skeleton variant="rounded" width={40} height={40} />
          <Skeleton variant="text" width="38%" height={18} />
        </Stack>
        <Skeleton variant="text" width="56%" height={42} />
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
  const [period, setPeriod] = useState<OrderOverviewPeriod>('today')
  const [overview, setOverview] = useState<OrderOverviewResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isCancelled = false

    const fetchOverview = async () => {
      try {
        setIsLoading(true)
        const response = await orderApi.getOrderOverview({
          source: 'all',
          period,
        })

        if (!isCancelled) {
          setOverview(response)
        }
      } catch (error) {
        if (!isCancelled) {
          console.error('Lỗi khi tải tổng quan đơn hàng:', error)
          showErrorToast(error, 'Không thể tải số liệu tổng quan.')
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
  }, [period])

  const summary = overview?.summary ?? null
  const previousSummary = overview?.previous_summary ?? null
  const comparisonLabel = useMemo(() => getComparisonLabel(period), [period])

  const deltas = useMemo(() => {
    if (!summary || !previousSummary) {
      return null
    }

    return {
      totalOrders: getDeltaDisplay(summary.total_orders, previousSummary.total_orders, 'number'),
      revenue: getDeltaDisplay(Number(summary.net_revenue), Number(previousSummary.net_revenue), 'currency'),
      profit: getDeltaDisplay(Number(summary.gross_profit), Number(previousSummary.gross_profit), 'currency'),
      profitPercent: getDeltaDisplay(
        Number(summary.gross_margin_percent),
        Number(previousSummary.gross_margin_percent),
        'percent',
      ),
      soldQuantity: getDeltaDisplay(summary.sold_quantity, previousSummary.sold_quantity, 'number'),
    }
  }, [previousSummary, summary])

  const cards = useMemo(() => {
    if (!summary) {
      return []
    }

    const totalOrders = summary.total_orders
    const revenue = Number(summary.net_revenue)
    const grossProfit = Number(summary.gross_profit)
    const grossMarginPercent = Number(summary.gross_margin_percent)
    const soldQuantity = summary.sold_quantity

    return [
      {
        key: 'total_orders',
        label: 'Tổng số đơn hàng',
        value: formatNumber(totalOrders),
        deltaText: deltas?.totalOrders.text ?? '0',
        deltaTone: deltas?.totalOrders.tone ?? 'neutral',
        comparisonText: comparisonLabel,
        metricTone: getMetricTone(totalOrders),
        icon: DescriptionOutlinedIcon,
      },
      {
        key: 'net_revenue',
        label: 'Doanh thu',
        value: formatCurrency(revenue),
        deltaText: deltas?.revenue.text ?? formatCurrency(0),
        deltaTone: deltas?.revenue.tone ?? 'neutral',
        comparisonText: comparisonLabel,
        metricTone: getMetricTone(revenue),
        icon: MonetizationOnOutlinedIcon,
      },
      {
        key: 'gross_profit',
        label: 'Lợi nhuận',
        value: formatCurrency(grossProfit),
        deltaText: deltas?.profit.text ?? formatCurrency(0),
        deltaTone: deltas?.profit.tone ?? 'neutral',
        comparisonText: comparisonLabel,
        metricTone: getMetricTone(grossProfit),
        icon: SavingsOutlinedIcon,
      },
      {
        key: 'gross_margin_percent',
        label: 'Lợi nhuận (%)',
        value: formatPercent(grossMarginPercent),
        deltaText: deltas?.profitPercent.text ?? formatPercent(0),
        deltaTone: deltas?.profitPercent.tone ?? 'neutral',
        comparisonText: comparisonLabel,
        metricTone: getMetricTone(grossMarginPercent),
        icon: PercentOutlinedIcon,
      },
      {
        key: 'sold_quantity',
        label: 'Tổng đơn hàng',
        value: formatNumber(soldQuantity),
        deltaText: deltas?.soldQuantity.text ?? '0',
        deltaTone: deltas?.soldQuantity.tone ?? 'neutral',
        comparisonText: comparisonLabel,
        metricTone: getMetricTone(soldQuantity),
        icon: Inventory2OutlinedIcon,
      },
    ]
  }, [comparisonLabel, deltas, summary])

  return (
    <PageContentContainer>
      <Stack spacing={2.5}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ alignItems: { md: 'center' } }}>
          <TextField
            select
            size="small"
            value={period}
            onChange={(event) => setPeriod(event.target.value as OrderOverviewPeriod)}
            sx={{
              minWidth: 180,
              '& .MuiOutlinedInput-root': {
                bgcolor: '#ffffff',
              },
            }}
          >
            {periodOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
        </Stack>

        <Stack spacing={2}>
          <Typography sx={{ color: '#101828', fontWeight: 700 }}>Tổng quan kinh doanh</Typography>

          <Box
            sx={{
              display: 'grid',
              gap: 1.5,
              gridTemplateColumns: {
                xs: '1fr',
                md: 'repeat(2, minmax(0, 1fr))',
                xl: 'repeat(5, minmax(0, 1fr))',
              },
            }}
          >
            {isLoading || !summary
              ? Array.from({ length: 5 }).map((_, index) => <DashboardOverviewCardSkeleton key={index} />)
              : cards.map((card) => (
                  <DashboardOverviewCard
                    key={card.key}
                    label={card.label}
                    value={card.value}
                    deltaText={card.deltaText}
                    deltaTone={card.deltaTone}
                    comparisonText={card.comparisonText}
                    metricTone={card.metricTone}
                    icon={card.icon}
                  />
                ))}
          </Box>
        </Stack>
      </Stack>
    </PageContentContainer>
  )
}

export default DashboardOverviewPage
