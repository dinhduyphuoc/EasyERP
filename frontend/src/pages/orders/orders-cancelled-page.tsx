import type { ReactElement } from 'react'
import { OrdersCollectionPage } from './order.shared'

export function OrdersCancelledPage(): ReactElement {
  return (
    <OrdersCollectionPage
      title="Don da huy"
      description="Theo doi cac don bi huy rieng biet voi tra hang de doi van hanh doi soat ly do huy, cong no va ton kho da rollback."
      view="cancelled"
      helperTitle="Cancelled tach rieng"
      helperDescription="Cancelled va returned la hai nghiep vu khac nhau. Tach rieng danh sach giup theo doi conversion loss, van hanh huy don va hau mai chinh xac hon."
    />
  )
}
