import type { ReactElement } from 'react'
import { PagePlaceholder } from '@/shared/ui/page/page-placeholder'

export function AccountSettingsPage(): ReactElement {
  return (
    <PagePlaceholder
      title="Cấu hình tài khoản"
      path="/account/settings"
      description="Khu vực này sẵn sàng để gắn đổi mật khẩu, cài đặt thông báo, phiên đăng nhập và các tuỳ chọn bảo mật cá nhân."
    />
  )
}
