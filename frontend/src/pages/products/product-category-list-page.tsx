import { useEffect, useMemo, useState } from 'react'
import { Button, Paper, Typography, alpha } from '@mui/material'
import { Link as RouterLink, useNavigate } from 'react-router'
import { CommonListLayout } from '@/shared/ui/list/common-list-layout'
import { ListEmptyState } from '@/shared/ui/list/list-empty-state'
import type { ListColumn } from '@/shared/ui/list/common-list.types'
import { productApi, type ProductCategory } from '@/pages/products/product.api'
import { appToast } from '@/shared/ui/toast/toast'

type ProductCategoryListPageCache = {
  searchValue: string
  page: number
  pageSize: number
  categories: ProductCategory[]
}

let productCategoryListPageCache: ProductCategoryListPageCache | null = null

export function ProductCategoryListPage() {
  const navigate = useNavigate()
  const [searchValue, setSearchValue] = useState(productCategoryListPageCache?.searchValue ?? '')
  const [page, setPage] = useState(productCategoryListPageCache?.page ?? 1)
  const [pageSize, setPageSize] = useState(productCategoryListPageCache?.pageSize ?? 10)
  const [categories, setCategories] = useState<ProductCategory[]>(productCategoryListPageCache?.categories ?? [])
  const [isLoading, setIsLoading] = useState(productCategoryListPageCache === null)
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([])
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    const fetchCategories = async () => {
      setIsLoading(categories.length === 0)
      try {
        const data = await productApi.getProductCategories()
        setCategories(data)
      } catch (error) {
        console.error('Loi khi tai danh muc san pham:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchCategories()
  }, [])

  useEffect(() => {
    productCategoryListPageCache = {
      searchValue,
      page,
      pageSize,
      categories,
    }
  }, [categories, page, pageSize, searchValue])

  const filteredRows = useMemo(() => {
    const keyword = searchValue.trim().toLowerCase()

    return categories.filter((category) => keyword.length === 0 || category.category_name.toLowerCase().includes(keyword))
  }, [categories, searchValue])

  const pagedRows = useMemo(() => {
    const start = (page - 1) * pageSize
    return filteredRows.slice(start, start + pageSize)
  }, [filteredRows, page, pageSize])

  const columns = useMemo<ListColumn<ProductCategory>[]>(
    () => [
      {
        key: 'category_name',
        title: 'Danh mục',
        render: (row) => row.category_name,
      },
    ],
    [],
  )

  const handleDeleteSelected = async () => {
    const idsToDelete = selectedCategoryIds
      .map((id) => Number(id))
      .filter((id) => Number.isInteger(id) && id > 0)

    if (idsToDelete.length === 0 || isDeleting) {
      return
    }

    setIsDeleting(true)
    try {
      await productApi.deleteCategories(idsToDelete)
      setCategories((current) => current.filter((row) => !idsToDelete.includes(row.id)))
      setSelectedCategoryIds([])
      appToast.success(`Đã xóa ${idsToDelete.length} danh mục.`)
    } catch (error) {
      console.error('Lỗi khi xóa danh mục:', error)
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
          : 'Không thể xóa danh mục. Vui lòng thử lại!'

      appToast.error(message)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <CommonListLayout
      title="Danh mục sản phẩm"
      headerActions={
        <Button component={RouterLink} to="/products/categories/create" variant="contained" color="secondary">
          Thêm danh mục
        </Button>
      }
      searchValue={searchValue}
      searchPlaceholder="Tìm theo tên danh mục"
      onSearchChange={(value) => {
        setSearchValue(value)
        setPage(1)
      }}
      toolbarActions={
        <Button
          variant="text"
          onClick={() => {
            setSearchValue('')
            setPage(1)
          }}
        >
          Đặt lại
        </Button>
      }
      bulkDelete={{
        enabled: true,
        selectedCount: selectedCategoryIds.length,
        onDelete: handleDeleteSelected,
        description: isDeleting ? 'Đang xóa danh mục đã chọn...' : undefined,
        selectionLabel: `Đã chọn ${selectedCategoryIds.length} danh mục`,
        buttonLabel: isDeleting ? 'Đang xóa...' : `Xóa ${selectedCategoryIds.length} danh mục đã chọn`,
      }}
      columns={columns}
      rows={pagedRows}
      rowKey={(row) => String(row.id)}
      rowSelection={{
        selectedRowKeys: selectedCategoryIds,
        onSelectedRowKeysChange: setSelectedCategoryIds,
        getRowLabel: (row) => row.category_name,
      }}
      onRowClick={(row) => navigate(`/products/categories/${row.id}/edit`)}
      loading={isLoading && categories.length === 0}
      emptyState={
        <ListEmptyState
          title="Chưa có danh mục sản phẩm"
          description="Tạo danh mục đầu tiên để dùng khi thêm hoặc chỉnh sửa sản phẩm."
          action={
            <Button component={RouterLink} to="/products/categories/create" variant="contained">
              Tạo danh mục
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
            border: (theme) => `1px solid ${alpha(theme.palette.info.main, 0.12)}`,
            bgcolor: (theme) => alpha(theme.palette.info.light, 0.08),
          }}
        >
          <Typography sx={{ fontWeight: 700 }}>Gợi ý sử dụng</Typography>
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            Danh mục tạo ở đây sẽ được dùng ngay trong form thêm và chỉnh sửa sản phẩm.
          </Typography>
        </Paper>
      }
    />
  )
}
