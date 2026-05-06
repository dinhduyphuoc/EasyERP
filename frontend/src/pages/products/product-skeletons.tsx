import { Box, Paper, Skeleton, Stack, Table, TableBody, TableCell, TableHead, TableRow } from '@mui/material'
import { defaultCardSx } from '@/shared/ui/paper'
import { CreateEditPageContainer } from '@/shared/ui/page'

function ProductListRowSkeleton() {
  return (
    <TableRow>
      <TableCell padding="checkbox">
        <Skeleton variant="rounded" width={18} height={18} />
      </TableCell>
      <TableCell>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', minWidth: 280 }}>
          <Skeleton variant="rounded" width={52} height={52} />
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Skeleton variant="text" width="46%" height={28} />
            <Skeleton variant="text" width="24%" height={20} />
          </Box>
        </Stack>
      </TableCell>
      <TableCell>
        <Skeleton variant="text" width="70%" height={24} />
      </TableCell>
      <TableCell>
        <Skeleton variant="text" width="58%" height={24} />
      </TableCell>
      <TableCell align="right">
        <Skeleton variant="text" width={18} height={24} sx={{ ml: 'auto' }} />
      </TableCell>
      <TableCell align="right">
        <Skeleton variant="text" width="52%" height={24} sx={{ ml: 'auto' }} />
      </TableCell>
      <TableCell>
        <Skeleton variant="rounded" width={92} height={26} />
      </TableCell>
    </TableRow>
  )
}

export function ProductListTableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <Table>
      <TableHead sx={{ backgroundColor: '#f4f6f8' }}>
        <TableRow>
          <TableCell padding="checkbox" sx={{ width: 56 }}>
            <Skeleton variant="rounded" width={18} height={18} />
          </TableCell>
          <TableCell>Sản phẩm</TableCell>
          <TableCell>SKU</TableCell>
          <TableCell>Danh mục</TableCell>
          <TableCell align="right">Biến thể</TableCell>
          <TableCell align="right">Giá bán</TableCell>
          <TableCell>Trạng thái</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {Array.from({ length: rows }).map((_, index) => (
          <ProductListRowSkeleton key={index} />
        ))}
      </TableBody>
    </Table>
  )
}

export function ProductCategoryListTableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <Table>
      <TableHead sx={{ backgroundColor: '#f4f6f8' }}>
        <TableRow>
          <TableCell padding="checkbox" sx={{ width: 56 }}>
            <Skeleton variant="rounded" width={18} height={18} />
          </TableCell>
          <TableCell>Danh mục</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {Array.from({ length: rows }).map((_, index) => (
          <TableRow key={index}>
            <TableCell padding="checkbox">
              <Skeleton variant="rounded" width={18} height={18} />
            </TableCell>
            <TableCell>
              <Skeleton variant="text" width={`${56 + (index % 3) * 10}%`} height={24} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function ProductFormFieldSkeleton({ fullWidth = false, multiline = false }: { fullWidth?: boolean; multiline?: boolean }) {
  return (
    <Box sx={{ gridColumn: fullWidth ? '1 / -1' : undefined }}>
      <Stack spacing={1}>
        <Skeleton variant="text" width={120} height={22} />
        <Skeleton variant="rounded" width="100%" height={multiline ? 132 : 40} />
      </Stack>
    </Box>
  )
}

function ProductFormHeaderSkeleton() {
  return (
    <Box sx={{ mb: 2 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ justifyContent: 'space-between', alignItems: { md: 'center' } }}>
        <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
          <Skeleton variant="rounded" width={44} height={44} />
          <Skeleton variant="text" width={220} height={36} />
        </Stack>
        <Skeleton variant="rounded" width={128} height={40} />
      </Stack>
    </Box>
  )
}

export function ProductPageSkeleton() {
  return (
    <CreateEditPageContainer>
      <ProductFormHeaderSkeleton />
      <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 2fr) minmax(320px, 1fr)' } }}>
        <Stack spacing={3}>
          <Paper sx={defaultCardSx}>
            <Stack spacing={3}>
              <Box>
                <Skeleton variant="text" width={180} height={32} />
              </Box>
              <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
                <ProductFormFieldSkeleton fullWidth />
                <ProductFormFieldSkeleton />
                <ProductFormFieldSkeleton />
                <ProductFormFieldSkeleton />
                <ProductFormFieldSkeleton fullWidth multiline />
              </Box>
            </Stack>
          </Paper>

          <Paper variant="outlined" sx={defaultCardSx}>
            <Skeleton variant="text" width={150} height={32} />
            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, mt: 2 }}>
              <ProductFormFieldSkeleton />
              <ProductFormFieldSkeleton />
            </Box>
          </Paper>

          <Paper sx={defaultCardSx}>
            <Stack spacing={2}>
              <Stack direction="row" spacing={2} sx={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
                <Skeleton variant="text" width={140} height={32} />
                <Skeleton variant="rounded" width={132} height={32} />
              </Stack>
              <Stack spacing={2}>
                {Array.from({ length: 2 }).map((_, index) => (
                  <Box
                    key={index}
                    sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1.4fr auto' } }}
                  >
                    <ProductFormFieldSkeleton />
                    <ProductFormFieldSkeleton />
                    <Skeleton variant="rounded" width={40} height={40} sx={{ justifySelf: { xs: 'flex-start', md: 'end' } }} />
                  </Box>
                ))}
              </Stack>
            </Stack>
          </Paper>
        </Stack>

        <Stack spacing={3}>
          <Paper sx={defaultCardSx}>
            <Stack spacing={2}>
              <Box>
                <Skeleton variant="text" width={110} height={32} />
                <Skeleton variant="text" width="72%" height={22} />
              </Box>
              <Skeleton variant="rounded" width="100%" height={300} sx={{ borderRadius: '18px' }} />
            </Stack>
          </Paper>
        </Stack>
      </Box>
    </CreateEditPageContainer>
  )
}

export function ProductCategoryPageSkeleton() {
  return (
    <CreateEditPageContainer>
      <Paper sx={{ ...defaultCardSx, mb: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ justifyContent: 'space-between', alignItems: { md: 'center' } }}>
          <Box sx={{ flex: 1 }}>
            <Skeleton variant="text" width={240} height={36} />
            <Skeleton variant="text" width="62%" height={22} />
          </Box>
          <Skeleton variant="rounded" width={128} height={40} />
        </Stack>
      </Paper>

      <Paper sx={defaultCardSx}>
        <Stack spacing={3}>
          <Box>
            <Skeleton variant="text" width={180} height={32} />
            <Skeleton variant="text" width="58%" height={22} />
          </Box>
          <Stack spacing={1}>
            <Skeleton variant="text" width={140} height={22} />
            <Skeleton variant="rounded" width="100%" height={40} />
          </Stack>
        </Stack>
      </Paper>
    </CreateEditPageContainer>
  )
}
