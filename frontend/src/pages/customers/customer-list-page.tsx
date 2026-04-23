import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, Chip, Paper, Stack, Typography, alpha } from '@mui/material'
import SyncOutlinedIcon from '@mui/icons-material/SyncOutlined'
import AddOutlinedIcon from '@mui/icons-material/AddOutlined'
import { Link as RouterLink, useNavigate } from 'react-router'
import { CommonListLayout } from '@/shared/ui/list/common-list-layout'
import { ListEmptyState } from '@/shared/ui/list/list-empty-state'
import type { ListColumn, ListFilterConfig, ListTabConfig } from '@/shared/ui/list/common-list.types'
import { customerApi, type CustomerCategory, type CustomerListItem } from './customer.api'
import { appToast } from '@/shared/ui/toast/toast.helpers'

type CustomerStatus = 'active' | 'inactive' | 'soft_deleted' | 'deleted'

type CustomerListPageCache = {
  activeTab: string
  searchValue: string
  filterValues: Record<string, string>
  page: number
  pageSize: number
  rows: CustomerListItem[]
  categories: CustomerCategory[]
}

let customerListPageCache: CustomerListPageCache | null = null

const customerTabs: ListTabConfig[] = [
  { label: 'Tất cả', value: 'all' },
  { label: 'Đang hoạt động', value: 'active' },
  { label: 'Ngưng hoạt động', value: 'inactive' },
]

function getStatusColor(status: CustomerStatus): 'success' | 'warning' | 'error' {
  if (status === 'active') {
    return 'success'
  }

  if (status === 'inactive') {
    return 'warning'
  }

  return 'error'
}

function getStatusLabel(status: CustomerStatus) {
  if (status === 'active') {
    return 'Đang hoạt động'
  }

  if (status === 'inactive') {
    return 'Ngưng hoạt động'
  }

  return 'Đã xóa'
}

function formatLastPurchase(value: string | null) {
  if (!value) {
    return '-'
  }

  return new Date(value).toLocaleString('vi-VN')
}

function matchesTab(row: CustomerListItem, activeTab: string) {
  if (activeTab === 'all') {
    return true
  }

  return row.status === activeTab
}

