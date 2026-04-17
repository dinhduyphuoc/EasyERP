import { Box, TablePagination, Typography } from '@mui/material'

type ListPaginationProps = {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  onPageSizeChange?: (pageSize: number) => void
  pageSizeOptions?: number[]
}

export function ListPagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50],
}: ListPaginationProps) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  return (
    <Box
      sx={{
        px: 3,
        py: 1.5,
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 2,
      }}
    >
      <Typography color="text.secondary">
        Trang {from}-{to} trên {total} trang
      </Typography>
      <TablePagination
        component="div"
        count={total}
        page={Math.max(page - 1, 0)}
        onPageChange={(_, nextPage) => onPageChange(nextPage + 1)}
        rowsPerPage={pageSize}
        onRowsPerPageChange={(event) => {
          onPageSizeChange?.(Number(event.target.value))
        }}
        rowsPerPageOptions={pageSizeOptions}
        labelDisplayedRows={() => ''}
        labelRowsPerPage="Số dòng"
      />
    </Box>
  )
}
