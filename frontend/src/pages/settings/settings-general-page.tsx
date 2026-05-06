import { useEffect, useMemo, useState, type ReactElement } from 'react'
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded'
import CreditCardOutlinedIcon from '@mui/icons-material/CreditCardOutlined'
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined'
import { Box, InputAdornment, Paper, Skeleton, Stack, Switch, TextField, Typography } from '@mui/material'
import { useAuth } from '@/modules/auth/use-auth'
import { storeApi } from '@/modules/store/store.api'
import { useStore } from '@/modules/store/use-store'
import { borderedCardSx } from '@/shared/ui/paper'
import { SummaryPaperHeader } from '@/shared/ui/summary-paper-header'
import { appToast } from '@/shared/ui/toast/toast.helpers'
import { showErrorToast } from '@/shared/ui/toast/toast-error'
import { generalSettingsApi } from './general-settings.api'
import { useSettingsUnsavedRegistration } from './settings-unsaved-context'

function SummaryRow({
  icon,
  label,
  value,
  onClick,
}: {
  icon: ReactElement
  label: string
  value: string
  onClick?: () => void
}): ReactElement {
  return (
    <Stack
      component={onClick ? 'button' : 'div'}
      direction="row"
      spacing={1.5}
      onClick={onClick}
      type={onClick ? 'button' : undefined}
      sx={{
        width: '100%',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderRadius: 1,
        border: '1px solid #eaecf0',
        px: 1.5,
        py: 1.25,
        bgcolor: '#ffffff',
        textAlign: 'left',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease',
        '&:hover': onClick
          ? {
              borderColor: '#d0d5dd',
              boxShadow: '0 8px 20px rgba(15, 23, 42, 0.08)',
              transform: 'translateY(-1px)',
            }
          : undefined,
      }}
    >
      <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center', minWidth: 0 }}>
        <Box
          sx={{
            width: 38,
            height: 38,
            borderRadius: 2.5,
            display: 'grid',
            placeItems: 'center',
            bgcolor: '#f2f4f7',
            color: '#475467',
            flexShrink: 0,
          }}
        >
          {icon}
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700, color: '#101828' }}>{label}</Typography>
          <Typography variant="body2" sx={{ color: '#667085' }} noWrap>
            {value}
          </Typography>
        </Box>
      </Stack>

      <ChevronRightRoundedIcon sx={{ color: '#98a2b3', flexShrink: 0 }} />
    </Stack>
  )
}

function SummaryRowSkeleton(): ReactElement {
  return (
    <Stack
      direction="row"
      spacing={1.5}
      sx={{
        alignItems: 'center',
        justifyContent: 'space-between',
        borderRadius: 1,
        border: '1px solid #eaecf0',
        px: 1.5,
        py: 1.25,
        bgcolor: '#ffffff',
      }}
    >
      <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center', minWidth: 0, flex: 1 }}>
        <Skeleton variant="rounded" width={38} height={38} sx={{ borderRadius: 2.5, flexShrink: 0 }} />
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Skeleton variant="text" width="32%" height={24} />
          <Skeleton variant="text" width="58%" height={20} />
        </Box>
      </Stack>
      <Skeleton variant="circular" width={20} height={20} />
    </Stack>
  )
}

function VatSectionSkeleton(): ReactElement {
  return (
    <Stack spacing={2}>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={1.5}
        sx={{ justifyContent: 'space-between', alignItems: { md: 'center' } }}
      >
        <Box sx={{ flex: 1 }}>
          <Skeleton variant="text" width={120} height={26} />
          <Skeleton variant="text" width="62%" height={20} />
        </Box>
        <Skeleton variant="rounded" width={44} height={24} />
      </Stack>
      <Skeleton variant="text" width={180} height={32} />
    </Stack>
  )
}

