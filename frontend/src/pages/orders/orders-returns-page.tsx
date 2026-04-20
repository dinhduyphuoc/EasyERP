import type { ReactElement } from 'react'
import { OrdersCollectionPage } from './order.shared'

export function OrdersReturnsPage(): ReactElement {
  return (
    <OrdersCollectionPage
      title="Tra hang"
      description="Quan ly cac don tra hang sau giao thanh cong de theo doi reverse logistics, hau mai va nhap lai kho."
      view="returns"
      helperTitle="Returns tach module"
      helperDescription="Cancelled da duoc tach sang danh sach rieng. Trang nay tap trung cho returned va cac don return type de theo doi tra hang thuc su."
    />
  )
}
