import { useMemo, useState } from 'react'
import {
  Box,
  Button,
  Chip,
  Link,
  Paper,
  Stack,
  Typography,
  alpha,
} from '@mui/material'
import { CommonListLayout } from '@/shared/ui/list/common-list-layout'
import { ListEmptyState } from '@/shared/ui/list/list-empty-state'
import type { ListColumn, ListFilterConfig, ListTabConfig } from '@/shared/ui/list/common-list.types'
import { categoryLabelMap, mockProducts, type ProductListItem } from '@/pages/products/product-list.data'

type ProductStatus = 'Đang bán' | 'Sắp hết' | 'Hết hàng'

const productTabs: ListTabConfig[] = [
  { label: 'Tất cả', value: 'all' },
  { label: 'Đang bán', value: 'active' },
  { label: 'Sắp hết', value: 'low-stock' },
  { label: 'Hết hàng', value: 'out-of-stock' },
]

const productFilters: ListFilterConfig[] = [
  {
    key: 'category',
    label: 'Danh mục',
    placeholder: 'Tất cả danh mục',
    options: [
      { label: 'Phụ kiện', value: 'Phụ kiện' },
      { label: 'Thời trang nam', value: 'Thời trang nam' },
      { label: 'Thời trang nữ', value: 'Thời trang nữ' },
    ],
  },
  {
    key: 'status',
    label: 'Trạng thái',
    placeholder: 'Tất cả trạng thái',
    options: [
      { label: 'Đang bán', value: 'Đang bán' },
      { label: 'Sắp hết', value: 'Sắp hết' },
      { label: 'Hết hàng', value: 'Hết hàng' },
    ],
  },
]

function getStatusColor(status: ProductStatus): 'success' | 'warning' | 'error' {
  if (status === 'Đang bán') {
    return 'success'
  }

  if (status === 'Sắp hết') {
    return 'warning'
  }

  return 'error'
}

function matchesTab(row: ProductListItem, activeTab: string) {
  if (activeTab === 'active') {
    return row.status === 'Đang bán'
  }

  if (activeTab === 'low-stock') {
    return row.status === 'Sắp hết'
  }

  if (activeTab === 'out-of-stock') {
    return row.status === 'Hết hàng'
  }

  return true
}

function formatCurrency(value: string) {
  return `${Number(value).toLocaleString('vi-VN')} đ`
}

function getCategoryLabel(categoryId: number | null) {
  if (!categoryId) {
    return '-'
  }

  return categoryLabelMap[categoryId] ?? `Danh mục #${categoryId}`
}

function getProductPriceLabel(product: ProductListItem) {
  if (product.variants.length === 0) {
    return '-'
  }

  const prices = product.variants.map((variant) => Number(variant.selling_price)).sort((a, b) => a - b)
  const minPrice = prices[0]
  const maxPrice = prices[prices.length - 1]

  if (minPrice === maxPrice) {
    return formatCurrency(String(minPrice))
  }

  return `${formatCurrency(String(minPrice))} - ${formatCurrency(String(maxPrice))}`
}

