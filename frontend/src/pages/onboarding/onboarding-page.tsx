import { useEffect, useMemo, useState, type ChangeEvent, type ReactElement } from 'react'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'
import InsertPhotoOutlinedIcon from '@mui/icons-material/InsertPhotoOutlined'
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined'
import {
  Alert,
  Box,
  Button,
  LinearProgress,
  Paper,
  Stack,
  Typography,
} from '@mui/material'
import { useNavigate } from 'react-router'
import { useAuth } from '@/modules/auth/use-auth'
import { setupApi } from '@/modules/setup/setup.api'
import type {
  CompanyData,
  FirstUserData,
  OnboardingFormData,
} from '@/modules/setup/setup.types'
import { useSetup } from '@/modules/setup/use-setup'
import { borderedCardSx } from '@/shared/ui/paper'
import { StackedTextField } from '@/shared/ui/form/stacked-text-field'
import { getErrorMessage } from '@/shared/lib/errors'
import { appToast } from '@/shared/ui/toast/toast.helpers'
import {
  createEmptyOnboardingErrors,
  type OnboardingFieldErrors,
  validateCompanyStep,
  validateEmailField,
  validateFirstUserStep,
  validatePasswordField,
} from './onboarding.validation'

type WizardStep = 0 | 1 | 2

type StepDefinition = {
  key: WizardStep
  title: string
}

const steps: StepDefinition[] = [
  { key: 0, title: 'Thiết lập tài khoản' },
  { key: 1, title: 'Thiết lập cửa hàng' },
  { key: 2, title: 'Đang khởi tạo cửa hàng của bạn...' },
]

const initialFormData: OnboardingFormData = {
  firstUser: {
    avatar: null,
    fullName: '',
    email: '',
    password: '',
  },
  company: {
    logo: null,
    name: '',
    abbreviation: '',
  },
}

const processingStatuses = [
  { progress: 18, message: 'Đang tạo người dùng...' },
  { progress: 42, message: 'Đang tạo cửa hàng...' },
  { progress: 72, message: 'Thiết lập không gian cửa hàng...' },
  { progress: 90, message: 'Hoàn tất thiết lập...' },
] as const

function OnboardingStepper({
  currentStep,
}: {
  currentStep: WizardStep
}): ReactElement {
  return (
    <Stack direction="row" spacing={1.25} sx={{ justifyContent: 'center', alignItems: 'center' }}>
      {steps.map((step) => {
        const isCompleted = step.key < currentStep
        const isCurrent = step.key === currentStep

        return (
          <Box
            key={step.key}
            sx={{
              width: 36,
              height: 36,
              borderRadius: '999px',
              border: isCompleted || isCurrent ? '1px solid #12b76a' : '1px solid #d0d5dd',
              bgcolor: isCompleted ? '#12b76a' : isCurrent ? '#ecfdf3' : '#ffffff',
              color: isCompleted ? '#ffffff' : isCurrent ? '#039855' : '#98a2b3',
              display: 'grid',
              placeItems: 'center',
              fontWeight: 700,
            }}
          >
            {isCompleted ? <CheckRoundedIcon fontSize="small" /> : step.key + 1}
          </Box>
        )
      })}
    </Stack>
  )
}

