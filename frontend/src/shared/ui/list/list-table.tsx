import type { ReactNode } from 'react'
import {
  Box,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import type { ListColumn } from '@/shared/ui/list/common-list.types'

type ListTableProps<T> = {
  columns: ListColumn<T>[]
  rows: T[]
  rowKey: (row: T) => string
  loading?: boolean
  emptyState?: ReactNode
}

export function ListTable<T>({
  columns,
  rows,
  rowKey,
  loading = false,
  emptyState,
}: ListTableProps<T>) {
  if (loading) {
    return (
      <Box sx={{ py: 8, display: 'grid', placeItems: 'center' }}>
        <CircularProgress size={28} />
      </Box>
    )
  }

  if (rows.length === 0) {
    return <>{emptyState}</>
  }

  return (
    <Table>
    <TableHead sx={{
      backgroundColor: "#f4f6f8",
    }}>
        <TableRow>
          {columns.map((column) => (
            <TableCell key={column.key} align={column.align} sx={{ width: column.width}}>
              {column.title}
            </TableCell>
          ))}
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={rowKey(row)} hover>
            {columns.map((column) => (
              <TableCell key={column.key} align={column.align}>
                <Typography component="div" variant="body2">
                  {column.render(row)}
                </Typography>
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

