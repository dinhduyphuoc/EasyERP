import { useEffect, useMemo, useState, type ReactElement } from 'react'
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import LinkOffOutlinedIcon from '@mui/icons-material/LinkOffOutlined'
import LinkOutlinedIcon from '@mui/icons-material/LinkOutlined'
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Link,
  Paper,
  Stack,
  Typography,
} from '@mui/material'
import { alpha } from '@mui/material/styles'
import { ListPageHeader } from '@/shared/ui/list/list-page-header'
import { StackedTextField } from '@/shared/ui/form/stacked-text-field'
import { borderedCardSx, defaultCardSx } from '@/shared/ui/paper'
import { appToast } from '@/shared/ui/toast/toast.helpers'
import {
  shippingApi,
  type ShippingConnectionDetail,
  type ShippingCredentialField,
  type ShippingProviderCardItem,
} from './shipping.api'

const DEFAULT_STORE_ID = 'default-store'

type ShippingManagementViewProps = {
  title?: string
  description?: string
}

const LOOKUP_LINKS: Record<string, string> = {
  ghn: 'https://donhang.ghn.vn/',
  ghtk: 'https://i.ghtk.vn/',
}

const PROVIDER_LOGOS: Record<string, string> = {
  ghn: 'https://symmie-837501718307-ap-southeast-2-an.s3.ap-southeast-2.amazonaws.com/Logo/ghn.jpg',
  ghtk: 'https://symmie-837501718307-ap-southeast-2-an.s3.ap-southeast-2.amazonaws.com/Logo/ghtk.png',
}

function formatDateTime(value: string | null) {
  if (!value) {
    return 'Chưa có'
  }

  return new Date(value).toLocaleString('vi-VN')
}

function getProviderMonogram(code: string) {
  return code.toUpperCase().slice(0, 4)
}

function getProviderLogo(code: string) {
  return PROVIDER_LOGOS[code.toLowerCase()] ?? null
}

function getStatusTone(status: ShippingProviderCardItem['status']['code']) {
  if (status === 'connected') {
    return {
      label: 'Đã liên kết',
      chipSx: {
        bgcolor: '#ecfdf3',
        color: '#067647',
        borderColor: '#abefc6',
      },
      accent: '#067647',
      surface: '#ecfdf3',
    }
  }

  if (status === 'error') {
    return {
      label: 'Lỗi kết nối',
      chipSx: {
        bgcolor: '#fef3f2',
        color: '#b42318',
        borderColor: '#fecdca',
      },
      accent: '#b42318',
      surface: '#fef3f2',
    }
  }

  return {
    label: 'Chưa liên kết',
    chipSx: {
      bgcolor: '#f8fafc',
      color: '#475467',
      borderColor: '#d0d5dd',
    },
    accent: '#475467',
    surface: '#f8fafc',
  }
}

function getPrimaryCredentialField(fields: ShippingCredentialField[]) {
  return fields.find((field) => field.key === 'token') ?? fields[0] ?? null
}

