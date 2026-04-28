import type { ReactElement } from 'react'
import { Divider, Stack, Typography } from '@mui/material'
import { formatCurrency } from './order.utils'

export function PaymentSummarySection({
  itemCount,
  subTotal,
  discountAmount,
  shippingFee,
  totalAmount,
  paidAmount,
  remainingAmount,
}: {
  itemCount: number
  subTotal: number
  discountAmount: number
  shippingFee: number
  totalAmount: number
  paidAmount: number
  remainingAmount: number
}): ReactElement {
  const statusLabel =
    remainingAmount <= 0 && totalAmount > 0
      ? 'Đã thanh toán'
      : paidAmount > 0
        ? 'Đã cọc'
        : 'Chưa thanh toán'

  return (
      <Stack spacing={1.35}>
        <SummaryLine label="Trạng thái" value={statusLabel} valueColor={paidAmount > 0 ? '#0f766e' : '#b42318'} />
        <SummaryLine
          label={`Tổng tiền hàng (${Math.max(itemCount, 0)} sản phẩm)`}
          value={formatCurrency(subTotal)}
        />
        <SummaryLine label="Giảm giá" value={discountAmount > 0 ? `- ${formatCurrency(discountAmount)}` : formatCurrency(0)} />
        <SummaryLine label="Phí ship" value={formatCurrency(shippingFee)} />
        <Divider />
        <SummaryLine label="Tổng" value={formatCurrency(totalAmount)} strong />
        <SummaryLine label="Khách đã trả" value={formatCurrency(paidAmount)} />
        <Divider />
        <SummaryLine label="Còn lại" value={formatCurrency(remainingAmount)} strong valueColor={remainingAmount > 0 ? '#d92d20' : '#027a48'} />
      </Stack>
  )
}

function SummaryLine({
  label,
  value,
  strong = false,
  valueColor = '#0f172a',
}: {
  label: string
  value: string
  strong?: boolean
  valueColor?: string
}): ReactElement {
  return (
    <Stack direction="row" spacing={1.5} sx={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
      <Typography variant="body2" color="text.secondary" sx={{ fontWeight: strong ? 700 : 500 }}>
        {label}
      </Typography>
      <Typography
        sx={{
          textAlign: 'right',
          color: valueColor,
          fontWeight: strong ? 800 : 600,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </Typography>
    </Stack>
  )
}
