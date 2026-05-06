import { Box, Button, Paper, Stack, Typography } from '@mui/material'
import { Link as RouterLink } from 'react-router'

export function ForbiddenPage() {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        px: 2,
        background:
          'radial-gradient(circle at top left, rgba(239, 68, 68, 0.10), transparent 24%), linear-gradient(180deg, #f8fafc 0%, #eef2f7 100%)',
      }}
    >
      <Paper
        elevation={0}
        sx={{
          maxWidth: 520,
          width: '100%',
          p: 4,
          borderRadius: 4,
          border: '1px solid rgba(15, 23, 42, 0.08)',
        }}
      >
        <Stack spacing={2}>
          <Typography variant="overline" color="error.main" sx={{ fontWeight: 700 }}>
            403 Forbidden
          </Typography>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>
            Bạn không có quyền truy cập trang này
          </Typography>
          <Typography color="text.secondary">
            Hãy liên hệ quản trị viên nếu bạn cần thêm quyền cho module hoặc dữ liệu này.
          </Typography>
          <Button component={RouterLink} to="/" variant="contained" sx={{ alignSelf: 'flex-start' }}>
            Quay về tổng quan
          </Button>
        </Stack>
      </Paper>
    </Box>
  )
}
