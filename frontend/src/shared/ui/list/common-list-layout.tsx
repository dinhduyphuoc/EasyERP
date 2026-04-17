import type { ReactNode } from 'react'
import { Box, Divider, Paper, Stack } from '@mui/material'
import { ListEmptyState } from '@/shared/ui/list/list-empty-state'
import { ListPageHeader } from '@/shared/ui/list/list-page-header'
import { ListPagination } from '@/shared/ui/list/list-pagination'
import { ListTable } from '@/shared/ui/list/list-table'
import { ListTabs } from '@/shared/ui/list/list-tabs'
import { ListToolbar } from '@/shared/ui/list/list-toolbar'
import type {
  ListColumn,
  ListFilterConfig,
  ListPaginationConfig,
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
  metaBar?: ReactNode
  columns: ListColumn<T>[]
  rows: T[]
  rowKey: (row: T) => string
  loading?: boolean
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
  metaBar,
  columns,
  rows,
  rowKey,
  loading = false,
  emptyState,
  pagination,
  helper,
}: CommonListLayoutProps<T>) {
  return (

    <Stack sx={{
      mx: { xs: 2, md: 3, xl: 4 },
      px: { xs: 1, md: 2, xl: 3 }
    }} spacing={3}>
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

        {bulkActions ? <Paper sx={{ borderRadius: 5, p: 2 }}>{bulkActions}</Paper> : null}
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
            loading={loading}
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
