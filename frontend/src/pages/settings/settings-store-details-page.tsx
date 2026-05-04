import { useEffect, useMemo, useState, type ReactElement } from 'react'
import { Box, Button, CircularProgress, MenuItem, Paper, Stack } from '@mui/material'
import { useNavigate } from 'react-router'
import { useAuth } from '@/modules/auth/use-auth'
import { customerApi, type CityItem, type DistrictItem, type LocationItem } from '@/pages/customers/customer.api'
import { storeApi } from '@/modules/store/store.api'
import { useStore } from '@/modules/store/use-store'
import { StackedDropdown } from '@/shared/ui/form/stacked-dropdown'
import { StackedTextField } from '@/shared/ui/form/stacked-text-field'
import { borderedCardSx } from '@/shared/ui/paper'
import { SummaryPaperHeader } from '@/shared/ui/summary-paper-header'
import { appToast } from '@/shared/ui/toast/toast.helpers'
import { showErrorToast } from '@/shared/ui/toast/toast-error'
import { useJsonDirtyState } from '@/shared/ui/unsaved-changes'
import { generalSettingsApi } from './general-settings.api'
import { useSettingsUnsavedRegistration } from './settings-unsaved-context'

const BUSINESS_TYPES = [
  { value: 'individual', label: 'Cá nhân' },
  { value: 'business', label: 'Doanh nghiệp' },
]

const CURRENCIES = ['USD', 'VND', 'EUR']
const TIMEZONES = ['Asia/Saigon', 'UTC', 'America/New_York']

