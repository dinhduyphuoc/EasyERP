import { useEffect, useMemo, useState, type ReactElement } from 'react'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  Typography,
} from '@mui/material'
import { useNavigate } from 'react-router'
import { useAuth } from '@/modules/auth/use-auth'
import { storeApi } from '@/modules/store/store.api'
import { useStore } from '@/modules/store/use-store'
import { borderedCardSx } from '@/shared/ui/paper'
import { SummaryPaperHeader } from '@/shared/ui/summary-paper-header'
import { StackedDropdown } from '@/shared/ui/form/stacked-dropdown'
import { StackedTextField } from '@/shared/ui/form/stacked-text-field'
import { appToast } from '@/shared/ui/toast/toast.helpers'
import { showErrorToast } from '@/shared/ui/toast/toast-error'
import { MenuItem } from '@mui/material'

const addressToText = (value: Record<string, unknown>) => String(value.address_line ?? '')

const applyStoreForm = (
  store: Awaited<ReturnType<typeof storeApi.getStore>>,
  setters: {
    setName: (value: string) => void
    setSlug: (value: string) => void
    setCurrency: (value: string) => void
    setTimezone: (value: string) => void
    setDefaultAddress: (value: string) => void
    setBillingAddress: (value: string) => void
    setReturnAddress: (value: string) => void
  },
) => {
  setters.setName(store.name)
  setters.setSlug(store.slug)
  setters.setCurrency(store.default_currency)
  setters.setTimezone(store.default_timezone)
  setters.setDefaultAddress(addressToText(store.addresses.default))
  setters.setBillingAddress(addressToText(store.addresses.billing))
  setters.setReturnAddress(addressToText(store.addresses.return))
}

