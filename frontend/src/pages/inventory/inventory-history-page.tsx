import { useEffect, useMemo, useState } from 'react'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import {
  Box,
  Button,
  Paper,
  Stack,
  Typography,
} from '@mui/material'
import { useLocation, useNavigate, useParams } from 'react-router'
import { CommonListLayout } from '@/shared/ui/list/common-list-layout'
import { ListEmptyState } from '@/shared/ui/list/list-empty-state'
import type { ListColumn, ListFilterConfig } from '@/shared/ui/list/common-list.types'
import { PageContentContainer } from '@/shared/ui/page'
import {
  inventoryApi,
  type InventoryHistoryItem,
  type InventoryStockListItem,
} from './inventory.api'
import { InventoryHistoryTableSkeleton } from './inventory-skeletons'

type InventoryHistoryLocationState = {
  stockItem?: InventoryStockListItem
}

type InventoryHistoryPageCache = {
  filterValues: Record<string, string>
  page: number
  pageSize: number
  rows: InventoryHistoryItem[]
  stockItem: InventoryStockListItem | null
}

let inventoryHistoryPageCache: InventoryHistoryPageCache | null = null

const historyTimeFilter: ListFilterConfig = {
  key: 'period',
  label: 'Thời gian',
  placeholder: 'Tất cả thời gian',
  options: [
    { label: '7 ngày gần đây', value: '7d' },
    { label: '30 ngày gần đây', value: '30d' },
    { label: '90 ngày gần đây', value: '90d' },
  ],
  minWidth: 180,
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('vi-VN')
}

function formatNumber(value: number) {
  return value.toLocaleString('vi-VN')
}

function getPeriodStart(period: string) {
  const now = new Date()

  if (period === '7d') {
    return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  }

  if (period === '30d') {
    return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  }

  if (period === '90d') {
    return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
  }

  return null
}

