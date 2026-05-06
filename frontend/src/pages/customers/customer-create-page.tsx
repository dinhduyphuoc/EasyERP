import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import { useNavigate, useParams } from 'react-router'
import {
  Box,
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
import { StackedAutocomplete } from '@/shared/ui/form/stacked-autocomplete'
import { StackedDropdown } from '@/shared/ui/form/stacked-dropdown'
import { StackedTextField } from '@/shared/ui/form/stacked-text-field'
import {
  CreateEditPageContainer,
  CreateEditPageHeader,
  buildPrimarySaveHeaderAction,
  type CreateEditPageHeaderAction,
} from '@/shared/ui/page'
import { UnsavedChangesBanner, useJsonDirtyState, useUnsavedChangesPrompt } from '@/shared/ui/unsaved-changes'

type GenderValue = '' | 'male' | 'female' | 'other'
type InvoiceEntityTypeValue = 'individual' | 'business'

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
  const [invoiceEntityType, setInvoiceEntityType] = useState<InvoiceEntityTypeValue>('individual')
  const [invoiceCompanyName, setInvoiceCompanyName] = useState('')
  const [invoiceBuyerName, setInvoiceBuyerName] = useState('')
  const [invoiceTaxCode, setInvoiceTaxCode] = useState('')
  const [invoicePersonalId, setInvoicePersonalId] = useState('')
  const [invoiceBudgetUnitCode, setInvoiceBudgetUnitCode] = useState('')
  const [invoiceEmail, setInvoiceEmail] = useState('')
  const [invoicePhone, setInvoicePhone] = useState('')
  const [invoiceAddressLine, setInvoiceAddressLine] = useState('')
  const [invoiceNote, setInvoiceNote] = useState('')
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
      invoiceEntityType,
      invoiceCompanyName,
      invoiceBuyerName,
      invoiceTaxCode,
      invoicePersonalId,
      invoiceBudgetUnitCode,
      invoiceEmail,
      invoicePhone,
      invoiceAddressLine,
      invoiceNote,
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
          setInvoiceEntityType(customerData.invoice_profile.entity_type ?? 'individual')
          setInvoiceCompanyName(customerData.invoice_profile.company_name ?? '')
          setInvoiceBuyerName(customerData.invoice_profile.buyer_name ?? customerData.full_name ?? '')
          setInvoiceTaxCode(customerData.invoice_profile.tax_code ?? customerData.tax_code ?? '')
          setInvoicePersonalId(customerData.invoice_profile.personal_id ?? '')
          setInvoiceBudgetUnitCode(customerData.invoice_profile.budget_unit_code ?? '')
          setInvoiceEmail(customerData.invoice_profile.email ?? customerData.email ?? '')
          setInvoicePhone(customerData.invoice_profile.phone ?? customerData.phone ?? '')
          setInvoiceAddressLine(customerData.invoice_profile.address_line ?? address?.address_line ?? '')
          setInvoiceNote(customerData.invoice_profile.note ?? '')
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
              invoiceEntityType: customerData.invoice_profile.entity_type ?? 'individual',
              invoiceCompanyName: customerData.invoice_profile.company_name ?? '',
              invoiceBuyerName: customerData.invoice_profile.buyer_name ?? customerData.full_name ?? '',
              invoiceTaxCode: customerData.invoice_profile.tax_code ?? customerData.tax_code ?? '',
              invoicePersonalId: customerData.invoice_profile.personal_id ?? '',
              invoiceBudgetUnitCode: customerData.invoice_profile.budget_unit_code ?? '',
              invoiceEmail: customerData.invoice_profile.email ?? customerData.email ?? '',
              invoicePhone: customerData.invoice_profile.phone ?? customerData.phone ?? '',
              invoiceAddressLine: customerData.invoice_profile.address_line ?? address?.address_line ?? '',
              invoiceNote: customerData.invoice_profile.note ?? '',
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
              invoiceEntityType: 'individual',
              invoiceCompanyName: '',
              invoiceBuyerName: '',
              invoiceTaxCode: '',
              invoicePersonalId: '',
              invoiceBudgetUnitCode: '',
              invoiceEmail: '',
              invoicePhone: '',
              invoiceAddressLine: '',
              invoiceNote: '',
            }),
          )
        }
      } catch (error) {
        console.error('Lá»—i khi táº£i dá»¯ liá»‡u khÃ¡ch hÃ ng:', error)
        showErrorToast(error, 'KhÃ´ng thá»ƒ táº£i dá»¯ liá»‡u táº¡o khÃ¡ch hÃ ng.')
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
        console.error('Lá»—i khi táº£i huyá»‡n/quáº­n:', error)
        showErrorToast(error, 'KhÃ´ng thá»ƒ táº£i danh sÃ¡ch huyá»‡n/quáº­n.')
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
        console.error('Lá»—i khi táº£i xÃ£/phÆ°á»ng:', error)
        showErrorToast(error, 'KhÃ´ng thá»ƒ táº£i danh sÃ¡ch xÃ£/phÆ°á»ng.')
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
      nextErrors.full_name = 'TÃªn khÃ¡ch hÃ ng lÃ  báº¯t buá»™c.'
    }

    if (!phone.trim()) {
      nextErrors.phone = 'Sá»‘ Ä‘iá»‡n thoáº¡i lÃ  báº¯t buá»™c.'
    }

    if (hasAnyAddressInput) {
      if (!stateId) {
        nextErrors.state_id = 'Tá»‰nh/ThÃ nh phá»‘ lÃ  báº¯t buá»™c khi nháº­p Ä‘á»‹a chá»‰.'
      }

      if (!cityId) {
        nextErrors.city_id = 'Huyá»‡n/Quáº­n lÃ  báº¯t buá»™c khi nháº­p Ä‘á»‹a chá»‰.'
      }

      if (!addressLine.trim()) {
        nextErrors.address_line = 'Äá»‹a chá»‰ 1 lÃ  báº¯t buá»™c khi nháº­p Ä‘á»‹a chá»‰.'
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
      invoiceEntityType: InvoiceEntityTypeValue
      invoiceCompanyName: string
      invoiceBuyerName: string
      invoiceTaxCode: string
      invoicePersonalId: string
      invoiceBudgetUnitCode: string
      invoiceEmail: string
      invoicePhone: string
      invoiceAddressLine: string
      invoiceNote: string
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
    setInvoiceEntityType(snapshot.invoiceEntityType)
    setInvoiceCompanyName(snapshot.invoiceCompanyName)
    setInvoiceBuyerName(snapshot.invoiceBuyerName)
    setInvoiceTaxCode(snapshot.invoiceTaxCode)
    setInvoicePersonalId(snapshot.invoicePersonalId)
    setInvoiceBudgetUnitCode(snapshot.invoiceBudgetUnitCode)
    setInvoiceEmail(snapshot.invoiceEmail)
    setInvoicePhone(snapshot.invoicePhone)
    setInvoiceAddressLine(snapshot.invoiceAddressLine)
    setInvoiceNote(snapshot.invoiceNote)
    setHasAttemptedSave(false)

    window.setTimeout(() => {
      isHydratingRef.current = false
    }, 0)
  }

  const handleSave = async () => {
    setHasAttemptedSave(true)

    if (!canSave) {
      appToast.warning('Vui lÃ²ng nháº­p Ä‘áº§y Ä‘á»§ thÃ´ng tin báº¯t buá»™c trÆ°á»›c khi lÆ°u.')
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
        invoice_profile: {
          entity_type: invoiceEntityType,
          company_name: invoiceCompanyName.trim() || null,
          buyer_name: invoiceBuyerName.trim() || fullName.trim() || null,
          tax_code: invoiceTaxCode.trim() || taxCode.trim() || null,
          personal_id: invoicePersonalId.trim() || null,
          budget_unit_code: invoiceBudgetUnitCode.trim() || null,
          email: invoiceEmail.trim() || email.trim() || null,
          phone: invoicePhone.trim() || phone.trim() || null,
          address_line: invoiceAddressLine.trim() || addressLine.trim() || null,
          note: invoiceNote.trim() || null,
        },
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
            label: 'Äá»‹a chá»‰ chÃ­nh',
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
        appToast.success('Cáº­p nháº­t khÃ¡ch hÃ ng thÃ nh cÃ´ng.')
      } else {
        await customerApi.createCustomer(payload)
        appToast.success('ThÃªm khÃ¡ch hÃ ng thÃ nh cÃ´ng.')
      }
      navigate('/customers')
    } catch (error) {
      console.error('Lá»—i khi táº¡o khÃ¡ch hÃ ng:', error)
      showErrorToast(
        error,
        isEditMode
          ? 'KhÃ´ng thá»ƒ cáº­p nháº­t khÃ¡ch hÃ ng. Vui lÃ²ng thá»­ láº¡i.'
          : 'KhÃ´ng thá»ƒ táº¡o khÃ¡ch hÃ ng. Vui lÃ²ng thá»­ láº¡i.',
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
  const headerActions: CreateEditPageHeaderAction[] = [
    buildPrimarySaveHeaderAction({
      label: isEditMode ? 'Cáº­p nháº­t' : 'LÆ°u',
      loadingLabel: 'Äang lÆ°u...',
      onClick: () => void handleSave(),
      disabled: !canSave,
      loading: isSaving,
    }),
  ]

  return (
    <CreateEditPageContainer>
      <Box sx={{ mb: 2 }}>
        <CreateEditPageHeader
          title={isEditMode ? 'Chá»‰nh sá»­a khÃ¡ch hÃ ng' : 'ThÃªm khÃ¡ch hÃ ng'}
          onBack={() => attemptNavigate('/customers')}
          actions={headerActions}
        />
      </Box>

      <Stack spacing={3}>
        <Paper sx={defaultCardSx}>
          <Stack spacing={3}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              ThÃ´ng tin chung
            </Typography>

            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
              <Box sx={{ gridColumn: '1 / -1' }}>
                <StackedTextField
                  fullWidth
                  label="TÃªn khÃ¡ch hÃ ng *"
                  placeholder="VÃ­ dá»¥: Nguyá»…n VÄƒn A"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  error={Boolean(visibleErrors.full_name)}
                  helperText={visibleErrors.full_name}
                  disabled={isLoading}
                />
              </Box>

              <StackedTextField
                fullWidth
                label="MÃ£ khÃ¡ch hÃ ng"
                placeholder="Äá»ƒ trá»‘ng Ä‘á»ƒ há»‡ thá»‘ng tá»± táº¡o"
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
              Hồ sơ xuất hóa đơn
            </Typography>

            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
              <StackedDropdown
                fullWidth
                label="Loại khách xuất hóa đơn"
                value={invoiceEntityType}
                onChange={(event) => setInvoiceEntityType(event.target.value as InvoiceEntityTypeValue)}
                disabled={isLoading}
              >
                <MenuItem value="individual">Cá nhân</MenuItem>
                <MenuItem value="business">Doanh nghiệp</MenuItem>
              </StackedDropdown>

              <StackedTextField
                fullWidth
                label="Người nhận hóa đơn"
                value={invoiceBuyerName}
                onChange={(event) => setInvoiceBuyerName(event.target.value)}
                disabled={isLoading}
                placeholder="Mặc định sẽ dùng tên khách hàng"
              />

              <StackedTextField
                fullWidth
                label="Tên công ty"
                value={invoiceCompanyName}
                onChange={(event) => setInvoiceCompanyName(event.target.value)}
                disabled={isLoading}
              />

              <StackedTextField
                fullWidth
                label="Mã số thuế"
                value={invoiceTaxCode}
                onChange={(event) => setInvoiceTaxCode(event.target.value)}
                disabled={isLoading}
              />

              <StackedTextField
                fullWidth
                label="Số định danh cá nhân"
                value={invoicePersonalId}
                onChange={(event) => setInvoicePersonalId(event.target.value)}
                disabled={isLoading}
              />

              <StackedTextField
                fullWidth
                label="Mã đơn vị NSNN"
                value={invoiceBudgetUnitCode}
                onChange={(event) => setInvoiceBudgetUnitCode(event.target.value)}
                disabled={isLoading}
              />

              <StackedTextField
                fullWidth
                label="Email nhận hóa đơn"
                value={invoiceEmail}
                onChange={(event) => setInvoiceEmail(event.target.value)}
                disabled={isLoading}
              />

              <StackedTextField
                fullWidth
                label="Số điện thoại hóa đơn"
                value={invoicePhone}
                onChange={(event) => setInvoicePhone(event.target.value)}
                disabled={isLoading}
              />

              <Box sx={{ gridColumn: '1 / -1' }}>
                <StackedTextField
                  fullWidth
                  label="Địa chỉ xuất hóa đơn"
                  value={invoiceAddressLine}
                  onChange={(event) => setInvoiceAddressLine(event.target.value)}
                  disabled={isLoading}
                />
              </Box>

              <Box sx={{ gridColumn: '1 / -1' }}>
                <StackedTextField
                  fullWidth
                  label="Ghi chú hóa đơn"
                  value={invoiceNote}
                  onChange={(event) => setInvoiceNote(event.target.value)}
                  disabled={isLoading}
                />
              </Box>
            </Box>
          </Stack>
        </Paper>

        <Paper sx={defaultCardSx}>
          <Stack spacing={3}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Thông tin địa chỉ
            </Typography>

            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
              <StackedAutocomplete
                fullWidth
                label="Tỉnh/Thành phố"
                options={states}
                value={states.find((state) => String(state.id) === stateId) ?? null}
                onChange={(_, value) => setStateId(value ? String(value.id) : '')}
                getOptionLabel={(option) => option.name}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                error={Boolean(visibleErrors.state_id)}
                helperText={visibleErrors.state_id}
                disabled={isLoading}
                placeholder="Chọn tỉnh/thành phố"
              />

              <StackedAutocomplete
                fullWidth
                label="Huyện/Quận"
                options={cities}
                value={cities.find((city) => String(city.id) === cityId) ?? null}
                onChange={(_, value) => setCityId(value ? String(value.id) : '')}
                getOptionLabel={(option) => option.name}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                error={Boolean(visibleErrors.city_id)}
                helperText={visibleErrors.city_id}
                disabled={isLoading || !stateId}
                placeholder="Chọn huyện/quận"
              />

              <StackedAutocomplete
                fullWidth
                label="Xã/Phường"
                options={districts}
                value={districts.find((district) => String(district.id) === districtId) ?? null}
                onChange={(_, value) => setDistrictId(value ? String(value.id) : '')}
                getOptionLabel={(option) => option.name}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                disabled={isLoading || !cityId}
                placeholder="Chọn xã/phường"
              />

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
              ThÃ´ng tin bá»• sung
            </Typography>

            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
              <StackedTextField
                fullWidth
                type="date"
                label="NgÃ y thÃ¡ng nÄƒm sinh"
                value={birthDate}
                onChange={(event) => setBirthDate(event.target.value)}
                disabled={isLoading}
              />

              <StackedDropdown
                fullWidth
                label="Giá»›i tÃ­nh"
                value={gender}
                onChange={(event) => setGender(event.target.value as GenderValue)}
                disabled={isLoading}
              >
                <MenuItem value="">ChÆ°a chá»n</MenuItem>
                <MenuItem value="male">Nam</MenuItem>
                <MenuItem value="female">Ná»¯</MenuItem>
                <MenuItem value="other">KhÃ¡c</MenuItem>
              </StackedDropdown>

              <StackedTextField
                fullWidth
                label="MST"
                placeholder="MÃ£ sá»‘ thuáº¿"
                value={taxCode}
                onChange={(event) => setTaxCode(event.target.value)}
                disabled={isLoading}
              />
            </Box>
          </Stack>
        </Paper>
      </Stack>

      <UnsavedChangesBanner {...bannerProps} />
    </CreateEditPageContainer>
  )
}


