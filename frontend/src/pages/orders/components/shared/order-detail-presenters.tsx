import { Box, Chip, CircularProgress, Paper, Radio, Stack, Typography } from '@mui/material'
import type { ReactElement, ReactNode } from 'react'
import { InfoField } from '@/shared/ui/info-field'
import { borderedCardSx } from '@/shared/ui/paper'
import type { OrderDetailItem, OrderProcessingStatus } from '../../api'

export type OrderTimelineStage = {
  key: string
  timelineKey: string
  label: string
  matches: OrderProcessingStatus[]
}

export type HorizontalTimelineItem = {
  key: string
  label: string
  timestamp: string | null
  state: 'upcoming' | 'completed' | 'current'
}

export type VerticalTimelineItem = {
  key: string
  label: string
  timestamp: string | null
  highlighted?: boolean
}

export type InfoPaperRow = {
  label: string
  value: string | null
  valueWeight?: number
  labelMinWidth?: number
}

export type InfoFieldGridItem = {
  label: string
  value: string
}

export type OverviewProductCardItem = {
  id: string | number
  imageUrl: string | null
  productName: string
  displayName: string | null
  sku: string
  variantSku: string | null
  variantLabel: string | null
  unitPriceLabel: string
  quantityLabel: string
}

export type SummaryRowItem = {
  label: string
  value: string
  valueWeight?: number
  labelMinWidth?: number
}

export type ShippingServiceOptionCardItem = {
  key: string
  providerDisplayName: string
  providerLogoUrl: string | null
  serviceName: string
  expectedDeliveryLabel: string
  feeLabel: string | null
}

const resolveTimelineTimestamp = (stage: unknown, fallback?: string | null): string | null => {
  if (typeof stage === 'string' && stage.trim()) {
    return stage
  }

  if (stage && typeof stage === 'object') {
    const timestampCandidateKeys = ['timestamp', 'date', 'pickup_date', 'delivery_date', 'completed_date']

    for (const key of timestampCandidateKeys) {
      const value = (stage as Record<string, unknown>)[key]

      if (typeof value === 'string' && value.trim()) {
        return value
      }
    }
  }

  return fallback ?? null
}

const formatTimelineTime = (value: string | null): string => {
  if (!value) {
    return ''
  }

  return new Date(value).toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

const formatTimelineDate = (value: string | null): string => {
  if (!value) {
    return ''
  }

  return new Date(value).toLocaleDateString('vi-VN')
}

const formatTimelineDateEn = (value: string | null): string => {
  if (!value) {
    return 'Chưa có thời gian'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return 'Chưa có thời gian'
  }

  return new Intl.DateTimeFormat('vi-VN', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  }).format(date)
}

const formatTimelineTimeWithSeconds = (value: string | null): string => {
  if (!value) {
    return '--:--:--'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '--:--:--'
  }

  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date)
}

