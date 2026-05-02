import { MenuItem, Paper, Stack, Typography } from '@mui/material'
import { StackedDropdown } from '@/shared/ui/form/stacked-dropdown'
import { StackedTextField } from '@/shared/ui/form/stacked-text-field'
import { borderedCardSx } from '@/shared/ui/paper'
import { SummaryPaperHeader } from '@/shared/ui/summary-paper-header'
import type { OrderOptionLookup } from '../../api/order.api'
import { getProcessingStatusMeta } from '../../lib/order.utils'

type ProcessingStatus = 'draft' | 'placed' | 'delivering' | 'delivered' | 'completed' | 'cancelled' | 'returned'
type FormOrderType = 'sale' | 'return'

type SidebarSectionsProps = {
  orderCode: string
  orderDate: string
  orderType: FormOrderType
  processingStatus: ProcessingStatus
  salesChannel: string
  orderNotes: string
  processingStatusOptions: OrderOptionLookup['processing_statuses']
  processingStatusError?: string
  onOrderCodeChange: (value: string) => void
  onOrderDateChange: (value: string) => void
  onOrderTypeChange: (value: FormOrderType) => void
  onProcessingStatusChange: (value: ProcessingStatus) => void
  onSalesChannelChange: (value: string) => void
  onOrderNotesChange: (value: string) => void
}

export function SidebarSections({
  orderCode,
  orderDate,
  orderType,
  processingStatus,
  salesChannel,
  orderNotes,
  processingStatusOptions,
  processingStatusError,
  onOrderCodeChange,
  onOrderDateChange,
  onOrderTypeChange,
  onProcessingStatusChange,
  onSalesChannelChange,
  onOrderNotesChange,
}: SidebarSectionsProps) {
  const resolvedProcessingStatusValue = processingStatusOptions.some((status) => status.value === processingStatus)
    ? processingStatus
    : ''

  return (
    <Stack spacing={2.5}>
      <Paper sx={borderedCardSx}>
        <Stack spacing={1.5}>
          <SummaryPaperHeader title="Thông tin đơn hàng" />
          <StackedTextField
            fullWidth
            label="Mã đơn hàng"
            placeholder="Để trống nếu muốn hệ thống tự tạo"
            value={orderCode}
            onChange={(event) => onOrderCodeChange(event.target.value)}
          />
          <StackedTextField
            fullWidth
            label="Ngày tạo đơn"
            type="date"
            value={orderDate}
            onChange={(event) => onOrderDateChange(event.target.value)}
          />
          <StackedDropdown
            fullWidth
            label="Loại đơn"
            value={orderType}
            onChange={(event) => onOrderTypeChange(event.target.value as FormOrderType)}
          >
            <MenuItem value="sale">Bán hàng</MenuItem>
            <MenuItem value="return">Trả hàng</MenuItem>
          </StackedDropdown>
          <StackedDropdown
            fullWidth
            label="Trạng thái xử lý"
            value={resolvedProcessingStatusValue}
            onChange={(event) => onProcessingStatusChange(event.target.value as ProcessingStatus)}
          >
            {processingStatusOptions.map((status) => (
              <MenuItem key={status.value} value={status.value}>
                {getProcessingStatusMeta(status.value).label}
              </MenuItem>
            ))}
          </StackedDropdown>
          <StackedTextField
            fullWidth
            label="Kênh bán hàng"
            placeholder="Nhập kênh bán hàng"
            value={salesChannel}
            onChange={(event) => onSalesChannelChange(event.target.value)}
          />
          {processingStatusError ? <Typography color="error">{processingStatusError}</Typography> : null}
        </Stack>
      </Paper>

      <Paper sx={borderedCardSx}>
        <Stack spacing={1.5}>
          <SummaryPaperHeader title="Ghi chú" />
          <StackedTextField
            fullWidth
            multiline
            minRows={4}
            placeholder="Nhập ghi chú cho đơn hàng"
            value={orderNotes}
            onChange={(event) => onOrderNotesChange(event.target.value)}
          />
        </Stack>
      </Paper>
    </Stack>
  )
}
