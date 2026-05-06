import { Paper, Stack, Typography } from '@mui/material'
import { type CityItem, type DistrictItem, type LocationItem } from '@/pages/customers/customer.api'
import { StackedAutocomplete } from '@/shared/ui/form/stacked-autocomplete'
import { StackedTextField } from '@/shared/ui/form/stacked-text-field'
import { borderedCardSx } from '@/shared/ui/paper'
import { SummaryPaperHeader } from '@/shared/ui/summary-paper-header'

type ShippingSectionProps = {
  customerName: string
  customerPhone: string
  shippingService: string
  shippingFee: string
  fromContactName: string
  fromContactPhone: string
  fromAddressLine: string
  fromState: LocationItem | null
  fromCity: CityItem | null
  fromDistrict: DistrictItem | null
  fromCities: CityItem[]
  fromDistricts: DistrictItem[]
  isFromCitiesLoading: boolean
  isFromDistrictsLoading: boolean
  toAddressLine: string
  toState: LocationItem | null
  toCity: CityItem | null
  toDistrict: DistrictItem | null
  toCities: CityItem[]
  toDistricts: DistrictItem[]
  isToCitiesLoading: boolean
  isToDistrictsLoading: boolean
  parcelContent: string
  parcelWeight: string
  parcelLength: string
  parcelWidth: string
  parcelHeight: string
  insuranceValue: string
  codAmount: string
  warehouseStatus: string
  trackingCode: string
  shippingStatus: string
  states: LocationItem[]
  onShippingServiceChange: (value: string) => void
  onShippingFeeChange: (value: string) => void
  onFromContactNameChange: (value: string) => void
  onFromContactPhoneChange: (value: string) => void
  onFromAddressLineChange: (value: string) => void
  onFromStateChange: (_event: unknown, value: LocationItem | null) => void
  onFromCityChange: (_event: unknown, value: CityItem | null) => void
  onFromDistrictChange: (_event: unknown, value: DistrictItem | null) => void
  onToAddressLineChange: (value: string) => void
  onToStateChange: (_event: unknown, value: LocationItem | null) => void
  onToCityChange: (_event: unknown, value: CityItem | null) => void
  onToDistrictChange: (_event: unknown, value: DistrictItem | null) => void
  onParcelContentChange: (value: string) => void
  onParcelWeightChange: (value: string) => void
  onParcelLengthChange: (value: string) => void
  onParcelWidthChange: (value: string) => void
  onParcelHeightChange: (value: string) => void
  onInsuranceValueChange: (value: string) => void
  onCodAmountChange: (value: string) => void
  onWarehouseStatusChange: (value: string) => void
  onTrackingCodeChange: (value: string) => void
  onShippingStatusChange: (value: string) => void
}

const LocationField = <T extends { id: number; name: string }>({
  label,
  placeholder,
  value,
  options,
  loading,
  disabled,
  onChange,
}: {
  label: string
  placeholder: string
  value: T | null
  options: T[]
  loading?: boolean
  disabled?: boolean
  onChange: (_event: unknown, value: T | null) => void
}) => (
  <StackedAutocomplete<T, false, false, false>
    fullWidth
    sx={{ flex: 1 }}
    label={label}
    options={options}
    value={value}
    loading={loading}
    onChange={onChange}
    getOptionLabel={(option) => option.name}
    isOptionEqualToValue={(option, nextValue) => option.id === nextValue.id}
    disabled={disabled}
    placeholder={placeholder}
  />
)

