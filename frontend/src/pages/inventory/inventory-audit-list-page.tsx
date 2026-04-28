import { useEffect, useMemo, useState } from 'react'
import { Box, Button, Chip, Stack, Typography } from '@mui/material'
import AddOutlinedIcon from '@mui/icons-material/AddOutlined'
import { useNavigate } from 'react-router'
import { CommonListLayout } from '@/shared/ui/list/common-list-layout'
import { ListEmptyState } from '@/shared/ui/list/list-empty-state'
import type { ListColumn, ListTabConfig } from '@/shared/ui/list/common-list.types'
import { inventoryApi, type InventoryAuditItem } from './inventory.api'
import { InventoryAuditListTableSkeleton } from './inventory-skeletons'

type InventoryAuditListPageCache = {
  activeTab: string
  searchValue: string
  page: number
  pageSize: number
  rows: InventoryAuditItem[]
}

let inventoryAuditListPageCache: InventoryAuditListPageCache | null = null

function formatDateTime(value: string | null) {
  if (!value) {
    return '-'
  }

  return new Date(value).toLocaleString('vi-VN')
}

function getStatusLabel(status: InventoryAuditItem['status']) {
  if (status === 'draft') {
    return 'Nháp'
  }

  return 'Hoàn thành'
}

function getStatusColor(status: InventoryAuditItem['status']): 'warning' | 'success' {
  if (status === 'draft') {
    return 'warning'
  }

  return 'success'
}