export function OrderTimeline(
  props:
    | {
        variant: 'horizontal'
        items: HorizontalTimelineItem[]
      }
    | {
        variant: 'vertical'
        items: VerticalTimelineItem[]
      },
): ReactElement {
  if (props.variant === 'horizontal') {
    const { items } = props

    return (
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: `repeat(${items.length}, minmax(0, 1fr))` },
          gap: { xs: 1.5, md: 0 },
        }}
      >
        {items.map((item, index) => {
          const isCompleted = item.state === 'completed'
          const isActive = item.state !== 'upcoming'
          const shouldRenderActiveDot = isActive

          return (
            <Box
              key={item.key}
              sx={{
                minWidth: 0,
                display: 'grid',
                gridTemplateColumns: { xs: '28px minmax(0, 1fr)', md: '1fr' },
                alignItems: { xs: 'flex-start', md: 'start' },
                position: 'relative',
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: { xs: 'column', md: 'column' },
                  alignItems: 'center',
                  minHeight: { xs: 88, md: 'auto' },
                  width: { xs: 28, md: '100%' },
                  flexShrink: 0,
                  position: 'relative',
                  pt: { xs: 0.25, md: 0 },
                }}
              >
                <Box
                  sx={{
                    width: shouldRenderActiveDot ? 24 : 16,
                    height: shouldRenderActiveDot ? 24 : 16,
                    borderRadius: '50%',
                    bgcolor: isActive ? '#16a34a' : '#d0d5dd',
                    border: shouldRenderActiveDot ? '3px solid #dcfce7' : 'none',
                    zIndex: 1,
                    display: 'grid',
                    placeItems: 'center',
                  }}
                >
                  {shouldRenderActiveDot ? (
                    <Box
                      sx={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        bgcolor: '#ffffff',
                      }}
                    />
                  ) : null}
                </Box>
                {index < items.length - 1 ? (
                  <Box
                    sx={{
                      bgcolor: isCompleted ? '#16a34a' : '#d0d5dd',
                      width: { xs: 2, md: `calc(100% - ${shouldRenderActiveDot ? 24 : 16}px)` },
                      height: { xs: 40, md: 2 },
                      minHeight: { xs: 40, md: 2 },
                      position: { xs: 'static', md: 'absolute' },
                      top: { xs: 'auto', md: shouldRenderActiveDot ? 11 : 7 },
                      left: { xs: 'auto', md: `calc(50% + ${shouldRenderActiveDot ? 12 : 8}px)` },
                    }}
                  />
                ) : null}
              </Box>
              <Box
                sx={{
                  px: { xs: 1.5, md: 0 },
                  mt: { xs: 0, md: 1.5 },
                  textAlign: { xs: 'left', md: 'center' },
                  minWidth: 0,
                }}
              >
                <Typography
                  sx={{
                    mt: { xs: 0.5, md: 0.75 },
                    color: isActive ? '#101828' : '#98a2b3',
                    fontWeight: 600,
                    fontSize: '0.875rem',
                    lineHeight: 1.4,
                    textAlign: 'center',
                  }}
                >
                  {item.label}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    display: 'block',
                    mt: 0.3,
                    color: isActive ? '#667085' : '#98a2b3',
                    fontSize: '0.75rem',
                    lineHeight: 1.35,
                    textAlign: 'center',
                    minHeight: '1rem',
                  }}
                >
                  {formatTimelineDate(item.timestamp)}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    display: 'block',
                    mt: 0.15,
                    color: isActive ? '#667085' : '#98a2b3',
                    fontSize: '0.75rem',
                    lineHeight: 1.35,
                    textAlign: 'center',
                    minHeight: '1rem',
                  }}
                >
                  {formatTimelineTime(item.timestamp)}
                </Typography>
              </Box>
            </Box>
          )
        })}
      </Box>
    )
  }

  const { items } = props

  return (
    <Stack spacing={0.5}>
      {items.map((item, index) => {
        const isHighlighted = item.highlighted ?? index === 0
        const isActive = isHighlighted || index === 0
        const isLast = index === items.length - 1

        return (
          <Box
            key={item.key}
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '28px minmax(0, 1fr)', sm: '112px 28px minmax(0, 1fr)' },
              columnGap: { xs: 1.25, sm: 1.5 },
              alignItems: 'start',
            }}
          >
            <Box sx={{ pr: { sm: 1 }, textAlign: 'right', display: { xs: 'none', sm: 'block' } }}>
              <Typography
                sx={{
                  fontSize: '0.75rem',
                  lineHeight: 0.5,
                  color: isActive ? '#667085' : '#98a2b3',
                }}
              >
                {formatTimelineTimeWithSeconds(item.timestamp)}
              </Typography>
              <Typography variant="caption" sx={{ color: isActive ? '#667085' : '#98a2b3' }}>
                {formatTimelineDateEn(item.timestamp)}
              </Typography>
            </Box>

            <Stack sx={{ minHeight: 28, pt: 0.25 }}>
              <Box
                sx={{
                  width: isActive ? 24 : 16,
                  height: isActive ? 24 : 16,
                  borderRadius: '50%',
                  bgcolor: isActive ? '#16a34a' : '#d0d5dd',
                  border: isActive ? '3px solid #dcfce7' : 'none',
                  display: 'grid',
                  placeItems: 'center',
                  zIndex: 1,
                }}
              >
                {isActive ? (
                  <Box
                    sx={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      bgcolor: '#ffffff',
                    }}
                  />
                ) : null}
              </Box>
              {!isLast ? (
                <Box
                  sx={{
                    mt: 0.5,
                    width: 2,
                    flex: 1,
                    minHeight: 52,
                    bgcolor: isActive ? '#16a34a' : '#d0d5dd',
                  }}
                />
              ) : null}
            </Stack>

            <Box sx={{ minWidth: 0, pt: { xs: 0, sm: 0.15 } }}>
              <Typography
                sx={{
                  fontWeight: isHighlighted ? 700 : 600,
                  color: isActive ? '#101828' : '#98a2b3',
                  lineHeight: 1.45,
                }}
              >
                {item.label}
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  display: { xs: 'block', sm: 'none' },
                  mt: 0.35,
                  color: isActive ? '#667085' : '#98a2b3',
                }}
              >
                {`${formatTimelineDateEn(item.timestamp)} ${formatTimelineTimeWithSeconds(item.timestamp)}`.trim()}
              </Typography>
            </Box>
          </Box>
        )
      })}
    </Stack>
  )
}