export function ShippingSection({
  customerName,
  customerPhone,
  shippingService,
  shippingFee,
  fromContactName,
  fromContactPhone,
  fromAddressLine,
  fromState,
  fromCity,
  fromDistrict,
  fromCities,
  fromDistricts,
  isFromCitiesLoading,
  isFromDistrictsLoading,
  toAddressLine,
  toState,
  toCity,
  toDistrict,
  toCities,
  toDistricts,
  isToCitiesLoading,
  isToDistrictsLoading,
  parcelContent,
  parcelWeight,
  parcelLength,
  parcelWidth,
  parcelHeight,
  insuranceValue,
  codAmount,
  warehouseStatus,
  trackingCode,
  shippingStatus,
  states,
  onShippingServiceChange,
  onShippingFeeChange,
  onFromContactNameChange,
  onFromContactPhoneChange,
  onFromAddressLineChange,
  onFromStateChange,
  onFromCityChange,
  onFromDistrictChange,
  onToAddressLineChange,
  onToStateChange,
  onToCityChange,
  onToDistrictChange,
  onParcelContentChange,
  onParcelWeightChange,
  onParcelLengthChange,
  onParcelWidthChange,
  onParcelHeightChange,
  onInsuranceValueChange,
  onCodAmountChange,
  onWarehouseStatusChange,
  onTrackingCodeChange,
  onShippingStatusChange,
}: ShippingSectionProps) {
  return (
    <Paper sx={borderedCardSx}>
      <Stack spacing={3}>
        <SummaryPaperHeader title="Vận chuyển" />

        <Stack spacing={2}>
          <Typography sx={{ fontWeight: 700, color: '#0f172a' }}>Dịch vụ vận chuyển</Typography>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <StackedTextField
              fullWidth
              sx={{ flex: 1 }}
              label="DVVC"
              placeholder="VD: GHN"
              value={shippingService}
              onChange={(event) => onShippingServiceChange(event.target.value)}
            />
            <StackedTextField
              fullWidth
              sx={{ flex: 1 }}
              label="Phí vận chuyển"
              placeholder="0"
              value={shippingFee}
              onChange={(event) => onShippingFeeChange(event.target.value)}
            />
          </Stack>
        </Stack>

        <Stack spacing={2}>
          <Typography sx={{ fontWeight: 700, color: '#0f172a' }}>Người gửi</Typography>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <StackedTextField
              fullWidth
              sx={{ flex: 1 }}
              label="Tên người gửi"
              value={fromContactName}
              onChange={(event) => onFromContactNameChange(event.target.value)}
            />
            <StackedTextField
              fullWidth
              sx={{ flex: 1 }}
              label="Số điện thoại người gửi"
              value={fromContactPhone}
              onChange={(event) => onFromContactPhoneChange(event.target.value)}
            />
          </Stack>
          <StackedTextField
            fullWidth
            label="Địa chỉ lấy hàng"
            placeholder="Số nhà, tên đường"
            value={fromAddressLine}
            onChange={(event) => onFromAddressLineChange(event.target.value)}
          />
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <LocationField
              label="Tỉnh/Thành phố"
              placeholder="Chọn tỉnh/thành phố"
              value={fromState}
              options={states}
              onChange={onFromStateChange}
            />
            <LocationField
              label="Huyện/Quận"
              placeholder="Chọn huyện/quận"
              value={fromCity}
              options={fromCities}
              loading={isFromCitiesLoading}
              disabled={!fromState}
              onChange={onFromCityChange}
            />
            <LocationField
              label="Xã/Phường"
              placeholder="Chọn xã/phường"
              value={fromDistrict}
              options={fromDistricts}
              loading={isFromDistrictsLoading}
              disabled={!fromCity}
              onChange={onFromDistrictChange}
            />
          </Stack>
        </Stack>

        <Stack spacing={2}>
          <Typography sx={{ fontWeight: 700, color: '#0f172a' }}>Người nhận</Typography>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <StackedTextField fullWidth sx={{ flex: 1 }} label="Tên khách hàng" value={customerName} disabled />
            <StackedTextField fullWidth sx={{ flex: 1 }} label="Số điện thoại khách hàng" value={customerPhone} disabled />
          </Stack>
          <StackedTextField
            fullWidth
            label="Địa chỉ giao hàng"
            placeholder="Số nhà, tên đường"
            value={toAddressLine}
            onChange={(event) => onToAddressLineChange(event.target.value)}
          />
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <LocationField
              label="Tỉnh/Thành phố"
              placeholder="Chọn tỉnh/thành phố"
              value={toState}
              options={states}
              onChange={onToStateChange}
            />
            <LocationField
              label="Huyện/Quận"
              placeholder="Chọn huyện/quận"
              value={toCity}
              options={toCities}
              loading={isToCitiesLoading}
              disabled={!toState}
              onChange={onToCityChange}
            />
            <LocationField
              label="Xã/Phường"
              placeholder="Chọn xã/phường"
              value={toDistrict}
              options={toDistricts}
              loading={isToDistrictsLoading}
              disabled={!toCity}
              onChange={onToDistrictChange}
            />
          </Stack>
        </Stack>

        <Stack spacing={2}>
          <Typography sx={{ fontWeight: 700, color: '#0f172a' }}>Kiện hàng</Typography>
          <StackedTextField
            fullWidth
            label="Nội dung hàng"
            placeholder="Mô tả ngắn nội dung kiện hàng"
            value={parcelContent}
            onChange={(event) => onParcelContentChange(event.target.value)}
          />
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <StackedTextField fullWidth sx={{ flex: 1 }} label="Khối lượng (gram)" value={parcelWeight} onChange={(event) => onParcelWeightChange(event.target.value)} />
            <StackedTextField fullWidth sx={{ flex: 1 }} label="Dài (cm)" value={parcelLength} onChange={(event) => onParcelLengthChange(event.target.value)} />
            <StackedTextField fullWidth sx={{ flex: 1 }} label="Rộng (cm)" value={parcelWidth} onChange={(event) => onParcelWidthChange(event.target.value)} />
            <StackedTextField fullWidth sx={{ flex: 1 }} label="Cao (cm)" value={parcelHeight} onChange={(event) => onParcelHeightChange(event.target.value)} />
          </Stack>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <StackedTextField fullWidth sx={{ flex: 1 }} label="Giá trị bảo hiểm" value={insuranceValue} onChange={(event) => onInsuranceValueChange(event.target.value)} />
            <StackedTextField fullWidth sx={{ flex: 1 }} label="Tiền thu hộ (COD)" value={codAmount} onChange={(event) => onCodAmountChange(event.target.value)} />
          </Stack>
        </Stack>

        <Stack spacing={2}>
          <Typography sx={{ fontWeight: 700, color: '#0f172a' }}>Theo dõi giao vận</Typography>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <StackedTextField fullWidth sx={{ flex: 1 }} label="Trạng thái kho" value={warehouseStatus} onChange={(event) => onWarehouseStatusChange(event.target.value)} />
            <StackedTextField fullWidth sx={{ flex: 1 }} label="Mã vận đơn" value={trackingCode} onChange={(event) => onTrackingCodeChange(event.target.value)} />
            <StackedTextField fullWidth sx={{ flex: 1 }} label="Trạng thái giao hàng" value={shippingStatus} onChange={(event) => onShippingStatusChange(event.target.value)} />
          </Stack>
        </Stack>
      </Stack>
    </Paper>
  )
}
