import AccountBalanceOutlinedIcon from '@mui/icons-material/AccountBalanceOutlined'
import ApartmentOutlinedIcon from '@mui/icons-material/ApartmentOutlined'
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined'
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined'
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined'
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined'
import PointOfSaleOutlinedIcon from '@mui/icons-material/PointOfSaleOutlined'
import QrCode2OutlinedIcon from '@mui/icons-material/QrCode2Outlined'
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined'
import SellOutlinedIcon from '@mui/icons-material/SellOutlined'
import VerifiedOutlinedIcon from '@mui/icons-material/VerifiedOutlined'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  MenuItem,
  Paper,
  Stack,
  Switch,
  Tab,
  Tabs,
  Typography,
} from '@mui/material'
import { useEffect, useMemo, useState, type ReactElement } from 'react'
import { useStore } from '@/modules/store/use-store'
import { storeApi, type StoreRecord } from '@/modules/store/store.api'
import { validateEmailField } from '@/pages/onboarding/onboarding.validation'
import { StackedDropdown } from '@/shared/ui/form/stacked-dropdown'
import { StackedTextField } from '@/shared/ui/form/stacked-text-field'
import { borderedCardSx } from '@/shared/ui/paper'
import { SummaryPaperHeader } from '@/shared/ui/summary-paper-header'
import { appToast } from '@/shared/ui/toast/toast.helpers'
import { showErrorToast } from '@/shared/ui/toast/toast-error'
import { useJsonDirtyState } from '@/shared/ui/unsaved-changes'
import { generalSettingsApi, type GeneralSettings } from './general-settings.api'
import { useSettingsUnsavedRegistration } from './settings-unsaved-context'

type InvoiceMode = 'b2b' | 'b2c'

type InvoiceFieldStatus = 'required' | 'recommended' | 'optional'

type InvoiceFieldItem = {
  label: string
  note: string
  status: InvoiceFieldStatus
}

const statusMeta: Record<InvoiceFieldStatus, { label: string; color: string; bg: string }> = {
  required: { label: 'Bắt buộc', color: '#b42318', bg: '#fef3f2' },
  recommended: { label: 'Nên có', color: '#b54708', bg: '#fffaeb' },
  optional: { label: 'Theo yêu cầu', color: '#026aa2', bg: '#f0f9ff' },
}

const legalMilestones = [
  {
    title: 'Nghị định 123/2020/NĐ-CP',
    effectiveDate: '01/07/2022',
    description:
      'Thiết lập bộ khung nội dung hóa đơn điện tử, ký hiệu mẫu số, số hóa đơn, thông tin người bán, người mua, hàng hóa và thuế.',
  },
  {
    title: 'Nghị định 70/2025/NĐ-CP',
    effectiveDate: '01/06/2025',
    description:
      'Bổ sung số định danh cá nhân/mã đơn vị NSNN của người mua, làm rõ dữ liệu theo ngành và hóa đơn điện tử khởi tạo từ máy tính tiền cho bán lẻ.',
  },
]

const invoiceTemplatePlaceholders = [
  ['{{invoice_title}}', 'Tiêu đề hóa đơn theo ngữ cảnh B2B/B2C'],
  ['{{invoice_code}}', 'Mã hóa đơn điện tử hoặc mã tra cứu fallback'],
  ['{{invoice_series}}', 'Ký hiệu/prefix hóa đơn'],
  ['{{invoice_date}}', 'Ngày lập hóa đơn'],
  ['{{invoice_signed_at}}', 'Ngày ký số / cập nhật cuối'],
  ['{{seller_legal_name}}', 'Tên pháp lý người bán'],
  ['{{seller_brand_name}}', 'Tên thương hiệu người bán'],
  ['{{seller_tax_code}}', 'Mã số thuế người bán'],
  ['{{seller_address}}', 'Địa chỉ người bán'],
  ['{{seller_email}}', 'Email người bán'],
  ['{{seller_phone}}', 'Điện thoại người bán'],
  ['{{buyer_name}}', 'Người mua / người nhận hóa đơn'],
  ['{{buyer_company_name}}', 'Tên công ty người mua'],
  ['{{buyer_tax_or_personal_id}}', 'MST hoặc số định danh cá nhân'],
  ['{{buyer_address}}', 'Địa chỉ xuất hóa đơn của người mua'],
  ['{{items_rows_html}}', 'HTML dòng sản phẩm đã render sẵn'],
  ['{{sub_total}}', 'Tạm tính trước VAT/phí'],
  ['{{discount_amount}}', 'Chiết khấu'],
  ['{{tax_amount}}', 'Tiền VAT'],
  ['{{shipping_fee}}', 'Phí giao hàng'],
  ['{{total_amount}}', 'Tổng thanh toán'],
  ['{{lookup_code}}', 'Mã tra cứu / fallback khi chưa có invoice code'],
  ['{{footer_note}}', 'Footer theo B2B hoặc B2C'],
] as const