export function TimelinePanel({
  title,
  description,
  statusLabel,
  isLoading,
  loadingMessage,
  errorMessage,
  emptyMessage,
  items,
}: {
  title: string
  description?: string
  statusLabel?: string | null
  isLoading?: boolean
  loadingMessage?: string
  errorMessage?: string | null
  emptyMessage?: string
  items: VerticalTimelineItem[]
}): ReactElement {
  return (
    <Paper sx={borderedCardSx}>
      <Stack spacing={2}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.5}
          sx={{ justifyContent: 'space-between', alignItems: { sm: 'flex-start' } }}
        >
          <Stack spacing={0.5}>
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#172b48' }}>
              {title}
            </Typography>
            {description ? <Typography sx={{ color: '#667085' }}>{description}</Typography> : null}
          </Stack>
          {statusLabel ? (
            <Chip label={statusLabel} variant="outlined" sx={{ fontWeight: 700, bgcolor: '#fff' }} />
          ) : null}
        </Stack>

        {isLoading ? (
          <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center', py: 1 }}>
            <CircularProgress size={18} />
            <Typography color="text.secondary">{loadingMessage || 'Đang tải timeline...'}</Typography>
          </Stack>
        ) : null}

        {!isLoading && errorMessage ? (
          <Typography variant="body2" color="error">
            {errorMessage}
          </Typography>
        ) : null}

        {!isLoading && !errorMessage ? (
          items.length > 0 ? (
            <OrderTimeline variant="vertical" items={items} />
          ) : (
            <Typography variant="body2" sx={{ color: '#667085' }}>
              {emptyMessage || 'Chưa có dữ liệu timeline.'}
            </Typography>
          )
        ) : null}
      </Stack>
    </Paper>
  )
}

export function InfoPaper({
  title,
  rows,
  children,
  labelMinWidth = 120,
  headerAction,
  paperSx,
}: {
  title: string
  rows: InfoPaperRow[]
  children?: ReactNode
  labelMinWidth?: number
  headerAction?: ReactNode
  paperSx?: Record<string, unknown>
}): ReactElement {
  const visibleRows = rows.filter((row): row is InfoPaperRow & { value: string } => Boolean(row.value))

  return (
    <Paper sx={paperSx ? { ...borderedCardSx, ...paperSx } : borderedCardSx}>
      <Stack spacing={1.25}>
        <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" sx={{ fontWeight: 700, color: '#172b48' }}>
            {title}
          </Typography>
          {headerAction ? <Box sx={{ flexShrink: 0 }}>{headerAction}</Box> : null}
        </Stack>
        {visibleRows.length > 0 ? (
          <Stack spacing={1}>
            {visibleRows.map((item) => (
              <InfoField
                key={item.label}
                label={item.label}
                value={item.value}
                valueWeight={item.valueWeight ?? 600}
                variant="row"
                labelMinWidth={item.labelMinWidth ?? labelMinWidth}
              />
            ))}
          </Stack>
        ) : null}
        {children}
      </Stack>
    </Paper>
  )
}

export function InfoPaperGrid({ children }: { children: ReactNode }): ReactElement {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' },
        gap: 2,
      }}
    >
      {children}
    </Box>
  )
}

export function InfoFieldGrid({
  items,
  columns = 3,
}: {
  items: InfoFieldGridItem[]
  columns?: number
}): ReactElement {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: `repeat(${columns}, minmax(0, 1fr))` },
        gap: 1.25,
      }}
    >
      {items.map((item) => (
        <InfoField key={item.label} label={item.label} value={item.value} />
      ))}
    </Box>
  )
}

export function OverviewProductCard({ item }: { item: OverviewProductCardItem }): ReactElement {
  const fallbackInitial = (item.variantSku?.slice(0, 1) || item.sku.slice(0, 1)).toUpperCase()

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: '36px minmax(0, 1fr)',
        gap: 1,
        alignItems: 'center',
        p: 0.875,
        borderRadius: 1.5,
        bgcolor: '#f8fafc',
        border: '1px solid #eef2f6',
      }}
    >
      {item.imageUrl ? (
        <Box
          component="img"
          src={item.imageUrl}
          alt={item.productName}
          sx={{
            width: 36,
            height: 36,
            borderRadius: 1.25,
            objectFit: 'cover',
            bgcolor: '#ffffff',
            border: '1px solid #eaecf0',
            display: 'block',
          }}
        />
      ) : (
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: 1.25,
            bgcolor: '#ffffff',
            border: '1px solid #eaecf0',
            display: 'grid',
            placeItems: 'center',
            color: '#667085',
            fontSize: 11,
            fontWeight: 700,
            overflow: 'hidden',
          }}
        >
          {fallbackInitial}
        </Box>
      )}

      <Box sx={{ minWidth: 0 }}>
        <Typography
          variant="body2"
          sx={{
            color: '#101828',
            fontSize: 12.5,
            lineHeight: '18px',
            fontWeight: 600,
            wordBreak: 'break-word',
          }}
        >
          {item.displayName ?? item.productName}
        </Typography>
        <Typography
          variant="caption"
          sx={{
            display: 'block',
            mt: 0.25,
            color: '#98a2b3',
            fontSize: 12,
            lineHeight: '16px',
          }}
        >
          {item.unitPriceLabel} - SL {item.quantityLabel}
        </Typography>
      </Box>
    </Box>
  )
}

