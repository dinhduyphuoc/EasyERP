import type { ReactElement } from 'react'
import { Box, Chip, Paper, Stack, Typography } from '@mui/material'
import { useAuth } from '@/modules/auth/use-auth'
import { ListPageHeader } from '@/shared/ui/list/list-page-header'

export function AccountProfilePage(): ReactElement {
  const { user } = useAuth()

  return (
    <Stack spacing={4} sx={{ pb: 8 }}>
      <ListPageHeader
        title="Thông tin tài khoản"
        description="Xem thông tin đăng nhập, vai trò và phạm vi truy cập hiện tại của tài khoản OMS."
      />

      <Paper sx={{ p: 3, borderRadius: 4 }}>
        <Stack spacing={3}>
          <Box>
            <Typography variant="overline" color="primary.main" sx={{ fontWeight: 700 }}>
              Hồ sơ truy cập
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 700, mt: 1 }}>
              {user?.full_name ?? 'Người dùng'}
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 0.5 }}>
              {user?.email ?? 'Chưa có email'}
            </Typography>
          </Box>

          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
            {(user?.roles ?? []).map((role) => (
              <Chip key={role} label={role} color="primary" variant="outlined" />
            ))}
          </Stack>

          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
              Phạm vi dữ liệu
            </Typography>
            <Stack spacing={1}>
              {(user?.scopes ?? []).length > 0 ? (
                user?.scopes.map((scope) => (
                  <Typography key={`${scope.scope_type}-${scope.scope_value}`} color="text.secondary">
                    {scope.scope_type}: {scope.scope_value}
                  </Typography>
                ))
              ) : (
                <Typography color="text.secondary">
                  Chưa có scope chi tiết được hiển thị cho tài khoản này.
                </Typography>
              )}
            </Stack>
          </Box>
        </Stack>
      </Paper>
    </Stack>
  )
}
