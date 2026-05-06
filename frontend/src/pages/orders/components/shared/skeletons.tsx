import { Box, Paper, Skeleton, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material'
import { borderedCardSx } from '@/shared/ui/paper'
import { PageContentContainer } from '@/shared/ui/page'

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
    <PageContentContainer>
      <Box sx={{ mb: 2 }}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={2}
          sx={{ justifyContent: 'space-between', alignItems: { md: 'center' } }}
        >
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
            <Skeleton variant="rounded" width={44} height={44} />
            <Stack spacing={1}>
              <Skeleton variant="text" width={260} height={36} />
              <Stack direction="row" spacing={1}>
                <Skeleton variant="rounded" width={108} height={28} />
                <Skeleton variant="rounded" width={92} height={28} />
              </Stack>
            </Stack>
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
            <Skeleton variant="rounded" width={170} height={40} />
            <Skeleton variant="rounded" width={132} height={40} />
          </Stack>
        </Stack>
      </Box>

      <Paper
        variant="outlined"
        sx={{
          ...borderedCardSx,
          mb: 2,
          p: 1.5,
        }}
      >
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ alignItems: { md: 'center' } }}>
          <Skeleton variant="rounded" width={184} height={32} />
          <Stack spacing={0.75} sx={{ flex: 1 }}>
            <Skeleton variant="text" width="74%" height={24} />
            <Skeleton variant="text" width="48%" height={20} />
          </Stack>
          <Skeleton variant="rounded" width={136} height={36} />
        </Stack>
      </Paper>

      <Paper sx={{ ...borderedCardSx, mt: 2.5, p: 0 }}>
        <Stack direction="row" spacing={1.5} sx={{ px: 2, py: 1.25 }}>
          <Skeleton variant="text" width={88} height={28} />
          <Skeleton variant="text" width={84} height={28} />
          <Skeleton variant="text" width={96} height={28} />
          <Skeleton variant="text" width={92} height={28} />
        </Stack>
      </Paper>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 3fr) minmax(360px, 1.4fr)' },
          gap: 2.5,
          alignItems: 'start',
          mt: 2.5,
        }}
      >
        <Stack spacing={2.5}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' },
              gap: 2.5,
              alignItems: 'stretch',
            }}
          >
            <Paper sx={borderedCardSx}>
              <Stack spacing={2}>
                <Skeleton variant="text" width={170} height={30} />
                <Skeleton variant="rounded" height={164} />
              </Stack>
            </Paper>

            <Paper sx={borderedCardSx}>
              <Stack spacing={2}>
                <Skeleton variant="text" width={150} height={30} />
                <Stack spacing={1.5}>
                  {Array.from({ length: 3 }).map((_, index) => (
                    <Stack key={index} direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
                      <Skeleton variant="rounded" width={56} height={56} />
                      <Stack spacing={0.5} sx={{ flex: 1 }}>
                        <Skeleton variant="text" width="62%" height={22} />
                        <Skeleton variant="text" width="38%" height={18} />
                      </Stack>
                    </Stack>
                  ))}
                </Stack>
              </Stack>
            </Paper>
          </Box>

          <Paper sx={borderedCardSx}>
            <Stack spacing={2}>
              <Skeleton variant="text" width={180} height={30} />
              <Skeleton variant="rounded" height={176} />
            </Stack>
          </Paper>
        </Stack>

        <Stack spacing={2.5}>
          <Paper sx={borderedCardSx}>
            <Stack spacing={2}>
              <Skeleton variant="text" width={196} height={30} />
              <Skeleton variant="rounded" height={220} />
            </Stack>
          </Paper>
        </Stack>
      </Box>
    </PageContentContainer>
  )
}
