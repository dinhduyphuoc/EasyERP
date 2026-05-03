import FmdGoodOutlinedIcon from '@mui/icons-material/FmdGoodOutlined'
import {
  Box,
  Button,
  CircularProgress,
  MenuItem,
  Paper,
  Stack,
  Typography,
} from '@mui/material'
import { useEffect, useMemo, useState, type ReactElement } from 'react'
import { customerApi, type CityItem, type DistrictItem, type LocationItem } from '@/pages/customers/customer.api'
import { StackedDropdown } from '@/shared/ui/form/stacked-dropdown'
import { StackedTextField } from '@/shared/ui/form/stacked-text-field'
import { borderedCardSx } from '@/shared/ui/paper'
import { SummaryPaperHeader } from '@/shared/ui/summary-paper-header'
import { appToast } from '@/shared/ui/toast/toast.helpers'
import { showErrorToast } from '@/shared/ui/toast/toast-error'
import { useJsonDirtyState } from '@/shared/ui/unsaved-changes'
import { generalSettingsApi } from './general-settings.api'
import { useSettingsUnsavedRegistration } from './settings-unsaved-context'

export function SettingsAddressManagementPage(): ReactElement {
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [states, setStates] = useState<LocationItem[]>([])
  const [cities, setCities] = useState<CityItem[]>([])
  const [districts, setDistricts] = useState<DistrictItem[]>([])
  const [contactName, setContactName] = useState('')
  const [phone, setPhone] = useState('')
  const [stateId, setStateId] = useState<number | ''>('')
  const [cityId, setCityId] = useState<number | ''>('')
  const [districtId, setDistrictId] = useState<number | ''>('')
  const [addressLine, setAddressLine] = useState('')
  const [bankSnapshot, setBankSnapshot] = useState({
    bank_name: '',
    bank_bin: '',
    bank_code: '',
    account_number: '',
    account_holder: '',
    qr_template: 'compact',
  })
  const [vatSnapshot, setVatSnapshot] = useState({
    enabled: false,
    rate_percent: 0,
  })
  const dirtyState = useJsonDirtyState(
    { contactName, phone, stateId, cityId, districtId, addressLine },
    !isLoading,
  )

  useEffect(() => {
    const load = async () => {
      setIsLoading(true)
      try {
        const [settings, nextStates] = await Promise.all([
          generalSettingsApi.getGeneralSettings(),
          customerApi.getStates({ is_active: true }),
        ])

        setStates(nextStates)
        setContactName(settings.defaults.shipping_address.contact_name)
        setPhone(settings.defaults.shipping_address.phone)
        setStateId(settings.defaults.shipping_address.state_id ?? '')
        setCityId(settings.defaults.shipping_address.city_id ?? '')
        setDistrictId(settings.defaults.shipping_address.district_id ?? '')
        setAddressLine(settings.defaults.shipping_address.address_line)
        setBankSnapshot(settings.defaults.bank_account)
        setVatSnapshot(settings.defaults.vat)
        dirtyState.setInitialSnapshot(
          JSON.stringify({
            contactName: settings.defaults.shipping_address.contact_name,
            phone: settings.defaults.shipping_address.phone,
            stateId: settings.defaults.shipping_address.state_id ?? '',
            cityId: settings.defaults.shipping_address.city_id ?? '',
            districtId: settings.defaults.shipping_address.district_id ?? '',
            addressLine: settings.defaults.shipping_address.address_line,
          }),
        )
      } catch (error) {
        showErrorToast(error, 'Không thể tải địa chỉ gửi mặc định.')
      } finally {
        setIsLoading(false)
      }
    }

    void load()
  }, [])

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
        setCities(await customerApi.getCities({ state_id: stateId, is_active: true }))
      } catch (error) {
        showErrorToast(error, 'Không thể tải quận/huyện.')
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
        setDistricts(await customerApi.getDistricts({ city_id: cityId, is_active: true }))
      } catch (error) {
        showErrorToast(error, 'Không thể tải phường/xã.')
      }
    }

    void loadDistricts()
  }, [cityId])

  const addressSummary = useMemo(() => {
    const stateName = states.find((item) => item.id === stateId)?.name
    const cityName = cities.find((item) => item.id === cityId)?.name
    const districtName = districts.find((item) => item.id === districtId)?.name

    return [addressLine, districtName, cityName, stateName].filter(Boolean).join(', ') || 'Chưa có địa chỉ mặc định'
  }, [addressLine, cities, cityId, districtId, districts, stateId, states])
  const { initialSnapshot, currentSnapshot, isDirty } = dirtyState

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await generalSettingsApi.updateGeneralSettings({
        defaults: {
          shipping_address: {
            contact_name: contactName,
            phone,
            state_id: stateId || null,
            city_id: cityId || null,
            district_id: districtId || null,
            address_line: addressLine,
          },
          bank_account: bankSnapshot,
          vat: vatSnapshot,
        },
      })
      dirtyState.setInitialSnapshot(currentSnapshot)
      appToast.success('Đã cập nhật địa chỉ gửi mặc định.')
    } catch (error) {
      showErrorToast(error, 'Không thể lưu địa chỉ gửi mặc định.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDiscard = () => {
    if (!initialSnapshot) {
      return
    }

    const snapshot = JSON.parse(initialSnapshot) as {
      contactName: string
      phone: string
      stateId: number | ''
      cityId: number | ''
      districtId: number | ''
      addressLine: string
    }

    setContactName(snapshot.contactName)
    setPhone(snapshot.phone)
    setStateId(snapshot.stateId)
    setCityId(snapshot.cityId)
    setDistrictId(snapshot.districtId)
    setAddressLine(snapshot.addressLine)
  }
  useSettingsUnsavedRegistration(
    useMemo(
      () => ({
        isDirty,
        isSaving,
        onSave: () => void handleSave(),
        onDiscard: handleDiscard,
      }),
      [isDirty, isSaving, handleDiscard],
    ),
  )

  return (
    <Stack spacing={2.5} sx={{ pb: 8 }}>
      <Paper sx={borderedCardSx}>
        <Stack spacing={1.5}>
          <SummaryPaperHeader title="Địa chỉ gửi mặc định" />
        </Stack>
      </Paper>

      <Paper sx={borderedCardSx}>
        <Stack spacing={2.5}>
          <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
            <Box
              sx={{
                width: 42,
                height: 42,
                borderRadius: 3,
                display: 'grid',
                placeItems: 'center',
                bgcolor: '#eff8ff',
                color: '#175cd3',
                flexShrink: 0,
              }}
            >
              <FmdGoodOutlinedIcon fontSize="small" />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 700, color: '#101828' }}>Địa chỉ gửi hàng mặc định</Typography>
              <Typography variant="body2" sx={{ color: '#667085' }}>
                {addressSummary}
              </Typography>
            </Box>
          </Stack>

          {isLoading ? <CircularProgress size={24} /> : null}

          <Stack spacing={2}>
            <StackedTextField fullWidth label="Tên liên hệ" value={contactName} onChange={(event) => setContactName(event.target.value)} />
            <StackedTextField fullWidth label="Số điện thoại" value={phone} onChange={(event) => setPhone(event.target.value)} />

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

            <StackedTextField fullWidth label="Địa chỉ chi tiết" value={addressLine} onChange={(event) => setAddressLine(event.target.value)} multiline minRows={3} />
          </Stack>
        </Stack>
      </Paper>

      <Stack direction="row" spacing={1.25} sx={{ justifyContent: 'flex-end' }}>
        <Button variant="contained" onClick={() => void handleSave()} disabled={isSaving || isLoading}>
          {isSaving ? 'Đang lưu...' : 'Lưu địa chỉ'}
        </Button>
      </Stack>
    </Stack>
  )
}
