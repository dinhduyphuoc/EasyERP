import { useEffect, useMemo, useState } from 'react'
import { Box, Button, Chip, Stack, Typography, alpha } from '@mui/material'
import { Link as RouterLink, useNavigate } from 'react-router'
import { CommonListLayout } from '@/shared/ui/list/common-list-layout'
import { ListEmptyState } from '@/shared/ui/list/list-empty-state'
import type { ListColumn, ListFilterConfig, ListTabConfig } from '@/shared/ui/list/common-list.types'
import type { ProductListItem } from '@/pages/products/product-list.data'
import { useStore } from '@/modules/store/use-store'
import { productApi, type ProductCategory } from '@/pages/products/product.api'
import { ProductListTableSkeleton } from '@/pages/products/product-skeletons'
import { appToast } from '@/shared/ui/toast/toast.helpers'
import { formatCurrency as sharedFormatCurrency } from '@/shared/utils/currency'

type ProductStatus = 'active' | 'inactive' | 'draft' | 'deleted'

type ProductListPageCache = {
  storeId: string | null
  activeTab: string
  searchValue: string
  filterValues: Record<string, string>
  page: number
  pageSize: number
  products: ProductListItem[]
  categories: ProductCategory[]
}

let productListPageCache: ProductListPageCache | null = null

const productTabs: ListTabConfig[] = [
  { label: 'Tất cả', value: 'all' },
  { label: 'Đang bán', value: 'active' },
  { label: 'Ngừng bán', value: 'inactive' },
  { label: 'Nháp', value: 'draft' },
]

const productStatusFilter: ListFilterConfig = {
  key: 'status',
  label: 'Trạng thái',
  placeholder: 'Tất cả trạng thái',
  options: [
    { label: 'Đang bán', value: 'active' },
    { label: 'Ngừng bán', value: 'inactive' },
    { label: 'Nháp', value: 'draft' },
  ],
}

function getStatusColor(status: ProductStatus): 'success' | 'warning' | 'error' {
  if (status === 'active') {
    return 'success'
  }

  if (status === 'draft') {
    return 'warning'
  }

  return 'error'
}

function getStatusLabel(status: ProductStatus) {
  if (status === 'active') {
    return 'Đang bán'
  }

  if (status === 'inactive') {
    return 'Ngừng bán'
  }

  if (status === 'deleted') {
    return 'Đã xóa'
  }

  return 'Nháp'
}

function matchesTab(row: ProductListItem, activeTab: string) {
  if (activeTab === 'all') {
    return true
  }

  return (row.status ?? 'draft') === activeTab
}

function formatCurrency(value: string) {
  return sharedFormatCurrency(value)
}

function getCategoryLabel(categoryId: number | null, categoryLabelMap: Record<number, string>) {
  if (!categoryId) {
    return '-'
  }

  return categoryLabelMap[categoryId] ?? `Danh mục #${categoryId}`
}

function getProductPriceLabel(product: ProductListItem) {
  if (product.variants.length === 0) {
    return product.base_price ? formatCurrency(product.base_price) : '-'
  }

  const prices = product.variants.map((variant) => Number(variant.selling_price)).sort((a, b) => a - b)
  const minPrice = prices[0]
  const maxPrice = prices[prices.length - 1]

  if (minPrice === maxPrice) {
    return formatCurrency(String(minPrice))
  }

  return `${formatCurrency(String(minPrice))} - ${formatCurrency(String(maxPrice))}`
}

function getProductStructureMeta(product: ProductListItem) {
  const generatedVariants = product.variants.filter((variant) => variant.kind === 'generated')

  if (generatedVariants.length === 0) {
    return {
      label: 'Biến thể mặc định',
      color: 'info' as const,
    }
  }

  return {
    label: `${generatedVariants.length} biến thể`,
    color: 'success' as const,
  }
}