const b2bFields: InvoiceFieldItem[] = [
  {
    label: 'Tên hóa đơn, mẫu số, ký hiệu, số hóa đơn',
    note: 'Dùng cho hóa đơn GTGT hoặc hóa đơn bán hàng; cần hiển thị nổi bật ở đầu chứng từ.',
    status: 'required',
  },
  {
    label: 'Thông tin người bán',
    note: 'Tên pháp lý, địa chỉ, mã số thuế, thông tin liên hệ và dấu hiệu nhận diện thương hiệu.',
    status: 'required',
  },
  {
    label: 'Thông tin người mua doanh nghiệp',
    note: 'Tên đơn vị, địa chỉ, mã số thuế; nếu cần có thể bổ sung mã đơn vị có quan hệ với ngân sách.',
    status: 'required',
  },
  {
    label: 'Danh mục hàng hóa, dịch vụ',
    note: 'Tên hàng hóa/dịch vụ, đơn vị tính, số lượng, đơn giá, thành tiền trước thuế.',
    status: 'required',
  },
  {
    label: 'Thuế GTGT và tổng thanh toán',
    note: 'Hiển thị theo từng mức thuế suất, tiền thuế và tổng cộng sau thuế.',
    status: 'required',
  },
  {
    label: 'Thời điểm lập hóa đơn và thời điểm ký số',
    note: 'Tách riêng để phù hợp tình huống lập hóa đơn và ký số khác thời điểm.',
    status: 'required',
  },
  {
    label: 'QR tra cứu hoặc mã cơ quan thuế',
    note: 'Giúp đối soát hóa đơn điện tử nhanh, đặc biệt khi gửi cho đối tác hoặc kế toán mua hàng.',
    status: 'recommended',
  },
]

const b2cFields: InvoiceFieldItem[] = [
  {
    label: 'Tiêu đề hóa đơn bán lẻ / hóa đơn điện tử từ máy tính tiền',
    note: 'Phù hợp luồng bán trực tiếp đến người tiêu dùng, đặc biệt với retail, ăn uống, dịch vụ.',
    status: 'required',
  },
  {
    label: 'Thông tin người bán',
    note: 'Tên, địa chỉ, mã số thuế của điểm bán hoặc doanh nghiệp.',
    status: 'required',
  },
  {
    label: 'Thông tin người mua',
    note: 'Tên, địa chỉ, MST/số định danh cá nhân/số điện thoại nếu người mua yêu cầu lấy hóa đơn.',
    status: 'optional',
  },
  {
    label: 'Tên hàng hóa, đơn giá, số lượng, giá thanh toán',
    note: 'Trường hợp kê khai khấu trừ cần hiển thị thêm giá chưa thuế, thuế suất và tiền thuế GTGT.',
    status: 'required',
  },
  {
    label: 'Thời điểm lập hóa đơn',
    note: 'Cần hiển thị rõ theo thời gian phát sinh giao dịch tại quầy hoặc tại điểm cung cấp dịch vụ.',
    status: 'required',
  },
  {
    label: 'Mã cơ quan thuế hoặc dữ liệu điện tử để tra cứu',
    note: 'Có thể biểu diễn bằng QR/chuỗi tra cứu ngắn ở chân hóa đơn.',
    status: 'required',
  },
  {
    label: 'Khối thông tin đổi trả/chăm sóc khách hàng',
    note: 'Không phải chỉ tiêu pháp lý bắt buộc nhưng rất hữu ích với bán lẻ và CSKH.',
    status: 'recommended',
  },
]

const formatVatRate = (settings: GeneralSettings | null) => {
  if (!settings?.defaults.vat.enabled) {
    return '0%'
  }

  return `${settings.defaults.vat.rate_percent}%`
}

const toAddress = (store: StoreRecord | null) => {
  if (!store) {
    return 'Số 12 Nguyễn Huệ, Quận 1, TP.HCM'
  }

  const billingAddress =
    typeof store.addresses.billing.address_line === 'string' ? store.addresses.billing.address_line.trim() : ''

  return billingAddress || store.profile.address_line || 'Địa chỉ cửa hàng chưa cấu hình'
}

function FieldChip({ status }: { status: InvoiceFieldStatus }): ReactElement {
  const meta = statusMeta[status]

  return (
    <Chip
      label={meta.label}
      size="small"
      sx={{
        borderRadius: 999,
        bgcolor: meta.bg,
        color: meta.color,
        fontWeight: 700,
      }}
    />
  )
}

function InvoiceFieldList({ title, items }: { title: string; items: InvoiceFieldItem[] }): ReactElement {
  return (
    <Paper sx={borderedCardSx}>
      <Stack spacing={2}>
        <SummaryPaperHeader title={title} />
        <Stack spacing={1.25}>
          {items.map((item) => (
            <Stack
              key={item.label}
              direction={{ xs: 'column', md: 'row' }}
              spacing={1.25}
              sx={{
                justifyContent: 'space-between',
                alignItems: { md: 'flex-start' },
                border: '1px solid #eaecf0',
                borderRadius: 3,
                p: 1.5,
                bgcolor: '#fff',
              }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontWeight: 700, color: '#101828', mb: 0.5 }}>{item.label}</Typography>
                <Typography variant="body2" sx={{ color: '#667085', lineHeight: 1.6 }}>
                  {item.note}
                </Typography>
              </Box>
              <FieldChip status={item.status} />
            </Stack>
          ))}
        </Stack>
      </Stack>
    </Paper>
  )
}

function InvoicePreviewCard({
  title,
  eyebrow,
  accent,
  children,
}: {
  title: string
  eyebrow: string
  accent: string
  children: ReactElement | ReactElement[]
}): ReactElement {
  return (
    <Paper
      sx={{
        ...borderedCardSx,
        overflow: 'hidden',
        background:
          'linear-gradient(180deg, rgba(255,255,255,1) 0%, rgba(249,250,251,1) 56%, rgba(244,247,250,1) 100%)',
      }}
    >
      <Box
        sx={{
          px: 2.5,
          py: 2,
          borderBottom: '1px solid #eaecf0',
          background: `linear-gradient(135deg, ${accent} 0%, #ffffff 90%)`,
        }}
      >
        <Typography variant="caption" sx={{ color: '#475467', fontWeight: 800, letterSpacing: 0.8 }}>
          {eyebrow}
        </Typography>
        <Typography sx={{ fontSize: 22, fontWeight: 800, color: '#101828', mt: 0.5 }}>{title}</Typography>
      </Box>
      <Stack spacing={2.5} sx={{ p: 2.5 }}>
        {children}
      </Stack>
    </Paper>
  )
}

