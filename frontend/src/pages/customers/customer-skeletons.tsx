import { Chip, Skeleton, Stack, Table, TableBody, TableCell, TableHead, TableRow } from '@mui/material'

export function CustomerListTableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <Table>
      <TableHead sx={{ backgroundColor: '#f4f6f8' }}>
        <TableRow>
          <TableCell padding="checkbox" sx={{ width: 56 }}>
            <Skeleton variant="rounded" width={18} height={18} />
          </TableCell>
          <TableCell>Mã khách hàng</TableCell>
          <TableCell>Tên khách hàng</TableCell>
          <TableCell>Số điện thoại</TableCell>
          <TableCell>Nhóm khách hàng</TableCell>
          <TableCell>Lần mua cuối</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {Array.from({ length: rows }).map((_, index) => (
          <TableRow key={index}>
            <TableCell padding="checkbox">
              <Skeleton variant="rounded" width={18} height={18} />
            </TableCell>
            <TableCell>
              <Skeleton variant="text" width="62%" height={24} />
            </TableCell>
            <TableCell>
              <Stack spacing={0.75} sx={{ minWidth: 220 }}>
                <Skeleton variant="text" width="58%" height={24} />
                <Chip label="" sx={{ width: 104, height: 24, '& .MuiChip-label': { display: 'none' } }} />
              </Stack>
            </TableCell>
            <TableCell>
              <Skeleton variant="text" width="66%" height={24} />
            </TableCell>
            <TableCell>
              <Skeleton variant="text" width="60%" height={24} />
            </TableCell>
            <TableCell>
              <Skeleton variant="text" width="72%" height={24} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
