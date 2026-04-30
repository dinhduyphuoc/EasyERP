import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react'
import {
  Button,
  Chip,
  Paper,
  Stack,
  Typography,
  alpha,
} from '@mui/material'
import AddOutlinedIcon from '@mui/icons-material/AddOutlined'
import SyncOutlinedIcon from '@mui/icons-material/SyncOutlined'
import { Link as RouterLink, useNavigate } from 'react-router'
import { useStore } from '@/modules/store/use-store'
import { CommonListLayout } from '@/shared/ui/list/common-list-layout'
import { ListEmptyState } from '@/shared/ui/list/list-empty-state'
import type { ListColumn, ListFilterConfig, ListTabConfig } from '@/shared/ui/list/common-list.types'
import { appToast } from '@/shared/ui/toast/toast.helpers'
import { orderApi, type OrderListItem } from '../api/order.api'
import { ListTableSkeleton } from '../components/shared/skeletons'
import { formatCurrency, formatDateTime, getPaymentStatusMeta, getProcessingStatusMeta } from './order.utils'

type OrdersCollectionPageProps = {
  title: string
  description: string
  view?: 'all' | 'drafts' | 'returns' | 'cancelled' | 'incomplete'
  helperTitle: string
  helperDescription: string
}

type OrdersCollectionPageCache = {
  activeStoreId: string
  view: string
  searchValue: string
  filterValues: Record<string, string>
  page: number
  pageSize: number
  rows: OrderListItem[]
}

const ordersCollectionCache = new Map<string, OrdersCollectionPageCache>()

const getOrdersCollectionCacheKey = (activeStoreId: string, view: OrdersCollectionPageProps['view']) =>
  `${activeStoreId}:${view ?? 'all'}`

export function invalidateOrdersCollectionCache(view?: OrdersCollectionPageProps['view']) {
  if (!view) {
    ordersCollectionCache.clear()
    return
  }

  for (const [key, cache] of ordersCollectionCache.entries()) {
    if (cache.view === view) {
      ordersCollectionCache.delete(key)
    }
  }
}

const orderTabs: ListTabConfig[] = [
  { label: 'Tất cả', value: 'all' },
  { label: 'Nháp', value: 'draft' },
  { label: 'Đặt cọc', value: 'deposit' },
  { label: 'Hoàn thành', value: 'completed' },
]

function matchesTab(order: OrderListItem, activeTab: string) {
  if (activeTab === 'all') {
    return true
  }

  if (activeTab === 'deposit') {
    return order.payment_status === 'deposit'
  }

  return order.processing_status === activeTab
}

