import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  MenuItem,
  Paper,
  Stack,
  Typography,
} from '@mui/material'
import { useEffect, useMemo, useState, type ReactElement } from 'react'
import { useNavigate } from 'react-router'
import { customerApi, type CityItem, type DistrictItem, type LocationItem } from '@/pages/customers/customer.api'
import { useAuth } from '@/modules/auth/use-auth'
import { storeApi } from '@/modules/store/store.api'
import { useStore } from '@/modules/store/use-store'
import { StackedDropdown } from '@/shared/ui/form/stacked-dropdown'
import { StackedTextField } from '@/shared/ui/form/stacked-text-field'
import { borderedCardSx } from '@/shared/ui/paper'
import { SummaryPaperHeader } from '@/shared/ui/summary-paper-header'
import { appToast } from '@/shared/ui/toast/toast.helpers'

const BUSINESS_TYPES = [
  { value: 'individual', label: 'Ca nhan' },
  { value: 'business', label: 'Doanh nghiep' },
]

const CURRENCIES = ['USD', 'VND', 'EUR']
const TIMEZONES = ['Asia/Saigon', 'UTC', 'America/New_York']

const getErrorMessage = (error: unknown, fallback: string) =>
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
    : fallback

export function SettingsStoreDetailsPage(): ReactElement {
  const navigate = useNavigate()
  const { user, refreshUser } = useAuth()
  const { activeStore, refreshStores } = useStore()
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [states, setStates] = useState<LocationItem[]>([])
  const [cities, setCities] = useState<CityItem[]>([])
  const [districts, setDistricts] = useState<DistrictItem[]>([])
  const [storeName, setStoreName] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [timezone, setTimezone] = useState('Asia/Saigon')
  const [businessType, setBusinessType] = useState('individual')
  const [legalFullName, setLegalFullName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [stateId, setStateId] = useState<number | ''>('')
  const [cityId, setCityId] = useState<number | ''>('')
  const [districtId, setDistrictId] = useState<number | ''>('')
  const [addressLine, setAddressLine] = useState('')

  useEffect(() => {
    if (!activeStore) {
      setIsLoading(false)
      return
    }

    let cancelled = false

    const load = async () => {
      setIsLoading(true)
      try {
        const [store, nextStates] = await Promise.all([
          storeApi.getStore(activeStore.id),
          customerApi.getStates({ is_active: true }),
        ])

        if (cancelled) {
          return
        }

        setStates(nextStates)
        setStoreName(store.name)
        setCurrency(store.default_currency)
        setTimezone(store.default_timezone)
        setBusinessType(store.profile.business_type || 'individual')
        setLegalFullName(store.profile.legal_full_name)
        setContactEmail(store.profile.contact_email || user?.email || '')
        setContactPhone(store.profile.contact_phone)
        setStateId(store.profile.state_id ?? '')
        setCityId(store.profile.city_id ?? '')
        setDistrictId(store.profile.district_id ?? '')
        setAddressLine(store.profile.address_line)
      } catch (error) {
        if (!cancelled) {
          appToast.error(getErrorMessage(error, 'Không thể tải cấu hình cửa hàng.'))
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [activeStore?.id, user?.email])

  useEffect(() => {
    if (!stateId) {
      setCities([])
      setCityId('')
      setDistricts([])
      setDistrictId('')
      return
    }

    const loadCities = async () => {
      try {
        const nextCities = await customerApi.getCities({ state_id: stateId, is_active: true })
        setCities(nextCities)
      } catch (error) {
        appToast.error(getErrorMessage(error, 'Không thể tải quận huyện.'))
      }
    }

    void loadCities()
  }, [stateId])

  useEffect(() => {
    if (!cityId) {
      setDistricts([])
      setDistrictId('')
      return
    }

    const loadDistricts = async () => {
      try {
        const nextDistricts = await customerApi.getDistricts({ city_id: cityId, is_active: true })
        setDistricts(nextDistricts)
      } catch (error) {
        appToast.error(getErrorMessage(error, 'Không thể tải phường xã.'))
      }
    }

    void loadDistricts()
  }, [cityId])

  const locationPreview = useMemo(() => {
    const stateName = states.find((item) => item.id === stateId)?.name
    const cityName = cities.find((item) => item.id === cityId)?.name
    const districtName = districts.find((item) => item.id === districtId)?.name

    return [addressLine, districtName, cityName, stateName].filter(Boolean).join(', ') || 'Chưa có địa chỉ'
  }, [addressLine, cities, cityId, districtId, districts, stateId, states])

  const handleSave = async () => {
    if (!activeStore) {
      return
    }

    setIsSaving(true)

    try {
      await storeApi.updateStore(activeStore.id, {
        name: storeName,
        default_currency: currency,
        default_timezone: timezone,
        profile: {
          business_type: businessType,
          legal_full_name: legalFullName,
          contact_email: contactEmail,
          contact_phone: contactPhone,
          state_id: stateId || null,
          city_id: cityId || null,
          district_id: districtId || null,
          address_line: addressLine,
        },
      })

      await Promise.all([refreshUser(), refreshStores()])
      appToast.success('Đã cập nhật thông tin cửa hàng.')
      navigate('/settings/general', { state: { overlayFrom: '/' } })
    } catch (error) {
      appToast.error(getErrorMessage(error, 'Không thể lưu thông tin cửa hàng.'))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Stack spacing={2.5} sx={{ pb: 8 }}>
      <Paper sx={borderedCardSx}>
        <Stack spacing={1.5}>
          <Button
            variant="text"
            startIcon={<ArrowBackRoundedIcon />}
            onClick={() => navigate('/settings/general', { state: { overlayFrom: '/' } })}
            sx={{ alignSelf: 'flex-start', px: 0 }}
          >
            Quay lại Cài đặt chung
          </Button>
          <SummaryPaperHeader title="Thông tin cửa hàng" />
          <Alert severity="info" sx={{ borderRadius: 3 }}>
            Chỉnh sửa tên cửa hàng, thông tin liên hệ, hồ sơ pháp lý và thiết lập vận hành mặc định.
          </Alert>
        </Stack>
      </Paper>

      <Paper sx={borderedCardSx}>
        <Stack spacing={2}>
          <SummaryPaperHeader title="Hồ sơ cửa hàng" />
          {isLoading ? <CircularProgress size={24} /> : null}

          <StackedTextField
            fullWidth
            label="Tên cửa hàng"
            value={storeName}
            onChange={(event) => setStoreName(event.target.value)}
            helperText="Hiển thị trên cửa hàng của bạn."
          />

          <StackedTextField
            fullWidth
            label="Email cửa hàng"
            value={contactEmail}
            onChange={(event) => setContactEmail(event.target.value)}
          />

          <StackedTextField
            fullWidth
            label="Số điện thoại cửa hàng"
            value={contactPhone}
            onChange={(event) => setContactPhone(event.target.value)}
          />

          <StackedDropdown fullWidth label="Loại hình" value={businessType} onChange={(event) => setBusinessType(String(event.target.value))}>
            {BUSINESS_TYPES.map((item) => (
              <MenuItem key={item.value} value={item.value}>
                {item.label}
              </MenuItem>
            ))}
          </StackedDropdown>

          <StackedTextField
            fullWidth
            label="Tên pháp lý / Họ và tên"
            value={legalFullName}
            onChange={(event) => setLegalFullName(event.target.value)}
          />

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
              gap: 2,
            }}
          >
            <StackedDropdown fullWidth label="Tỉnh / Thành phố" value={stateId} onChange={(event) => setStateId(Number(event.target.value) || '')}>
              <MenuItem value="">Chưa chọn</MenuItem>
              {states.map((item) => (
                <MenuItem key={item.id} value={item.id}>
                  {item.name}
                </MenuItem>
              ))}
            </StackedDropdown>

            <StackedDropdown fullWidth label="Quận / Huyện" value={cityId} onChange={(event) => setCityId(Number(event.target.value) || '')} disabled={!stateId}>
              <MenuItem value="">Chưa chọn</MenuItem>
              {cities.map((item) => (
                <MenuItem key={item.id} value={item.id}>
                  {item.name}
                </MenuItem>
              ))}
            </StackedDropdown>

            <StackedDropdown fullWidth label="Phường / Xã" value={districtId} onChange={(event) => setDistrictId(Number(event.target.value) || '')} disabled={!cityId}>
              <MenuItem value="">Chưa chọn</MenuItem>
              {districts.map((item) => (
                <MenuItem key={item.id} value={item.id}>
                  {item.name}
                </MenuItem>
              ))}
            </StackedDropdown>
          </Box>

          <StackedTextField
            fullWidth
            label="Địa chỉ chi tiết"
            value={addressLine}
            onChange={(event) => setAddressLine(event.target.value)}
            multiline
            minRows={2}
          />
        </Stack>
      </Paper>

      <Paper sx={borderedCardSx}>
        <Stack spacing={2}>
          <SummaryPaperHeader title="Thiết lập mặc định" />
          <StackedDropdown fullWidth label="Currency" value={currency} onChange={(event) => setCurrency(String(event.target.value))}>
            {CURRENCIES.map((item) => (
              <MenuItem key={item} value={item}>
                {item}
              </MenuItem>
            ))}
          </StackedDropdown>

          <StackedDropdown fullWidth label="Timezone" value={timezone} onChange={(event) => setTimezone(String(event.target.value))}>
            {TIMEZONES.map((item) => (
              <MenuItem key={item} value={item}>
                {item}
              </MenuItem>
            ))}
          </StackedDropdown>

          <Typography variant="body2" sx={{ color: '#667085' }}>
            Xem trước: {locationPreview}
          </Typography>
        </Stack>
      </Paper>

      <Stack direction="row" spacing={1.25} sx={{ justifyContent: 'flex-end' }}>
        <Button variant="outlined" onClick={() => navigate('/settings/general', { state: { overlayFrom: '/' } })}>
          Hủy
        </Button>
        <Button variant="contained" onClick={() => void handleSave()} disabled={isSaving || isLoading || !activeStore}>
          {isSaving ? 'Đang lưu...' : 'Lưu cấu hình'}
        </Button>
      </Stack>
    </Stack>
  )
}
