import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined'
import {
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Stack,
} from '@mui/material'
import { type CityItem, type DistrictItem, type LocationItem } from '@/pages/customers/customer.api'
import { StackedAutocomplete } from '@/shared/ui/form/stacked-autocomplete'
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
      <DialogTitle>{mode === 'create' ? 'Táº¡o khÃ¡ch hÃ ng má»›i' : 'Chá»‰nh sá»­a khÃ¡ch hÃ ng'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <StackedTextField
              fullWidth
              required
              sx={{ flex: 1 }}
              label="Há» vÃ  tÃªn"
              value={form.fullName}
              onChange={(event) => onFieldChange('fullName', event.target.value)}
            />
            <StackedTextField
              fullWidth
              required
              sx={{ flex: 1 }}
              label="Sá»‘ Ä‘iá»‡n thoáº¡i"
              value={form.phone}
              onChange={(event) => onFieldChange('phone', event.target.value)}
            />
          </Stack>
          <StackedTextField
            fullWidth
            label="Äá»‹a chá»‰"
            placeholder="Sá»‘ nhÃ , tÃªn Ä‘Æ°á»ng"
            value={form.addressLine}
            onChange={(event) => onFieldChange('addressLine', event.target.value)}
          />
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <StackedAutocomplete<LocationItem, false, false, false>
              fullWidth
              sx={{ flex: 1 }}
              label="Tá»‰nh/ThÃ nh phá»‘"
              options={states}
              value={form.state}
              loading={isStatesLoading}
              onChange={onStateChange}
              getOptionLabel={(option) => option.name}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              placeholder="Chá»n tá»‰nh/thÃ nh phá»‘"
            />
            <StackedAutocomplete<CityItem, false, false, false>
              fullWidth
              sx={{ flex: 1 }}
              label="Huyá»‡n/Quáº­n"
              options={cities}
              value={form.city}
              loading={isCitiesLoading}
              onChange={onCityChange}
              getOptionLabel={(option) => option.name}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              disabled={!form.state}
              placeholder="Chá»n Huyá»‡n/Quáº­n"
            />
            <StackedAutocomplete<DistrictItem, false, false, false>
              fullWidth
              sx={{ flex: 1 }}
              label="XÃ£/PhÆ°á»ng"
              options={districts}
              value={form.district}
              loading={isDistrictsLoading}
              onChange={onDistrictChange}
              getOptionLabel={(option) => option.name}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              disabled={!form.city}
              placeholder="Chá»n XÃ£/PhÆ°á»ng"
            />
          </Stack>
          <FormControlLabel
            control={<Checkbox checked={form.setAsDefaultAddress} onChange={(event) => onDefaultAddressChange(event.target.checked)} />}
            label="Äáº·t Ä‘á»‹a chá»‰ nÃ y lÃ m máº·c Ä‘á»‹nh"
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isSaving}>
          ÄÃ³ng
        </Button>
        <Button
          variant="contained"
          onClick={onSave}
          disabled={isSaving}
          startIcon={isSaving ? <CircularProgress size={16} color="inherit" /> : <SaveOutlinedIcon />}
        >
          {isSaving ? 'Äang lÆ°u...' : mode === 'create' ? 'Táº¡o khÃ¡ch hÃ ng' : 'Cáº­p nháº­t'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
