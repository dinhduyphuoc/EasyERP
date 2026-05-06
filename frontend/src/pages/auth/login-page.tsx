import { useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { useAuth } from '@/modules/auth/use-auth'
import { useSetup } from '@/modules/setup/use-setup'
import { getErrorMessage } from '@/shared/lib/errors'
import { AuthScreenSkeleton } from '@/shared/ui/skeleton/loading-skeletons'

type LocationState = {
  from?: string
}

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { status, login } = useAuth()
  const { status: setupStatus, setup } = useSetup()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (status === 'loading' || setupStatus === 'loading') {
    return <AuthScreenSkeleton />
  }

  if (!setup?.setupCompleted) {
    return <Navigate to="/onboarding" replace />
  }

  if (status === 'authenticated') {
    return <Navigate to="/" replace />
  }

  const from = ((location.state as LocationState | null)?.from ?? '/') as string

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      await login({ email, password })
      navigate(from, { replace: true })
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Đăng nhập thất bại. Vui lòng thử lại.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        px: 2,
        background:
          'radial-gradient(circle at top left, rgba(15, 118, 110, 0.16), transparent 24%), radial-gradient(circle at bottom right, rgba(14, 165, 233, 0.14), transparent 28%), linear-gradient(180deg, #eff6f8 0%, #e8eef4 100%)',
      }}
    >
      <Paper
        elevation={0}
        sx={{
          width: '100%',
          maxWidth: 440,
          p: { xs: 3, sm: 4 },
          borderRadius: 4,
          border: '1px solid rgba(15, 23, 42, 0.08)',
          background: 'rgba(255,255,255,0.9)',
          backdropFilter: 'blur(16px)',
        }}
      >
        <Stack spacing={3}>
          <Box>
            <Typography variant="overline" sx={{ color: 'primary.main', fontWeight: 700 }}>
              EasyERP OMS
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 800, mt: 1 }}>
              Đăng nhập hệ thống
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Truy cập OMS an toàn với phân quyền theo vai trò và phạm vi dữ liệu.
            </Typography>
          </Box>

          {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}

          <Box component="form" onSubmit={handleSubmit}>
            <Stack spacing={2}>
              <TextField
                label="Email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
                fullWidth
              />
              <TextField
                label="Mật khẩu"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
                fullWidth
              />
              <Button
                type="submit"
                variant="contained"
                size="large"
                disabled={isSubmitting}
                sx={{ minHeight: 48, fontWeight: 700 }}
              >
                {isSubmitting ? 'Đang đăng nhập...' : 'Đăng nhập'}
              </Button>
            </Stack>
          </Box>
        </Stack>
      </Paper>
    </Box>
  )
}