function InvoiceMetaRow({
  icon,
  label,
  value,
}: {
  icon: ReactElement
  label: string
  value: string
}): ReactElement {
  return (
    <Stack direction="row" spacing={1.25} sx={{ alignItems: 'flex-start' }}>
      <Box
        sx={{
          width: 34,
          height: 34,
          borderRadius: 2.5,
          display: 'grid',
          placeItems: 'center',
          bgcolor: '#f2f4f7',
          color: '#475467',
          flexShrink: 0,
        }}
      >
        {icon}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="caption" sx={{ color: '#667085', textTransform: 'uppercase', letterSpacing: 0.6 }}>
          {label}
        </Typography>
        <Typography sx={{ color: '#101828', fontWeight: 700 }}>{value}</Typography>
      </Box>
    </Stack>
  )
}

function B2BPreview({
  store,
  settings,
}: {
  store: StoreRecord | null
  settings: GeneralSettings | null
}): ReactElement {
  const legalName = store?.profile.legal_full_name || store?.name || 'CÔNG TY TNHH EASYERP DEMO'
  const vatRate = formatVatRate(settings)
  const subTotal = 12500000
  const vatValue = settings?.defaults.vat.enabled ? (subTotal * settings.defaults.vat.rate_percent) / 100 : 0
  const total = subTotal + vatValue

  return (
    <InvoicePreviewCard
      title="HÓA ĐƠN GIÁ TRỊ GIA TĂNG"
      eyebrow="B2B TEMPLATE"
      accent="rgba(194, 231, 255, 0.85)"
    >
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ justifyContent: 'space-between' }}>
        <Stack spacing={1}>
          <Typography sx={{ fontWeight: 800, color: '#0f172a' }}>{legalName}</Typography>
          <Typography variant="body2" sx={{ color: '#475467' }}>
            {toAddress(store)}
          </Typography>
          <Typography variant="body2" sx={{ color: '#475467' }}>
            MST: 0312345678
          </Typography>
        </Stack>
        <Stack spacing={1} sx={{ minWidth: { md: 260 } }}>
          <InvoiceMetaRow icon={<ReceiptLongOutlinedIcon fontSize="small" />} label="Mẫu số / Ký hiệu" value="1C26TYY / AA-25E" />
          <InvoiceMetaRow icon={<VerifiedOutlinedIcon fontSize="small" />} label="Số hóa đơn" value="0000128" />
          <InvoiceMetaRow icon={<CalendarMonthOutlinedIcon fontSize="small" />} label="Ngày lập / ký số" value="04/05/2026 14:36 / 04/05/2026 15:02" />
        </Stack>
      </Stack>

      <Divider />

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        <Box sx={{ flex: 1, border: '1px solid #eaecf0', borderRadius: 3, p: 2 }}>
          <Typography sx={{ fontWeight: 800, color: '#101828', mb: 1 }}>Bên bán</Typography>
          <Stack spacing={1}>
            <InvoiceMetaRow icon={<BusinessOutlinedIcon fontSize="small" />} label="Tên đơn vị" value={legalName} />
            <InvoiceMetaRow icon={<ApartmentOutlinedIcon fontSize="small" />} label="Địa chỉ" value={toAddress(store)} />
            <InvoiceMetaRow icon={<AccountBalanceOutlinedIcon fontSize="small" />} label="Tài khoản nhận tiền" value={settings?.defaults.bank_account.account_number || '1903 2025 6868'} />
          </Stack>
        </Box>
        <Box sx={{ flex: 1, border: '1px solid #eaecf0', borderRadius: 3, p: 2 }}>
          <Typography sx={{ fontWeight: 800, color: '#101828', mb: 1 }}>Bên mua</Typography>
          <Stack spacing={1}>
            <InvoiceMetaRow icon={<BadgeOutlinedIcon fontSize="small" />} label="Tên đơn vị" value="CÔNG TY CỔ PHẦN ABC DISTRIBUTION" />
            <InvoiceMetaRow icon={<ApartmentOutlinedIcon fontSize="small" />} label="Địa chỉ / MST" value="15 Lê Thánh Tôn, Q.1, TP.HCM • 0309988776" />
            <InvoiceMetaRow icon={<FactCheckOutlinedIcon fontSize="small" />} label="Mã đơn vị NSNN / tham chiếu" value="Tùy chọn nếu bên mua thuộc khối ngân sách" />
          </Stack>
        </Box>
      </Stack>

      <Box sx={{ border: '1px solid #d0d5dd', borderRadius: 3, overflow: 'hidden' }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1.5fr 0.7fr 0.5fr 0.7fr 0.8fr', bgcolor: '#f8fafc', px: 1.5, py: 1.25 }}>
          {['Hàng hóa / dịch vụ', 'Đơn vị tính', 'SL', 'Đơn giá', 'Thành tiền'].map((label) => (
            <Typography key={label} variant="body2" sx={{ fontWeight: 800, color: '#344054' }}>
              {label}
            </Typography>
          ))}
        </Box>
        {[
          ['Gói triển khai EasyERP OMS', 'Gói', '1', '8.500.000', '8.500.000'],
          ['Phí onboarding kho và vận hành', 'Dịch vụ', '1', '4.000.000', '4.000.000'],
        ].map((row) => (
          <Box
            key={row[0]}
            sx={{
              display: 'grid',
              gridTemplateColumns: '1.5fr 0.7fr 0.5fr 0.7fr 0.8fr',
              px: 1.5,
              py: 1.25,
              borderTop: '1px solid #eaecf0',
            }}
          >
            {row.map((cell) => (
              <Typography key={cell} variant="body2" sx={{ color: '#101828' }}>
                {cell}
              </Typography>
            ))}
          </Box>
        ))}
      </Box>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        <Box sx={{ flex: 1, borderRadius: 3, border: '1px dashed #98a2b3', p: 2 }}>
          <Typography sx={{ fontWeight: 700, color: '#101828', mb: 1 }}>Ghi chú pháp lý</Typography>
          <Typography variant="body2" sx={{ color: '#667085', lineHeight: 1.7 }}>
            Tách riêng thời điểm lập và thời điểm ký số. Trường thông tin người mua ưu tiên tên đơn vị, địa chỉ, MST; có thể mở rộng thêm số định danh cá nhân hoặc mã đơn vị NSNN khi cần.
          </Typography>
        </Box>
        <Box sx={{ minWidth: { md: 280 }, borderRadius: 3, border: '1px solid #eaecf0', p: 2, bgcolor: '#fcfcfd' }}>
          <Stack spacing={1}>
            <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
              <Typography variant="body2" sx={{ color: '#667085' }}>Cộng tiền hàng</Typography>
              <Typography sx={{ fontWeight: 700 }}>{subTotal.toLocaleString('vi-VN')} đ</Typography>
            </Stack>
            <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
              <Typography variant="body2" sx={{ color: '#667085' }}>VAT ({vatRate})</Typography>
              <Typography sx={{ fontWeight: 700 }}>{vatValue.toLocaleString('vi-VN')} đ</Typography>
            </Stack>
            <Divider />
            <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
              <Typography sx={{ fontWeight: 800, color: '#101828' }}>Tổng thanh toán</Typography>
              <Typography sx={{ fontWeight: 800, color: '#101828' }}>{total.toLocaleString('vi-VN')} đ</Typography>
            </Stack>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', pt: 1 }}>
              <QrCode2OutlinedIcon sx={{ color: '#475467' }} />
              <Typography variant="body2" sx={{ color: '#667085' }}>
                QR tra cứu hóa đơn / mã cơ quan thuế đặt ở chân chứng từ.
              </Typography>
            </Stack>
          </Stack>
        </Box>
      </Stack>
    </InvoicePreviewCard>
  )
}