export function OrdersCollectionPage({
  title,
  description,
  view = 'all',
  helperTitle,
  helperDescription,
}: OrdersCollectionPageProps): ReactElement {
  const navigate = useNavigate()
  const { activeStore } = useStore()
  const activeStoreId = activeStore?.id ?? 'no-store'
  const cacheKey = getOrdersCollectionCacheKey(activeStoreId, view)
  const cachedState = ordersCollectionCache.get(cacheKey) ?? null
  const [activeTab, setActiveTab] = useState(
    cachedState?.filterValues.activeTab ?? 'all',
  )
  const [searchValue, setSearchValue] = useState(cachedState?.searchValue ?? '')
  const [filterValues, setFilterValues] = useState<Record<string, string>>(
    cachedState?.filterValues ?? { payment_status: '', processing_status: '' },
  )
  const [page, setPage] = useState(cachedState?.page ?? 1)
  const [pageSize, setPageSize] = useState(cachedState?.pageSize ?? 10)
  const [rows, setRows] = useState<OrderListItem[]>(cachedState?.rows ?? [])
  const [isLoading, setIsLoading] = useState(rows.length === 0)
  const [hasResolvedInitialLoad, setHasResolvedInitialLoad] = useState((cachedState?.rows.length ?? 0) > 0)

  const fetchOrders = useCallback(async () => {
    const cachedRows = ordersCollectionCache.get(cacheKey)?.rows ?? []
    const hasCachedRows = cachedRows.length > 0
    setIsLoading(!hasCachedRows)

    try {
      const data = await orderApi.getOrders(view === 'all' ? undefined : { view })
      setRows(data)
    } catch (error) {
      console.error('Lỗi khi tải đơn hàng:', error)
      appToast.error('Không thể tải dữ liệu đơn hàng.')
    } finally {
      setIsLoading(false)
      setHasResolvedInitialLoad(true)
    }
  }, [cacheKey, view])

  useEffect(() => {
    void fetchOrders()
  }, [fetchOrders])

  useEffect(() => {
    if (!hasResolvedInitialLoad) {
      return
    }

    ordersCollectionCache.set(cacheKey, {
      activeStoreId,
      view,
      searchValue,
      filterValues: { ...filterValues, activeTab },
      page,
      pageSize,
      rows,
    })
  }, [activeStoreId, activeTab, cacheKey, filterValues, hasResolvedInitialLoad, page, pageSize, rows, searchValue, view])

  const filters = useMemo<ListFilterConfig[]>(
    () => [
      {
        key: 'payment_status',
        label: 'Thanh toán',
        placeholder: 'Tất cả trạng thái thanh toán',
        options: [
          { label: 'Chưa thanh toán', value: 'unpaid' },
          { label: 'Đã thanh toán', value: 'paid' },
          { label: 'Đặt cọc', value: 'deposit' },
        ],
      },
      {
        key: 'processing_status',
        label: 'Xử lý',
        placeholder: 'Tất cả trạng thái xử lý',
        options: [
          { label: 'Nháp', value: 'draft' },
          { label: 'Chờ xác nhận', value: 'placed' },
          { label: 'Đã xác nhận', value: 'confirmed' },
          { label: 'Đóng gói', value: 'picked_up' },
          { label: 'Đang giao', value: 'delivering' },
          { label: 'Hoàn thành', value: 'completed' },
          { label: 'Đã hủy', value: 'cancelled' },
          { label: 'Trả hàng', value: 'returned' },
        ],
      },
    ],
    [],
  )

  const tabs = useMemo(
    () =>
      orderTabs.map((tab) => ({
        ...tab,
        count:
          tab.value === 'all'
            ? rows.length
            : rows.filter((row) => matchesTab(row, tab.value)).length,
      })),
    [rows],
  )

  const filteredRows = useMemo(() => {
    const keyword = searchValue.trim().toLowerCase()

    return rows.filter((row) => {
      const matchesKeyword =
        keyword.length === 0 ||
        row.order_code.toLowerCase().includes(keyword) ||
        row.customer_info.name.toLowerCase().includes(keyword) ||
        row.customer_info.phone.toLowerCase().includes(keyword) ||
        (row.customer_info.customer_code ?? '').toLowerCase().includes(keyword)

      const matchesPayment = !filterValues.payment_status || row.payment_status === filterValues.payment_status
      const matchesProcessing = !filterValues.processing_status || row.processing_status === filterValues.processing_status

      return matchesKeyword && matchesPayment && matchesProcessing && matchesTab(row, activeTab)
    })
  }, [activeTab, filterValues.payment_status, filterValues.processing_status, rows, searchValue])

  const shouldShowInitialSkeleton = (!hasResolvedInitialLoad || isLoading) && rows.length === 0

  const pagedRows = useMemo(() => {
    const start = (page - 1) * pageSize
    return filteredRows.slice(start, start + pageSize)
  }, [filteredRows, page, pageSize])

  const columns = useMemo<ListColumn<OrderListItem>[]>(
    () => [
      {
        key: 'order_code',
        title: 'Mã đơn hàng',
        render: (row) => (
          <Stack spacing={0.5}>
            <Typography sx={{ fontWeight: 700, color: '#0f172a' }}>{row.order_code}</Typography>
            <Typography variant="body2" color="text.secondary">
              {formatDateTime(row.order_date)}
            </Typography>
          </Stack>
        ),
      },
      {
        key: 'customer',
        title: 'Khách hàng',
        render: (row) => (
          <Stack spacing={0.5} sx={{ minWidth: 220 }}>
            <Typography sx={{ fontWeight: 600 }}>{row.customer_info.name}</Typography>
            <Typography variant="body2" color="text.secondary">
              {row.customer_info.customer_code ?? 'Khách lẻ'} · {row.customer_info.phone}
            </Typography>
          </Stack>
        ),
      },
      {
        key: 'total_amount',
        title: 'Tổng tiền',
        align: 'right',
        render: (row) => formatCurrency(row.total_amount),
      },
      {
        key: 'payment_status',
        title: 'Thanh toán',
        render: (row) => {
          const meta = getPaymentStatusMeta(row.payment_status)
          return <Chip size="small" label={meta.label} color={meta.color} variant="outlined" />
        },
      },
      {
        key: 'processing_status',
        title: 'Xử lý',
        render: (row) => {
          const meta = getProcessingStatusMeta(row.processing_status)
          return <Chip size="small" label={meta.label} color={meta.color} variant="outlined" />
        },
      },
      {
        key: 'shipping_service',
        title: 'ĐVVC',
        render: (row) => row.shipping_service ?? '-',
      },
      {
        key: 'sales_channel',
        title: 'Kênh bán hàng',
        render: (row) => row.sales_channel ?? '-',
      },
    ],
    [],
  )

  return (
    <CommonListLayout
      title={title}
      description={description}
      headerActions={
        <>
          <Button variant="outlined" startIcon={<SyncOutlinedIcon />} onClick={() => void fetchOrders()}>
            Làm mới
          </Button>
          <Button
            component={RouterLink}
            to="/orders/create"
            variant="contained"
            color="secondary"
            startIcon={<AddOutlinedIcon />}
          >
            Tạo đơn hàng
          </Button>
        </>
      }
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={(value) => {
        setActiveTab(value)
        setPage(1)
      }}
      searchValue={searchValue}
      searchPlaceholder="Tìm theo mã đơn, khách hàng hoặc mã khách hàng"
      onSearchChange={(value) => {
        setSearchValue(value)
        setPage(1)
      }}
      filters={filters}
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
            setActiveTab('all')
            setSearchValue('')
            setFilterValues({ payment_status: '', processing_status: '' })
            setPage(1)
          }}
        >
          Đặt lại
        </Button>
      }
      columns={columns}
      rows={pagedRows}
      rowKey={(row) => String(row.id)}
      onRowClick={(row) => navigate(`/orders/${row.id}`)}
      loading={shouldShowInitialSkeleton}
      loadingState={<ListTableSkeleton />}
      emptyState={
        <ListEmptyState
          title="Không tìm thấy đơn hàng phù hợp"
          description="Thử đổi từ khóa tìm kiếm hoặc xóa bộ lọc để xem lại danh sách đơn hàng."
          action={
            <Button
              variant="contained"
              onClick={() => {
                setActiveTab('all')
                setSearchValue('')
                setFilterValues({ payment_status: '', processing_status: '' })
                setPage(1)
              }}
            >
              Xem tất cả đơn hàng
            </Button>
          }
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
      helper={
        <Paper
          sx={{
            p: 2.5,
            border: (theme) => `1px solid ${alpha(theme.palette.info.main, 0.12)}`,
            bgcolor: (theme) => alpha(theme.palette.info.light, 0.08),
          }}
        >
          <Typography sx={{ fontWeight: 700 }}>{helperTitle}</Typography>
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            {helperDescription}
          </Typography>
        </Paper>
      }
    />
  )
}
