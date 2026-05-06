import type { ReactElement } from 'react'
import { ShippingManagementView } from '@/pages/shipping/shipping-management-view'

export function SettingsShippingPage(): ReactElement {
  return (
    <ShippingManagementView
      title="Vận chuyển"
      description="Thiết lập kết nối nhà vận chuyển trong khu vực Cài đặt, quản lý token tích hợp và chuẩn bị nền tảng để mở rộng thêm nhiều đơn vị vận chuyển khác."
    />
  )
}
