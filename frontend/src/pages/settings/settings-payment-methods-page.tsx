import AccountBalanceOutlinedIcon from '@mui/icons-material/AccountBalanceOutlined'
import {
  Box,
  Button,
  Paper,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material'
import { useEffect, useMemo, useState, type ReactElement } from 'react'
import { StackedAutocomplete } from '@/shared/ui/form/stacked-autocomplete'
import { StackedTextField } from '@/shared/ui/form/stacked-text-field'
import { borderedCardSx } from '@/shared/ui/paper'
import { appToast } from '@/shared/ui/toast/toast.helpers'
import { showErrorToast } from '@/shared/ui/toast/toast-error'
import { useJsonDirtyState } from '@/shared/ui/unsaved-changes'
import { generalSettingsApi, type VietQrBankItem } from './general-settings.api'
import { useSettingsUnsavedRegistration } from './settings-unsaved-context'

function PaymentMethodsSkeleton(): ReactElement {
  return (
    <Stack spacing={2}>
      <Stack spacing={0.75}>
        <Skeleton variant="text" width={112} height={26} />
        <Skeleton variant="rounded" height={56} sx={{ borderRadius: 3 }} />
      </Stack>

      <Stack spacing={0.75}>
        <Skeleton variant="text" width={124} height={26} />
        <Skeleton variant="rounded" height={56} sx={{ borderRadius: 3 }} />
      </Stack>

      <Stack spacing={0.75}>
        <Skeleton variant="text" width={170} height={26} />
        <Skeleton variant="rounded" height={56} sx={{ borderRadius: 3 }} />
      </Stack>
    </Stack>
  )
}

export function SettingsPaymentMethodsPage(): ReactElement {
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [bankName, setBankName] = useState('')
  const [bankBin, setBankBin] = useState('')
  const [bankCode, setBankCode] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [accountHolder, setAccountHolder] = useState('')
  const [shippingSnapshot, setShippingSnapshot] = useState({
    contact_name: '',
    phone: '',
    state_id: null as number | null,
    city_id: null as number | null,
    district_id: null as number | null,
    address_line: '',
  })
  const [vatSnapshot, setVatSnapshot] = useState({
    enabled: false,
    rate_percent: 0,
  })
  const [bankOptions, setBankOptions] = useState<VietQrBankItem[]>([])
  const dirtyState = useJsonDirtyState(
    { bankName, bankBin, bankCode, accountNumber, accountHolder },
    !isLoading,
  )

  useEffect(() => {
    const load = async () => {
      setIsLoading(true)
      try {
        const [settings, banksResponse] = await Promise.all([
          generalSettingsApi.getGeneralSettings(),
          generalSettingsApi.getVietQrBanks(),
        ])

        setBankName(settings.defaults.bank_account.bank_name)
        setBankBin(settings.defaults.bank_account.bank_bin)
        setBankCode(settings.defaults.bank_account.bank_code)
        setAccountNumber(settings.defaults.bank_account.account_number)
        setAccountHolder(settings.defaults.bank_account.account_holder)
        setShippingSnapshot(settings.defaults.shipping_address)
        setVatSnapshot(settings.defaults.vat)
        setBankOptions(banksResponse.data)
        dirtyState.setInitialSnapshot(
          JSON.stringify({
            bankName: settings.defaults.bank_account.bank_name,
            bankBin: settings.defaults.bank_account.bank_bin,
            bankCode: settings.defaults.bank_account.bank_code,
            accountNumber: settings.defaults.bank_account.account_number,
            accountHolder: settings.defaults.bank_account.account_holder,
          }),
        )
      } catch (error) {
        showErrorToast(error, 'Không thể tải tài khoản ngân hàng mặc định.')
      } finally {
        setIsLoading(false)
      }
    }

    void load()
  }, [])

  const selectedBank = useMemo(
    () =>
      bankOptions.find((item) => item.bin === bankBin) ??
      bankOptions.find((item) => item.code === bankCode) ??
      bankOptions.find((item) => item.name === bankName) ??
      null,
    [bankBin, bankCode, bankName, bankOptions],
  )
  const { initialSnapshot, currentSnapshot, isDirty } = dirtyState

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await generalSettingsApi.updateGeneralSettings({
        defaults: {
          shipping_address: shippingSnapshot,
          bank_account: {
            bank_name: bankName,
            bank_bin: bankBin,
            bank_code: bankCode,
            account_number: accountNumber,
            account_holder: accountHolder,
            qr_template: 'compact',
          },
          vat: vatSnapshot,
        },
      })
      dirtyState.setInitialSnapshot(currentSnapshot)
      appToast.success('Đã cập nhật tài khoản ngân hàng mặc định.')
    } catch (error) {
      showErrorToast(error, 'Không thể lưu tài khoản ngân hàng mặc định.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDiscard = () => {
    if (!initialSnapshot) {
      return
    }

    const snapshot = JSON.parse(initialSnapshot) as {
      bankName: string
      bankBin: string
      bankCode: string
      accountNumber: string
      accountHolder: string
    }

    setBankName(snapshot.bankName)
    setBankBin(snapshot.bankBin)
    setBankCode(snapshot.bankCode)
    setAccountNumber(snapshot.accountNumber)
    setAccountHolder(snapshot.accountHolder)
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
        <Stack spacing={2.5}>
          <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
            <Box
              sx={{
                width: 42,
                height: 42,
                borderRadius: 3,
                display: 'grid',
                placeItems: 'center',
                bgcolor: '#ecfdf3',
                color: '#067647',
                flexShrink: 0,
              }}
            >
              <AccountBalanceOutlinedIcon fontSize="small" />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 700, color: '#101828' }}>Quản lý thanh toán</Typography>
              <Typography variant="body2" sx={{ color: '#667085' }}>
                Dùng làm thông tin thanh toán mặc định.
              </Typography>
            </Box>
          </Stack>

          {isLoading ? (
            <PaymentMethodsSkeleton />
          ) : (
            <Stack spacing={2}>
              <StackedAutocomplete<VietQrBankItem, false, false, false>
                options={bankOptions}
                label="Ngân hàng"
                placeholder="Chọn ngân hàng"
                value={selectedBank}
                loading={isLoading}
                autoHighlight
                getOptionLabel={(option) => option.short_name || option.name}
                isOptionEqualToValue={(option, value) => option.bin === value.bin}
                onChange={(_, value) => {
                  setBankName(value?.name ?? '')
                  setBankBin(value?.bin ?? '')
                  setBankCode(value?.code ?? '')
                }}
                renderOption={(props, option) => (
                  <Box component="li" {...props}>
                    <Stack spacing={0.25} sx={{ py: 0.5 }}>
                      <Typography sx={{ fontWeight: 700, color: '#101828' }}>
                        {option.short_name || option.name}
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#667085' }}>
                        {option.name}
                      </Typography>
                    </Stack>
                  </Box>
                )}
              />

              <StackedTextField fullWidth label="Số tài khoản" value={accountNumber} onChange={(event) => setAccountNumber(event.target.value)} />
              <StackedTextField fullWidth label="Tên chủ tài khoản" value={accountHolder} onChange={(event) => setAccountHolder(event.target.value)} />
            </Stack>
          )}
        </Stack>
      </Paper>

      <Stack direction="row" spacing={1.25} sx={{ justifyContent: 'flex-end' }}>
        <Button variant="contained" onClick={() => void handleSave()} disabled={isSaving || isLoading}>
          {isSaving ? 'Đang lưu...' : 'Lưu'}
        </Button>
      </Stack>
    </Stack>
  )
}