function B2CPreview({
  store,
  settings,
}: {
  store: StoreRecord | null
  settings: GeneralSettings | null
}): ReactElement {
  const vatRate = formatVatRate(settings)

  return (
    <InvoicePreviewCard
      title="HÓA ĐƠN ĐIỆN TỬ KHỞI TẠO TỪ MÁY TÍNH TIỀN"
      eyebrow="B2C TEMPLATE"
      accent="rgba(254, 228, 64, 0.28)"
    >
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ justifyContent: 'space-between' }}>
        <Stack spacing={0.75}>
          <Typography sx={{ fontWeight: 800, color: '#101828' }}>{store?.name || 'EasyERP Retail Flagship'}</Typography>
          <Typography variant="body2" sx={{ color: '#475467' }}>
            {toAddress(store)}
          </Typography>
          <Typography variant="body2" sx={{ color: '#475467' }}>
            MST: 0312345678 • Hotline: {store?.profile.contact_phone || '0909 000 123'}
          </Typography>
        </Stack>
        <Stack spacing={1} sx={{ minWidth: { md: 260 } }}>
          <InvoiceMetaRow icon={<PointOfSaleOutlinedIcon fontSize="small" />} label="Điểm bán / POS" value="Quầy số 03 • Cửa hàng trung tâm" />
          <InvoiceMetaRow icon={<CalendarMonthOutlinedIcon fontSize="small" />} label="Thời điểm lập" value="04/05/2026 19:42" />
          <InvoiceMetaRow icon={<QrCode2OutlinedIcon fontSize="small" />} label="Mã tra cứu" value="MTT-000128-20260504" />
        </Stack>
      </Stack>

      <Alert
        severity="info"
        sx={{
          borderRadius: 3,
          '& .MuiAlert-message': {
            width: '100%',
          },
        }}
      >
        <Typography variant="body2" sx={{ lineHeight: 1.7 }}>
          Thông tin người mua trong mẫu B2C chỉ hiển thị khi khách yêu cầu lấy hóa đơn. Khi không có yêu cầu, giao diện vẫn hợp lệ nếu giữ đủ dữ liệu người bán, mặt hàng, thời điểm lập và mã tra cứu.
        </Typography>
      </Alert>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        <Box sx={{ flex: 1, border: '1px solid #eaecf0', borderRadius: 3, p: 2, bgcolor: '#fffef6' }}>
          <Typography sx={{ fontWeight: 800, color: '#101828', mb: 1 }}>Thông tin người mua</Typography>
          <Stack spacing={1}>
            <InvoiceMetaRow icon={<BadgeOutlinedIcon fontSize="small" />} label="Mặc định" value="Khách lẻ / không yêu cầu xuất danh tính" />
            <InvoiceMetaRow icon={<FactCheckOutlinedIcon fontSize="small" />} label="Khi có yêu cầu" value="Tên khách • SĐT hoặc số định danh cá nhân • Email nhận hóa đơn" />
          </Stack>
        </Box>
        <Box sx={{ flex: 1, border: '1px solid #eaecf0', borderRadius: 3, p: 2 }}>
          <Typography sx={{ fontWeight: 800, color: '#101828', mb: 1 }}>Tình huống nên dùng</Typography>
          <Stack spacing={1}>
            <InvoiceMetaRow icon={<SellOutlinedIcon fontSize="small" />} label="Retail / POS" value="Siêu thị, cửa hàng, nhà hàng, dịch vụ trực tiếp người tiêu dùng" />
            <InvoiceMetaRow icon={<ReceiptLongOutlinedIcon fontSize="small" />} label="Mẫu hiển thị" value="Ngắn, dễ in tại quầy, vẫn đủ dữ liệu cho tra cứu hóa đơn điện tử" />
          </Stack>
        </Box>
      </Stack>

      <Box sx={{ borderRadius: 3, border: '1px solid #d0d5dd', overflow: 'hidden' }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1.4fr 0.7fr 0.4fr 0.7fr', bgcolor: '#f8fafc', px: 1.5, py: 1.25 }}>
          {['Mặt hàng', 'Đơn giá', 'SL', 'Thanh toán'].map((label) => (
            <Typography key={label} variant="body2" sx={{ fontWeight: 800, color: '#344054' }}>
              {label}
            </Typography>
          ))}
        </Box>
        {[
          ['Áo sơ mi linen', '590.000', '1', '590.000'],
          ['Thắt lưng da', '450.000', '1', '450.000'],
          ['Giảm giá thành viên', '-50.000', '1', '-50.000'],
        ].map((row) => (
          <Box
            key={row[0]}
            sx={{
              display: 'grid',
              gridTemplateColumns: '1.4fr 0.7fr 0.4fr 0.7fr',
              px: 1.5,
              py: 1.25,
              borderTop: '1px solid #eaecf0',
              bgcolor: row[0].includes('Giảm') ? '#fffaf5' : '#fff',
            }}
          >
            {row.map((cell) => (
              <Typography key={cell} variant="body2" sx={{ color: '#101828' }}>
                {cell}
              </Typography>
            ))}
          </Box>
        ))}
      </Box>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        <Box sx={{ flex: 1, borderRadius: 3, border: '1px dashed #98a2b3', p: 2 }}>
          <Typography sx={{ fontWeight: 700, color: '#101828', mb: 1 }}>Lưu ý hiển thị B2C</Typography>
          <Typography variant="body2" sx={{ color: '#667085', lineHeight: 1.7 }}>
            Nếu đơn vị nộp thuế theo phương pháp khấu trừ, mẫu tại quầy nên có thêm khối phụ hiển thị giá chưa thuế, thuế suất {vatRate}, tiền thuế và tổng thanh toán sau thuế.
          </Typography>
        </Box>
        <Box sx={{ minWidth: { md: 280 }, borderRadius: 3, border: '1px solid #eaecf0', p: 2, bgcolor: '#fcfcfd' }}>
          <Stack spacing={1}>
            <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
              <Typography variant="body2" sx={{ color: '#667085' }}>Tạm tính</Typography>
              <Typography sx={{ fontWeight: 700 }}>990.000 đ</Typography>
            </Stack>
            <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
              <Typography variant="body2" sx={{ color: '#667085' }}>VAT ({vatRate})</Typography>
              <Typography sx={{ fontWeight: 700 }}>{settings?.defaults.vat.enabled ? '99.000 đ' : '0 đ'}</Typography>
            </Stack>
            <Divider />
            <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
              <Typography sx={{ fontWeight: 800, color: '#101828' }}>Khách cần trả</Typography>
              <Typography sx={{ fontWeight: 800, color: '#101828' }}>
                {settings?.defaults.vat.enabled ? '1.089.000 đ' : '990.000 đ'}
              </Typography>
            </Stack>
          </Stack>
        </Box>
      </Stack>
    </InvoicePreviewCard>
  )
}

