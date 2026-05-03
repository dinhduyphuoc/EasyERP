import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import { useNavigate, useParams } from 'react-router'
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined'
import {
  Box,
  Button,
  CircularProgress,
  MenuItem,
  Paper,
  Stack,
  Typography,
} from '@mui/material'
import {
  customerApi,
  type CityItem,
  type CustomerCategory,
  type CustomerCreatePayload,
  type DistrictItem,
  type LocationItem,
} from './customer.api'
import { defaultCardSx } from '@/shared/ui/paper'
import { appToast } from '@/shared/ui/toast/toast.helpers'
import { showErrorToast } from '@/shared/ui/toast/toast-error'
import { StackedDropdown } from '@/shared/ui/form/stacked-dropdown'
import { StackedTextField } from '@/shared/ui/form/stacked-text-field'
import { CreateEditPageHeader } from '@/shared/ui/page'
import { UnsavedChangesBanner, useJsonDirtyState, useUnsavedChangesPrompt } from '@/shared/ui/unsaved-changes'

type GenderValue = '' | 'male' | 'female' | 'other'

export function CustomerCreatePage(): ReactElement {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEditMode = Boolean(id)
  const isHydratingRef = useRef(false)
  const [clientCode, setClientCode] = useState('')
  const [fullName, setFullName] = useState('')
  const [customerCategoryId, setCustomerCategoryId] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [stateId, setStateId] = useState('')
  const [cityId, setCityId] = useState('')
  const [districtId, setDistrictId] = useState('')
  const [addressLine, setAddressLine] = useState('')
  const [addressLine2, setAddressLine2] = useState('')
  const [addressNote, setAddressNote] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [gender, setGender] = useState<GenderValue>('')
  const [taxCode, setTaxCode] = useState('')
  const [categories, setCategories] = useState<CustomerCategory[]>([])
  const [states, setStates] = useState<LocationItem[]>([])
  const [cities, setCities] = useState<CityItem[]>([])
  const [districts, setDistricts] = useState<DistrictItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [hasAttemptedSave, setHasAttemptedSave] = useState(false)
  const dirtyState = useJsonDirtyState(
    {
      clientCode,
      fullName,
      customerCategoryId,
      phone,
      email,
      stateId,
      cityId,
      districtId,
      addressLine,
      addressLine2,
      addressNote,
      birthDate,
      gender,
      taxCode,
    },
    !isLoading,
  )

  useEffect(() => {
    const fetchInitialData = async () => {
      setIsLoading(true)

      try {
        const [categoryData, stateData, customerData] = await Promise.all([
          customerApi.getCustomerCategories(),
          customerApi.getStates({ is_active: true }),
          id ? customerApi.getCustomerById(id) : Promise.resolve(null),
        ])
        setCategories(categoryData)
        setStates(stateData)
        if (customerData) {
          isHydratingRef.current = true
          const primaryAddress =
            customerData.addresses.find((item) => item.is_default) ?? customerData.addresses[0] ?? null
          const address = primaryAddress?.address ?? null
          const [cityData, districtData] = await Promise.all([
            address ? customerApi.getCities({ state_id: address.state_id, is_active: true }) : Promise.resolve([]),
            address ? customerApi.getDistricts({ city_id: address.city_id, is_active: true }) : Promise.resolve([]),
          ])

          setClientCode(customerData.client_code)
          setFullName(customerData.full_name)
          setCustomerCategoryId(customerData.customer_category_id ? String(customerData.customer_category_id) : '')
          setPhone(customerData.phone ?? '')
          setEmail(customerData.email ?? '')
          setBirthDate(customerData.birth_date ? customerData.birth_date.slice(0, 10) : '')
          setGender(customerData.gender ?? '')
          setTaxCode(customerData.tax_code ?? '')
          setCities(cityData)
          setDistricts(districtData)
          setStateId(address ? String(address.state_id) : '')
          setCityId(address ? String(address.city_id) : '')
          setDistrictId(address?.district_id ? String(address.district_id) : '')
          setAddressLine(address?.address_line ?? '')
          setAddressLine2(address?.address_line2 ?? '')
          setAddressNote(primaryAddress?.note ?? address?.note ?? '')
          dirtyState.setInitialSnapshot(
            JSON.stringify({
              clientCode: customerData.client_code,
              fullName: customerData.full_name,
              customerCategoryId: customerData.customer_category_id ? String(customerData.customer_category_id) : '',
              phone: customerData.phone ?? '',
              email: customerData.email ?? '',
              stateId: address ? String(address.state_id) : '',
              cityId: address ? String(address.city_id) : '',
              districtId: address?.district_id ? String(address.district_id) : '',
              addressLine: address?.address_line ?? '',
              addressLine2: address?.address_line2 ?? '',
              addressNote: primaryAddress?.note ?? address?.note ?? '',
              birthDate: customerData.birth_date ? customerData.birth_date.slice(0, 10) : '',
              gender: customerData.gender ?? '',
              taxCode: customerData.tax_code ?? '',
            }),
          )

          window.setTimeout(() => {
            isHydratingRef.current = false
          }, 0)
        } else {
          dirtyState.setInitialSnapshot(
            JSON.stringify({
              clientCode: '',
              fullName: '',
              customerCategoryId: '',
              phone: '',
              email: '',
              stateId: '',
              cityId: '',
              districtId: '',
              addressLine: '',
              addressLine2: '',
              addressNote: '',
              birthDate: '',
              gender: '',
              taxCode: '',
            }),
          )
        }
      } catch (error) {
        console.error('Lỗi khi tải dữ liệu khách hàng:', error)
        showErrorToast(error, 'Không thể tải dữ liệu tạo khách hàng.')
      } finally {
        setIsLoading(false)
      }
    }

    void fetchInitialData()
  }, [id])

  useEffect(() => {
    if (isHydratingRef.current) {
      return
    }

    if (!stateId) {
      setCities([])
      setCityId('')
      setDistricts([])
      setDistrictId('')
      return
    }

    const fetchCities = async () => {
      try {
        const data = await customerApi.getCities({ state_id: Number(stateId), is_active: true })
        setCities(data)
      } catch (error) {
        console.error('Lỗi khi tải huyện/quận:', error)
        showErrorToast(error, 'Không thể tải danh sách huyện/quận.')
      }
    }

    setCityId('')
    setDistricts([])
    setDistrictId('')
    void fetchCities()
  }, [stateId])

  useEffect(() => {
    if (isHydratingRef.current) {
      return
    }

    if (!cityId) {
      setDistricts([])
      setDistrictId('')
      return
    }

    const fetchDistricts = async () => {
      try {
        const data = await customerApi.getDistricts({ city_id: Number(cityId), is_active: true })
        setDistricts(data)
      } catch (error) {
        console.error('Lỗi khi tải xã/phường:', error)
        showErrorToast(error, 'Không thể tải danh sách xã/phường.')
      }
    }

    setDistrictId('')
    void fetchDistricts()
  }, [cityId])

  const hasAnyAddressInput = Boolean(
    stateId || cityId || districtId || addressLine.trim() || addressLine2.trim() || addressNote.trim(),
  )

  const errors = useMemo(() => {
    const nextErrors: Record<string, string> = {}

    if (!fullName.trim()) {
      nextErrors.full_name = 'Tên khách hàng là bắt buộc.'
    }

    if (!phone.trim()) {
      nextErrors.phone = 'Số điện thoại là bắt buộc.'
    }

    if (hasAnyAddressInput) {
      if (!stateId) {
        nextErrors.state_id = 'Tỉnh/Thành phố là bắt buộc khi nhập địa chỉ.'
      }

      if (!cityId) {
        nextErrors.city_id = 'Huyện/Quận là bắt buộc khi nhập địa chỉ.'
      }

      if (!addressLine.trim()) {
        nextErrors.address_line = 'Địa chỉ 1 là bắt buộc khi nhập địa chỉ.'
      }
    }

    return nextErrors
  }, [addressLine, cityId, fullName, hasAnyAddressInput, phone, stateId])

  const visibleErrors = hasAttemptedSave ? errors : {}
  const canSave = !isLoading && !isSaving && Object.keys(errors).length === 0
  const { isDirty } = dirtyState

  const handleDiscard = () => {
    if (!dirtyState.initialSnapshot) {
      return
    }

    const snapshot = JSON.parse(dirtyState.initialSnapshot) as {
      clientCode: string
      fullName: string
      customerCategoryId: string
      phone: string
      email: string
      stateId: string
      cityId: string
      districtId: string
      addressLine: string
      addressLine2: string
      addressNote: string
      birthDate: string
      gender: GenderValue
      taxCode: string
    }

    isHydratingRef.current = true
    setClientCode(snapshot.clientCode)
    setFullName(snapshot.fullName)
    setCustomerCategoryId(snapshot.customerCategoryId)
    setPhone(snapshot.phone)
    setEmail(snapshot.email)
    setStateId(snapshot.stateId)
    setCityId(snapshot.cityId)
    setDistrictId(snapshot.districtId)
    setAddressLine(snapshot.addressLine)
    setAddressLine2(snapshot.addressLine2)
    setAddressNote(snapshot.addressNote)
    setBirthDate(snapshot.birthDate)
    setGender(snapshot.gender)
    setTaxCode(snapshot.taxCode)
    setHasAttemptedSave(false)

    window.setTimeout(() => {
      isHydratingRef.current = false
    }, 0)
  }

  const handleSave = async () => {
    setHasAttemptedSave(true)

    if (!canSave) {
      appToast.warning('Vui lòng nhập đầy đủ thông tin bắt buộc trước khi lưu.')
      return
    }

    setIsSaving(true)

    try {
      const payload: CustomerCreatePayload = {
        full_name: fullName.trim(),
        phone: phone.trim(),
        email: email.trim() || null,
        birth_date: birthDate || null,
        gender: gender || null,
        tax_code: taxCode.trim() || null,
        status: 'active',
        customer_category_id: customerCategoryId ? Number(customerCategoryId) : null,
      }

      if (clientCode.trim()) {
        payload.client_code = clientCode.trim()
      }

      if (hasAnyAddressInput) {
        payload.addresses = [
          {
            type: 'shipping',
            label: 'Địa chỉ chính',
            is_default: true,
            recipient_name: fullName.trim(),
            recipient_phone: phone.trim(),
            note: addressNote.trim() || null,
            address: {
              state_id: Number(stateId),
              city_id: Number(cityId),
              district_id: districtId ? Number(districtId) : null,
              address_line: addressLine.trim(),
              address_line2: addressLine2.trim() || null,
              note: addressNote.trim() || null,
            },
          },
        ]
      }

      if (isEditMode && id) {
        await customerApi.updateCustomer(id, payload)
        appToast.success('Cập nhật khách hàng thành công.')
      } else {
        await customerApi.createCustomer(payload)
        appToast.success('Thêm khách hàng thành công.')
      }
      navigate('/customers')
    } catch (error) {
      console.error('Lỗi khi tạo khách hàng:', error)
      showErrorToast(
        error,
        isEditMode
          ? 'Không thể cập nhật khách hàng. Vui lòng thử lại.'
          : 'Không thể tạo khách hàng. Vui lòng thử lại.',
      )
    } finally {
      setIsSaving(false)
    }
  }
  const { bannerProps, attemptNavigate } = useUnsavedChangesPrompt({
    isDirty,
    isSaving,
    onDiscard: handleDiscard,
    onSave: () => void handleSave(),
  })

  return (
    <Box sx={{ px: { xs: 2, md: 3, xl: 4 }, pb: 8 }}>
      <Box sx={{ mb: 2 }}>
        <CreateEditPageHeader
          title={isEditMode ? 'Chỉnh sửa khách hàng' : 'Thêm khách hàng'}
          onBack={() => attemptNavigate('/customers')}
          actions={
            <Button
              variant="contained"
              color="secondary"
              startIcon={isSaving ? <CircularProgress size={16} color="inherit" /> : <SaveOutlinedIcon />}
              onClick={() => void handleSave()}
              disabled={!canSave}
            >
              {isSaving ? 'Đang lưu...' : isEditMode ? 'Cập nhật' : 'Lưu'}
            </Button>
          }
        />
      </Box>

      <Stack spacing={3}>
        <Paper sx={defaultCardSx}>
          <Stack spacing={3}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Thông tin chung
            </Typography>

            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
              <Box sx={{ gridColumn: '1 / -1' }}>
                <StackedTextField
                  fullWidth
                  label="Tên khách hàng *"
                  placeholder="Ví dụ: Nguyễn Văn A"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  error={Boolean(visibleErrors.full_name)}
                  helperText={visibleErrors.full_name}
                  disabled={isLoading}
                />
              </Box>

              <StackedTextField
                fullWidth
                label="Mã khách hàng"
                placeholder="Để trống để hệ thống tự tạo"
                value={clientCode}
                onChange={(event) => setClientCode(event.target.value)}
                disabled={isLoading}
              />

              <StackedDropdown
                fullWidth
                label="Nhóm khách hàng"
                value={customerCategoryId}
                onChange={(event) => setCustomerCategoryId(event.target.value as string)}
                disabled={isLoading}
              >
                <MenuItem value="">Chưa phân nhóm</MenuItem>
                {categories.map((category) => (
                  <MenuItem key={category.id} value={String(category.id)}>
                    {category.category_name}
                  </MenuItem>
                ))}
              </StackedDropdown>

              <StackedTextField
                fullWidth
                label="Số điện thoại *"
                placeholder="Ví dụ: 0901234567"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                error={Boolean(visibleErrors.phone)}
                helperText={visibleErrors.phone}
                disabled={isLoading}
              />

              <StackedTextField
                fullWidth
                label="Email"
                placeholder="Ví dụ: khachhang@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={isLoading}
              />
            </Box>
          </Stack>
        </Paper>

        <Paper sx={defaultCardSx}>
          <Stack spacing={3}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Thông tin địa chỉ
            </Typography>

            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
              <StackedDropdown
                fullWidth
                label="Tỉnh/Thành phố"
                value={stateId}
                onChange={(event) => setStateId(event.target.value as string)}
                error={Boolean(visibleErrors.state_id)}
                helperText={visibleErrors.state_id}
                disabled={isLoading}
              >
                <MenuItem value="">Chọn tỉnh/thành phố</MenuItem>
                {states.map((state) => (
                  <MenuItem key={state.id} value={String(state.id)}>
                    {state.name}
                  </MenuItem>
                ))}
              </StackedDropdown>

              <StackedDropdown
                fullWidth
                label="Huyện/Quận"
                value={cityId}
                onChange={(event) => setCityId(event.target.value as string)}
                error={Boolean(visibleErrors.city_id)}
                helperText={visibleErrors.city_id}
                disabled={isLoading || !stateId}
              >
                <MenuItem value="">Chọn huyện/quận</MenuItem>
                {cities.map((city) => (
                  <MenuItem key={city.id} value={String(city.id)}>
                    {city.name}
                  </MenuItem>
                ))}
              </StackedDropdown>

              <StackedDropdown
                fullWidth
                label="Xã/Phường"
                value={districtId}
                onChange={(event) => setDistrictId(event.target.value as string)}
                disabled={isLoading || !cityId}
              >
                <MenuItem value="">Chọn xã/phường</MenuItem>
                {districts.map((district) => (
                  <MenuItem key={district.id} value={String(district.id)}>
                    {district.name}
                  </MenuItem>
                ))}
              </StackedDropdown>

              <StackedTextField
                fullWidth
                label="Địa chỉ 1"
                placeholder="Số nhà, tên đường"
                value={addressLine}
                onChange={(event) => setAddressLine(event.target.value)}
                error={Boolean(visibleErrors.address_line)}
                helperText={visibleErrors.address_line}
                disabled={isLoading}
              />

              <StackedTextField
                fullWidth
                label="Địa chỉ 2"
                placeholder="Tòa nhà, tầng, khu vực"
                value={addressLine2}
                onChange={(event) => setAddressLine2(event.target.value)}
                disabled={isLoading}
              />

              <StackedTextField
                fullWidth
                label="Ghi chú"
                placeholder="Ghi chú giao hàng hoặc liên hệ"
                value={addressNote}
                onChange={(event) => setAddressNote(event.target.value)}
                disabled={isLoading}
              />
            </Box>
          </Stack>
        </Paper>

        <Paper sx={defaultCardSx}>
          <Stack spacing={3}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Thông tin bổ sung
            </Typography>

            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
              <StackedTextField
                fullWidth
                type="date"
                label="Ngày tháng năm sinh"
                value={birthDate}
                onChange={(event) => setBirthDate(event.target.value)}
                disabled={isLoading}
              />

              <StackedDropdown
                fullWidth
                label="Giới tính"
                value={gender}
                onChange={(event) => setGender(event.target.value as GenderValue)}
                disabled={isLoading}
              >
                <MenuItem value="">Chưa chọn</MenuItem>
                <MenuItem value="male">Nam</MenuItem>
                <MenuItem value="female">Nữ</MenuItem>
                <MenuItem value="other">Khác</MenuItem>
              </StackedDropdown>

              <StackedTextField
                fullWidth
                label="MST"
                placeholder="Mã số thuế"
                value={taxCode}
                onChange={(event) => setTaxCode(event.target.value)}
                disabled={isLoading}
              />
            </Box>
          </Stack>
        </Paper>
      </Stack>

      <UnsavedChangesBanner {...bannerProps} />
    </Box>
  )
}
