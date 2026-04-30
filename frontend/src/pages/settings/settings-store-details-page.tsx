import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import {
  Alert,
  Button,
  CircularProgress,
  MenuItem,
  Paper,
  Stack,
} from '@mui/material'
import { useEffect, useState, type ReactElement } from 'react'
import { useNavigate } from 'react-router'
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
  const [storeName, setStoreName] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [timezone, setTimezone] = useState('Asia/Saigon')
  const [businessType, setBusinessType] = useState('individual')
  const [legalFullName, setLegalFullName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')

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
      } catch (error) {
        if (!cancelled) {
          appToast.error(getErrorMessage(error, 'Khong the tai cau hinh cua hang.'))
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
      appToast.success('Da cap nhat thong tin cua hang.')
      navigate('/settings/general', { state: { overlayFrom: '/' } })
    } catch (error) {
      appToast.error(getErrorMessage(error, 'Khong the luu thong tin cua hang.'))
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
            Quay lai Cai dat chung
          </Button>
          <SummaryPaperHeader title="Thong tin cua hang" />
          <Alert severity="info" sx={{ borderRadius: 3 }}>
            Chinh sua ten cua hang, thong tin lien he, ho so phap ly va thiet lap van hanh mac dinh.
          </Alert>
        </Stack>
      </Paper>

      <Paper sx={borderedCardSx}>
        <Stack spacing={2}>
          <SummaryPaperHeader title="Ho so cua hang" />
          {isLoading ? <CircularProgress size={24} /> : null}

          <StackedTextField
            fullWidth
            label="Ten cua hang"
            value={storeName}
            onChange={(event) => setStoreName(event.target.value)}
            helperText="Hien thi tren cua hang cua ban."
          />

          <StackedTextField
            fullWidth
            label="Email cua hang"
            value={contactEmail}
            onChange={(event) => setContactEmail(event.target.value)}
          />

          <StackedTextField
            fullWidth
            label="So dien thoai cua hang"
            value={contactPhone}
            onChange={(event) => setContactPhone(event.target.value)}
          />

          <StackedDropdown fullWidth label="Loai hinh" value={businessType} onChange={(event) => setBusinessType(String(event.target.value))}>
            {BUSINESS_TYPES.map((item) => (
              <MenuItem key={item.value} value={item.value}>
                {item.label}
              </MenuItem>
            ))}
          </StackedDropdown>

          <StackedTextField
            fullWidth
            label="Ten phap ly / Ho va ten"
            value={legalFullName}
            onChange={(event) => setLegalFullName(event.target.value)}
          />

          <Alert severity="info" sx={{ borderRadius: 3 }}>
            Dia chi giao hang mac dinh cua shop duoc quan ly tai "Quan ly dia chi" va duoc dung lam nguon chuan cho shipping flow.
          </Alert>
          <Button
            variant="outlined"
            onClick={() => navigate('/settings/address-management', { state: { overlayFrom: '/' } })}
            sx={{ alignSelf: 'flex-start' }}
          >
            Quan ly dia chi giao hang mac dinh
          </Button>
        </Stack>
      </Paper>

      <Paper sx={borderedCardSx}>
        <Stack spacing={2}>
          <SummaryPaperHeader title="Thiet lap mac dinh" />
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
        <Button variant="outlined" onClick={() => navigate('/settings/general', { state: { overlayFrom: '/' } })}>
          Huy
        </Button>
        <Button variant="contained" onClick={() => void handleSave()} disabled={isSaving || isLoading || !activeStore}>
          {isSaving ? 'Dang luu...' : 'Luu cau hinh'}
        </Button>
      </Stack>
    </Stack>
  )
}