export function SettingsStoreDetailsPage(): ReactElement {
  const navigate = useNavigate()
  const { user, refreshUser } = useAuth()
  const { activeStore, refreshStores } = useStore()
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [storeName, setStoreName] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [timezone, setTimezone] = useState('Asia/Saigon')
  const [businessType, setBusinessType] = useState('individual')
  const [legalFullName, setLegalFullName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [states, setStates] = useState<LocationItem[]>([])
  const [cities, setCities] = useState<CityItem[]>([])
  const [districts, setDistricts] = useState<DistrictItem[]>([])
  const [shippingContactName, setShippingContactName] = useState('')
  const [shippingPhone, setShippingPhone] = useState('')
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
    {
      storeName,
      currency,
      timezone,
      businessType,
      legalFullName,
      contactEmail,
      contactPhone,
      shippingContactName,
      shippingPhone,
      stateId,
      cityId,
      districtId,
      addressLine,
    },
    !isLoading,
  )

  useEffect(() => {
    if (!activeStore) {
      setIsLoading(false)
      return
    }

    let cancelled = false

    const load = async () => {
      setIsLoading(true)
      try {
        const [store, settings, nextStates] = await Promise.all([
          storeApi.getStore(activeStore.id),
          generalSettingsApi.getGeneralSettings(),
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
        setShippingContactName(settings.defaults.shipping_address.contact_name)
        setShippingPhone(settings.defaults.shipping_address.phone)
        setStateId(settings.defaults.shipping_address.state_id ?? '')
        setCityId(settings.defaults.shipping_address.city_id ?? '')
        setDistrictId(settings.defaults.shipping_address.district_id ?? '')
        setAddressLine(settings.defaults.shipping_address.address_line)
        setBankSnapshot(settings.defaults.bank_account)
        setVatSnapshot(settings.defaults.vat)
        dirtyState.setInitialSnapshot(
          JSON.stringify({
            storeName: store.name,
            currency: store.default_currency,
            timezone: store.default_timezone,
            businessType: store.profile.business_type || 'individual',
            legalFullName: store.profile.legal_full_name,
            contactEmail: store.profile.contact_email || user?.email || '',
            contactPhone: store.profile.contact_phone,
            shippingContactName: settings.defaults.shipping_address.contact_name,
            shippingPhone: settings.defaults.shipping_address.phone,
            stateId: settings.defaults.shipping_address.state_id ?? '',
            cityId: settings.defaults.shipping_address.city_id ?? '',
            districtId: settings.defaults.shipping_address.district_id ?? '',
            addressLine: settings.defaults.shipping_address.address_line,
          }),
        )
      } catch (error) {
        if (!cancelled) {
          showErrorToast(error, 'Không thể tải cấu hình cửa hàng.')
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

  const { initialSnapshot, currentSnapshot, isDirty } = dirtyState

  const handleSave = async () => {
    if (!activeStore) {
      return
    }

    setIsSaving(true)

    try {
      await Promise.all([
        storeApi.updateStore(activeStore.id, {
          name: storeName,
          default_currency: currency,
          default_timezone: timezone,
          profile: {
            business_type: businessType,
            legal_full_name: legalFullName,
            contact_email: contactEmail,
            contact_phone: contactPhone,
          },
        }),
        generalSettingsApi.updateGeneralSettings({
          defaults: {
            shipping_address: {
              contact_name: shippingContactName,
              phone: shippingPhone,
              state_id: stateId || null,
              city_id: cityId || null,
              district_id: districtId || null,
              address_line: addressLine,
            },
            bank_account: bankSnapshot,
            vat: vatSnapshot,
          },
        }),
      ])

      await Promise.all([refreshUser(), refreshStores()])
      dirtyState.setInitialSnapshot(currentSnapshot)
      appToast.success('Đã cập nhật thông tin cửa hàng.')
      navigate('/settings/general', { state: { overlayFrom: '/' } })
    } catch (error) {
      showErrorToast(error, 'Không thể lưu thông tin cửa hàng.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDiscard = () => {
    if (!initialSnapshot) {
      return
    }

    const snapshot = JSON.parse(initialSnapshot) as {
      storeName: string
      currency: string
      timezone: string
      businessType: string
      legalFullName: string
      contactEmail: string
      contactPhone: string
      shippingContactName: string
      shippingPhone: string
      stateId: number | ''
      cityId: number | ''
      districtId: number | ''
      addressLine: string
    }

    setStoreName(snapshot.storeName)
    setCurrency(snapshot.currency)
    setTimezone(snapshot.timezone)
    setBusinessType(snapshot.businessType)
    setLegalFullName(snapshot.legalFullName)
    setContactEmail(snapshot.contactEmail)
    setContactPhone(snapshot.contactPhone)
    setShippingContactName(snapshot.shippingContactName)
    setShippingPhone(snapshot.shippingPhone)
    setStateId(snapshot.stateId)
    setCityId(snapshot.cityId)
    setDistrictId(snapshot.districtId)
    setAddressLine(snapshot.addressLine)
  }

  const { pulse } = useSettingsUnsavedRegistration(
    useMemo(
      () => ({
        isDirty,
        isSaving,
        onSave: () => void handleSave(),
        onDiscard: handleDiscard,
      }),
      [isDirty, isSaving],
    ),
  )

  return (
    <Stack spacing={2.5} sx={{ pb: 8 }}>
      <Paper sx={borderedCardSx}>
        <Stack spacing={2}>
          <SummaryPaperHeader title="Thông tin cửa hàng" />
          {isLoading ? <CircularProgress size={24} /> : null}


          <StackedTextField
            fullWidth
            label="Tên cửa hàng"
            value={storeName}
            onChange={(event) => setStoreName(event.target.value)}
          />

          <StackedTextField
            fullWidth
            label="Email"
            value={contactEmail}
            onChange={(event) => setContactEmail(event.target.value)}
          />
          
          <StackedTextField
            fullWidth
            label="Họ và tên pháp lý"
            value={legalFullName}
            onChange={(event) => setLegalFullName(event.target.value)}
          />

          <StackedTextField
            fullWidth
            label="Số điện thoại"
            value={contactPhone}
            onChange={(event) => setContactPhone(event.target.value)}
          />

          <StackedDropdown
            fullWidth
            label="Mô hình cửa hàng"
            value={businessType}
            onChange={(event) => setBusinessType(String(event.target.value))}
          >
            {BUSINESS_TYPES.map((item) => (
              <MenuItem key={item.value} value={item.value}>
                {item.label}
              </MenuItem>
            ))}
          </StackedDropdown>
        </Stack>
      </Paper>

      <Paper sx={borderedCardSx}>
        <Stack spacing={2}>
          <Stack spacing={0.75}>
            <SummaryPaperHeader title="Địa chỉ giao hàng mặc định" />
          </Stack>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
              gap: 2,
            }}
          >
            <StackedTextField
              fullWidth
              label="Tên liên hệ"
              value={shippingContactName}
              onChange={(event) => setShippingContactName(event.target.value)}
            />
            <StackedTextField
              fullWidth
              label="Số điện thoại"
              value={shippingPhone}
              onChange={(event) => setShippingPhone(event.target.value)}
            />
          </Box>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
              gap: 2,
            }}
          >
            <StackedDropdown
              fullWidth
              label="Tỉnh / Thành phố"
              value={stateId}
              onChange={(event) => setStateId(Number(event.target.value) || '')}
            >
              <MenuItem value="">Chưa chọn</MenuItem>
              {states.map((item) => (
                <MenuItem key={item.id} value={item.id}>
                  {item.name}
                </MenuItem>
              ))}
            </StackedDropdown>

            <StackedDropdown
              fullWidth
              label="Quận / Huyện"
              value={cityId}
              onChange={(event) => setCityId(Number(event.target.value) || '')}
              disabled={!stateId}
            >
              <MenuItem value="">Chưa chọn</MenuItem>
              {cities.map((item) => (
                <MenuItem key={item.id} value={item.id}>
                  {item.name}
                </MenuItem>
              ))}
            </StackedDropdown>

            <StackedDropdown
              fullWidth
              label="Phường / Xã"
              value={districtId}
              onChange={(event) => setDistrictId(Number(event.target.value) || '')}
              disabled={!cityId}
            >
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
            minRows={3}
          />
        </Stack>
      </Paper>

      <Paper sx={borderedCardSx}>
        <Stack spacing={2}>
          <SummaryPaperHeader title="Thiết lập mặc định" />
          <StackedDropdown
            fullWidth
            label="Tiền tệ"
            value={currency}
            onChange={(event) => setCurrency(String(event.target.value))}
          >
            {CURRENCIES.map((item) => (
              <MenuItem key={item} value={item}>
                {item}
              </MenuItem>
            ))}
          </StackedDropdown>

          <StackedDropdown
            fullWidth
            label="Múi giờ"
            value={timezone}
            onChange={(event) => setTimezone(String(event.target.value))}
          >
            {TIMEZONES.map((item) => (
              <MenuItem key={item} value={item}>
                {item}
              </MenuItem>
            ))}
          </StackedDropdown>
        </Stack>
      </Paper>

      <Stack direction="row" spacing={1.25} sx={{ justifyContent: 'flex-end' }}>
        <Button
          variant="outlined"
          onClick={() => {
            if (isDirty) {
              pulse()
              return
            }

            navigate('/settings/general', { state: { overlayFrom: '/' } })
          }}
        >
          Hủy
        </Button>
        <Button variant="contained" onClick={() => void handleSave()} disabled={isSaving || isLoading || !activeStore}>
          {isSaving ? 'Đang lưu...' : 'Lưu cấu hình'}
        </Button>
      </Stack>
    </Stack>
  )
}
