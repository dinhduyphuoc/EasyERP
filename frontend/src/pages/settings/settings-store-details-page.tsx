import { useEffect, useMemo, useState, type ReactElement } from 'react'
import {
  Button,
  CircularProgress,
  MenuItem,
  Paper,
  Stack,
} from '@mui/material'
import { useNavigate } from 'react-router'
import { useAuth } from '@/modules/auth/use-auth'
import { storeApi } from '@/modules/store/store.api'
import { useStore } from '@/modules/store/use-store'
import { StackedDropdown } from '@/shared/ui/form/stacked-dropdown'
import { StackedTextField } from '@/shared/ui/form/stacked-text-field'
import { borderedCardSx } from '@/shared/ui/paper'
import { SummaryPaperHeader } from '@/shared/ui/summary-paper-header'
import { appToast } from '@/shared/ui/toast/toast.helpers'
import { showErrorToast } from '@/shared/ui/toast/toast-error'
import { useJsonDirtyState } from '@/shared/ui/unsaved-changes'
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
  const dirtyState = useJsonDirtyState(
    {
      storeName,
      currency,
      timezone,
      businessType,
      legalFullName,
      contactEmail,
      contactPhone,
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
        const store = await storeApi.getStore(activeStore.id)

        if (cancelled) {
          return
        }

        setStoreName(store.name)
        setCurrency(store.default_currency)
        setTimezone(store.default_timezone)
        setBusinessType(store.profile.business_type || 'individual')
        setLegalFullName(store.profile.legal_full_name)
        setContactEmail(store.profile.contact_email || user?.email || '')
        setContactPhone(store.profile.contact_phone)
        dirtyState.setInitialSnapshot(
          JSON.stringify({
            storeName: store.name,
            currency: store.default_currency,
            timezone: store.default_timezone,
            businessType: store.profile.business_type || 'individual',
            legalFullName: store.profile.legal_full_name,
            contactEmail: store.profile.contact_email || user?.email || '',
            contactPhone: store.profile.contact_phone,
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

  const { initialSnapshot, currentSnapshot, isDirty } = dirtyState

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
        },
      })

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
    }

    setStoreName(snapshot.storeName)
    setCurrency(snapshot.currency)
    setTimezone(snapshot.timezone)
    setBusinessType(snapshot.businessType)
    setLegalFullName(snapshot.legalFullName)
    setContactEmail(snapshot.contactEmail)
    setContactPhone(snapshot.contactPhone)
  }

  const { attemptNavigate, pulse } = useSettingsUnsavedRegistration(
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

          <StackedTextField
            fullWidth
            label="Họ và tên pháp lý"
            value={legalFullName}
            onChange={(event) => setLegalFullName(event.target.value)}
          />

          <Button
            variant="outlined"
            onClick={() => attemptNavigate('/settings/address-management')}
            sx={{ alignSelf: 'flex-start' }}
          >
            Quản lý địa chỉ giao hàng mặc định
          </Button>
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
