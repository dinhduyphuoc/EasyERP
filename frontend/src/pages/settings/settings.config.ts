import type { SvgIconComponent } from '@mui/icons-material'
import ApartmentOutlinedIcon from '@mui/icons-material/ApartmentOutlined'
import CreditCardOutlinedIcon from '@mui/icons-material/CreditCardOutlined'
import FolderOpenOutlinedIcon from '@mui/icons-material/FolderOpenOutlined'
import GroupWorkOutlinedIcon from '@mui/icons-material/GroupWorkOutlined'
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined'
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined'
import NotificationsOutlinedIcon from '@mui/icons-material/NotificationsOutlined'
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined'
import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined'
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined'
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined'
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined'

export type SettingsCardItem = {
  title: string
  description: string
  path: string
  icon: SvgIconComponent
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
    title: 'Nhóm 1 - Cấu hình chung',
    description: 'Thiết lập nền tảng để vận hành hệ thống đồng nhất và dễ mở rộng.',
    items: [
      {
        title: 'Cấu hình chung',
        description: 'Quản lý cấu hình chung của hệ thống, thông tin doanh nghiệp và tùy chọn mặc định.',
        path: '/settings/general',
        icon: SettingsOutlinedIcon,
      },
      {
        title: 'Address Management',
        description: 'Tổ chức danh sách địa chỉ, khu vực giao nhận và dữ liệu vị trí dùng trong vận hành.',
        path: '/settings/address-management',
        icon: ApartmentOutlinedIcon,
      },
      {
        title: 'Vận chuyển',
        description: 'Cấu hình, liên kết đơn vị vận chuyển.',
        path: '/settings/shipping-settings',
        icon: LocalShippingOutlinedIcon,
      },
    ],
  },
  {
    id: 'accounts',
    title: 'Nhóm 2 - Tài khoản & phân quyền',
    description: 'Quản lý người dùng, vai trò và cách phân phối công việc giữa các nhóm vận hành.',
    items: [
      {
        title: 'Accounts',
        description: 'Tạo và quản lý tài khoản người dùng, trạng thái hoạt động và thông tin đăng nhập.',
        path: '/settings/accounts',
        icon: PersonOutlineOutlinedIcon,
      },
      {
        title: 'Role / Permission Groups',
        description: 'Thiết lập nhóm quyền truy cập để kiểm soát phạm vi thao tác theo chức năng.',
        path: '/settings/role-permission-groups',
        icon: GroupWorkOutlinedIcon,
      },
      {
        title: 'Assignment Groups',
        description: 'Phân nhóm nhân sự theo vai trò xử lý để dễ giao việc và theo dõi hiệu suất.',
        path: '/settings/assignment-groups',
        icon: Inventory2OutlinedIcon,
      },
    ],
  },
  {
    id: 'payments',
    title: 'Nhóm 3 - Thanh toán & tài chính',
    description: 'Quản lý phương thức thanh toán, cấu hình cổng thu tiền và chứng từ tài chính.',
    items: [
      {
        title: 'Payment Methods',
        description: 'Khai báo các phương thức thanh toán áp dụng trong bán hàng và đối soát.',
        path: '/settings/payment-methods',
        icon: CreditCardOutlinedIcon,
      },
      {
        title: 'Payment Configuration',
        description: 'Cấu hình thanh toán, cổng kết nối và quy tắc xử lý trạng thái giao dịch.',
        path: '/settings/payment-configuration',
        icon: PaymentsOutlinedIcon,
      },
      {
        title: 'Billing / Invoices',
        description: 'Quản lý hóa đơn, mẫu chứng từ và thiết lập dữ liệu phục vụ xuất billing.',
        path: '/settings/billing-invoices',
        icon: ReceiptLongOutlinedIcon,
      },
    ],
  },
  {
    id: 'system',
    title: 'Nhóm 4 - Hệ thống & tích hợp',
    description: 'Điều phối các cấu hình mở rộng, tích hợp ngoài hệ thống và tài nguyên dùng chung.',
    items: [
      {
        title: 'Sales Channels',
        description: 'Quản lý các kênh bán hàng kết nối với hệ thống và cấu hình đồng bộ dữ liệu.',
        path: '/settings/sales-channels',
        icon: StorefrontOutlinedIcon,
      },
      {
        title: 'Notifications',
        description: 'Thiết lập thông báo nội bộ, nhắc việc và quy tắc gửi cảnh báo theo sự kiện.',
        path: '/settings/notifications',
        icon: NotificationsOutlinedIcon,
      },
      {
        title: 'File Management',
        description: 'Quản lý kho tệp, quyền truy cập file và các quy tắc lưu trữ tài nguyên số.',
        path: '/settings/file-management',
        icon: FolderOpenOutlinedIcon,
      },
    ],
  },
]

export const settingsDetailPages = settingsSections.flatMap((section) => section.items)
