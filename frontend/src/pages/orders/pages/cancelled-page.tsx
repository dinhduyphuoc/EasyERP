import type { ReactElement } from 'react'
import { OrdersCollectionPage } from '../lib'

export function OrdersCancelledPage(): ReactElement {
  return (
    <OrdersCollectionPage
      title="Đơn đã hủy"
      description="Theo dõi các đơn bị hủy riêng biệt với trả hàng để đội vận hành đối soát lý do hủy, công nợ và tồn kho đã rollback."
      view="cancelled"
      helperTitle="Đơn hủy được tách riêng"
      helperDescription="Đơn hủy và trả hàng là hai nghiệp vụ khác nhau. Tách riêng danh sách giúp theo dõi conversion loss, vận hành hủy đơn và hậu mãi chính xác hơn."
    />
  )
}
