import { useEffect, useMemo, useState, type ReactElement } from 'react'
import { useNavigate } from 'react-router'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined'
import {
  Box,
  Button,
  CircularProgress,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { customerApi, type CustomerCategory, type CustomerCreatePayload } from './customer.api'
import { defaultCardSx } from '@/shared/ui/paper'
import { appToast } from '@/shared/ui/toast/toast'

export function CustomerCreatePage(): ReactElement {
  const navigate = useNavigate()
  const [clientCode, setClientCode] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [status, setStatus] = useState<'active' | 'inactive'>('active')
  const [customerCategoryId, setCustomerCategoryId] = useState('')
  const [categories, setCategories] = useState<CustomerCategory[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [hasAttemptedSave, setHasAttemptedSave] = useState(false)

  useEffect(() => {
    const fetchCategories = async () => {
      setIsLoading(true)

      try {
        const data = await customerApi.getCustomerCategories()
        setCategories(data)
      } catch (error) {
        console.error('Lỗi khi tải nhóm khách hàng:', error)
        appToast.error('Không thể tải nhóm khách hàng.')
      } finally {
        setIsLoading(false)
      }
    }

    void fetchCategories()
  }, [])

  const errors = useMemo(() => {
    const nextErrors: Record<string, string> = {}

    if (!fullName.trim()) {
      nextErrors.full_name = 'Tên khách hàng là bắt buộc.'
    }

    if (!phone.trim()) {
      nextErrors.phone = 'Số điện thoại là bắt buộc.'
    }

    return nextErrors
  }, [fullName, phone])

  const visibleErrors = hasAttemptedSave ? errors : {}
  const canSave = !isLoading && !isSaving && Object.keys(errors).length === 0

  const handleSave = async () => {
    setHasAttemptedSave(true)

    if (!canSave) {
      appToast.warning('Vui lòng nhập đầy đủ thông tin bắt buộc trước khi lưu.')
      return
    }

    setIsSaving(true)

    try {
      const payload: CustomerCreatePayload = {
        full_name: fullName.trim(),
        phone: phone.trim(),
        status,
        customer_category_id: customerCategoryId ? Number(customerCategoryId) : null,
      }

      if (clientCode.trim()) {
        payload.client_code = clientCode.trim()
      }

      await customerApi.createCustomer(payload)
      appToast.success('Thêm khách hàng thành công.')
      navigate('/customers')
    } catch (error) {
      console.error('Lỗi khi tạo khách hàng:', error)
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
          : 'Không thể tạo khách hàng. Vui lòng thử lại.'

      appToast.error(message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Box sx={{ px: { xs: 2, md: 3, xl: 4 }, pb: 8 }}>
      <Paper sx={{ ...defaultCardSx, mb: 2 }}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={2}
          sx={{ justifyContent: 'space-between', alignItems: { md: 'center' } }}
        >
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700, color: '#101828' }}>
              Thêm khách hàng
            </Typography>
            <Typography sx={{ color: '#667085', mt: 0.5 }}>
              Tạo hồ sơ khách hàng mới để dùng cho chăm sóc khách hàng, bán hàng và các báo
              cáo liên quan sau này.
            </Typography>
          </Box>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => navigate('/customers')}>
              Quay lại
            </Button>
            <Button
              variant="contained"
              color="secondary"
              startIcon={isSaving ? <CircularProgress size={16} color="inherit" /> : <SaveOutlinedIcon />}
              onClick={() => void handleSave()}
              disabled={!canSave}
            >
              {isSaving ? 'Đang lưu...' : 'Lưu khách hàng'}
            </Button>
          </Stack>
        </Stack>
      </Paper>

      <Paper sx={defaultCardSx}>
        <Stack spacing={3}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Thông tin khách hàng
            </Typography>
            <Typography sx={{ color: '#667085', mt: 0.5 }}>
              Nhập các thông tin chính theo dữ liệu khách hàng hiện đang quản lý trong hệ thống.
            </Typography>
          </Box>

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <TextField
              fullWidth
              label="Mã khách hàng"
              placeholder="Để trống để hệ thống tự tạo, ví dụ: KH0001"
              value={clientCode}
              onChange={(event) => setClientCode(event.target.value)}
              helperText="Nếu để trống, hệ thống sẽ tự sinh mã bắt đầu bằng KH."
              disabled={isLoading}
            />
            <TextField
              fullWidth
              label="Số điện thoại *"
              placeholder="Ví dụ: 0901234567"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              error={Boolean(visibleErrors.phone)}
              helperText={visibleErrors.phone}
              disabled={isLoading}
            />
          </Stack>

          <TextField
            fullWidth
            label="Tên khách hàng *"
            placeholder="Ví dụ: Nguyễn Văn A"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            error={Boolean(visibleErrors.full_name)}
            helperText={visibleErrors.full_name}
            disabled={isLoading}
          />

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <TextField
              select
              fullWidth
              label="Trạng thái"
              value={status}
              onChange={(event) => setStatus(event.target.value as 'active' | 'inactive')}
              disabled={isLoading}
            >
              <MenuItem value="active">Đang hoạt động</MenuItem>
              <MenuItem value="inactive">Ngừng hoạt động</MenuItem>
            </TextField>

            <TextField
              select
              fullWidth
              label="Nhóm khách hàng"
              value={customerCategoryId}
              onChange={(event) => setCustomerCategoryId(event.target.value)}
              disabled={isLoading}
            >
              <MenuItem value="">Chưa phân nhóm</MenuItem>
              {categories.map((category) => (
                <MenuItem key={category.id} value={String(category.id)}>
                  {category.category_name}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </Stack>
      </Paper>
    </Box>
  )
}