function OnboardingFileField({
  label,
  helperText,
  buttonLabel = 'Chọn hình',
  file,
  onChange,
}: {
  label: string
  helperText?: string
  buttonLabel?: string
  file: File | null
  onChange: (file: File | null) => void
}): ReactElement {
  const inputId = useMemo(
    () => `onboarding-file-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    [label],
  )
  const [previewUrl, setPreviewUrl] = useState('')

  useEffect(() => {
    if (!file) {
      setPreviewUrl('')
      return
    }

    const nextPreviewUrl = URL.createObjectURL(file)
    setPreviewUrl(nextPreviewUrl)

    return () => {
      URL.revokeObjectURL(nextPreviewUrl)
    }
  }, [file])

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.files?.[0] ?? null)
    event.target.value = ''
  }

  return (
    <Stack spacing={1}>
      <Typography variant="body2" sx={{ color: '#344054', fontWeight: 600 }}>
        {label}
      </Typography>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1.25}
        sx={{
          alignItems: { sm: 'center' },
          justifyContent: 'space-between',
          border: '1px dashed #d0d5dd',
          borderRadius: 3,
          px: 1.5,
          py: 1.25,
          bgcolor: '#fcfcfd',
        }}
      >
        <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center', minWidth: 0 }}>
          {previewUrl ? (
            <Box
              component="img"
              src={previewUrl}
              alt={`${label} preview`}
              sx={{
                width: 48,
                height: 48,
                borderRadius: 2.5,
                objectFit: 'cover',
                border: '1px solid #d0d5dd',
                flexShrink: 0,
                bgcolor: '#ffffff',
              }}
            />
          ) : (
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: 2.5,
                display: 'grid',
                placeItems: 'center',
                bgcolor: '#f2f4f7',
                color: '#667085',
                flexShrink: 0,
              }}
            >
              <InsertPhotoOutlinedIcon fontSize="small" />
            </Box>
          )}
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ color: '#667085', fontWeight: 600 }} noWrap>
              {file?.name || 'Chưa chọn tệp'}
            </Typography>
            {helperText ? (
              <Typography variant="body2" sx={{ color: '#667085' }}>
                {helperText}
              </Typography>
            ) : null}
          </Box>
        </Stack>

        <Button component="label" variant="outlined" sx={{ flexShrink: 0 }}>
          {buttonLabel}
          <input hidden id={inputId} type="file" accept="image/png,image/jpeg" onChange={handleFileChange} />
        </Button>
      </Stack>
    </Stack>
  )
}

function SetupProcessingState({
  progress,
  message,
}: {
  progress: number
  message: string
}): ReactElement {
  return (
    <Stack spacing={2.5}>
      <Box>
        <Typography variant="h5" sx={{ fontWeight: 700, color: '#101828' }}>
          Đang thiết lập cửa hàng của bạn
        </Typography>
        <Typography variant="body2" sx={{ color: '#667085', mt: 1 }}>
          Vui lòng chờ trong giây lát...
        </Typography>
      </Box>

      <Stack spacing={1.25}>
        <LinearProgress
          variant="determinate"
          value={progress}
          sx={{
            height: 10,
            borderRadius: 999,
            bgcolor: '#e4e7ec',
            '& .MuiLinearProgress-bar': {
              borderRadius: 999,
            },
          }}
        />
        <Typography variant="body2" sx={{ color: '#475467' }}>
          {message}
        </Typography>
      </Stack>
    </Stack>
  )
}

function SetupErrorState({
  message,
  onRetry,
  onBack,
  disabled,
}: {
  message: string
  onRetry: () => void
  onBack: () => void
  disabled: boolean
}): ReactElement {
  return (
    <Stack spacing={2.5}>
      <Alert severity="error">{message}</Alert>
      <Stack direction={{ xs: 'column-reverse', sm: 'row' }} spacing={1.25} sx={{ justifyContent: 'flex-end' }}>
        <Button variant="outlined" onClick={onBack} disabled={disabled}>
          Quay lại
        </Button>
        <Button variant="contained" onClick={onRetry} disabled={disabled}>
          Retry
        </Button>
      </Stack>
    </Stack>
  )
}

export function OnboardingPage(): ReactElement {
  const navigate = useNavigate()
  const { login } = useAuth()
  const { refreshSetupStatus, markSetupCompleted } = useSetup()
  const [currentStep, setCurrentStep] = useState<WizardStep>(0)
  const [formData, setFormData] = useState<OnboardingFormData>(initialFormData)
  const [errors, setErrors] = useState<OnboardingFieldErrors>(createEmptyOnboardingErrors())
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [setupStatusMessage, setSetupStatusMessage] = useState<string>(processingStatuses[0].message)
  const [setupProgress, setSetupProgress] = useState(0)
  const [setupError, setSetupError] = useState<string | null>(null)

  useEffect(() => {
    if (currentStep !== 2 || !isSubmitting) {
      return
    }

    setSetupProgress(processingStatuses[0].progress)
    setSetupStatusMessage(processingStatuses[0].message)
    let activeIndex = 0

    const timer = window.setInterval(() => {
      activeIndex += 1

      if (activeIndex >= processingStatuses.length) {
        window.clearInterval(timer)
        return
      }

      const state = processingStatuses[activeIndex]
      setSetupProgress(state.progress)
      setSetupStatusMessage(state.message)
    }, 700)

    return () => {
      window.clearInterval(timer)
    }
  }, [currentStep, isSubmitting])

  const updateFirstUser = (patch: Partial<FirstUserData>) => {
    setFormData((current) => ({
      ...current,
      firstUser: {
        ...current.firstUser,
        ...patch,
      },
    }))
  }

  const updateCompany = (patch: Partial<CompanyData>) => {
    setFormData((current) => ({
      ...current,
      company: {
        ...current.company,
        ...patch,
      },
    }))
  }

  const goToStep = (step: WizardStep) => {
    setCurrentStep(step)
    setSetupError(null)
  }

  const handleFirstStepNext = () => {
    const nextErrors = validateFirstUserStep(formData.firstUser)
    setErrors((current) => ({
      ...current,
      firstUser: nextErrors,
    }))

    if (Object.keys(nextErrors).length > 0) {
      return
    }

    goToStep(1)
  }

  const handleSecondStepNext = () => {
    const nextErrors = validateCompanyStep(formData.company)
    setErrors((current) => ({
      ...current,
      company: nextErrors,
    }))

    if (Object.keys(nextErrors).length > 0) {
      return
    }

    goToStep(2)
    void runSetup()
  }

  const runSetup = async () => {
    setIsSubmitting(true)
    setSetupError(null)
    setSetupProgress(10)
    setSetupStatusMessage(processingStatuses[0].message)

    try {
      const result = await setupApi.initialize(formData)
      setSetupProgress(100)
      setSetupStatusMessage('Setup completed. Redirecting to your dashboard ...')
      markSetupCompleted()
      await refreshSetupStatus()

      try {
        await login({
          email: formData.firstUser.email.trim(),
          password: formData.firstUser.password,
        })
      } catch {
        appToast.success('Khởi tạo hệ thống thành công. Vui lòng đăng nhập để tiếp tục.')
        navigate('/login', { replace: true })
        return
      }

      navigate(result.redirectTo || '/', { replace: true })
    } catch (error) {
      setSetupProgress(0)
      setSetupError(getErrorMessage(error, 'Unable to complete setup'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const cardHeader = (
    <Stack spacing={1.5} sx={{ textAlign: 'center' }}>
      <OnboardingStepper currentStep={currentStep} />
      {currentStep < 2 ? (
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, color: '#101828' }}>
            {steps[currentStep].title}
          </Typography>
        </Box>
      ) : null}
    </Stack>
  )

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 3,
        bgcolor: '#f7f9f8',
      }}
    >
      <Paper
        sx={{
          ...borderedCardSx,
          width: '100%',
          maxWidth: 620,
          p: { xs: 3, sm: 5 },
          borderRadius: 4,
        }}
      >
        <Stack spacing={3}>
          {cardHeader}

          {currentStep === 0 ? (
            <Stack spacing={2}>
              <OnboardingFileField
                label="Tải hình đại diện"
                file={formData.firstUser.avatar}
                onChange={(file) => updateFirstUser({ avatar: file })}
              />

              <StackedTextField
                fullWidth
                label="Họ và tên"
                required
                value={formData.firstUser.fullName}
                onChange={(event) => updateFirstUser({ fullName: event.target.value })}
                submitError={errors.firstUser.fullName}
              />
              <StackedTextField
                fullWidth
                label="Email"
                required
                type="email"
                value={formData.firstUser.email}
                onChange={(event) => updateFirstUser({ email: event.target.value })}
                submitError={errors.firstUser.email}
                validate={validateEmailField}
                validateWhen="blur"
              />
              <StackedTextField
                fullWidth
                label="Mật khẩu"
                required
                type="password"
                value={formData.firstUser.password}
                onChange={(event) => updateFirstUser({ password: event.target.value })}
                submitError={errors.firstUser.password}
                validate={validatePasswordField}
                validateWhen="blur"
              />

              <Stack direction={{ xs: 'column-reverse', sm: 'row' }} spacing={1.25} sx={{ justifyContent: 'flex-end', pt: 1 }}>
                <Button variant="outlined" disabled>
                  Trước
                </Button>
                <Button variant="contained" onClick={handleFirstStepNext}>
                  Tiếp
                </Button>
              </Stack>
            </Stack>
          ) : null}

          {currentStep === 1 ? (
            <Stack spacing={2}>
              <OnboardingFileField
                label="Tải lên logo"
                helperText="Kích thước: 100x100px"
                file={formData.company.logo}
                onChange={(file) => updateCompany({ logo: file })}
              />

              <StackedTextField
                fullWidth
                label="Tên cửa hàng"
                required
                value={formData.company.name}
                onChange={(event) => updateCompany({ name: event.target.value })}
                submitError={errors.company.name}
                startAdornment={
                  <Box sx={{ display: 'grid', placeItems: 'center', pr: 1, color: '#98a2b3' }}>
                    <StorefrontOutlinedIcon fontSize="small" />
                  </Box>
                }
              />
              <StackedTextField
                fullWidth
                label="Tên viết tắt cửa hàng"
                value={formData.company.abbreviation}
                onChange={(event) => updateCompany({ abbreviation: event.target.value })}
              />

              <Stack direction={{ xs: 'column-reverse', sm: 'row' }} spacing={1.25} sx={{ justifyContent: 'space-between', pt: 1 }}>
                <Button variant="outlined" onClick={() => goToStep(0)} disabled={isSubmitting}>
                  Trước
                </Button>
                <Button variant="contained" onClick={handleSecondStepNext} disabled={isSubmitting}>
                  Tiếp
                </Button>
              </Stack>
            </Stack>
          ) : null}

          {currentStep === 2 ? (
            setupError ? (
              <SetupErrorState
                message={setupError}
                onRetry={() => void runSetup()}
                onBack={() => goToStep(1)}
                disabled={isSubmitting}
              />
            ) : (
              <SetupProcessingState progress={setupProgress} message={setupStatusMessage} />
            )
          ) : null}
        </Stack>
      </Paper>
    </Box>
  )
}
