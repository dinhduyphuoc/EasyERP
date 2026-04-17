import { Box, Chip, Paper, Stack, Typography } from '@mui/material'

type PagePlaceholderProps = {
  title: string
  path: string
  description?: string
}

export function PagePlaceholder({
  title,
  path,
  description = 'Khu vực nội dung đã sẵn sàng để mình tiếp tục gắn table, form hoặc dashboard widget cho module này.',
}: PagePlaceholderProps) {
  return (
    <Stack spacing={3}>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={2}
        sx={{ justifyContent: 'space-between' }}
      >
        <Box>
          <Typography variant="h4" gutterBottom>
            {title}
          </Typography>
          <Typography color="text.secondary">{description}</Typography>
        </Box>
        <Chip
          label={path}
          color="primary"
          variant="outlined"
          sx={{ alignSelf: { xs: 'flex-start', md: 'center' } }}
        />
      </Stack>

      <Stack direction={{ xs: 'column', xl: 'row' }} spacing={2}>
        <Paper sx={{ flex: 1, p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Tổng quan module
          </Typography>
          <Typography color="text.secondary">
            Đây là slot mặc định để đặt các card số liệu, bộ lọc nhanh và thông tin tổng hợp theo route hiện tại.
          </Typography>
        </Paper>

        <Paper sx={{ flex: 1, p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Ghi chú triển khai
          </Typography>
          <Typography color="text.secondary">
            Router đã sẵn sàng, sidebar đã active theo URL và layout responsive để bạn tiếp tục tách page thật.
          </Typography>
        </Paper>
      </Stack>
    </Stack>
  )
}