export function ProductListPage() {
  const [activeTab, setActiveTab] = useState('all')
  const [searchValue, setSearchValue] = useState('')
  const [filterValues, setFilterValues] = useState<Record<string, string>>({
    category: '',
    status: '',
  })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const tabCounts = useMemo(
    () => ({
      all: mockProducts.length,
      active: mockProducts.filter((item) => item.status === 'Đang bán').length,
      'low-stock': mockProducts.filter((item) => item.status === 'Sắp hết').length,
      'out-of-stock': mockProducts.filter((item) => item.status === 'Hết hàng').length,
    }),
    [],
  )

  const tabs = useMemo(
    () =>
      productTabs.map((tab) => ({
        ...tab,
        count: tabCounts[tab.value as keyof typeof tabCounts],
      })),
    [tabCounts],
  )

  const filteredRows = useMemo(() => {
    const keyword = searchValue.trim().toLowerCase()

    return mockProducts.filter((row) => {
      const matchesKeyword =
        keyword.length === 0 ||
        row.product_name.toLowerCase().includes(keyword) ||
        row.sku?.toLowerCase().includes(keyword) ||
        row.variants.some((variant) => variant.sku.toLowerCase().includes(keyword))

      const matchesCategory = !filterValues.category || getCategoryLabel(row.category_id) === filterValues.category
      const matchesStatus = !filterValues.status || row.status === filterValues.status

      return matchesKeyword && matchesCategory && matchesStatus && matchesTab(row, activeTab)
    })
  }, [activeTab, filterValues.category, filterValues.status, searchValue])

  const pagedRows = useMemo(() => {
    const start = (page - 1) * pageSize
    return filteredRows.slice(start, start + pageSize)
  }, [filteredRows, page, pageSize])

  const columns = useMemo<ListColumn<ProductListItem>[]>(
    () => [
      {
        key: 'name',
        title: 'Sản phẩm',
        render: (row) => (
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', minWidth: 280 }}>
            <Box
              component="img"
              src={row.image_url ?? row.variants[0]?.image_url ?? 'https://placehold.co/80x80?text=SP'}
              alt={row.product_name}
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
              <Typography sx={{ fontWeight: 600 }}>{row.product_name}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                {row.variants.length} phiên bản
              </Typography>
            </Box>
          </Stack>
        ),
      },
      {
        key: 'sku',
        title: 'SKU',
        render: (row) => row.sku ?? row.variants[0]?.sku ?? '-',
      },
      {
        key: 'category',
        title: 'Danh mục',
        render: (row) => getCategoryLabel(row.category_id),
      },
      {
        key: 'variants',
        title: 'Biến thể',
        align: 'right',
        render: (row) => row.variants.length,
      },
      {
        key: 'price',
        title: 'Giá bán',
        align: 'right',
        render: (row) => getProductPriceLabel(row),
      },
      {
        key: 'status',
        title: 'Trạng thái',
        render: (row) => (
          <Chip
            size="small"
            label={row.status ?? 'Chưa cập nhật'}
            color={getStatusColor((row.status ?? 'Hết hàng') as ProductStatus)}
            variant="outlined"
          />
        ),
      },
    ],
    [],
  )

  const handleFilterChange = (key: string, value: string) => {
    setPage(1)
    setFilterValues((current) => ({
      ...current,
      [key]: value,
    }))
  }

  return (
    <CommonListLayout
      title="Danh sách sản phẩm"
      headerActions={
        <>
          <Button variant="outlined">Xuất file</Button>
          <Button variant="outlined">Nhập file</Button>
          <Button variant="contained" color="secondary">
            Thêm sản phẩm
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
      searchPlaceholder="Tìm theo tên sản phẩm hoặc SKU"
      onSearchChange={(value) => {
        setSearchValue(value)
        setPage(1)
      }}
      filters={productFilters}
      filterValues={filterValues}
      onFilterChange={handleFilterChange}
      toolbarActions={
        <Button
          variant="text"
          onClick={() => {
            setSearchValue('')
            setFilterValues({ category: '', status: '' })
            setPage(1)
          }}
        >
          Đặt lại
        </Button>
      }
      columns={columns}
      rows={pagedRows}
      rowKey={(row) => String(row.product_id)}
      emptyState={
        <ListEmptyState
          title="Không tìm thấy sản phẩm phù hợp"
          description="Thử đổi từ khóa tìm kiếm hoặc xóa bớt bộ lọc để xem lại toàn bộ danh sách."
          action={
            <Button
              variant="contained"
              onClick={() => {
                setSearchValue('')
                setFilterValues({ category: '', status: '' })
                setActiveTab('all')
                setPage(1)
              }}
            >
              Xem tất cả sản phẩm
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
        pageSizeOptions: [5, 10, 20],
      }}
      helper={
        <Paper
          sx={{
            p: 2.5,
            borderRadius: 5,
            border: (theme) => `1px solid ${alpha(theme.palette.info.main, 0.12)}`,
            bgcolor: (theme) => alpha(theme.palette.info.light, 0.08),
          }}
        >
          <Typography sx={{ fontWeight: 700 }}>Gợi ý triển khai tiếp</Typography>
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            Bộ `productSkeleton` và `mockProducts` đang bám theo format response của backend để bạn thay sang API
            thật mà không cần sửa nhiều ở list view.
          </Typography>
          <Link href="#" underline="hover" sx={{ display: 'inline-block', mt: 1.5 }}>
            Xem hướng dẫn tích hợp common list
          </Link>
        </Paper>
      }
    />
  )
}