export function SettingsGeneralPage(): ReactElement {
  const { user } = useAuth()
  const { activeStore } = useStore()
  const [isLoading, setIsLoading] = useState(true)
  const [storeName, setStoreName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [bankName, setBankName] = useState('')
  const [accountHolder, setAccountHolder] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [vatEnabled, setVatEnabled] = useState(false)
  const [vatRatePercent, setVatRatePercent] = useState('0')
  const [isSavingVat, setIsSavingVat] = useState(false)
  const [initialVatEnabled, setInitialVatEnabled] = useState(false)
  const [initialVatRatePercent, setInitialVatRatePercent] = useState('0')

  useEffect(() => {
    if (!activeStore) {
      setIsLoading(false)
      return
    }

    let cancelled = false

    const load = async () => {
      setIsLoading(true)
      try {
        const [store, settings] = await Promise.all([
          storeApi.getStore(activeStore.id),
          generalSettingsApi.getGeneralSettings(),
        ])

        if (cancelled) {
          return
        }

        setStoreName(store.name)
        setContactEmail(store.profile.contact_email || user?.email || '')
        setContactPhone(store.profile.contact_phone)
        setBankName(settings.defaults.bank_account.bank_name)
        setAccountHolder(settings.defaults.bank_account.account_holder)
        setAccountNumber(settings.defaults.bank_account.account_number)
        setVatEnabled(settings.defaults.vat.enabled)
        setVatRatePercent(String(settings.defaults.vat.rate_percent))
        setInitialVatEnabled(settings.defaults.vat.enabled)
        setInitialVatRatePercent(String(settings.defaults.vat.rate_percent))
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

  const hasUnsavedVatChanges = useMemo(
    () => vatEnabled !== initialVatEnabled || String(vatRatePercent) !== String(initialVatRatePercent),
    [initialVatEnabled, initialVatRatePercent, vatEnabled, vatRatePercent],
  )

  const handleDiscardVatChanges = () => {
    setVatEnabled(initialVatEnabled)
    setVatRatePercent(initialVatRatePercent)
  }

  const handleSaveVatSettings = async () => {
    try {
      setIsSavingVat(true)

      const currentSettings = await generalSettingsApi.getGeneralSettings()
      const updated = await generalSettingsApi.updateGeneralSettings({
        defaults: {
          ...currentSettings.defaults,
          vat: {
            enabled: vatEnabled,
            rate_percent: Math.max(Number(vatRatePercent || 0), 0),
          },
        },
      })

      setVatEnabled(updated.defaults.vat.enabled)
      setVatRatePercent(String(updated.defaults.vat.rate_percent))
      setInitialVatEnabled(updated.defaults.vat.enabled)
      setInitialVatRatePercent(String(updated.defaults.vat.rate_percent))
      appToast.success('Đã lưu cấu hình thuế VAT.')
    } catch (error) {
      showErrorToast(error, 'Không thể lưu cấu hình thuế VAT.')
    } finally {
      setIsSavingVat(false)
    }
  }

  const { attemptNavigate } = useSettingsUnsavedRegistration(
    useMemo(
      () => ({
        isDirty: hasUnsavedVatChanges,
        isSaving: isSavingVat,
        onSave: () => void handleSaveVatSettings(),
        onDiscard: handleDiscardVatChanges,
      }),
      [hasUnsavedVatChanges, isSavingVat],
    ),
  )

  return (
    <Stack spacing={2.5} sx={{ pb: 8 }}>
      <Paper sx={borderedCardSx}>
        <Stack spacing={2.5}>
          <Stack spacing={0.75}>
            <SummaryPaperHeader title="Thông tin cửa hàng" />
          </Stack>

          {isLoading ? (
            <SummaryRowSkeleton />
          ) : (
            <SummaryRow
              icon={<StorefrontOutlinedIcon fontSize="small" />}
              label={storeName || 'Chưa có tên cửa hàng'}
              value={`${contactEmail || 'Chưa có email'} • ${contactPhone || 'Chưa có số điện thoại'}`}
              onClick={() => attemptNavigate('/settings/general/store-details')}
            />
          )}
        </Stack>
      </Paper>

      <Paper sx={borderedCardSx}>
        <Stack spacing={2.5}>
          <Stack spacing={0.75}>
            <SummaryPaperHeader title="Quản lý thanh toán" />
            <Typography sx={{ color: '#667085' }}>
              Thông tin hiển thị nhanh để kiểm tra trước khi mở trang chỉnh sửa.
            </Typography>
          </Stack>

          <Stack spacing={1.25}>
            {isLoading ? (
              <SummaryRowSkeleton />
            ) : (
              <SummaryRow
                icon={<CreditCardOutlinedIcon fontSize="small" />}
                label={bankName || 'Chưa có ngân hàng'}
                value={
                  accountHolder || accountNumber
                    ? `${accountHolder || 'Chưa có chủ tài khoản'} - ${accountNumber || 'Chưa có số tài khoản'}`
                    : 'Thêm thông tin tài khoản ngân hàng mặc định'
                }
                onClick={() => attemptNavigate('/settings/general/payment-methods')}
              />
            )}
          </Stack>
        </Stack>
      </Paper>

      <Paper sx={borderedCardSx}>
        <Stack spacing={2.5}>
          <Stack spacing={0.75}>
            <SummaryPaperHeader title="Thuế VAT" />
            <Typography sx={{ color: '#667085' }}>
              Áp dụng VAT mặc định ở cấp cửa hàng cho phần thanh toán của đơn hàng.
            </Typography>
          </Stack>

          {isLoading ? (
            <VatSectionSkeleton />
          ) : (
            <>
              <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={1.5}
                sx={{ justifyContent: 'space-between', alignItems: { md: 'center' } }}
              >
                <Stack spacing={0.35}>
                  <Typography sx={{ fontWeight: 700, color: '#101828' }}>Bật thuế VAT</Typography>
                  <Typography variant="body2" sx={{ color: '#667085' }}>
                    Khi bật, hệ thống sẽ tự động tính VAT từ tạm tính theo tỷ lệ cấu hình.
                  </Typography>
                </Stack>
                <Switch
                  checked={vatEnabled}
                  disabled={isSavingVat}
                  onChange={(event) => setVatEnabled(event.target.checked)}
                />
              </Stack>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ alignItems: { sm: 'flex-end' } }}>
                {vatEnabled ? (
                  <TextField
                    label="Mức VAT"
                    variant="standard"
                    type="number"
                    value={vatRatePercent}
                    disabled={isSavingVat}
                    onChange={(event) => setVatRatePercent(event.target.value)}
                    sx={{ width: { xs: '100%', sm: 220 } }}
                    slotProps={{
                      htmlInput: {
                        min: 0,
                        step: '0.01',
                      },
                      input: {
                        endAdornment: <InputAdornment position="end">%</InputAdornment>,
                      },
                    }}
                  />
                ) : (
                  <Typography variant="body2" sx={{ color: '#667085' }}>
                    Tắt VAT thì hệ thống sẽ không hiển thị dòng thuế ở phần thanh toán.
                  </Typography>
                )}
              </Stack>
            </>
          )}
        </Stack>
      </Paper>
    </Stack>
  )
}