export function StoreSettingsPage(): ReactElement {
  const navigate = useNavigate()
  const { user, refreshUser } = useAuth()
  const { activeStore, refreshStores } = useStore()
  const [isLoading, setIsLoading] = useState(true)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [timezone, setTimezone] = useState('Asia/Saigon')
  const [defaultAddress, setDefaultAddress] = useState('')
  const [billingAddress, setBillingAddress] = useState('')
  const [returnAddress, setReturnAddress] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [hasAttemptedSave, setHasAttemptedSave] = useState(false)

  const errors = useMemo(() => {
    const nextErrors: Partial<Record<'name' | 'slug', string>> = {}

    if (!name.trim()) {
      nextErrors.name = 'Tên cửa hàng là bắt buộc.'
    }

    if (!slug.trim()) {
      nextErrors.slug = 'Slug là bắt buộc.'
    }

    return nextErrors
  }, [name, slug])

  useEffect(() => {
    if (!activeStore) {
      setIsLoading(false)
      return
    }

    let cancelled = false

    const loadStore = async () => {
      setIsLoading(true)
      try {
        const store = await storeApi.getStore(activeStore.id)

        if (cancelled) {
          return
        }

        applyStoreForm(store, {
          setName,
          setSlug,
          setCurrency,
          setTimezone,
          setDefaultAddress,
          setBillingAddress,
          setReturnAddress,
        })
      } catch (error) {
        if (!cancelled) {
          showErrorToast(error, 'Could not load store settings.')
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void loadStore()

    return () => {
      cancelled = true
    }
  }, [activeStore?.id])

  const handleSave = async () => {
    if (!activeStore) {
      return
    }

    setHasAttemptedSave(true)

    if (Object.keys(errors).length > 0) {
      appToast.warning('Vui lòng kiểm tra lại các trường bắt buộc.')
      return
    }

    setIsSaving(true)
    try {
      const updatedStore = await storeApi.updateStore(activeStore.id, {
        name,
        slug,
        default_currency: currency,
        default_timezone: timezone,
        default_address: { address_line: defaultAddress },
        billing_address: { address_line: billingAddress },
        return_address: { address_line: returnAddress },
      })
      applyStoreForm(updatedStore, {
        setName,
        setSlug,
        setCurrency,
        setTimezone,
        setDefaultAddress,
        setBillingAddress,
        setReturnAddress,
      })
      await refreshUser()
      await refreshStores()
      appToast.success('Store information and defaults were saved.')
    } catch (error) {
      showErrorToast(error, 'Could not save store settings.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!activeStore) {
      return
    }

    setIsDeleting(true)
    try {
      await storeApi.deleteStore(activeStore.id)
      await refreshUser()
      await refreshStores()
      appToast.success('Store deleted successfully.')
      navigate('/')
    } catch (error) {
      showErrorToast(error, 'Could not delete this store.')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Stack spacing={2.5} sx={{ pb: 8 }}>
      <Paper sx={borderedCardSx}>
        <Stack spacing={1.25}>
          <SummaryPaperHeader title="Store management" />
          <Typography sx={{ color: '#667085' }}>
            Configure the active store context for orders, customers, products, and operational defaults.
          </Typography>
        </Stack>
      </Paper>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', xl: 'repeat(2, minmax(0, 1fr))' },
          gap: 2.5,
          alignItems: 'start',
        }}
      >
        <Paper sx={borderedCardSx}>
          <Stack spacing={2}>
            <SummaryPaperHeader title="Store info" />
            {isLoading ? <CircularProgress size={24} /> : null}
            <StackedTextField
              fullWidth
              required
              label="Name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              submitError={hasAttemptedSave ? errors.name : undefined}
            />
            <StackedTextField
              fullWidth
              required
              label="Slug"
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
              submitError={hasAttemptedSave ? errors.slug : undefined}
            />
            <StackedTextField
              fullWidth
              label="Owner"
              value={user?.full_name ?? ''}
              disabled
            />
          </Stack>
        </Paper>

        <Paper sx={borderedCardSx}>
          <Stack spacing={2}>
            <SummaryPaperHeader title="Store defaults" />
            {isLoading ? <CircularProgress size={24} /> : null}
            <StackedDropdown fullWidth label="Currency" value={currency} onChange={(event) => setCurrency(String(event.target.value))}>
              {['USD', 'VND', 'EUR'].map((item) => (
                <MenuItem key={item} value={item}>
                  {item}
                </MenuItem>
              ))}
            </StackedDropdown>
            <StackedDropdown fullWidth label="Timezone" value={timezone} onChange={(event) => setTimezone(String(event.target.value))}>
              {['Asia/Saigon', 'UTC', 'America/New_York'].map((item) => (
                <MenuItem key={item} value={item}>
                  {item}
                </MenuItem>
              ))}
            </StackedDropdown>
          </Stack>
        </Paper>

        <Paper sx={borderedCardSx}>
          <Stack spacing={2}>
            <SummaryPaperHeader title="Store addresses" />
            {isLoading ? <CircularProgress size={24} /> : null}
            <StackedTextField fullWidth label="Default address" value={defaultAddress} onChange={(event) => setDefaultAddress(event.target.value)} multiline minRows={2} />
            <StackedTextField fullWidth label="Billing address" value={billingAddress} onChange={(event) => setBillingAddress(event.target.value)} multiline minRows={2} />
            <StackedTextField fullWidth label="Return address" value={returnAddress} onChange={(event) => setReturnAddress(event.target.value)} multiline minRows={2} />
          </Stack>
        </Paper>

        <Paper sx={{ ...borderedCardSx, borderColor: 'rgba(217, 45, 32, 0.18)' }}>
          <Stack spacing={2}>
            <SummaryPaperHeader title="Store actions" />
            <Alert severity="warning" sx={{ borderRadius: 3 }}>
              Deleting a store hides it from the workspace and switches you to another available store.
            </Alert>
            <Button
              variant="outlined"
              color="error"
              onClick={() => void handleDelete()}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete store'}
            </Button>
          </Stack>
        </Paper>
      </Box>

      <Stack direction="row" spacing={1.25} sx={{ justifyContent: 'flex-end' }}>
        <Button variant="contained" onClick={() => void handleSave()} disabled={isSaving || isLoading || !activeStore}>
          {isSaving ? 'Saving...' : 'Save store settings'}
        </Button>
      </Stack>
    </Stack>
  )
}
