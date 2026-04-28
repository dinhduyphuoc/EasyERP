import type { ReactElement } from 'react'
import { OrdersCollectionPage } from './order.shared'

export function OrdersDraftsPage(): ReactElement {
  return (
    <OrdersCollectionPage
      title="Đơn hàng nháp"
      description="Danh sách các đơn đang được nhập liệu hoặc chờ hoàn thiện thông tin trước khi xác nhận xử lý."
      view="drafts"
      helperTitle="Luồng nháp"
      helperDescription="Draft phù hợp cho đơn chưa chốt sản phẩm, chưa chốt thanh toán hoặc đang cần xác minh thông tin khách hàng. Khi chuyển ra khỏi nháp, timeline xử lý sẽ bắt đầu rõ ràng hơn."
    />
  )
}
