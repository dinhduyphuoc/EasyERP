import type { ReactNode } from 'react'

export type ListTabConfig = {
  label: string
  value: string
  count?: number
  disabled?: boolean
}

export type ListFilterOption = {
  label: string
  value: string
}

export type ListFilterConfig = {
  key: string
  label: string
  placeholder?: string
  options: ListFilterOption[]
  minWidth?: number
}

export type ListColumn<T> = {
  key: string
  title: ReactNode
  align?: 'left' | 'center' | 'right'
  width?: number | string
  render: (row: T) => ReactNode
}

export type ListRowClickHandler<T> = (row: T) => void

export type ListRowSelectionConfig<T> = {
  selectedRowKeys: string[]
  onSelectedRowKeysChange: (keys: string[]) => void
  getRowLabel?: (row: T) => string
}

export type ListPaginationConfig = {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  onPageSizeChange?: (pageSize: number) => void
  pageSizeOptions?: number[]
}

export type ListLoadingState = ReactNode
