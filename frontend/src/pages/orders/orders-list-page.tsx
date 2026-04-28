import type { ReactElement } from 'react'
import { OrdersCollectionPage } from './order.shared'

export function OrdersListPage(): ReactElement {
  return (
    <OrdersCollectionPage
      title="Đơn hàng"
      description=""
      helperTitle="Thiết kế luồng dữ liệu"
      helperDescription="Đơn `unpaid` có thể ở trạng thái nháp hoặc chờ xác nhận nhưng không được hoàn thành. Đơn `deposit` có thể tiếp tục xử lý, vẫn theo dõi số tiền còn thiếu. Đơn `paid` có thể đi hết luồng fulfillment và hoàn thành."
    />
  )
}