export function SettingsBillingInvoicesPage(): ReactElement {
  const { activeStore } = useStore()
  const [mode, setMode] = useState<InvoiceMode>('b2b')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [store, setStore] = useState<StoreRecord | null>(null)
  const [settings, setSettings] = useState<GeneralSettings | null>(null)
  const [invoiceDraft, setInvoiceDraft] = useState<GeneralSettings['defaults']['invoice'] | null>(null)
  const [hasAttemptedSave, setHasAttemptedSave] = useState(false)
  const dirtyState = useJsonDirtyState({ invoiceDraft }, !isLoading && invoiceDraft !== null)

  useEffect(() => {
    if (!activeStore?.id) {
      setIsLoading(false)
      setStore(null)
      setSettings(null)
      return
    }

    let cancelled = false

    const load = async () => {
      setIsLoading(true)
      try {
        const [storeResponse, settingsResponse] = await Promise.all([
          storeApi.getStore(activeStore.id),
          generalSettingsApi.getGeneralSettings(),
        ])

        if (cancelled) {
          return
        }

        setStore(storeResponse)
        setSettings(settingsResponse)
        setInvoiceDraft(settingsResponse.defaults.invoice)
        dirtyState.setInitialSnapshot(JSON.stringify({ invoiceDraft: settingsResponse.defaults.invoice }))
      } catch (error) {
        if (!cancelled) {
          showErrorToast(error, 'Không thể tải cấu hình hóa đơn hiện tại.')
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [activeStore?.id])

  const activeFields = useMemo(() => (mode === 'b2b' ? b2bFields : b2cFields), [mode])
  const errors = useMemo(() => {
    if (!invoiceDraft) {
      return {}
    }

    const nextErrors: Record<string, string> = {}

    if (!invoiceDraft.numbering.invoice_series_prefix.trim()) {
      nextErrors.invoice_series_prefix = 'Prefix ký hiệu là bắt buộc.'
    }

    if (!invoiceDraft.seller.legal_name.trim()) {
      nextErrors.seller_legal_name = 'Tên pháp lý là bắt buộc.'
    }

    if (!invoiceDraft.seller.tax_code.trim()) {
      nextErrors.seller_tax_code = 'Mã số thuế là bắt buộc.'
    }

    if (!invoiceDraft.seller.address_line.trim()) {
      nextErrors.seller_address_line = 'Địa chỉ người bán là bắt buộc.'
    }

    if (invoiceDraft.seller.email.trim()) {
      const emailError = validateEmailField(invoiceDraft.seller.email)

      if (emailError) {
        nextErrors.seller_email = emailError
      }
    }

    return nextErrors
  }, [invoiceDraft])

  const handleInvoiceDraftChange = <T extends keyof GeneralSettings['defaults']['invoice']>(
    section: T,
    value: GeneralSettings['defaults']['invoice'][T],
  ) => {
    setInvoiceDraft((current) => (current ? { ...current, [section]: value } : current))
  }

  const handleDiscard = () => {
    if (!dirtyState.initialSnapshot) {
      return
    }

    const snapshot = JSON.parse(dirtyState.initialSnapshot) as {
      invoiceDraft: GeneralSettings['defaults']['invoice']
    }
    setInvoiceDraft(snapshot.invoiceDraft)
    setHasAttemptedSave(false)
  }

  const handleSave = async () => {
    if (!invoiceDraft) {
      return
    }

    setHasAttemptedSave(true)

    if (Object.keys(errors).length > 0) {
      appToast.warning('Vui lòng kiểm tra lại các trường bắt buộc của invoice.')
      return
    }

    try {
      setIsSaving(true)
      const updated = await generalSettingsApi.updateGeneralSettings({
        defaults: {
          shipping_address: settings?.defaults.shipping_address ?? {
            contact_name: '',
            phone: '',
            state_id: null,
            city_id: null,
            district_id: null,
            address_line: '',
          },
          bank_account: settings?.defaults.bank_account ?? {
            bank_name: '',
            bank_bin: '',
            bank_code: '',
            account_number: '',
            account_holder: '',
            qr_template: 'compact',
          },
          vat: settings?.defaults.vat ?? {
            enabled: false,
            rate_percent: 0,
          },
          invoice: invoiceDraft,
        },
      })
      setSettings(updated)
      setInvoiceDraft(updated.defaults.invoice)
      dirtyState.setInitialSnapshot(JSON.stringify({ invoiceDraft: updated.defaults.invoice }))
      setHasAttemptedSave(false)
      appToast.success('Đã lưu cấu hình invoice.')
    } catch (error) {
      showErrorToast(error, 'Không thể lưu cấu hình invoice.')
    } finally {
      setIsSaving(false)
    }
  }

  useSettingsUnsavedRegistration(
    useMemo(
      () => ({
        isDirty: dirtyState.isDirty,
        isSaving,
        onSave: () => void handleSave(),
        onDiscard: handleDiscard,
      }),
      [dirtyState.isDirty, isSaving, invoiceDraft, settings],
    ),
  )

  return (
    <Stack spacing={2.5} sx={{ pb: 8 }}>
      <Paper
        sx={{
          ...borderedCardSx,
          overflow: 'hidden',
          background:
            'radial-gradient(circle at top right, rgba(254, 240, 138, 0.45) 0%, rgba(255,255,255,1) 38%), linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
        }}
      >
        <Stack spacing={2.5}>
          <Box>
            <Typography sx={{ fontSize: 28, fontWeight: 900, color: '#101828', mb: 1 }}>
              Thiết kế hóa đơn điện tử cho B2B và B2C
            </Typography>
            <Typography sx={{ color: '#475467', maxWidth: 920, lineHeight: 1.75 }}>
              Mẫu hiển thị này được dựng theo khung nội dung của Nghị định 123/2020/NĐ-CP có hiệu lực từ 01/07/2022 và các điểm sửa đổi đáng chú ý của Nghị định 70/2025/NĐ-CP có hiệu lực từ 01/06/2025.
            </Typography>
          </Box>

          <Stack direction={{ xs: 'column', xl: 'row' }} spacing={1.5}>
            {legalMilestones.map((item) => (
              <Box
                key={item.title}
                sx={{
                  flex: 1,
                  minWidth: 0,
                  border: '1px solid #eaecf0',
                  borderRadius: 3,
                  p: 1.75,
                  bgcolor: 'rgba(255,255,255,0.9)',
                }}
              >
                <Typography sx={{ fontWeight: 800, color: '#101828' }}>{item.title}</Typography>
                <Typography variant="body2" sx={{ color: '#b54708', fontWeight: 700, mt: 0.5, mb: 1 }}>
                  Hiệu lực: {item.effectiveDate}
                </Typography>
                <Typography variant="body2" sx={{ color: '#667085', lineHeight: 1.7 }}>
                  {item.description}
                </Typography>
              </Box>
            ))}
          </Stack>
        </Stack>
      </Paper>

      <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2.5} sx={{ alignItems: 'stretch' }}>
        <Paper sx={{ ...borderedCardSx, flex: 1 }}>
          <Stack spacing={2}>
            <SummaryPaperHeader title="Tóm tắt thiết kế" />
            <Stack spacing={1.25}>
              <InvoiceMetaRow icon={<BusinessOutlinedIcon fontSize="small" />} label="Người bán" value={store?.profile.legal_full_name || store?.name || 'Dùng thông tin cửa hàng đang active'} />
              <InvoiceMetaRow icon={<ApartmentOutlinedIcon fontSize="small" />} label="Địa chỉ xuất hóa đơn" value={toAddress(store)} />
              <InvoiceMetaRow icon={<AccountBalanceOutlinedIcon fontSize="small" />} label="Tài khoản nhận tiền" value={settings?.defaults.bank_account.account_number || 'Lấy từ cấu hình thanh toán'} />
              <InvoiceMetaRow icon={<SellOutlinedIcon fontSize="small" />} label="Thuế suất mặc định" value={formatVatRate(settings)} />
            </Stack>
          </Stack>
        </Paper>

        <Paper sx={{ ...borderedCardSx, flex: 1 }}>
          <Stack spacing={2}>
            <SummaryPaperHeader title="Điểm mới cần phản ánh từ 01/06/2025" />
            <Stack spacing={1.25}>
              <Typography variant="body2" sx={{ color: '#475467', lineHeight: 1.7 }}>
                1. Người mua có thể được định danh bằng <strong>số định danh cá nhân</strong> hoặc <strong>mã số đơn vị có quan hệ với ngân sách</strong> ngoài MST.
              </Typography>
              <Typography variant="body2" sx={{ color: '#475467', lineHeight: 1.7 }}>
                2. Một số ngành phải hiển thị mô tả hàng hóa, dịch vụ chi tiết hơn; vì vậy layout nên dành chỗ cho diễn giải mở rộng ở dòng hàng.
              </Typography>
              <Typography variant="body2" sx={{ color: '#475467', lineHeight: 1.7 }}>
                3. Mẫu B2C/POS cần ưu tiên <strong>thời điểm lập</strong> và <strong>mã tra cứu cơ quan thuế</strong>, còn thông tin người mua có thể hiện khi khách yêu cầu.
              </Typography>
            </Stack>
          </Stack>
        </Paper>
      </Stack>

      {invoiceDraft ? (
        <Paper sx={borderedCardSx}>
          <Stack spacing={2.5}>
            <SummaryPaperHeader title="Cấu hình dữ liệu invoice" />
            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', xl: '1fr 1fr' } }}>
              <StackedDropdown
                label="Chế độ phát hành"
                value={invoiceDraft.issuing_mode}
                onChange={(event) =>
                  handleInvoiceDraftChange(
                    'issuing_mode',
                    event.target.value as GeneralSettings['defaults']['invoice']['issuing_mode'],
                  )
                }
              >
                <MenuItem value="hybrid">Hybrid B2B + B2C</MenuItem>
                <MenuItem value="b2b">B2B</MenuItem>
                <MenuItem value="b2c">B2C</MenuItem>
              </StackedDropdown>

              <StackedTextField
                label="Prefix ký hiệu"
                required
                value={invoiceDraft.numbering.invoice_series_prefix}
                onChange={(event) =>
                  handleInvoiceDraftChange('numbering', {
                    ...invoiceDraft.numbering,
                    invoice_series_prefix: event.target.value,
                  })
                }
                submitError={hasAttemptedSave ? errors.invoice_series_prefix : undefined}
              />

              <StackedTextField
                label="Tên pháp lý"
                required
                value={invoiceDraft.seller.legal_name}
                onChange={(event) =>
                  handleInvoiceDraftChange('seller', { ...invoiceDraft.seller, legal_name: event.target.value })
                }
                submitError={hasAttemptedSave ? errors.seller_legal_name : undefined}
              />

              <StackedTextField
                label="Tên thương hiệu"
                value={invoiceDraft.seller.brand_name}
                onChange={(event) =>
                  handleInvoiceDraftChange('seller', { ...invoiceDraft.seller, brand_name: event.target.value })
                }
              />

              <StackedTextField
                label="Mã số thuế"
                required
                value={invoiceDraft.seller.tax_code}
                onChange={(event) =>
                  handleInvoiceDraftChange('seller', { ...invoiceDraft.seller, tax_code: event.target.value })
                }
                submitError={hasAttemptedSave ? errors.seller_tax_code : undefined}
              />

              <StackedTextField
                label="Email người bán"
                value={invoiceDraft.seller.email}
                onChange={(event) =>
                  handleInvoiceDraftChange('seller', { ...invoiceDraft.seller, email: event.target.value })
                }
                submitError={hasAttemptedSave ? errors.seller_email : undefined}
                validate={validateEmailField}
                validateWhen="blur"
              />

              <StackedTextField
                label="Số điện thoại người bán"
                value={invoiceDraft.seller.phone}
                onChange={(event) =>
                  handleInvoiceDraftChange('seller', { ...invoiceDraft.seller, phone: event.target.value })
                }
              />

              <StackedTextField
                label="Màu chính"
                value={invoiceDraft.display.primary_color}
                onChange={(event) =>
                  handleInvoiceDraftChange('display', { ...invoiceDraft.display, primary_color: event.target.value })
                }
              />

              <Box sx={{ gridColumn: '1 / -1' }}>
                <StackedTextField
                  label="Địa chỉ người bán"
                  required
                  value={invoiceDraft.seller.address_line}
                  onChange={(event) =>
                    handleInvoiceDraftChange('seller', { ...invoiceDraft.seller, address_line: event.target.value })
                  }
                  submitError={hasAttemptedSave ? errors.seller_address_line : undefined}
                />
              </Box>

              <Box sx={{ gridColumn: '1 / -1' }}>
                <StackedTextField
                  label="Footer B2B"
                  value={invoiceDraft.display.footer_note_b2b}
                  onChange={(event) =>
                    handleInvoiceDraftChange('display', { ...invoiceDraft.display, footer_note_b2b: event.target.value })
                  }
                />
              </Box>

              <Box sx={{ gridColumn: '1 / -1' }}>
                <StackedTextField
                  label="Footer B2C"
                  value={invoiceDraft.display.footer_note_b2c}
                  onChange={(event) =>
                    handleInvoiceDraftChange('display', { ...invoiceDraft.display, footer_note_b2c: event.target.value })
                  }
                />
              </Box>

              <Box sx={{ gridColumn: '1 / -1' }}>
                <StackedTextField
                  label="Template HTML B2B"
                  value={invoiceDraft.templates.b2b_html}
                  onChange={(event) =>
                    handleInvoiceDraftChange('templates', { ...invoiceDraft.templates, b2b_html: event.target.value })
                  }
                  multiline
                  minRows={12}
                />
              </Box>

              <Box sx={{ gridColumn: '1 / -1' }}>
                <StackedTextField
                  label="Template HTML B2C"
                  value={invoiceDraft.templates.b2c_html}
                  onChange={(event) =>
                    handleInvoiceDraftChange('templates', { ...invoiceDraft.templates, b2c_html: event.target.value })
                  }
                  multiline
                  minRows={12}
                />
              </Box>
            </Box>

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
              <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', justifyContent: 'space-between', flex: 1 }}>
                <Typography sx={{ color: '#344054' }}>Hiển thị tài khoản ngân hàng</Typography>
                <Switch
                  checked={invoiceDraft.display.show_bank_account}
                  onChange={(event) =>
                    handleInvoiceDraftChange('display', { ...invoiceDraft.display, show_bank_account: event.target.checked })
                  }
                />
              </Stack>
              <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', justifyContent: 'space-between', flex: 1 }}>
                <Typography sx={{ color: '#344054' }}>Hiển thị QR thanh toán</Typography>
                <Switch
                  checked={invoiceDraft.display.show_payment_qr}
                  onChange={(event) =>
                    handleInvoiceDraftChange('display', { ...invoiceDraft.display, show_payment_qr: event.target.checked })
                  }
                />
              </Stack>
            </Stack>

            <Stack direction="row" spacing={1.25} sx={{ justifyContent: 'flex-end' }}>
              <Button variant="contained" onClick={() => void handleSave()} disabled={isSaving}>
                {isSaving ? 'Đang lưu...' : 'Lưu cấu hình'}
              </Button>
            </Stack>
          </Stack>
        </Paper>
      ) : null}

      <Paper sx={borderedCardSx}>
        <Stack spacing={2}>
          <SummaryPaperHeader title="Placeholder cho template HTML" />
          <Typography variant="body2" sx={{ color: '#667085', lineHeight: 1.7 }}>
            Các template HTML B2B/B2C đang được render server-side. Bạn có thể chèn các token dưới đây trực tiếp vào HTML để hệ thống thay dữ liệu từ đơn hàng khi xuất bản in hoặc PDF.
          </Typography>
          <Box sx={{ display: 'grid', gap: 1.25, gridTemplateColumns: { xs: '1fr', xl: '1fr 1fr' } }}>
            {invoiceTemplatePlaceholders.map(([token, meaning]) => (
              <Box
                key={token}
                sx={{
                  border: '1px solid #eaecf0',
                  borderRadius: 3,
                  p: 1.5,
                  bgcolor: '#fff',
                }}
              >
                <Typography sx={{ fontFamily: 'monospace', fontWeight: 700, color: '#101828', mb: 0.5 }}>
                  {token}
                </Typography>
                <Typography variant="body2" sx={{ color: '#667085', lineHeight: 1.6 }}>
                  {meaning}
                </Typography>
              </Box>
            ))}
          </Box>
        </Stack>
      </Paper>

      {isLoading ? (
        <Paper sx={borderedCardSx}>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
            <CircularProgress size={24} />
            <Typography sx={{ color: '#475467' }}>Đang tải dữ liệu cửa hàng và cấu hình thanh toán để ghép vào mẫu hóa đơn...</Typography>
          </Stack>
        </Paper>
      ) : null}

      <Paper sx={borderedCardSx}>
        <Stack spacing={2.5}>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={1.5}
            sx={{ justifyContent: 'space-between', alignItems: { md: 'center' } }}
          >
            <Box>
              <Typography sx={{ fontWeight: 800, color: '#101828' }}>Bộ preview đề xuất</Typography>
              <Typography variant="body2" sx={{ color: '#667085', mt: 0.5 }}>
                Chọn ngữ cảnh xuất hóa đơn để xem layout và danh sách trường nên triển khai.
              </Typography>
            </Box>

            <Tabs
              value={mode}
              onChange={(_, value: InvoiceMode) => setMode(value)}
              sx={{
                minHeight: 44,
                '& .MuiTabs-indicator': {
                  height: 3,
                  borderRadius: 999,
                },
              }}
            >
              <Tab label="B2B / Doanh nghiệp" value="b2b" sx={{ minHeight: 44, fontWeight: 700 }} />
              <Tab label="B2C / Bán lẻ POS" value="b2c" sx={{ minHeight: 44, fontWeight: 700 }} />
            </Tabs>
          </Stack>

          {mode === 'b2b' ? <B2BPreview store={store} settings={settings} /> : <B2CPreview store={store} settings={settings} />}
        </Stack>
      </Paper>

      <InvoiceFieldList
        title={mode === 'b2b' ? 'Checklist trường dữ liệu cho B2B' : 'Checklist trường dữ liệu cho B2C'}
        items={activeFields}
      />
    </Stack>
  )
}
