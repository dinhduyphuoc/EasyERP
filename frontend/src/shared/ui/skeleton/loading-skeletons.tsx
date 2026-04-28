import { Box, Paper, Skeleton, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material'
import { borderedCardSx, defaultCardSx } from '@/shared/ui/paper'

export function AuthScreenSkeleton() {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background:
          'radial-gradient(circle at top left, rgba(15, 118, 110, 0.12), transparent 24%), linear-gradient(180deg, #f4f8fb 0%, #edf3f7 100%)',
        px: 2,
      }}
    >
      <Paper sx={{ ...defaultCardSx, width: '100%', maxWidth: 420, borderRadius: 5 }}>
        <Stack spacing={2}>
          <Skeleton variant="text" width="42%" height={36} />
          <Skeleton variant="text" width="72%" height={22} />
          <Skeleton variant="rounded" width="100%" height={46} />
          <Skeleton variant="rounded" width="100%" height={46} />
          <Skeleton variant="rounded" width="100%" height={44} />
        </Stack>
      </Paper>
    </Box>
  )
}

export function MetricCardsSkeleton({
  count = 4,
  columns = { xs: '1fr', md: 'repeat(4, minmax(0, 1fr))' },
}: {
  count?: number
  columns?: object
}) {
  return (
    <Box
      sx={{
        display: 'grid',
        gap: 2,
        gridTemplateColumns: columns,
      }}
    >
      {Array.from({ length: count }).map((_, index) => (
        <Paper key={index} sx={{ ...borderedCardSx, borderRadius: 4 }}>
          <Skeleton variant="text" width="54%" height={22} />
          <Skeleton variant="rounded" width={52} height={52} sx={{ my: 1.5, borderRadius: 3 }} />
          <Skeleton variant="text" width="24%" height={40} />
        </Paper>
      ))}
    </Box>
  )
}

export function TableCardSkeleton({
  titleWidth = '36%',
  descriptionWidth = '64%',
  columns,
  rows = 6,
}: {
  titleWidth?: string | number
  descriptionWidth?: string | number
  columns: string[]
  rows?: number
}) {
  return (
    <Paper sx={{ ...borderedCardSx, borderRadius: 4, overflow: 'hidden' }}>
      <Stack spacing={2}>
        <Box>
          <Skeleton variant="text" width={titleWidth} height={34} />
          <Skeleton variant="text" width={descriptionWidth} height={22} />
        </Box>

        <Table>
          <TableHead>
            <TableRow>
              {columns.map((column) => (
                <TableCell key={column}>
                  <Typography component="span" variant="body2">
                    {column}
                  </Typography>
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {Array.from({ length: rows }).map((_, rowIndex) => (
              <TableRow key={rowIndex}>
                {columns.map((column, columnIndex) => (
                  <TableCell key={`${column}-${rowIndex}`}>
                    <Skeleton
                      variant={columnIndex >= columns.length - 2 ? 'rounded' : 'text'}
                      width={columnIndex === 0 ? '58%' : columnIndex === 1 ? '74%' : '62%'}
                      height={columnIndex >= columns.length - 2 ? 26 : 24}
                    />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Stack>
    </Paper>
  )
}

export function ProviderCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
        gap: 2,
      }}
    >
      {Array.from({ length: count }).map((_, index) => (
        <Paper key={index} sx={{ ...defaultCardSx, borderRadius: 4, minHeight: 280 }}>
          <Stack spacing={2.5}>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <Stack direction="row" spacing={1.5}>
                <Skeleton variant="rounded" width={70} height={60} sx={{ borderRadius: 3.5 }} />
                <Box sx={{ flex: 1 }}>
                  <Skeleton variant="text" width="42%" height={32} />
                  <Skeleton variant="text" width="88%" height={20} />
                  <Skeleton variant="text" width="74%" height={20} />
                </Box>
              </Stack>
              <Skeleton variant="rounded" width={96} height={28} />
            </Stack>

            <Paper sx={{ ...defaultCardSx, p: 1.75, borderRadius: 3 }}>
              <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ flex: 1 }}>
                  <Skeleton variant="text" width="36%" height={20} />
                  <Skeleton variant="text" width="48%" height={24} />
                </Box>
                <Skeleton variant="rounded" width={92} height={28} />
              </Stack>
            </Paper>

            <Skeleton variant="text" width="54%" height={20} />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <Skeleton variant="rounded" width={132} height={40} />
              <Skeleton variant="rounded" width={132} height={40} />
            </Stack>
          </Stack>
        </Paper>
      ))}
    </Box>
  )
}