export function InfoSummaryRows({
  rows,
  spacing = 0.5,
  variant = 'row',
  labelMinWidth = 88,
}: {
  rows: SummaryRowItem[]
  spacing?: number
  variant?: 'row' | 'column'
  labelMinWidth?: number
}): ReactElement {
  return (
    <Stack spacing={spacing}>
      {rows.map((row) => (
        <InfoField
          key={row.label}
          label={row.label}
          value={row.value}
          valueWeight={row.valueWeight ?? 600}
          variant={variant}
          labelMinWidth={row.labelMinWidth ?? labelMinWidth}
        />
      ))}
    </Stack>
  )
}

export function ShippingServiceOptionCard({
  item,
  selected,
  isSaving,
  disabled,
  isLowestFee,
  isFastest,
  onSelect,
}: {
  item: ShippingServiceOptionCardItem
  selected: boolean
  isSaving: boolean
  disabled?: boolean
  isLowestFee?: boolean
  isFastest?: boolean
  onSelect: () => void
}): ReactElement {
  return (
    <Box
      component="button"
      type="button"
      onClick={onSelect}
      disabled={disabled}
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
        cursor: disabled ? 'default' : 'pointer',
        appearance: 'none',
      }}
    >
      <Radio checked={selected} value={item.key} disableRipple />

      <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center', minWidth: 0 }}>
        {item.providerLogoUrl ? (
          <Box
            component="img"
            src={item.providerLogoUrl}
            alt={item.providerDisplayName}
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
            {item.providerDisplayName.slice(0, 3).toUpperCase()}
          </Box>
        )}

        <Box sx={{ minWidth: 0 }}>
          <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', flexWrap: 'wrap' }} useFlexGap>
            <Typography sx={{ fontWeight: 700, color: '#101828' }}>{item.providerDisplayName}</Typography>
            {isLowestFee ? (
              <Chip label="Rẻ nhất" size="small" color="success" variant="outlined" sx={{ height: 22, fontWeight: 700 }} />
            ) : null}
            {isFastest ? (
              <Chip label="Nhanh nhất" size="small" color="primary" variant="outlined" sx={{ height: 22, fontWeight: 700 }} />
            ) : null}
          </Stack>
          <Typography variant="body2" sx={{ color: '#475467' }}>
            {item.serviceName}
          </Typography>
          <Typography variant="caption" sx={{ color: '#667085', display: 'block' }}>
            Dự kiến giao: {item.expectedDeliveryLabel}
          </Typography>
        </Box>
      </Stack>

      <Stack spacing={0.5} sx={{ alignItems: 'flex-end' }}>
        {item.feeLabel ? (
          <Typography sx={{ fontWeight: 700, color: '#101828' }}>{item.feeLabel}</Typography>
        ) : (
          <Typography variant="caption" sx={{ color: '#98a2b3' }}>
            Chưa tính phí
          </Typography>
        )}
        {selected && isSaving ? (
          <Typography variant="caption" sx={{ color: '#475467' }}>
            Đang lưu...
          </Typography>
        ) : null}
      </Stack>
    </Box>
  )
}

export function OrderTimelineCard({
  order,
  currentIndex,
  stages,
}: {
  order: OrderDetailItem
  currentIndex: number
  stages: OrderTimelineStage[]
}): ReactElement {
  const timeline = (order.status_timeline ?? {}) as Record<string, unknown>
  const items: HorizontalTimelineItem[] = stages.map((stage, index) => {
    const stageTimeline = timeline[stage.timelineKey]
    const resolvedTimestamp = resolveTimelineTimestamp(
      stageTimeline,
      stage.timelineKey === 'created' ? order.created_at : null,
    )

    return {
      key: stage.key,
      label: stage.label,
      timestamp: index <= currentIndex ? resolvedTimestamp : null,
      state: index < currentIndex ? 'completed' : index === currentIndex ? 'current' : 'upcoming',
    }
  })

  return (
    <Paper sx={borderedCardSx}>
      <Stack spacing={2.5}>
        <Typography variant="h6" sx={{ fontWeight: 700, color: '#101828' }}>
          Tiến trình đơn hàng
        </Typography>
        <OrderTimeline variant="horizontal" items={items} />
      </Stack>
    </Paper>
  )
}
