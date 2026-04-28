import type { ReactNode } from 'react'
import { Box, Button, Divider, Paper, Stack, Typography } from '@mui/material'
import { ListEmptyState } from '@/shared/ui/list/list-empty-state'
import { ListPageHeader } from '@/shared/ui/list/list-page-header'
import { ListPagination } from '@/shared/ui/list/list-pagination'
import { ListTable } from '@/shared/ui/list/list-table'
import { ListTabs } from '@/shared/ui/list/list-tabs'
import { ListToolbar } from '@/shared/ui/list/list-toolbar'
import type {
  ListColumn,
  ListFilterConfig,
  ListLoadingState,
  ListPaginationConfig,
  ListRowClickHandler,
  ListRowSelectionConfig,
  ListTabConfig,
} from '@/shared/ui/list/common-list.types'

type CommonListLayoutProps<T> = {
  title: ReactNode
  description?: ReactNode
  headerActions?: ReactNode
  tabs?: ListTabConfig[]
  activeTab?: string
  onTabChange?: (value: string) => void
  searchValue?: string
  searchPlaceholder?: string
  onSearchChange?: (value: string) => void
  filters?: ListFilterConfig[]
  filterValues?: Record<string, string>
  onFilterChange?: (key: string, value: string) => void
  toolbarActions?: ReactNode
  bulkActions?: ReactNode
  bulkDelete?: {
    enabled?: boolean
    selectedCount: number
    onDelete: () => void | Promise<void>
    selectionLabel?: ReactNode
    description?: ReactNode
    buttonLabel?: ReactNode
  }
  metaBar?: ReactNode
  columns: ListColumn<T>[]
  rows: T[]
  rowKey: (row: T) => string
  onRowClick?: ListRowClickHandler<T>
  rowSelection?: ListRowSelectionConfig<T>
  loading?: boolean
  loadingState?: ListLoadingState
  emptyState?: ReactNode
  pagination?: ListPaginationConfig
  helper?: ReactNode
}

export function CommonListLayout<T>({
  title,
  description,
  headerActions,
  tabs,
  activeTab,
  onTabChange,
  searchValue,
  searchPlaceholder,
  onSearchChange,
  filters,
  filterValues,
  onFilterChange,
  toolbarActions,
  bulkActions,
  bulkDelete,
  metaBar,
  columns,
  rows,
  rowKey,
  onRowClick,
  rowSelection,
  loading = false,
  loadingState,
  emptyState,
  pagination,
  helper,
}: CommonListLayoutProps<T>) {
  const shouldShowBulkDelete =
    bulkDelete !== undefined &&
    bulkDelete.enabled !== false &&
    bulkDelete.selectedCount > 0

  return (

    <Stack spacing={3}>
      <ListPageHeader title={title} description={description} actions={headerActions} />
      <Paper>
        {tabs && activeTab && onTabChange ? (
          <ListTabs tabs={tabs} activeTab={activeTab} onTabChange={onTabChange} />
        ) : null}
        <Box sx={{
          p: 2,
        }}>
        <ListToolbar
          searchValue={searchValue}
          searchPlaceholder={searchPlaceholder}
          onSearchChange={onSearchChange}
          filters={filters}
          filterValues={filterValues}
          onFilterChange={onFilterChange}
          actions={toolbarActions}
        />
        </Box>

        {shouldShowBulkDelete ? (
          <Paper sx={{ p: 2 }}>
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={2}
              sx={{ alignItems: { xs: 'stretch', md: 'center' }, justifyContent: 'space-between' }}
            >
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {bulkDelete.selectionLabel ?? `Đã chọn ${bulkDelete.selectedCount} dòng`}
                </Typography>
                {bulkDelete.description ? (
                  <Typography variant="body2" color="text.secondary">
                    {bulkDelete.description}
                  </Typography>
                ) : null}
              </Box>
              <Button variant="outlined" color="error" onClick={bulkDelete.onDelete}>
                {bulkDelete.buttonLabel ?? 'Xóa các dòng đã chọn'}
              </Button>
            </Stack>
          </Paper>
        ) : null}
        {bulkActions ? <Paper sx={{ p: 2 }}>{bulkActions}</Paper> : null}
        {metaBar ? (
          <>
            <Divider />
            <Box sx={{ p: 2 }}>{metaBar}</Box>
          </>
        ) : null}
          <ListTable
            columns={columns}
            rows={rows}
            rowKey={rowKey}
            onRowClick={onRowClick}
            rowSelection={rowSelection}
            loading={loading}
            loadingState={loadingState}
            emptyState={emptyState ?? <ListEmptyState title="Chưa có dữ liệu" />}
          />

          {pagination ? (
            <>
              <Divider />
              <ListPagination
                page={pagination.page}
                pageSize={pagination.pageSize}
                total={pagination.total}
                onPageChange={pagination.onPageChange}
                onPageSizeChange={pagination.onPageSizeChange}
                pageSizeOptions={pagination.pageSizeOptions}
              />
            </>
          ) : null}
        </Paper>

        {helper ? <Box>{helper}</Box> : null}
    </Stack>
  )
}
