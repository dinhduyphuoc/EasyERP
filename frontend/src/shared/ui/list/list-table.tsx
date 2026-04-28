import type { ReactNode } from 'react'
import {
  Box,
  Checkbox,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import type {
  ListColumn,
  ListLoadingState,
  ListRowClickHandler,
  ListRowSelectionConfig,
} from '@/shared/ui/list/common-list.types'

type ListTableProps<T> = {
  columns: ListColumn<T>[]
  rows: T[]
  rowKey: (row: T) => string
  onRowClick?: ListRowClickHandler<T>
  rowSelection?: ListRowSelectionConfig<T>
  loading?: boolean
  loadingState?: ListLoadingState
  emptyState?: ReactNode
}

export function ListTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  rowSelection,
  loading = false,
  loadingState,
  emptyState,
}: ListTableProps<T>) {
  if (loading) {
    if (loadingState) {
      return <>{loadingState}</>
    }

    return (
      <Box sx={{ py: 8, display: 'grid', placeItems: 'center' }}>
        <CircularProgress size={28} />
      </Box>
    )
  }

  if (rows.length === 0) {
    return <>{emptyState}</>
  }

  const currentPageKeys = rows.map((row) => rowKey(row))
  const allRowsSelected =
    rowSelection !== undefined &&
    currentPageKeys.length > 0 &&
    currentPageKeys.every((key) => rowSelection.selectedRowKeys.includes(key))
  const someRowsSelected =
    rowSelection !== undefined &&
    currentPageKeys.some((key) => rowSelection.selectedRowKeys.includes(key))

  const handleSelectAll = (checked: boolean) => {
    if (!rowSelection) {
      return
    }

    if (!checked) {
      rowSelection.onSelectedRowKeysChange(
        rowSelection.selectedRowKeys.filter((key) => !currentPageKeys.includes(key)),
      )
      return
    }

    const nextKeys = new Set(rowSelection.selectedRowKeys)
    currentPageKeys.forEach((key) => nextKeys.add(key))
    rowSelection.onSelectedRowKeysChange(Array.from(nextKeys))
  }

  const handleToggleRow = (targetKey: string) => {
    if (!rowSelection) {
      return
    }

    rowSelection.onSelectedRowKeysChange(
      rowSelection.selectedRowKeys.includes(targetKey)
        ? rowSelection.selectedRowKeys.filter((key) => key !== targetKey)
        : [...rowSelection.selectedRowKeys, targetKey],
    )
  }

  return (
    <Table>
      <TableHead
        sx={{
          backgroundColor: '#f4f6f8',
        }}
      >
        <TableRow>
          {rowSelection ? (
            <TableCell padding="checkbox" sx={{ width: 56 }}>
              <Checkbox
                size="small"
                checked={allRowsSelected}
                indeterminate={!allRowsSelected && someRowsSelected}
                onChange={(event) => handleSelectAll(event.target.checked)}
                slotProps={{ input: { 'aria-label': 'select all rows on current page' } }}
              />
            </TableCell>
          ) : null}
          {columns.map((column) => (
            <TableCell key={column.key} align={column.align} sx={{ width: column.width }}>
              {column.title}
            </TableCell>
          ))}
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((row) => {
          const key = rowKey(row)
          const isSelected = rowSelection?.selectedRowKeys.includes(key) ?? false

          return (
            <TableRow
              key={key}
              hover
              selected={isSelected}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              sx={
                onRowClick
                  ? {
                      cursor: 'pointer',
                      '&:hover': {
                        bgcolor: 'action.hover',
                      },
                    }
                  : undefined
              }
            >
              {rowSelection ? (
                <TableCell padding="checkbox" onClick={(event) => event.stopPropagation()}>
                  <Checkbox
                    size="small"
                    checked={isSelected}
                    onChange={() => handleToggleRow(key)}
                    slotProps={{ input: { 'aria-label': `select row ${rowSelection.getRowLabel?.(row) ?? key}` } }}
                  />
                </TableCell>
              ) : null}
              {columns.map((column) => (
                <TableCell key={column.key} align={column.align}>
                  <Typography component="div" variant="body2">
                    {column.render(row)}
                  </Typography>
                </TableCell>
              ))}
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
