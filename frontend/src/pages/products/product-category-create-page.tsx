import { useEffect, useMemo, useState, type ReactElement } from 'react'
import { useNavigate, useParams } from 'react-router'
import {
  Box,
  Paper,
  Stack,
  Typography,
} from '@mui/material'
import { productApi } from '@/pages/products/product.api'
import { defaultCardSx } from '@/shared/ui/paper'
import { appToast } from '@/shared/ui/toast/toast.helpers'
import { showErrorToast } from '@/shared/ui/toast/toast-error'
import { StackedTextField } from '@/shared/ui/form/stacked-text-field'
import { ProductCategoryPageSkeleton } from '@/pages/products/product-skeletons'
import { UnsavedChangesBanner, useUnsavedChangesPrompt } from '@/shared/ui/unsaved-changes'
import {
  CreateEditPageContainer,
  CreateEditPageHeader,
  buildPrimarySaveHeaderAction,
  type CreateEditPageHeaderAction,
} from '@/shared/ui/page'

export function ProductCategoryCreatePage(): ReactElement {
  const { id } = useParams()
  const navigate = useNavigate()
  const [categoryName, setCategoryName] = useState('')
  const [initialCategoryName, setInitialCategoryName] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(Boolean(id))
  const [dirty, setDirty] = useState(false)
  const [hasAttemptedSave, setHasAttemptedSave] = useState(false)

  const isEditMode = Boolean(id)
  useEffect(() => {
    if (!id) {
      return
    }

    const fetchCategory = async () => {
      setIsLoading(true)
      try {
        const category = await productApi.getCategoryById(id)
        setCategoryName(category.category_name)
        setInitialCategoryName(category.category_name)
        setDirty(false)
        setHasAttemptedSave(false)
      } catch (error) {
        showErrorToast(error, 'Không thể tải thông tin danh mục. Vui lòng thử lại!')
      } finally {
        setIsLoading(false)
      }
    }

    void fetchCategory()
  }, [id])

  const errors = useMemo(() => {
    const nextErrors: Record<string, string> = {}

    if (!categoryName.trim()) {
      nextErrors.category_name = 'Tên danh mục là bắt buộc.'
    }

    return nextErrors
  }, [categoryName])

  const visibleErrors = hasAttemptedSave ? errors : {}
  const canSave = !isSaving && Object.keys(errors).length === 0 && (!isEditMode || dirty)

  if (isLoading) {
    return <ProductCategoryPageSkeleton />
  }

  const handleSave = async () => {
    setHasAttemptedSave(true)

    if (!canSave) {
      appToast.warning('Vui lòng nhập tên danh mục trước khi lưu.')
      return
    }

    setIsSaving(true)
    try {
      const payload = {
        category_name: categoryName.trim(),
      }

      if (isEditMode && id) {
        await productApi.updateCategory(id, payload)
        appToast.success('Cập nhật danh mục thành công.')
      } else {
        await productApi.createCategory(payload)
        appToast.success('Tạo danh mục thành công.')
      }

      setDirty(false)
      setHasAttemptedSave(false)
      setInitialCategoryName(categoryName.trim())
      window.setTimeout(() => navigate('/products/categories'), 1000)
    } catch (error) {
      showErrorToast(error, 'Có lỗi xảy ra khi lưu danh mục. Vui lòng thử lại!')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDiscard = () => {
    setCategoryName(initialCategoryName)
    setDirty(false)
    setHasAttemptedSave(false)
  }
  const { bannerProps, attemptNavigate } = useUnsavedChangesPrompt({
    isDirty: dirty,
    isSaving,
    onDiscard: handleDiscard,
    onSave: handleSave,
  })
  const headerActions: CreateEditPageHeaderAction[] = [
    buildPrimarySaveHeaderAction({
      label: isEditMode ? 'Cập nhật' : 'Lưu',
      loadingLabel: 'Đang lưu...',
      onClick: handleSave,
      disabled: !canSave,
      loading: isSaving,
    }),
  ]

  return (
    <CreateEditPageContainer>
      <Paper sx={{ ...defaultCardSx, mb: 2 }}>
        <CreateEditPageHeader
          title={isEditMode ? 'Chỉnh sửa danh mục' : 'Thêm danh mục'}
          subtitle={
            isEditMode
              ? 'Cập nhật tên danh mục để áp dụng cho toàn bộ sản phẩm liên quan.'
              : 'Tạo danh mục mới để dùng khi thêm hoặc chỉnh sửa sản phẩm.'
          }
          onBack={() => attemptNavigate('/products/categories')}
          actions={headerActions}
        />
      </Paper>

      <Paper sx={defaultCardSx}>
        <Stack spacing={3}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Thông tin danh mục
            </Typography>
            <Typography sx={{ color: '#667085', mt: 0.5 }}>
              Nhập tên danh mục để sử dụng trong toàn bộ module sản phẩm.
            </Typography>
          </Box>

          <StackedTextField
            fullWidth
            label="Tên danh mục *"
            placeholder="Ví dụ: Phụ kiện thời trang"
            value={categoryName}
            onChange={(event) => {
              setDirty(true)
              setCategoryName(event.target.value)
            }}
            error={Boolean(visibleErrors.category_name)}
            helperText={visibleErrors.category_name}
            disabled={isLoading}
          />
        </Stack>
      </Paper>

      <UnsavedChangesBanner {...bannerProps} />
    </CreateEditPageContainer>
  )
}