export function CustomerListPage() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState(customerListPageCache?.activeTab ?? 'all')
  const [searchValue, setSearchValue] = useState(customerListPageCache?.searchValue ?? '')
  const [filterValues, setFilterValues] = useState<Record<string, string>>(
    customerListPageCache?.filterValues ?? {
      customer_category_id: '',
    },
  )
  const [page, setPage] = useState(customerListPageCache?.page ?? 1)
  const [pageSize, setPageSize] = useState(customerListPageCache?.pageSize ?? 10)
  const [rows, setRows] = useState<CustomerListItem[]>(customerListPageCache?.rows ?? [])
  const [categories, setCategories] = useState<CustomerCategory[]>(customerListPageCache?.categories ?? [])
  const [isLoading, setIsLoading] = useState(customerListPageCache === null)
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([])
  const [isDeleting, setIsDeleting] = useState(false)

  const fetchCustomers = useCallback(async () => {
    setIsLoading(customerListPageCache === null)

    try {
      const [customerData, categoryData] = await Promise.all([
        customerApi.getCustomers(),
        customerApi.getCustomerCategories(),
      ])

      setRows(customerData)
      setCategories(categoryData)
    } catch (error) {
      console.error('Lỗi khi tải danh sách khách hàng:', error)
      appToast.error('Không thể tải danh sách khách hàng.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchCustomers()
  }, [fetchCustomers])

  useEffect(() => {
    customerListPageCache = {
      activeTab,
      searchValue,
      filterValues,
      page,
      pageSize,
      rows,
      categories,
    }
  }, [activeTab, categories, filterValues, page, pageSize, rows, searchValue])

  const filters = useMemo<ListFilterConfig[]>(
    () => [
      {
        key: 'customer_category_id',
        label: 'Nhóm khách hàng',
        placeholder: 'Tất cả nhóm khách hàng',
        options: categories.map((category) => ({
          label: category.category_name,
          value: String(category.id),
        })),
      },
    ],
    [categories],
  )

  const tabs = useMemo(
    () =>
      customerTabs.map((tab) => ({
        ...tab,
        count: tab.value === 'all' ? rows.length : rows.filter((row) => row.status === tab.value).length,
      })),
    [rows],
  )

  const filteredRows = useMemo(() => {
    const keyword = searchValue.trim().toLowerCase()

    return rows.filter((row) => {
      const matchesKeyword =
        keyword.length === 0 ||
        row.client_code.toLowerCase().includes(keyword) ||
        row.full_name.toLowerCase().includes(keyword) ||
        (row.phone ?? '').toLowerCase().includes(keyword) ||
        (row.email ?? '').toLowerCase().includes(keyword) ||
        (row.tax_code ?? '').toLowerCase().includes(keyword)

      const matchesCategory =
        !filterValues.customer_category_id ||
        String(row.customer_category_id ?? '') === filterValues.customer_category_id

      return matchesKeyword && matchesCategory && matchesTab(row, activeTab) && row.status !== 'deleted' && row.status !== 'soft_deleted'
    })
  }, [activeTab, filterValues.customer_category_id, rows, searchValue])

  const pagedRows = useMemo(() => {
    const start = (page - 1) * pageSize
    return filteredRows.slice(start, start + pageSize)
  }, [filteredRows, page, pageSize])

  const handleDeleteSelected = async () => {
    const idsToDelete = selectedCustomerIds
      .map((id) => Number(id))
      .filter((id) => Number.isInteger(id) && id > 0)

    if (idsToDelete.length === 0 || isDeleting) {
      return
    }

    setIsDeleting(true)

    try {
      const result = await customerApi.deleteCustomers(idsToDelete)
      setRows((current) => current.filter((row) => !result.deleted_ids.includes(row.id)))
      setSelectedCustomerIds([])
      appToast.success(
        result.deleted_ids.length > 0
          ? `Đã xóa mềm ${result.deleted_ids.length} khách hàng.`
          : 'Đã xử lý khách hàng đã chọn.',
      )
    } catch (error) {
      console.error('Lỗi khi xóa khách hàng:', error)
      appToast.error('Không thể xóa khách hàng. Vui lòng thử lại.')
    } finally {
      setIsDeleting(false)
    }
  }

  const columns = useMemo<ListColumn<CustomerListItem>[]>(
    () => [
      {
        key: 'client_code',
        title: 'Mã khách hàng',
        render: (row) => row.client_code,
      },
      {
        key: 'full_name',
        title: 'Tên khách hàng',
        render: (row) => (
          <Stack spacing={0.5} sx={{ minWidth: 220 }}>
            <Typography sx={{ fontWeight: 600, color: '#0f172a' }}>{row.full_name}</Typography>
            <Chip
              size="small"
              label={getStatusLabel(row.status as CustomerStatus)}
              color={getStatusColor(row.status as CustomerStatus)}
              variant="outlined"
              sx={{ width: 'fit-content' }}
            />
          </Stack>
        ),
      },
      {
        key: 'phone',
        title: 'Số điện thoại',
        render: (row) => row.phone ?? '-',
      },
      {
        key: 'customer_category',
        title: 'Nhóm khách hàng',
        render: (row) => row.customer_category?.category_name ?? '-',
      },
      {
        key: 'last_purchased_at',
        title: 'Lần mua cuối',
        render: (row) => formatLastPurchase(row.last_purchased_at),
      },
    ],
    [],
  )

  return (
    <CommonListLayout
      title="Khách hàng"
      description="Danh sách khách hàng tập trung để tra cứu nhanh thông tin liên hệ, nhóm khách hàng và chuẩn bị nối dữ liệu mua hàng về sau."
      headerActions={
        <>
          <Button variant="outlined" startIcon={<SyncOutlinedIcon />} onClick={() => void fetchCustomers()}>
            Làm mới
          </Button>
          <Button component={RouterLink} to="/customers/create" variant="contained" color="secondary" startIcon={<AddOutlinedIcon />}>
            Thêm khách hàng
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
      searchPlaceholder="Tìm theo tên khách hàng, mã khách hàng hoặc số điện thoại"
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
            setFilterValues({ customer_category_id: '' })
            setPage(1)
          }}
        >
          Đặt lại
        </Button>
      }
      bulkDelete={{
        enabled: true,
        selectedCount: selectedCustomerIds.length,
        onDelete: handleDeleteSelected,
        selectionLabel: `Đã chọn ${selectedCustomerIds.length} khách hàng`,
        description: isDeleting
          ? 'Đang xử lý khách hàng đã chọn...'
          : 'Xóa mềm sẽ ẩn khách hàng khỏi danh sách hiện tại nhưng vẫn giữ dữ liệu để đối soát và nối với đơn hàng sau này.',
        buttonLabel: isDeleting ? 'Đang xử lý...' : 'Xóa mềm khách hàng',
      }}
      columns={columns}
      rows={pagedRows}
      rowKey={(row) => String(row.id)}
      rowSelection={{
        selectedRowKeys: selectedCustomerIds,
        onSelectedRowKeysChange: setSelectedCustomerIds,
        getRowLabel: (row) => row.full_name,
      }}
      onRowClick={(row) => navigate(`/customers/${row.id}`)}
      loading={isLoading && rows.length === 0}
      emptyState={
        <ListEmptyState
          title="Không tìm thấy khách hàng phù hợp"
          description="Thử đổi từ khóa tìm kiếm hoặc xóa bộ lọc để xem lại toàn bộ danh sách khách hàng."
          action={
            <Button
              variant="contained"
              onClick={() => {
                setActiveTab('all')
                setSearchValue('')
                setFilterValues({ customer_category_id: '' })
                setPage(1)
              }}
            >
              Xem tất cả khách hàng
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
          <Typography sx={{ fontWeight: 700 }}>Ghi chú triển khai</Typography>
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            Cột lần mua cuối hiện lấy từ đơn hàng gần nhất nếu đã có dữ liệu. Khi module đơn hàng hoàn thiện hơn,
            phần này có thể mở rộng thêm tổng số đơn, doanh thu và phân tầng khách hàng mà không cần đổi layout list page.
          </Typography>
        </Paper>
      }
    />
  )
}
