import type { ReactElement } from 'react'
import { OrdersCollectionPage } from './order.shared'

export function OrdersListPage(): ReactElement {
  return (
    <OrdersCollectionPage
      title="Đơn hàng"
      description=''
      helperTitle="Thiết kế data flow"
      helperDescription="Đơn unpaid có thể ở draft hoặc chờ xác nhận nhưng không được completed. Đơn deposit có thể tiếp tục xử lý, vẫn theo dõi số tiền còn thiếu. Đơn paid có thể đi hết luồng fulfillment và hoàn thành."
    />
  )
}