export function ShippingManagementView({
  title = 'Vận chuyển',
  description = 'Quản lý kết nối với các đơn vị vận chuyển, cấu hình token theo từng nhà vận chuyển và theo dõi trạng thái tích hợp trên hệ thống.',
}: ShippingManagementViewProps): ReactElement {
  const [providers, setProviders] = useState<ShippingProviderCardItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [selectedCode, setSelectedCode] = useState<string | null>(null)
  const [detail, setDetail] = useState<ShippingConnectionDetail | null>(null)
  const [isDetailLoading, setIsDetailLoading] = useState(false)
  const [formValues, setFormValues] = useState<Record<string, string>>({})
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [isSaving, setIsSaving] = useState(false)
  const [modalError, setModalError] = useState<string | null>(null)

  const loadProviders = async (options?: { silent?: boolean }) => {
    if (options?.silent) {
      setIsRefreshing(true)
    } else {
      setIsLoading(true)
    }

    try {
      const data = await shippingApi.listProviders(DEFAULT_STORE_ID)
      setProviders(data.items)
    } catch (error) {
      console.error('Lỗi khi tải danh sách đơn vị vận chuyển:', error)
      appToast.error('Không thể tải danh sách đơn vị vận chuyển.')
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    void loadProviders()
  }, [])

  const summary = useMemo(() => {
    const connected = providers.filter((item) => item.status.code === 'connected').length
    const disconnected = providers.filter((item) => item.status.code === 'disconnected').length
    const error = providers.filter((item) => item.status.code === 'error').length

    return { connected, disconnected, error }
  }, [providers])

  const initializeForm = (nextDetail: ShippingConnectionDetail) => {
    const nextValues: Record<string, string> = {}

    nextDetail.provider.credential_fields.forEach((field) => {
      nextValues[field.key] = ''
    })

    setFormValues(nextValues)
    setFormErrors({})
  }

  const handleOpenModal = async (providerCode: string) => {
    setSelectedCode(providerCode)
    setDetail(null)
    setModalError(null)
    setIsDetailLoading(true)

    try {
      const data = await shippingApi.getConnectionDetail(providerCode, DEFAULT_STORE_ID)
      setDetail(data)
      initializeForm(data)
    } catch (error) {
      console.error('Lỗi khi tải cấu hình đơn vị vận chuyển:', error)
      appToast.error('Không thể tải chi tiết cấu hình đơn vị vận chuyển.')
    } finally {
      setIsDetailLoading(false)
    }
  }

  const handleCloseModal = () => {
    if (isSaving) {
      return
    }

    setSelectedCode(null)
    setDetail(null)
    setFormValues({})
    setFormErrors({})
    setModalError(null)
  }

  const validateForm = () => {
    if (!detail) {
      return false
    }

    const nextErrors: Record<string, string> = {}

    detail.provider.credential_fields.forEach((field) => {
      const rawValue = formValues[field.key] ?? ''
      const value = rawValue.trim()

      if (field.required && !value) {
        nextErrors[field.key] = `${field.label} là bắt buộc.`
        return
      }

      if (field.min_length && value && value.length < field.min_length) {
        nextErrors[field.key] = `${field.label} phải có ít nhất ${field.min_length} ký tự.`
      }
    })

    setFormErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleChangeField = (fieldKey: string, value: string) => {
    setFormValues((current) => ({
      ...current,
      [fieldKey]: value,
    }))

    setFormErrors((current) => {
      if (!current[fieldKey]) {
        return current
      }

      const next = { ...current }
      delete next[fieldKey]
      return next
    })
  }

  const handleSaveConnection = async () => {
    if (!detail || !validateForm()) {
      return
    }

    const trimmedCredentials = Object.fromEntries(
      Object.entries(formValues).map(([key, value]) => [key, value.trim()]),
    )

    setIsSaving(true)
    setModalError(null)

    try {
      const response = await shippingApi.connectProvider(detail.provider.code, {
        store_id: DEFAULT_STORE_ID,
        credentials: trimmedCredentials,
        verify: true,
      })

      setDetail(response)
      initializeForm(response)
      await loadProviders({ silent: true })

      if (response.connection.status.code === 'connected') {
        appToast.success(`Liên kết ${response.provider.display_name} thành công.`)
      } else {
        appToast.warning(`Đã lưu cấu hình ${response.provider.display_name}, nhưng kết nối chưa hợp lệ.`)
      }
    } catch (error) {
      console.error('Lỗi khi lưu cấu hình vận chuyển:', error)
      const message =
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
          : 'Không thể lưu cấu hình vận chuyển.'

      setModalError(message)
      appToast.error(message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDisconnect = async () => {
    if (!detail) {
      return
    }

    const confirmed = window.confirm(`Bạn có chắc muốn hủy kết nối ${detail.provider.display_name}?`)
    if (!confirmed) {
      return
    }

    setIsSaving(true)
    setModalError(null)

    try {
      const response = await shippingApi.disconnectProvider(detail.provider.code, {
        store_id: DEFAULT_STORE_ID,
      })

      setDetail(response)
      initializeForm(response)
      await loadProviders({ silent: true })
      appToast.success(`Hủy kết nối ${response.provider.display_name} thành công.`)
    } catch (error) {
      console.error('Lỗi khi hủy kết nối vận chuyển:', error)
      const message =
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
          : 'Không thể hủy kết nối vận chuyển.'

      setModalError(message)
      appToast.error(message)
    } finally {
      setIsSaving(false)
    }
  }

  const selectedProvider = detail?.provider ?? providers.find((provider) => provider.code === selectedCode) ?? null
  const lookupLink = selectedProvider ? LOOKUP_LINKS[selectedProvider.code.toLowerCase()] ?? null : null
  const primaryCredentialField = detail ? getPrimaryCredentialField(detail.provider.credential_fields) : null

  return (
    <Stack spacing={3} sx={{ pb: 8 }}>
      <ListPageHeader
        title={title}
        description={description}
        actions={
          <Button
            variant="outlined"
            startIcon={isRefreshing ? <CircularProgress size={16} color="inherit" /> : <RefreshOutlinedIcon />}
            onClick={() => void loadProviders({ silent: true })}
            disabled={isRefreshing}
          >
            Làm mới
          </Button>
        }
      />

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
          gap: 2,
        }}
      >
        {[
          {
            label: 'Đã liên kết',
            value: summary.connected,
            icon: <CheckCircleOutlinedIcon fontSize="small" />,
            color: '#067647',
            bg: '#ecfdf3',
          },
          {
            label: 'Chưa liên kết',
            value: summary.disconnected,
            icon: <LinkOutlinedIcon fontSize="small" />,
            color: '#175cd3',
            bg: '#eff8ff',
          },
          {
            label: 'Lỗi kết nối',
            value: summary.error,
            icon: <LinkOffOutlinedIcon fontSize="small" />,
            color: '#b42318',
            bg: '#fef3f2',
          },
        ].map((item) => (
          <Paper key={item.label} sx={{ ...defaultCardSx, borderRadius: 4 }}>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
              <Box
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: 3,
                  display: 'grid',
                  placeItems: 'center',
                  bgcolor: item.bg,
                  color: item.color,
                }}
              >
                {item.icon}
              </Box>
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 700, color: '#101828' }}>
                  {item.value}
                </Typography>
                <Typography sx={{ color: '#667085' }}>{item.label}</Typography>
              </Box>
            </Stack>
          </Paper>
        ))}
      </Box>

      {isLoading ? (
        <Paper sx={{ ...defaultCardSx, borderRadius: 4 }}>
          <Stack spacing={2} sx={{ alignItems: 'center', py: 6 }}>
            <CircularProgress />
            <Typography color="text.secondary">Đang tải danh sách đơn vị vận chuyển...</Typography>
          </Stack>
        </Paper>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
            gap: 2,
          }}
        >
          {providers.map((provider) => {
            const tone = getStatusTone(provider.status.code)

            return (
              <Paper
                key={provider.code}
                sx={{
                  ...borderedCardSx,
                  borderRadius: 4,
                  minHeight: 280,
                  position: 'relative',
                  overflow: 'hidden',
                  transition: 'transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: '0 22px 55px rgba(15, 23, 42, 0.12)',
                    borderColor: (theme) => alpha(theme.palette.primary.main, 0.24),
                  },
                }}
              >
                <Box
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    background: `radial-gradient(circle at top right, ${alpha(tone.accent, 0.12)}, transparent 28%)`,
                    pointerEvents: 'none',
                  }}
                />

                <Stack spacing={2.5} sx={{ position: 'relative', height: '100%' }}>
                  <Stack direction="row" spacing={1.5} sx={{ alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <Stack direction="row" spacing={1.5}>
                      <Box
                        sx={{
                          width: 70,
                          height: 60,
                          borderRadius: 3.5,
                          display: 'grid',
                          placeItems: 'center',
                          bgcolor: '#ffffff',
                          border: '1px solid #eaecf0',
                          boxShadow: '0 10px 30px rgba(15, 23, 42, 0.08)',
                          overflow: 'hidden',
                        }}
                      >
                        {getProviderLogo(provider.code) ? (
                          <Box
                            component="img"
                            src={getProviderLogo(provider.code) ?? undefined}
                            alt={provider.display_name}
                            sx={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                            }}
                          />
                        ) : (
                          <Box
                            sx={{
                              color: '#175cd3',
                              fontWeight: 800,
                              letterSpacing: 0.8,
                            }}
                          >
                            {getProviderMonogram(provider.code)}
                          </Box>
                        )}
                      </Box>
                      <Box>
                        <Typography variant="h6" sx={{ fontWeight: 700, color: '#101828' }}>
                          {provider.display_name}
                        </Typography>
                        <Typography sx={{ color: '#667085', mt: 0.5 }}>
                          {provider.short_description ?? 'Đồng bộ đơn hàng sang hệ thống vận chuyển khi xử lý.'}
                        </Typography>
                      </Box>
                    </Stack>
                    {provider.status.code === 'connected' ? (
                      <Chip
                        label="Đã liên kết"
                        variant="outlined"
                        sx={{ fontWeight: 700, ...tone.chipSx }}
                      />
                    ) : null}
                  </Stack>

                  <Paper
                    sx={{
                      ...defaultCardSx,
                      p: 1.75,
                      borderRadius: 3,
                      bgcolor: tone.surface,
                      border: '1px solid #eaecf0',
                    }}
                  >
                    <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                      <Box>
                        <Typography variant="body2" sx={{ color: '#667085', mb: 0.5 }}>
                          Trạng thái kết nối
                        </Typography>
                        <Typography sx={{ color: '#101828', fontWeight: 700 }}>{tone.label}</Typography>
                      </Box>
                      <Chip label={provider.status.label} variant="outlined" sx={tone.chipSx} />
                    </Stack>
                  </Paper>

                  {provider.error_message ? <Alert severity="error">{provider.error_message}</Alert> : null}

                  <Box sx={{ mt: 'auto' }}>
                    <Divider sx={{ mb: 2 }} />
                    <Stack spacing={1.5}>
                      <Typography variant="body2" sx={{ color: '#667085' }}>
                        Lần kiểm tra gần nhất: {formatDateTime(provider.last_verified_at)}
                      </Typography>

                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                        <Button
                          variant="contained"
                          color="secondary"
                          startIcon={<LinkOutlinedIcon />}
                          onClick={() => void handleOpenModal(provider.code)}
                        >
                          {provider.status.code === 'disconnected' ? 'Liên kết' : 'Chỉnh sửa thông tin'}
                        </Button>
                        {provider.status.code !== 'disconnected' ? (
                          <Button
                            variant="outlined"
                            color="error"
                            startIcon={<LinkOffOutlinedIcon />}
                            onClick={() => void handleOpenModal(provider.code)}
                          >
                            Hủy kết nối
                          </Button>
                        ) : null}
                      </Stack>
                    </Stack>
                  </Box>
                </Stack>
              </Paper>
            )
          })}
        </Box>
      )}

      <Dialog open={Boolean(selectedCode)} onClose={handleCloseModal} fullWidth maxWidth="sm">
        <DialogTitle sx={{ pb: 1.5 }}>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
              <Box
                sx={{
                  width: 52,
                  height: 52,
                  borderRadius: 3,
                  display: 'grid',
                  placeItems: 'center',
                  bgcolor: '#eff8ff',
                  overflow: 'hidden',
                }}
              >
                {selectedProvider && getProviderLogo(selectedProvider.code) ? (
                  <Box
                    component="img"
                    src={getProviderLogo(selectedProvider.code) ?? undefined}
                    alt={selectedProvider.display_name}
                    sx={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                  />
                ) : (
                  <Box
                    sx={{
                      color: '#175cd3',
                      fontWeight: 800,
                      letterSpacing: 0.8,
                    }}
                  >
                    {selectedProvider ? getProviderMonogram(selectedProvider.code) : 'VC'}
                  </Box>
                )}
              </Box>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700, color: '#101828' }}>
                  Kết nối nhà vận chuyển {selectedProvider?.display_name ?? ''}
                </Typography>
                <Typography sx={{ color: '#667085', mt: 0.5 }}>
                  Đồng bộ đơn hàng sang hệ thống nhà vận chuyển và quản lý token tích hợp theo từng đơn vị.
                </Typography>
              </Box>
            </Stack>
            <IconButton onClick={handleCloseModal} disabled={isSaving} sx={{ color: '#98a2b3' }}>
              <CloseRoundedIcon />
            </IconButton>
          </Stack>
        </DialogTitle>

        <DialogContent dividers>
          {isDetailLoading || !detail ? (
            <Stack spacing={2} sx={{ alignItems: 'center', py: 6 }}>
              <CircularProgress />
              <Typography color="text.secondary">Đang tải cấu hình kết nối...</Typography>
            </Stack>
          ) : (
            <Stack spacing={3}>
              {modalError ? <Alert severity="error">{modalError}</Alert> : null}
              {detail.connection.error_message ? <Alert severity="warning">{detail.connection.error_message}</Alert> : null}
              {detail.connection.has_credentials ? (
                <Alert severity="info">
                  Token hiện tại đang được lưu bảo mật. Nhập giá trị mới nếu bạn muốn cập nhật cấu hình.
                </Alert>
              ) : null}

              <Paper
                sx={{
                  ...defaultCardSx,
                  borderRadius: 4,
                  bgcolor: '#f8fafc',
                  border: '1px solid #eaecf0',
                }}
              >
                <Stack spacing={2}>
                  <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography sx={{ fontWeight: 700, color: '#101828' }}>Trạng thái tích hợp</Typography>
                      <Typography variant="body2" sx={{ color: '#667085', mt: 0.5 }}>
                        Store: {detail.connection.store_id}
                      </Typography>
                    </Box>
                    <Chip label={detail.connection.status.label} variant="outlined" sx={getStatusTone(detail.connection.status.code).chipSx} />
                  </Stack>
                  <Typography variant="body2" sx={{ color: '#667085' }}>
                    Lần cập nhật gần nhất: {formatDateTime(detail.connection.updated_at)}
                  </Typography>
                </Stack>
              </Paper>

              <Stack spacing={2}>
                <StackedTextField label="Tên nhà vận chuyển" value={detail.provider.display_name} fullWidth disabled />

                {lookupLink ? (
                  <StackedTextField
                    label="Link tra cứu"
                    value={lookupLink}
                    fullWidth
                    endAdornment={
                      <Link href={lookupLink} target="_blank" rel="noreferrer" underline="hover" sx={{ whiteSpace: 'nowrap' }}>
                        Mở link
                      </Link>
                    }
                    slotProps={{
                      input: {
                        readOnly: true,
                      },
                    }}
                  />
                ) : null}

                {detail.provider.credential_fields.map((field) => (
                  <StackedTextField
                    key={field.key}
                    fullWidth
                    type={field.input_type}
                    label={field.label}
                    placeholder={field.placeholder}
                    value={formValues[field.key] ?? ''}
                    onChange={(event) => handleChangeField(field.key, event.target.value)}
                    error={Boolean(formErrors[field.key])}
                    helperText={formErrors[field.key] ?? field.helper_text}
                  />
                ))}

                {primaryCredentialField?.key === 'token' ? (
                  <Typography variant="body2" sx={{ color: '#667085' }}>
                    Client token sẽ được trim khoảng trắng đầu cuối trước khi gửi lên backend.
                  </Typography>
                ) : null}
              </Stack>

              <Paper sx={{ ...defaultCardSx, borderRadius: 4, border: '1px solid #eaecf0' }}>
                <Stack spacing={1.25}>
                  <Typography sx={{ fontWeight: 700, color: '#101828' }}>Lịch sử kết nối</Typography>
                  {detail.connection.history_items.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      Chưa có lịch sử thao tác cho nhà vận chuyển này.
                    </Typography>
                  ) : (
                    detail.connection.history_items.slice(0, 4).map((item) => (
                      <Box key={item.id}>
                        <Typography sx={{ fontWeight: 600, color: '#101828' }}>
                          {item.action} • {item.status.label}
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#667085', mt: 0.5 }}>
                          {formatDateTime(item.created_at)}
                        </Typography>
                        {item.error_message ? (
                          <Typography variant="body2" sx={{ color: '#b42318', mt: 0.5 }}>
                            {item.error_message}
                          </Typography>
                        ) : null}
                      </Box>
                    ))
                  )}
                </Stack>
              </Paper>
            </Stack>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2 }}>
          {detail && detail.connection.status.code !== 'disconnected' ? (
            <Button color="error" onClick={() => void handleDisconnect()} disabled={isSaving || isDetailLoading}>
              Hủy kết nối
            </Button>
          ) : null}
          <Box sx={{ flex: 1 }} />
          <Button onClick={handleCloseModal} disabled={isSaving}>
            Hủy
          </Button>
          <Button
            variant="contained"
            color="secondary"
            startIcon={isSaving ? <CircularProgress size={16} color="inherit" /> : <LinkOutlinedIcon />}
            onClick={() => void handleSaveConnection()}
            disabled={isSaving || isDetailLoading || !detail}
          >
            {detail?.connection.status.code === 'disconnected' ? 'Lưu' : 'Lưu thay đổi'}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  )
}
