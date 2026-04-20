import type { ReactElement } from 'react'
import { OrdersCollectionPage } from './order.shared'

export function OrdersIncompletePage(): ReactElement {
  return (
    <OrdersCollectionPage
      title="Đơn hàng chưa hoàn tất"
      description="Theo dõi các đơn còn công nợ hoặc chưa đi đến mốc hoàn thành để đội vận hành không bỏ sót việc."
      view="incomplete"
      helperTitle="Luồng incomplete"
      helperDescription="Danh sách này gom các đơn chưa paid hoặc chưa completed. Đây là nơi hữu ích để theo dõi đơn đặt cọc, đơn đang giao và các ca cần thu nốt trước khi đóng đơn."
    />
  )
}