export function InventoryHistoryPage() {
  const { productVariantId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const locationState = location.state as InventoryHistoryLocationState | null
  const cachedPage = inventoryHistoryPageCache?.stockItem?.product_variant_id === productVariantId ? inventoryHistoryPageCache : null
  const [filterValues, setFilterValues] = useState<Record<string, string>>(
    cachedPage?.filterValues ?? {
      reason_code: '',
      period: '',
    },
  )
  const [page, setPage] = useState(cachedPage?.page ?? 1)
  const [pageSize, setPageSize] = useState(cachedPage?.pageSize ?? 10)
  const [rows, setRows] = useState<InventoryHistoryItem[]>(cachedPage?.rows ?? [])
  const [stockItem, setStockItem] = useState<InventoryStockListItem | null>(
    cachedPage?.stockItem ?? locationState?.stockItem ?? null,
  )
  const [isLoading, setIsLoading] = useState(cachedPage === null)
  const [hasResolvedInitialLoad, setHasResolvedInitialLoad] = useState(cachedPage !== null)

  useEffect(() => {
    const fetchPageData = async () => {
      if (!productVariantId) {
        return
      }

      setIsLoading(cachedPage === null)

      try {
        const [historyResponse, fetchedStockItem] = await Promise.all([
          inventoryApi.getHistory(productVariantId),
          locationState?.stockItem
            ? Promise.resolve<InventoryStockListItem | null>(null)
            : inventoryApi.getStockItem(productVariantId),
        ])

        setRows(historyResponse.items)

        if (locationState?.stockItem) {
          setStockItem(locationState.stockItem)
        } else if (fetchedStockItem) {
          setStockItem(fetchedStockItem)
        }
      } catch (error) {
        console.error('Lỗi khi tải lịch sử thay đổi kho:', error)
      } finally {
        setIsLoading(false)
        setHasResolvedInitialLoad(true)
      }
    }

    void fetchPageData()
  }, [cachedPage, locationState, productVariantId])

  useEffect(() => {
    if (!hasResolvedInitialLoad) {
      return
    }

    inventoryHistoryPageCache = {
      filterValues,
      page,
      pageSize,
      rows,
      stockItem,
    }
  }, [filterValues, hasResolvedInitialLoad, page, pageSize, rows, stockItem])

  const historyTypeFilter = useMemo<ListFilterConfig>(() => {
    const options = Array.from(
      new Map(
        rows.map((row) => [
          row.reason_code,
          {
            label: row.reason ?? row.reason_code,
            value: row.reason_code,
          },
        ]),
      ).values(),
    )

    return {
      key: 'reason_code',
      label: 'Loại thay đổi',
      placeholder: 'Tất cả loại thay đổi',
      options,
      minWidth: 220,
    }
  }, [rows])

  const filteredRows = useMemo(() => {
    const periodStart = getPeriodStart(filterValues.period)

    return rows.filter((row) => {
      const matchesReason = !filterValues.reason_code || row.reason_code === filterValues.reason_code
      const matchesPeriod = !periodStart || new Date(row.created_at) >= periodStart

      return matchesReason && matchesPeriod
    })
  }, [filterValues.period, filterValues.reason_code, rows])

  const pagedRows = useMemo(() => {
    const start = (page - 1) * pageSize
    return filteredRows.slice(start, start + pageSize)
  }, [filteredRows, page, pageSize])

  const columns = useMemo<ListColumn<InventoryHistoryItem>[]>(
    () => [
      {
        key: 'created_at',
        title: 'Thời gian',
        width: 180,
        render: (row) => formatDateTime(row.created_at),
      },
      {
        key: 'reason',
        title: 'Loại thay đổi',
        width: 170,
        render: (row) => row.reason ?? row.reason_code,
      },
      {
        key: 'action',
        title: 'Hành động',
        width: 170,
        render: (row) => row.action,
      },
      {
        key: 'actor',
        title: 'Người thay đổi',
        width: 170,
        render: (row) => row.actor.name ?? '-',
      },
      {
        key: 'on_hand',
        title: 'Tồn kho',
        align: 'right',
        width: 110,
        render: (row) => formatNumber(row.changes.on_hand.after),
      },
      {
        key: 'available',
        title: 'Có thể bán',
        align: 'right',
        width: 120,
        render: (row) => formatNumber(row.changes.available.after),
      },
      {
        key: 'committed',
        title: 'Đang giao dịch',
        align: 'right',
        width: 130,
        render: (row) => formatNumber(row.changes.committed.after),
      },
      {
        key: 'packing',
        title: 'Đang đóng gói',
        align: 'right',
        width: 130,
        render: (row) => formatNumber(row.changes.packing.after),
      },
      {
        key: 'incoming',
        title: 'Đang về kho',
        align: 'right',
        width: 120,
        render: (row) => formatNumber(row.changes.incoming.after),
      },
    ],
    [],
  )

  const shouldShowInitialSkeleton = (!hasResolvedInitialLoad || isLoading) && rows.length === 0

  return (
    <PageContentContainer>
      <Box sx={{ mb: 2 }}>
        <Stack
          direction="row"
          spacing={2}
          sx={{ alignItems: 'center', cursor: 'pointer' }}
          onClick={() => navigate('/inventory/stock')}
        >
          <Paper
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              p: 1,
            }}
          >
            <ArrowBackIcon sx={{ color: '#344054' }} />
          </Paper>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 600, color: '#101828' }}>
              {stockItem?.display_name ?? productVariantId ?? 'Lịch sử kho'}
            </Typography>
            <Typography color="text.secondary">
              {stockItem?.sku ?? productVariantId ?? '-'}
            </Typography>
          </Box>
        </Stack>
      </Box>

      <CommonListLayout
        title="Lịch sử thay đổi kho"
        filters={[historyTypeFilter, historyTimeFilter]}
        filterValues={filterValues}
        onFilterChange={(key, value) => {
          setFilterValues((current) => ({
            ...current,
            [key]: value,
          }))
          setPage(1)
        }}
        toolbarActions={
          <Button
            variant="text"
            onClick={() => {
              setFilterValues({ reason_code: '', period: '' })
              setPage(1)
            }}
          >
            Đặt lại
          </Button>
        }
        columns={columns}
        rows={pagedRows}
        rowKey={(row) => row.id}
        loading={shouldShowInitialSkeleton}
        loadingState={<InventoryHistoryTableSkeleton />}
        emptyState={
          <ListEmptyState
            title="Chưa có lịch sử thay đổi kho"
            description="Biến thể này chưa phát sinh giao dịch kho nào để hiển thị."
          />
        }
        pagination={{
          page,
          pageSize,
          total: filteredRows.length,
          onPageChange: setPage,
          onPageSizeChange: (size) => {
            setPageSize(size)
            setPage(1)
          },
          pageSizeOptions: [10, 20, 50],
        }}
      />
    </PageContentContainer>
  )
}
