import { useCallback, useEffect, useMemo, useState } from 'react'
import { Box, Button, Paper, Stack, Typography, alpha } from '@mui/material'
import SyncOutlinedIcon from '@mui/icons-material/SyncOutlined'
import { useNavigate } from 'react-router'
import { CommonListLayout } from '@/shared/ui/list/common-list-layout'
import { ListEmptyState } from '@/shared/ui/list/list-empty-state'
import type { ListColumn, ListTabConfig } from '@/shared/ui/list/common-list.types'
import { inventoryApi, type InventoryStockListItem } from './inventory.api'

type InventoryStockPageCache = {
  activeTab: string
  searchValue: string
  page: number
  pageSize: number
  rows: InventoryStockListItem[]
}

let inventoryStockPageCache: InventoryStockPageCache | null = null

function formatCurrency(value: string) {
  return `${Number(value).toLocaleString('vi-VN')} đ`
}

function formatNumber(value: number) {
  return value.toLocaleString('vi-VN')
}

export function InventoryStockPage() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState(inventoryStockPageCache?.activeTab ?? 'all')
  const [searchValue, setSearchValue] = useState(inventoryStockPageCache?.searchValue ?? '')
  const [page, setPage] = useState(inventoryStockPageCache?.page ?? 1)
  const [pageSize, setPageSize] = useState(inventoryStockPageCache?.pageSize ?? 10)
  const [rows, setRows] = useState<InventoryStockListItem[]>(inventoryStockPageCache?.rows ?? [])
  const [isLoading, setIsLoading] = useState(inventoryStockPageCache === null)

  const fetchStockList = useCallback(async () => {
    setIsLoading(inventoryStockPageCache === null)

    try {
      const data = await inventoryApi.getStockList()
      setRows(data)
    } catch (error) {
      console.error('Loi khi tai danh sach ton kho:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchStockList()
  }, [fetchStockList])

  useEffect(() => {
    inventoryStockPageCache = {
      activeTab,
      searchValue,
      page,
      pageSize,
      rows,
    }
  }, [activeTab, page, pageSize, rows, searchValue])

  const tabs = useMemo<ListTabConfig[]>(() => {
    const inStockCount = rows.filter((row) => row.on_hand > 0).length
    const outOfStockCount = rows.filter((row) => row.on_hand === 0).length

    return [
      { label: 'Tất cả', value: 'all', count: rows.length },
      { label: 'Còn hàng', value: 'in-stock', count: inStockCount },
      { label: 'Hết hàng', value: 'out-of-stock', count: outOfStockCount },
    ]
  }, [rows])

  const filteredRows = useMemo(() => {
    const keyword = searchValue.trim().toLowerCase()

    return rows.filter((row) => {
      if (row.product_status === 'deleted') {
        return false
      }

      const matchesKeyword =
        !keyword ||
        row.display_name.toLowerCase().includes(keyword) ||
        row.product_name.toLowerCase().includes(keyword) ||
        row.sku.toLowerCase().includes(keyword)

      const matchesTab =
        activeTab === 'all' ||
        (activeTab === 'in-stock' && row.on_hand > 0) ||
        (activeTab === 'out-of-stock' && row.on_hand === 0)

      return matchesKeyword && matchesTab
    })
  }, [activeTab, rows, searchValue])

  const pagedRows = useMemo(() => {
    const start = (page - 1) * pageSize
    return filteredRows.slice(start, start + pageSize)
  }, [filteredRows, page, pageSize])

  const columns = useMemo<ListColumn<InventoryStockListItem>[]>(
    () => [
      {
        key: 'product',
        title: 'Sản phẩm',
        width: 320,
        render: (row) => (
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', minWidth: 280 }}>
            <Box
              component="img"
              src={row.image_url ?? 'https://placehold.co/80x80?text=SP'}
              alt={row.display_name}
              sx={{
                width: 52,
                height: 52,
                borderRadius: 2,
                objectFit: 'cover',
                flexShrink: 0,
                bgcolor: alpha('#132238', 0.06),
              }}
            />
            <Box>
              <Typography sx={{ fontWeight: 600, color: '#0f172a' }}>{row.display_name}</Typography>
            </Box>
          </Stack>
        ),
      },
      {
        key: 'sku',
        title: 'SKU',
        width: 160,
        render: (row) => row.sku,
      },
      {
        key: 'unit',
        title: 'Đơn vị tính',
        width: 120,
        render: (row) => row.unit ?? '-',
      },
      {
        key: 'on_hand',
        title: 'Tồn kho',
        align: 'right',
        width: 110,
        render: (row) => formatNumber(row.on_hand),
      },
      {
        key: 'available',
        title: 'Có thể bán',
        align: 'right',
        width: 120,
        render: (row) => formatNumber(row.available),
      },
      {
        key: 'committed',
        title: 'Đang giao dịch',
        align: 'right',
        width: 130,
        render: (row) => formatNumber(row.committed),
      },
      {
        key: 'packing',
        title: 'Đang đóng gói',
        align: 'right',
        width: 130,
        render: (row) => formatNumber(row.packing),
      },
      {
        key: 'incoming',
        title: 'Đang về kho',
        align: 'right',
        width: 120,
        render: (row) => formatNumber(row.incoming),
      },
      {
        key: 'selling_price',
        title: 'Giá bán',
        align: 'right',
        width: 140,
        render: (row) => formatCurrency(row.selling_price),
      },
    ],
    [],
  )

  return (
    <CommonListLayout
      title="Tồn kho"
      description="Danh sách SKU đang được quản lý tồn kho theo từng sản phẩm đơn hoặc từng biến thể."
      headerActions={
        <Button variant="outlined" startIcon={<SyncOutlinedIcon />} onClick={() => void fetchStockList()}>
          Làm mới
        </Button>
      }
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={(value) => {
        setActiveTab(value)
        setPage(1)
      }}
      searchValue={searchValue}
      searchPlaceholder="Tìm theo tên sản phẩm hoặc SKU"
      onSearchChange={(value) => {
        setSearchValue(value)
        setPage(1)
      }}
      toolbarActions={
        <Button
          variant="text"
          onClick={() => {
            setActiveTab('all')
            setSearchValue('')
            setPage(1)
          }}
        >
          Đặt lại
        </Button>
      }
      columns={columns}
      rows={pagedRows}
      rowKey={(row) => row.product_variant_id}
      onRowClick={(row) =>
        navigate(`/inventory/stock/${row.product_variant_id}/history`, {
          state: {
            stockItem: row,
          },
        })
      }
      loading={isLoading && rows.length === 0}
      emptyState={
        <ListEmptyState
          title="Chưa có dữ liệu tồn kho"
          description="Hãy khởi tạo tồn kho cho SKU đầu tiên hoặc chạy seed mẫu để xem danh sách."
          action={
            <Button variant="contained" onClick={() => void fetchStockList()}>
              Tải lại
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
            border: (theme) => `1px solid ${alpha(theme.palette.secondary.main, 0.12)}`,
            background: 'linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)',
          }}
        >
          <Typography sx={{ fontWeight: 700 }}>Gợi ý dữ liệu đang hiển thị</Typography>
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            Mỗi dòng là một SKU thực tế để bán: với sản phẩm không có biến thể thì hiển thị một dòng sản phẩm đơn,
            còn sản phẩm có biến thể sẽ hiển thị theo từng biến thể riêng.
          </Typography>
        </Paper>
      }
    />
  )
}
