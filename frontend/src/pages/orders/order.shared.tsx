import { useEffect, useMemo, useState, type ReactElement } from 'react'
import {
  Alert,
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
import { CommonListLayout } from '@/shared/ui/list/common-list-layout'
import { ListEmptyState } from '@/shared/ui/list/list-empty-state'
import type { ListColumn, ListFilterConfig, ListTabConfig } from '@/shared/ui/list/common-list.types'
import { appToast } from '@/shared/ui/toast/toast'
import { orderApi, type OrderListItem, type OrderPaymentStatus, type OrderProcessingStatus } from './order.api'

export function formatCurrency(value: string | number | null | undefined): string {
  const numericValue = Number(value ?? 0)
  return `${numericValue.toLocaleString('vi-VN')} đ`
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return '-'
  }

  return new Date(value).toLocaleString('vi-VN')
}

export function getPaymentStatusMeta(status: OrderPaymentStatus): {
  label: string
  color: 'default' | 'warning' | 'success' | 'info'
} {
  if (status === 'paid') {
    return { label: 'Đã thanh toán', color: 'success' }
  }

  if (status === 'deposit') {
    return { label: 'Đặt cọc', color: 'info' }
  }

  return { label: 'Chưa thanh toán', color: 'warning' }
}

export function getProcessingStatusMeta(status: OrderProcessingStatus): {
  label: string
  color: 'default' | 'warning' | 'success' | 'info'
} {
  switch (status) {
    case 'draft':
      return { label: 'Nháp', color: 'default' }
    case 'placed':
      return { label: 'Đặt hàng', color: 'info' }
    case 'confirmed':
      return { label: 'Xác nhận', color: 'info' }
    case 'picked_up':
      return { label: 'DVVC lấy hàng', color: 'warning' }
    case 'delivering':
      return { label: 'Đang giao', color: 'warning' }
    case 'completed':
      return { label: 'Hoàn thành', color: 'success' }
    case 'cancelled':
      return { label: 'Đã hủy', color: 'default' }
    case 'returned':
      return { label: 'Trả hàng', color: 'default' }
    default:
      return { label: status, color: 'default' }
  }
}

type OrdersCollectionPageProps = {
  title: string
  description: string
  view?: 'all' | 'drafts' | 'returns' | 'cancelled' | 'incomplete'
  helperTitle: string
  helperDescription: string
}

type OrdersCollectionPageCache = {
  view: string
  searchValue: string
  filterValues: Record<string, string>
  page: number
  pageSize: number
  rows: OrderListItem[]
}

let ordersCollectionCache: OrdersCollectionPageCache | null = null

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
  const [activeTab, setActiveTab] = useState(
    ordersCollectionCache?.view === view ? ordersCollectionCache?.filterValues.activeTab ?? 'all' : 'all',
  )
  const [searchValue, setSearchValue] = useState(
    ordersCollectionCache?.view === view ? ordersCollectionCache?.searchValue ?? '' : '',
  )
  const [filterValues, setFilterValues] = useState<Record<string, string>>(
    ordersCollectionCache?.view === view
      ? ordersCollectionCache?.filterValues ?? { payment_status: '', processing_status: '' }
      : { payment_status: '', processing_status: '' },
  )
  const [page, setPage] = useState(ordersCollectionCache?.view === view ? ordersCollectionCache?.page ?? 1 : 1)
  const [pageSize, setPageSize] = useState(
    ordersCollectionCache?.view === view ? ordersCollectionCache?.pageSize ?? 10 : 10,
  )
  const [rows, setRows] = useState<OrderListItem[]>(
    ordersCollectionCache?.view === view ? ordersCollectionCache?.rows ?? [] : [],
  )
  const [isLoading, setIsLoading] = useState(rows.length === 0)

  const fetchOrders = async () => {
    setIsLoading(rows.length === 0)

    try {
      const data = await orderApi.getOrders(view === 'all' ? undefined : { view })
      setRows(data)
    } catch (error) {
      console.error('Lỗi khi tải đơn hàng:', error)
      appToast.error('Không thể tải dữ liệu đơn hàng.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void fetchOrders()
  }, [view])

  useEffect(() => {
    ordersCollectionCache = {
      view,
      searchValue,
      filterValues: { ...filterValues, activeTab },
      page,
      pageSize,
      rows,
    }
  }, [activeTab, filterValues, page, pageSize, rows, searchValue, view])

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
          { label: 'Đặt hàng', value: 'placed' },
          { label: 'Xác nhận', value: 'confirmed' },
          { label: 'DVVC lấy hàng', value: 'picked_up' },
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

      const matchesPayment =
        !filterValues.payment_status || row.payment_status === filterValues.payment_status
      const matchesProcessing =
        !filterValues.processing_status || row.processing_status === filterValues.processing_status

      return matchesKeyword && matchesPayment && matchesProcessing && matchesTab(row, activeTab)
    })
  }, [activeTab, filterValues.payment_status, filterValues.processing_status, rows, searchValue])

  const pagedRows = useMemo(() => {
    const start = (page - 1) * pageSize
    return filteredRows.slice(start, start + pageSize)
  }, [filteredRows, page, pageSize])

  const columns = useMemo<ListColumn<OrderListItem>[]>(
    () => [
      {
        key: 'order_code',
        title: 'Mã DH',
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
              {row.customer_info.customer_code ?? 'Khách lẻ'} • {row.customer_info.phone}
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
      metaBar={
        <Alert severity="info" sx={{ borderRadius: 3 }}>
          `payment_status`: unpaid là chưa có giao dịch, deposit là đã thu cọc và còn công nợ,
          paid là đã thu đủ. `processing_status` phản ánh luồng xử lý từ đặt hàng tới hoàn
          thành hoặc trả hàng.
        </Alert>
      }
      columns={columns}
      rows={pagedRows}
      rowKey={(row) => String(row.id)}
      onRowClick={(row) => navigate(`/orders/${row.id}`)}
      loading={isLoading && rows.length === 0}
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


