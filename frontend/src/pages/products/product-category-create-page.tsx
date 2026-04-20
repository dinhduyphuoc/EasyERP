import { useEffect, useMemo, useState, type ReactElement } from 'react'
import { useNavigate, useParams } from 'react-router'
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined'
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { productApi } from '@/pages/products/product.api'
import { appToast } from '@/shared/ui/toast/toast'

const cardSx = {
  p: { xs: 2, md: 2.5 },
  borderRadius: '8px',
  boxShadow: '0 0.5rem 1.5rem rgba(15,23,42,0.08)',
}

export function ProductCategoryCreatePage(): ReactElement {
  const { id } = useParams()
  const navigate = useNavigate()
  const [categoryName, setCategoryName] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(Boolean(id))
  const [dirty, setDirty] = useState(false)
  const [hasAttemptedSave, setHasAttemptedSave] = useState(false)
  const [showExitDialog, setShowExitDialog] = useState(false)

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
        setDirty(false)
        setHasAttemptedSave(false)
      } catch (error) {
        console.error('Lỗi khi lấy thông tin danh mục:', error)
        appToast.error('Không thể tải thông tin danh mục. Vui lòng thử lại!')
      } finally {
        setIsLoading(false)
      }
    }

    fetchCategory()
  }, [id])

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirty) {
        return
      }

      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [dirty])

  const errors = useMemo(() => {
    const nextErrors: Record<string, string> = {}

    if (!categoryName.trim()) {
      nextErrors.category_name = 'Tên danh mục là bắt buộc.'
    }

    return nextErrors
  }, [categoryName])

  const visibleErrors = hasAttemptedSave ? errors : {}
  const canSave = !isSaving && Object.keys(errors).length === 0 && (!isEditMode || dirty)

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
      window.setTimeout(() => navigate('/products/categories'), 1000)
    } catch (error) {
      console.error('Lỗi khi lưu danh mục:', error)
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
          : 'Có lỗi xảy ra khi lưu danh mục. Vui lòng thử lại!'

      appToast.error(message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Box sx={{ px: { xs: 2, md: 3, xl: 4 }, pb: 8 }}>
      <Paper sx={{ ...cardSx, mb: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ justifyContent: 'space-between', alignItems: { md: 'center' } }}>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700, color: '#101828' }}>
              {isEditMode ? 'Chỉnh sửa danh mục' : 'Thêm danh mục'}
            </Typography>
            <Typography sx={{ color: '#667085', mt: 0.5 }}>
              {isEditMode
                ? 'Cập nhật tên danh mục để áp dụng cho toàn bộ sản phẩm liên quan.'
                : 'Tạo danh mục mới để dùng khi thêm hoặc chỉnh sửa sản phẩm.'}
            </Typography>
          </Box>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <Button variant="contained" color="secondary" startIcon={isSaving ? <CircularProgress size={16} color="inherit" /> : <SaveOutlinedIcon />} onClick={handleSave} disabled={!canSave}>
              {isSaving ? 'Đang lưu...' : isEditMode ? 'Cập nhật' : 'Lưu'}
            </Button>
          </Stack>
        </Stack>
      </Paper>

      <Paper sx={cardSx}>
        <Stack spacing={3}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Thông tin danh mục
            </Typography>
            <Typography sx={{ color: '#667085', mt: 0.5 }}>
              Nhập tên danh mục để sử dụng trong toàn bộ module sản phẩm.
            </Typography>
          </Box>

          <TextField
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

      <Dialog open={showExitDialog} onClose={() => setShowExitDialog(false)}>
        <DialogTitle>Rời trang khi chưa lưu?</DialogTitle>
        <DialogContent>
          <Typography color="text.secondary">
            Bạn đang có thay đổi chưa lưu. Nếu quay lại bây giờ, dữ liệu hiện tại sẽ bị mất.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowExitDialog(false)}>Ở lại</Button>
          <Button color="error" onClick={() => navigate('/products/categories')}>
            Rời trang
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
