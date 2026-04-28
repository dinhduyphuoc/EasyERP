import type { ReactElement } from 'react'
import { OrdersCollectionPage } from './order.shared'

export function OrdersIncompletePage(): ReactElement {
  return (
    <OrdersCollectionPage
      title="Đơn hàng chưa hoàn tất"
      description="Theo dõi các đơn còn công nợ hoặc chưa đi đến mốc hoàn thành để đội vận hành không bị sót việc."
      view="incomplete"
      helperTitle="Luồng chưa hoàn tất"
      helperDescription="Danh sách này gom các đơn chưa thanh toán đủ hoặc chưa hoàn thành. Đây là nơi hữu ích để theo dõi đơn đặt cọc, đơn đang giao và các ca cần thu nốt trước khi đóng đơn."
    />
  )
}