export function ProductListPage() {
  const navigate = useNavigate()
  const { activeStore, isReady } = useStore()
  const cachedState = activeStore && productListPageCache?.storeId === activeStore.id ? productListPageCache : null
  const [activeTab, setActiveTab] = useState(cachedState?.activeTab ?? 'all')
  const [searchValue, setSearchValue] = useState(cachedState?.searchValue ?? '')
  const [filterValues, setFilterValues] = useState<Record<string, string>>(
    cachedState?.filterValues ?? {
      category: '',
      status: '',
    },
  )
  const [page, setPage] = useState(cachedState?.page ?? 1)
  const [pageSize, setPageSize] = useState(cachedState?.pageSize ?? 10)
  const [products, setProducts] = useState<ProductListItem[]>(cachedState?.products ?? [])
  const [categories, setCategories] = useState<ProductCategory[]>(cachedState?.categories ?? [])
  const [isLoading, setIsLoading] = useState(cachedState === null)
  const [hasResolvedInitialLoad, setHasResolvedInitialLoad] = useState(cachedState !== null)
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([])
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    if (!isReady) {
      return
    }

    if (!activeStore) {
      setHasResolvedInitialLoad(true)
      return
    }

    const nextCachedState = productListPageCache?.storeId === activeStore.id ? productListPageCache : null
    setHasResolvedInitialLoad(nextCachedState !== null)

    if (!nextCachedState) {
      setProducts([])
      setCategories([])
      setSelectedProductIds([])
      return
    }

    setActiveTab(nextCachedState.activeTab)
    setSearchValue(nextCachedState.searchValue)
    setFilterValues(nextCachedState.filterValues)
    setPage(nextCachedState.page)
    setPageSize(nextCachedState.pageSize)
    setProducts(nextCachedState.products)
    setCategories(nextCachedState.categories)
    setSelectedProductIds([])
  }, [activeStore, isReady])

  useEffect(() => {
    const fetchProducts = async () => {
      if (!isReady) {
        return
      }

      if (!activeStore) {
        setProducts([])
        setCategories([])
        setIsLoading(false)
        setHasResolvedInitialLoad(true)
        return
      }

      const hasCachedDataForStore = productListPageCache?.storeId === activeStore.id
      setIsLoading(!hasCachedDataForStore)
      try {
        const [productResult, categoryResult] = await Promise.allSettled([
          productApi.getProducts(),
          productApi.getProductCategories(),
        ])
        if (productResult.status === 'fulfilled') {
          setProducts(productResult.value)
        } else {
          setProducts([])
          console.error('Lỗi khi tải danh sách sản phẩm:', productResult.reason)
          appToast.error(`Không thể tải danh sách sản phẩm cho cửa hàng ${activeStore.name}.`)
        }
        if (categoryResult.status === 'fulfilled') {
          setCategories(categoryResult.value)
        } else {
          setCategories([])
          console.error('Lỗi khi tải danh mục sản phẩm:', categoryResult.reason)
          appToast.warning(`Không thể tải danh mục của cửa hàng ${activeStore.name}.`)
        }
      } catch (error) {
        console.error('Lỗi khi tải danh sách sản phẩm:', error)
      } finally {
        setIsLoading(false)
        setHasResolvedInitialLoad(true)
      }
    }

    void fetchProducts()
  }, [activeStore, isReady])

  useEffect(() => {
    if (!isReady || !activeStore || !hasResolvedInitialLoad) {
      return
    }

    productListPageCache = {
      storeId: activeStore.id,
      activeTab,
      searchValue,
      filterValues,
      page,
      pageSize,
      products,
      categories,
    }
  }, [activeStore, activeTab, categories, filterValues, hasResolvedInitialLoad, isReady, page, pageSize, products, searchValue])

  const categoryLabelMap = useMemo(
    () =>
      Object.fromEntries(categories.map((category) => [category.id, category.category_name])) as Record<number, string>,
    [categories],
  )

  const productFilters = useMemo<ListFilterConfig[]>(
    () => [
      {
        key: 'category',
        label: 'Danh mục',
        placeholder: 'Tất cả danh mục',
        options: categories.map((category) => ({
          label: category.category_name,
          value: category.category_name,
        })),
      },
      productStatusFilter,
    ],
    [categories],
  )

  const tabs = useMemo(
    () =>
      productTabs.map((tab) => {
        let count = 0
        if (tab.value === 'all') {
          count = products.length
        } else {
          count = products.filter((row) => (row.status ?? 'draft') === tab.value).length
        }

        return {
          ...tab,
          count,
        }
      }),
    [products],
  )

  const filteredRows = useMemo(() => {
    const keyword = searchValue.trim().toLowerCase()

    return products.filter((row) => {
      const matchesKeyword =
        keyword.length === 0 ||
        row.product_name.toLowerCase().includes(keyword) ||
        row.default_variant_sku?.toLowerCase().includes(keyword) ||
        row.variants.some((variant) => variant.sku.toLowerCase().includes(keyword))

      const matchesCategory =
        !filterValues.category || getCategoryLabel(row.category_id, categoryLabelMap) === filterValues.category
      const matchesStatus = !filterValues.status || row.status === filterValues.status

      return matchesKeyword && matchesCategory && matchesStatus && matchesTab(row, activeTab)
    })
  }, [activeTab, categoryLabelMap, filterValues.category, filterValues.status, products, searchValue])

  const pagedRows = useMemo(() => {
    const start = (page - 1) * pageSize
    return filteredRows.slice(start, start + pageSize)
  }, [filteredRows, page, pageSize])

  const handleDeleteSelected = async () => {
    const idsToDelete = selectedProductIds
      .map((id) => Number(id))
      .filter((id) => Number.isInteger(id) && id > 0)

    if (idsToDelete.length === 0 || isDeleting) {
      return
    }

    setIsDeleting(true)
    try {
      const result = await productApi.deleteProducts(idsToDelete)
      setProducts((current) => current.filter((row) => !result.deleted_ids.includes(row.id)))
      setSelectedProductIds([])
      appToast.success(
        result.deleted_ids.length > 0
          ? `Đã chuyển ${result.deleted_ids.length} sản phẩm sang trạng thái đã xóa.`
          : 'Đã xử lý sản phẩm đã chọn.',
      )
    } catch (error) {
      console.error('Lỗi khi xóa sản phẩm:', error)
      const message =
        typeof error === 'object' &&
        error !== null &&
        'response' in error &&
        typeof error.response === 'object' &&
        error.response !== null &&
        'data' in error.response &&
        typeof error.response.data === 'object' &&
        error.response.data !== null &&
        'message' in error.response.data &&
        typeof error.response.data.message === 'string'
          ? error.response.data.message
          : 'Không thể xóa sản phẩm. Vui lòng thử lại!'

      appToast.error(message)
    } finally {
      setIsDeleting(false)
    }
  }

  const columns = useMemo<ListColumn<ProductListItem>[]>(
    () => [
      {
        key: 'name',
        title: 'Sản phẩm',
        render: (row) => {
          const structureMeta = getProductStructureMeta(row)

          return (
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
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mt: 0.5, flexWrap: 'wrap' }} useFlexGap>
                  <Chip size="small" color={structureMeta.color} variant="outlined" label={structureMeta.label} />
                </Stack>
              </Box>
            </Stack>
          )
        },
      },
      {
        key: 'sku',
        title: 'SKU mặc định',
        render: (row) => row.default_variant_sku ?? row.variants[0]?.sku ?? '-',
      },
      {
        key: 'category',
        title: 'Danh mục',
        render: (row) => getCategoryLabel(row.category_id, categoryLabelMap),
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
            label={getStatusLabel((row.status ?? 'draft') as ProductStatus)}
            color={getStatusColor((row.status ?? 'draft') as ProductStatus)}
            variant="outlined"
          />
        ),
      },
    ],
    [categoryLabelMap],
  )

  const handleFilterChange = (key: string, value: string) => {
    setPage(1)
    setFilterValues((current) => ({
      ...current,
      [key]: value,
    }))
  }

  const shouldShowInitialSkeleton = (!isReady || !hasResolvedInitialLoad || isLoading) && products.length === 0

  return (
    <CommonListLayout
      title="Danh sách sản phẩm"
      headerActions={
        <>
          <Button variant="outlined">Xuất file</Button>
          <Button variant="outlined">Nhập file</Button>
          <Button component={RouterLink} to="/products/create" variant="contained" color="secondary">
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
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Button
            variant="text"
            onClick={() => {
              setSearchValue('')
              setFilterValues({ category: '', status: '' })
              setActiveTab('all')
              setPage(1)
            }}
          >
            Đặt lại
          </Button>
        </Box>
      }
      bulkDelete={{
        enabled: true,
        selectedCount: selectedProductIds.length,
        onDelete: handleDeleteSelected,
        description: isDeleting
          ? 'Đang xử lý sản phẩm đã chọn...'
          : 'Xóa sản phẩm sẽ chuyển trạng thái sang đã xóa. Toàn bộ attributes, variants và dữ liệu lịch sử vẫn được giữ lại.',
        selectionLabel: `Đã chọn ${selectedProductIds.length} sản phẩm`,
        buttonLabel: isDeleting ? 'Đang xử lý...' : 'Xóa mềm sản phẩm',
      }}
      columns={columns}
      rows={pagedRows}
      rowKey={(row) => String(row.id)}
      rowSelection={{
        selectedRowKeys: selectedProductIds,
        onSelectedRowKeysChange: setSelectedProductIds,
        getRowLabel: (row) => row.product_name,
      }}
      onRowClick={(row) => navigate(`/products/${row.id}/edit`)}
      loading={shouldShowInitialSkeleton}
      loadingState={<ProductListTableSkeleton />}
      emptyState={
        <ListEmptyState
          title="Không tìm thấy sản phẩm phù hợp"
          description="Thử đổi từ khóa tìm kiếm hoặc xóa bộ lọc để xem lại toàn bộ danh sách."
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
    />
  )
}
