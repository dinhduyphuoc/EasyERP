import type { ReactElement } from 'react'
import { OrdersCollectionPage } from './order.shared'

export function OrdersReturnsPage(): ReactElement {
  return (
    <OrdersCollectionPage
      title="Trả hàng"
      description="Quản lý các đơn hoàn trả hoặc đơn được đánh dấu returned để theo dõi đối soát và hậu mãi."
      view="returns"
      helperTitle="Returns tách module"
      helperDescription="Hiện tại returns dùng chung cấu trúc order để tái sử dụng timeline, payment và history. Cách này giúp dễ tách riêng module hậu mãi hoặc reverse logistics ở bước sau."
    />
  )
}
