import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined'
import {
  Autocomplete,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { type CityItem, type DistrictItem, type LocationItem } from '@/pages/customers/customer.api'
import { StackedTextField } from '@/shared/ui/form/stacked-text-field'

export type CustomerModalMode = 'create' | 'edit'

export type CustomerModalForm = {
  fullName: string
  phone: string
  addressLine: string
  state: LocationItem | null
  city: CityItem | null
  district: DistrictItem | null
  setAsDefaultAddress: boolean
}

type CustomerModalProps = {
  open: boolean
  mode: CustomerModalMode
  form: CustomerModalForm
  states: LocationItem[]
  cities: CityItem[]
  districts: DistrictItem[]
  isStatesLoading: boolean
  isCitiesLoading: boolean
  isDistrictsLoading: boolean
  isSaving: boolean
  onClose: () => void
  onSave: () => void
  onFieldChange: (field: 'fullName' | 'phone' | 'addressLine', value: string) => void
  onDefaultAddressChange: (checked: boolean) => void
  onStateChange: (_event: unknown, value: LocationItem | null) => void
  onCityChange: (_event: unknown, value: CityItem | null) => void
  onDistrictChange: (_event: unknown, value: DistrictItem | null) => void
}

export function CustomerModal({
  open,
  mode,
  form,
  states,
  cities,
  districts,
  isStatesLoading,
  isCitiesLoading,
  isDistrictsLoading,
  isSaving,
  onClose,
  onSave,
  onFieldChange,
  onDefaultAddressChange,
  onStateChange,
  onCityChange,
  onDistrictChange,
}: CustomerModalProps) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{mode === 'create' ? 'Tạo khách hàng mới' : 'Chỉnh sửa khách hàng'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <StackedTextField
              fullWidth
              required
              sx={{ flex: 1 }}
              label="Họ và tên"
              value={form.fullName}
              onChange={(event) => onFieldChange('fullName', event.target.value)}
            />
            <StackedTextField
              fullWidth
              required
              sx={{ flex: 1 }}
              label="Số điện thoại"
              value={form.phone}
              onChange={(event) => onFieldChange('phone', event.target.value)}
            />
          </Stack>
          <StackedTextField
            fullWidth
            label="Địa chỉ"
            placeholder="Số nhà, tên đường"
            value={form.addressLine}
            onChange={(event) => onFieldChange('addressLine', event.target.value)}
          />
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="body2" sx={{ mb: 1, color: '#344054', fontWeight: 500 }}>
                Tỉnh/Thành phố
              </Typography>
              <Autocomplete
                options={states}
                value={form.state}
                loading={isStatesLoading}
                onChange={onStateChange}
                getOptionLabel={(option) => option.name}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                renderInput={(params) => <TextField {...params} size="small" placeholder="Chọn tỉnh/thành phố" />}
              />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="body2" sx={{ mb: 1, color: '#344054', fontWeight: 500 }}>
                Huyện/Quận
              </Typography>
              <Autocomplete
                options={cities}
                value={form.city}
                loading={isCitiesLoading}
                onChange={onCityChange}
                getOptionLabel={(option) => option.name}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                disabled={!form.state}
                renderInput={(params) => <TextField {...params} size="small" placeholder="Chọn Huyện/Quận" />}
              />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="body2" sx={{ mb: 1, color: '#344054', fontWeight: 500 }}>
                Xã/Phường
              </Typography>
              <Autocomplete
                options={districts}
                value={form.district}
                loading={isDistrictsLoading}
                onChange={onDistrictChange}
                getOptionLabel={(option) => option.name}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                disabled={!form.city}
                renderInput={(params) => <TextField {...params} size="small" placeholder="Chọn Xã/Phường" />}
              />
            </Box>
          </Stack>
          <FormControlLabel
            control={<Checkbox checked={form.setAsDefaultAddress} onChange={(event) => onDefaultAddressChange(event.target.checked)} />}
            label="Đặt địa chỉ này làm mặc định"
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isSaving}>
          Đóng
        </Button>
        <Button
          variant="contained"
          onClick={onSave}
          disabled={isSaving}
          startIcon={isSaving ? <CircularProgress size={16} color="inherit" /> : <SaveOutlinedIcon />}
        >
          {isSaving ? 'Đang lưu...' : mode === 'create' ? 'Tạo khách hàng' : 'Cập nhật'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
