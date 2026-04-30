import { Box, Paper, Skeleton, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material'
import { borderedCardSx } from '@/shared/ui/paper'

function OrderListRowSkeleton() {
  return (
    <TableRow>
      <TableCell>
        <Stack spacing={0.5}>
          <Skeleton variant="text" width="52%" height={26} />
          <Skeleton variant="text" width="38%" height={20} />
        </Stack>
      </TableCell>
      <TableCell>
        <Stack spacing={0.5} sx={{ minWidth: 220 }}>
          <Skeleton variant="text" width="58%" height={24} />
          <Skeleton variant="text" width="72%" height={20} />
        </Stack>
      </TableCell>
      <TableCell align="right">
        <Skeleton variant="text" width="48%" height={24} sx={{ ml: 'auto' }} />
      </TableCell>
      <TableCell>
        <Skeleton variant="rounded" width={104} height={26} />
      </TableCell>
      <TableCell>
        <Skeleton variant="rounded" width={110} height={26} />
      </TableCell>
      <TableCell>
        <Skeleton variant="text" width="55%" height={24} />
      </TableCell>
      <TableCell>
        <Skeleton variant="text" width="60%" height={24} />
      </TableCell>
    </TableRow>
  )
}

export function ListTableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <Table>
      <TableHead
        sx={{
          backgroundColor: '#f4f6f8',
        }}
      >
        <TableRow>
          <TableCell>
            <Typography component="span" variant="body2">
              Mã đơn hàng
            </Typography>
          </TableCell>
          <TableCell>
            <Typography component="span" variant="body2">
              Khách hàng
            </Typography>
          </TableCell>
          <TableCell align="right">
            <Typography component="span" variant="body2">
              Tổng tiền
            </Typography>
          </TableCell>
          <TableCell>
            <Typography component="span" variant="body2">
              Thanh toán
            </Typography>
          </TableCell>
          <TableCell>
            <Typography component="span" variant="body2">
              Xử lý
            </Typography>
          </TableCell>
          <TableCell>
            <Typography component="span" variant="body2">
              ĐVVC
            </Typography>
          </TableCell>
          <TableCell>
            <Typography component="span" variant="body2">
              Kênh bán hàng
            </Typography>
          </TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {Array.from({ length: rows }).map((_, index) => (
          <OrderListRowSkeleton key={index} />
        ))}
      </TableBody>
    </Table>
  )
}

export function DetailPageSkeleton() {
  return (
    <Box sx={{ px: { xs: 2, md: 3, xl: 4 }, pb: 8 }}>
      <Skeleton variant="rounded" height={124} sx={{ borderRadius: 4, mb: 3 }} />

      <Stack spacing={3}>
        <Paper sx={borderedCardSx}>
          <Stack spacing={2}>
            <Skeleton variant="text" width={220} height={34} />
            <Skeleton variant="rounded" height={72} />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
              <Skeleton variant="rounded" width={170} height={40} />
              <Skeleton variant="rounded" width={170} height={40} />
              <Skeleton variant="rounded" width={170} height={40} />
            </Stack>
          </Stack>
        </Paper>

        <Paper sx={borderedCardSx}>
          <Stack spacing={2}>
            <Skeleton variant="text" width={180} height={30} />
            <Skeleton variant="rounded" height={96} />
          </Stack>
        </Paper>

        <Paper sx={borderedCardSx}>
          <Stack spacing={2}>
            <Skeleton variant="text" width={180} height={30} />
            <Skeleton variant="rounded" height={220} />
          </Stack>
        </Paper>
      </Stack>
    </Box>
  )
}
