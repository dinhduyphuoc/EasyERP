import type { SvgIconComponent } from '@mui/icons-material'
import ApartmentOutlinedIcon from '@mui/icons-material/ApartmentOutlined'
import CreditCardOutlinedIcon from '@mui/icons-material/CreditCardOutlined'
import FolderOpenOutlinedIcon from '@mui/icons-material/FolderOpenOutlined'
import GroupWorkOutlinedIcon from '@mui/icons-material/GroupWorkOutlined'
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined'
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined'
import NotificationsOutlinedIcon from '@mui/icons-material/NotificationsOutlined'
import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined'
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined'
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined'
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined'

export type SettingsCardItem = {
  title: string
  description: string
  path: string
  icon: SvgIconComponent
  permissions?: string[]
}

export type SettingsCardSection = {
  id: string
  title: string
  description: string
  items: SettingsCardItem[]
}

export const settingsSections: SettingsCardSection[] = [
  {
    id: 'general',
    title: 'Thiết lập nền tảng',
    description: 'Cấu hình cốt lõi cho vận hành cửa hàng, giao hàng và các thiết lập kinh doanh mặc định.',
    items: [
      {
        title: 'Cài đặt chung',
        description: 'Cấu hình thông tin cửa hàng, hồ sơ pháp lý, liên hệ và các thiết lập mặc định.',
        path: '/settings/general',
        icon: SettingsOutlinedIcon,
        permissions: ['settings.read'],
      },
      {
        title: 'Quản lý địa chỉ',
        description: 'Quản lý địa chỉ giao hàng mặc định và thông tin vị trí dùng lại.',
        path: '/settings/address-management',
        icon: ApartmentOutlinedIcon,
        permissions: ['settings.read'],
      },
      {
        title: 'Giao hàng',
        description: 'Thiết lập kết nối đơn vị vận chuyển và các quy tắc vận hành liên quan.',
        path: '/settings/shipping-settings',
        icon: LocalShippingOutlinedIcon,
        permissions: ['settings.read'],
      },
    ],
  },
  {
    id: 'accounts',
    title: 'Nhân sự và phân quyền',
    description: 'Quản lý người dùng, vai trò, quyền hạn và cách phân công công việc trong hệ thống.',
    items: [
      {
        title: 'Người dùng',
        description: 'Tạo và quản lý tài khoản, trạng thái hoạt động và thông tin đăng nhập.',
        path: '/settings/accounts',
        icon: PersonOutlineOutlinedIcon,
        permissions: ['users.read'],
      },
      {
        title: 'Phân quyền',
        description: 'Thiết lập nhóm quyền và kiểm soát những gì từng bộ phận được xem hoặc chỉnh sửa.',
        path: '/settings/role-permission-groups',
        icon: GroupWorkOutlinedIcon,
        permissions: ['users.read'],
      },
      {
        title: 'Nhóm phân công',
        description: 'Nhóm nhân sự theo trách nhiệm để luồng xử lý và đối soát rõ ràng hơn.',
        path: '/settings/assignment-groups',
        icon: Inventory2OutlinedIcon,
        permissions: ['users.read'],
      },
    ],
  },
  {
    id: 'payments',
    title: 'Thanh toán và hóa đơn',
    description: 'Thiết lập phương thức thanh toán, hành vi xuất hóa đơn và các cấu hình tài chính.',
    items: [
      {
        title: 'Phương thức thanh toán',
        description: 'Quản lý tài khoản ngân hàng mặc định và thông tin thanh toán cho bộ phận tài chính.',
        path: '/settings/payment-methods',
        icon: CreditCardOutlinedIcon,
        permissions: ['payments.read'],
      },
      {
        title: 'Hóa đơn',
        description: 'Quản lý mẫu hóa đơn, dữ liệu xuất hóa đơn và các tùy chọn chứng từ tài chính.',
        path: '/settings/billing-invoices',
        icon: ReceiptLongOutlinedIcon,
        permissions: ['payments.read'],
      },
    ],
  },
  {
    id: 'system',
    title: 'Mở rộng và vận hành',
    description: 'Quản lý kênh vận hành, tích hợp, thông báo và tài nguyên dùng chung.',
    items: [
      {
        title: 'Kênh bán hàng',
        description: 'Điều phối các kênh bán và cách dữ liệu OMS đồng bộ giữa chúng.',
        path: '/settings/sales-channels',
        icon: StorefrontOutlinedIcon,
        permissions: ['settings.read'],
      },
      {
        title: 'Ứng dụng',
        description: 'Cấu hình cảnh báo nội bộ, thông báo tự động và các công cụ tích hợp.',
        path: '/settings/notifications',
        icon: NotificationsOutlinedIcon,
        permissions: ['settings.read'],
      },
      {
        title: 'Tệp tin',
        description: 'Quản lý tệp dùng chung, quy tắc lưu trữ và tài nguyên vận hành.',
        path: '/settings/file-management',
        icon: FolderOpenOutlinedIcon,
        permissions: ['settings.read'],
      },
    ],
  },
]

export const settingsDetailPages = settingsSections.flatMap((section) => section.items)

export const settingsItemsByPath = Object.fromEntries(
  settingsDetailPages.map((item) => [item.path, item]),
) as Record<string, SettingsCardItem>
