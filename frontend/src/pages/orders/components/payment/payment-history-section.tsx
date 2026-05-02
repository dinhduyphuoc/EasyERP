import type { ReactElement } from 'react'
import { Box, Paper, Stack, Typography } from '@mui/material'
import { formatCurrency, formatDateTime } from '../../lib/order.utils'

export type PaymentHistoryEntry = {
  id: number
  amount: number
  cumulativePaid: number
  outstandingAfter: number
  methodLabel: string
  paymentLabel: string
  note: string | null
  timestamp: string
}

export function PaymentHistorySection({
  entries,
  isLoading = false,
}: {
  entries: PaymentHistoryEntry[]
  isLoading?: boolean
}): ReactElement {
  if (isLoading) {
    return (
      <Paper variant="outlined" sx={{ p: 2, bgcolor: '#f8fafc' }}>
        <Typography color="text.secondary">
          Đang tải lịch sử thanh toán...
        </Typography>
      </Paper>
    )
  }

  if (entries.length === 0) {
    return (
      <Paper variant="outlined" sx={{ p: 2, bgcolor: '#f8fafc' }}>
        <Typography color="text.secondary">
          Chưa có giao dịch thanh toán nào. Hãy dùng nút "Thêm thanh toán" để ghi nhận từng lần thu tiền.
        </Typography>
      </Paper>
    )
  }

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack spacing={1.5}>
        <Typography sx={{ fontWeight: 800, color: '#0f172a' }}>Lịch sử thanh toán</Typography>
        <Stack spacing={1.25}>
          {entries.map((entry) => (
            <Box
              key={entry.id}
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) auto' },
                gap: 1.25,
                borderRadius: 2,
                border: '1px solid #e2e8f0',
                px: 1.5,
                py: 1.25,
                bgcolor: '#fff',
              }}
            >
              <Stack spacing={0.45}>
                <Typography sx={{ fontWeight: 700, color: '#0f172a' }}>
                  {entry.paymentLabel} • {entry.methodLabel}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {formatDateTime(entry.timestamp)} • Đã thu lũy kế {formatCurrency(entry.cumulativePaid)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Còn lại sau giao dịch: {formatCurrency(entry.outstandingAfter)}
                </Typography>
                {entry.note ? (
                  <Typography variant="body2" color="text.secondary">
                    Ghi chú: {entry.note}
                  </Typography>
                ) : null}
              </Stack>
              <Typography sx={{ fontWeight: 800, color: '#0f172a', textAlign: { md: 'right' } }}>
                {formatCurrency(entry.amount)}
              </Typography>
            </Box>
          ))}
        </Stack>
      </Stack>
    </Paper>
  )
}
