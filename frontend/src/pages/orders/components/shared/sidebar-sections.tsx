import { MenuItem, Paper, Stack, Typography } from '@mui/material'
import { validateEmailField } from '@/pages/onboarding/onboarding.validation'
import { StackedDropdown } from '@/shared/ui/form/stacked-dropdown'
import { StackedTextField } from '@/shared/ui/form/stacked-text-field'
import { borderedCardSx } from '@/shared/ui/paper'
import { SummaryPaperHeader } from '@/shared/ui/summary-paper-header'
import type { OrderInvoiceSnapshot, OrderOptionLookup } from '../../api/order.api'
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
  invoiceCode: string
  invoiceSnapshot: OrderInvoiceSnapshot
  processingStatusOptions: OrderOptionLookup['processing_statuses']
  processingStatusError?: string
  onOrderCodeChange: (value: string) => void
  onOrderDateChange: (value: string) => void
  onOrderTypeChange: (value: FormOrderType) => void
  onProcessingStatusChange: (value: ProcessingStatus) => void
  onSalesChannelChange: (value: string) => void
  onOrderNotesChange: (value: string) => void
  onInvoiceCodeChange: (value: string) => void
  onInvoiceSnapshotChange: (field: keyof OrderInvoiceSnapshot, value: string) => void
}

export function SidebarSections({
  orderCode,
  orderDate,
  orderType,
  processingStatus,
  salesChannel,
  orderNotes,
  invoiceCode,
  invoiceSnapshot,
  processingStatusOptions,
  processingStatusError,
  onOrderCodeChange,
  onOrderDateChange,
  onOrderTypeChange,
  onProcessingStatusChange,
  onSalesChannelChange,
  onOrderNotesChange,
  onInvoiceCodeChange,
  onInvoiceSnapshotChange,
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
            submitError={processingStatusError}
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
          <SummaryPaperHeader title="Thông tin hóa đơn" />
          <StackedTextField
            fullWidth
            label="Mã hóa đơn"
            placeholder="Để trống nếu chưa chốt"
            value={invoiceCode}
            onChange={(event) => onInvoiceCodeChange(event.target.value)}
          />
          <StackedDropdown
            fullWidth
            label="Loại hóa đơn"
            value={invoiceSnapshot.invoice_type}
            onChange={(event) => onInvoiceSnapshotChange('invoice_type', String(event.target.value))}
          >
            <MenuItem value="b2c">B2C</MenuItem>
            <MenuItem value="b2b">B2B</MenuItem>
          </StackedDropdown>
          <StackedTextField
            fullWidth
            label="Người mua / người nhận hóa đơn"
            value={invoiceSnapshot.buyer_name}
            onChange={(event) => onInvoiceSnapshotChange('buyer_name', event.target.value)}
          />
          <StackedTextField
            fullWidth
            label="Tên công ty"
            value={invoiceSnapshot.company_name}
            onChange={(event) => onInvoiceSnapshotChange('company_name', event.target.value)}
          />
          <StackedTextField
            fullWidth
            label="Mã số thuế"
            value={invoiceSnapshot.tax_code}
            onChange={(event) => onInvoiceSnapshotChange('tax_code', event.target.value)}
          />
          <StackedTextField
            fullWidth
            label="Email nhận hóa đơn"
            value={invoiceSnapshot.email}
            onChange={(event) => onInvoiceSnapshotChange('email', event.target.value)}
            validate={validateEmailField}
            validateWhen="blur"
          />
          <StackedTextField
            fullWidth
            label="Địa chỉ xuất hóa đơn"
            value={invoiceSnapshot.address_line}
            onChange={(event) => onInvoiceSnapshotChange('address_line', event.target.value)}
          />
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