export function InventoryAuditListPage() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState(inventoryAuditListPageCache?.activeTab ?? 'all')
  const [searchValue, setSearchValue] = useState(inventoryAuditListPageCache?.searchValue ?? '')
  const [page, setPage] = useState(inventoryAuditListPageCache?.page ?? 1)
  const [pageSize, setPageSize] = useState(inventoryAuditListPageCache?.pageSize ?? 10)
  const [rows, setRows] = useState<InventoryAuditItem[]>(inventoryAuditListPageCache?.rows ?? [])
  const [isLoading, setIsLoading] = useState(inventoryAuditListPageCache === null)
  const [hasResolvedInitialLoad, setHasResolvedInitialLoad] = useState(inventoryAuditListPageCache !== null)

  useEffect(() => {
    const fetchAuditList = async () => {
      setIsLoading(inventoryAuditListPageCache === null)

      try {
        const data = await inventoryApi.getAuditList()
        setRows(data)
      } catch (error) {
        console.error('Lỗi khi tải lịch sử kiểm kho:', error)
      } finally {
        setIsLoading(false)
        setHasResolvedInitialLoad(true)
      }
    }

    void fetchAuditList()
  }, [])

  useEffect(() => {
    if (!hasResolvedInitialLoad) {
      return
    }

    inventoryAuditListPageCache = {
      activeTab,
      searchValue,
      page,
      pageSize,
      rows,
    }
  }, [activeTab, hasResolvedInitialLoad, page, pageSize, rows, searchValue])

  const tabs = useMemo<ListTabConfig[]>(
    () => [
      {
        label: 'Tất cả',
        value: 'all',
        count: rows.length,
      },
      {
        label: 'Nháp',
        value: 'draft',
        count: rows.filter((row) => row.status === 'draft').length,
      },
    ],
    [rows],
  )

  const filteredRows = useMemo(() => {
    const keyword = searchValue.trim().toLowerCase()

    return rows.filter((row) => {
      const matchesKeyword =
        !keyword ||
        row.audit_code.toLowerCase().includes(keyword) ||
        (row.account.name ?? '').toLowerCase().includes(keyword) ||
        (row.note ?? '').toLowerCase().includes(keyword)

      const matchesTab = activeTab === 'all' || (activeTab === 'draft' && row.status === 'draft')

      return matchesKeyword && matchesTab
    })
  }, [activeTab, rows, searchValue])

  const pagedRows = useMemo(() => {
    const start = (page - 1) * pageSize
    return filteredRows.slice(start, start + pageSize)
  }, [filteredRows, page, pageSize])

  const columns = useMemo<ListColumn<InventoryAuditItem>[]>(
    () => [
      {
        key: 'audit_code',
        title: 'Phiếu kiểm kho',
        width: 220,
        render: (row) => (
          <Box>
            <Typography sx={{ fontWeight: 700, color: '#101828' }}>{row.audit_code}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
              {row.account.name ?? 'Chưa có người lập phiếu'}
            </Typography>
          </Box>
        ),
      },
      {
        key: 'status',
        title: 'Trạng thái',
        width: 140,
        render: (row) => (
          <Chip
            size="small"
            label={getStatusLabel(row.status)}
            color={getStatusColor(row.status)}
            variant="outlined"
          />
        ),
      },
      {
        key: 'created_at',
        title: 'Ngày lập phiếu',
        width: 170,
        render: (row) => formatDateTime(row.created_at),
      },
      {
        key: 'updated_at',
        title: 'Ngày chỉnh sửa',
        width: 170,
        render: (row) => formatDateTime(row.updated_at),
      },
      {
        key: 'counted_at',
        title: 'Ngày kiểm',
        width: 170,
        render: (row) => formatDateTime(row.counted_at),
      },
      {
        key: 'lines',
        title: 'Số dòng',
        align: 'right',
        width: 100,
        render: (row) => row.summary.total_lines,
      },
      {
        key: 'counted_lines',
        title: 'Đã kiểm',
        align: 'right',
        width: 100,
        render: (row) => row.summary.counted_lines,
      },
      {
        key: 'adjusted_lines',
        title: 'Dòng lệch',
        align: 'right',
        width: 100,
        render: (row) => row.summary.adjusted_lines,
      },
      {
        key: 'delta',
        title: 'Tổng SL lệch',
        align: 'right',
        width: 120,
        render: (row) => row.summary.total_delta_qty.toLocaleString('vi-VN'),
      },
      {
        key: 'note',
        title: 'Ghi chú',
        width: 220,
        render: (row) => row.note ?? '-',
      },
    ],
    [],
  )

  const shouldShowInitialSkeleton = (!hasResolvedInitialLoad || isLoading) && rows.length === 0

  return (
    <CommonListLayout
      title="Lịch sử kiểm kho"
      description="Theo dõi các phiếu kiểm kho đã hoàn thành và các phiếu còn đang lưu nháp."
      headerActions={
        <Button
          variant="contained"
          color="secondary"
          startIcon={<AddOutlinedIcon />}
          onClick={() => navigate('/inventory/audit/create')}
        >
          Tạo mới
        </Button>
      }
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={(value) => {
        setActiveTab(value)
        setPage(1)
      }}
      searchValue={searchValue}
      searchPlaceholder="Tìm theo mã kiểm, người lập hoặc ghi chú"
      onSearchChange={(value) => {
        setSearchValue(value)
        setPage(1)
      }}
      toolbarActions={
        <Button
          variant="text"
          onClick={() => {
            setSearchValue('')
            setActiveTab('all')
            setPage(1)
          }}
        >
          Đặt lại
        </Button>
      }
      columns={columns}
      rows={pagedRows}
      rowKey={(row) => String(row.id)}
      onRowClick={(row) => navigate(`/inventory/audit/${row.id}/edit`)}
      loading={shouldShowInitialSkeleton}
      loadingState={<InventoryAuditListTableSkeleton />}
      emptyState={
        <ListEmptyState
          title="Chưa có phiếu kiểm kho phù hợp"
          description="Hãy tạo phiếu mới hoặc đổi tab để xem các phiếu đang lưu nháp."
          action={
            <Button variant="contained" onClick={() => navigate('/inventory/audit/create')}>
              Tạo phiếu kiểm kho
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
      metaBar={
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <Typography variant="body2" color="text.secondary">
            Hoàn thành: <strong>{rows.filter((row) => row.status === 'completed').length}</strong>
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Nháp: <strong>{rows.filter((row) => row.status === 'draft').length}</strong>
          </Typography>
        </Stack>
      }
    />
  )
}
