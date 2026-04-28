import type { ReactElement } from 'react'
import { OrdersCollectionPage } from './order.shared'

export function OrdersReturnsPage(): ReactElement {
  return (
    <OrdersCollectionPage
      title="Trả hàng"
      description="Quản lý các đơn trả hàng sau giao thành công để theo dõi reverse logistics, hậu mãi và nhập lại kho."
      view="returns"
      helperTitle="Returns tách module"
      helperDescription="Đơn đã hủy đã được tách sang danh sách riêng. Trang này tập trung cho đơn trả hàng và các đơn loại return để theo dõi nghiệp vụ trả hàng thực tế."
    />
  )
}
