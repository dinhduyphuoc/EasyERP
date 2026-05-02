import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import { customerApi, type CityItem, type DistrictItem, type LocationItem } from '@/pages/customers/customer.api'
import { appToast } from '@/shared/ui/toast/toast.helpers'
import type { CustomerModalForm, CustomerModalMode } from '../components/customer/customer-modal'
import type { CustomerAutocompleteOption } from '../components/customer/customer-section'
import type { OrderDetailBase, OrderDetailItem, OrderOptionLookup, OrderProcessingStatus } from '../api/order.api'
import { getErrorMessage } from '../lib/error-message'
import { ORDER_TOAST_MESSAGES } from '../lib/toast-messages'
import {
  buildPaymentNoteContent,
  getDerivedPaymentStatusValue,
  getNextPaymentStatus,
  getNormalizedDepositAmount,
  getNormalizedDiscountAmount,
  getNormalizedPaidAmount,
  getNormalizedTaxAmount,
  getOrderTotalAmount,
  getPaymentMethodFromTypeId,
  getPaymentValidationErrors,
  parsePaymentNoteContent,
  type DepositInputMode,
  type PaymentMethod,
} from '../lib/order-payment'

type ParsedCustomerAddress = {
  addressLine: string
  districtName: string
  cityName: string
  stateName: string
}

type AddressDetailInput = {
  state_id: number
  city_id: number
  district_id: number | null
  address_line: string
}

type ShippingDefaults = {
  contact_name: string
  phone: string
  address_line: string
  state_id: number | null
  city_id: number | null
  district_id: number | null
}

type BankDefaults = {
  bank_name: string
  account_number: string
  account_holder: string
}

type VatDefaults = {
  enabled: boolean
  rate_percent: number
}

type UseOrderFormOptions = {
  options: OrderOptionLookup | null
  setOptions: Dispatch<SetStateAction<OrderOptionLookup | null>>
  states: LocationItem[]
  setStates: Dispatch<SetStateAction<LocationItem[]>>
  hasAttemptedSave: boolean
  subTotal: number
  processingStatus: OrderProcessingStatus
}

const createEmptyCustomerModalForm = (): CustomerModalForm => ({
  fullName: '',
  phone: '',
  addressLine: '',
  state: null,
  city: null,
  district: null,
  setAsDefaultAddress: false,
})

const buildCustomerAddress = (form: CustomerModalForm): string =>
  [form.addressLine.trim(), form.district?.name, form.city?.name, form.state?.name].filter(Boolean).join(', ')

const formatDefaultCustomerAddress = (customer: OrderOptionLookup['customers'][number]): string => {
  const address = customer.default_address?.address

  if (!address) {
    return ''
  }

  return [address.address_line, address.district_name, address.city_name, address.state_name]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(', ')
}

const normalizeLocationLookup = (value: string): string => value.trim().toLowerCase()

const parseCustomerAddress = (address: string): ParsedCustomerAddress => {
  const parts = address
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)

  if (parts.length === 0) {
    return {
      addressLine: '',
      districtName: '',
      cityName: '',
      stateName: '',
    }
  }

  if (parts.length === 1) {
    return {
      addressLine: parts[0],
      districtName: '',
      cityName: '',
      stateName: '',
    }
  }

  if (parts.length === 2) {
    return {
      addressLine: '',
      districtName: '',
      cityName: parts[0],
      stateName: parts[1],
    }
  }

  if (parts.length === 3) {
    return {
      addressLine: '',
      districtName: parts[0],
      cityName: parts[1],
      stateName: parts[2],
    }
  }

  return {
    addressLine: parts.slice(0, parts.length - 3).join(', '),
    districtName: parts[parts.length - 3],
    cityName: parts[parts.length - 2],
    stateName: parts[parts.length - 1],
  }
}

const hydrateAddressSelection = async (address: AddressDetailInput | null | undefined, statesData: LocationItem[]) => {
  if (!address) {
    return {
      state: null,
      cities: [] as CityItem[],
      city: null,
      districts: [] as DistrictItem[],
      district: null,
    }
  }

  const state = statesData.find((item) => item.id === address.state_id) ?? null

  if (!state) {
    return {
      state: null,
      cities: [] as CityItem[],
      city: null,
      districts: [] as DistrictItem[],
      district: null,
    }
  }

  const cities = await customerApi.getCities({
    state_id: state.id,
    is_active: true,
  })
  const city = cities.find((item) => item.id === address.city_id) ?? null
  const districts = city
    ? await customerApi.getDistricts({
        city_id: city.id,
        is_active: true,
      })
    : []
  const district = address.district_id ? districts.find((item) => item.id === address.district_id) ?? null : null

  return {
    state,
    cities,
    city,
    districts,
    district,
  }
}

export function useOrderForm({
  options,
  setOptions,
  states,
  setStates,
  hasAttemptedSave,
  subTotal,
  processingStatus,
}: UseOrderFormOptions) {
  const [paymentStatus, setPaymentStatus] = useState<'unpaid' | 'paid' | 'deposit'>('unpaid')

  const [customerSearch, setCustomerSearch] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [customerCode, setCustomerCode] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerAddress, setCustomerAddress] = useState('')
  const [cities, setCities] = useState<CityItem[]>([])
  const [districts, setDistricts] = useState<DistrictItem[]>([])
  const [isCitiesLoading, setIsCitiesLoading] = useState(false)
  const [isDistrictsLoading, setIsDistrictsLoading] = useState(false)
  const [customerModalOpen, setCustomerModalOpen] = useState(false)
  const [customerModalMode, setCustomerModalMode] = useState<CustomerModalMode>('create')
  const [customerModalForm, setCustomerModalForm] = useState<CustomerModalForm>(createEmptyCustomerModalForm)
  const [customerModalPrefill, setCustomerModalPrefill] = useState<ParsedCustomerAddress | null>(null)
  const [isCustomerModalSaving, setIsCustomerModalSaving] = useState(false)

  const [serviceId, setServiceId] = useState<number | null>(null)
  const [serviceTypeId, setServiceTypeId] = useState<number | null>(null)
  const [shippingService, setShippingService] = useState('')
  const [shippingFee, setShippingFee] = useState('0')
  const [fromContactName, setFromContactName] = useState('')
  const [fromContactPhone, setFromContactPhone] = useState('')
  const [fromAddressLine, setFromAddressLine] = useState('')
  const [fromState, setFromState] = useState<LocationItem | null>(null)
  const [fromCity, setFromCity] = useState<CityItem | null>(null)
  const [fromDistrict, setFromDistrict] = useState<DistrictItem | null>(null)
  const [toAddressLine, setToAddressLine] = useState('')
  const [toState, setToState] = useState<LocationItem | null>(null)
  const [toCity, setToCity] = useState<CityItem | null>(null)
  const [toDistrict, setToDistrict] = useState<DistrictItem | null>(null)
  const [fromCities, setFromCities] = useState<CityItem[]>([])
  const [fromDistricts, setFromDistricts] = useState<DistrictItem[]>([])
  const [toCities, setToCities] = useState<CityItem[]>([])
  const [toDistricts, setToDistricts] = useState<DistrictItem[]>([])
  const [isFromCitiesLoading, setIsFromCitiesLoading] = useState(false)
  const [isFromDistrictsLoading, setIsFromDistrictsLoading] = useState(false)
  const [isToCitiesLoading, setIsToCitiesLoading] = useState(false)
  const [isToDistrictsLoading, setIsToDistrictsLoading] = useState(false)
  const [parcelContent, setParcelContent] = useState('')
  const [parcelWeight, setParcelWeight] = useState('500')
  const [parcelLength, setParcelLength] = useState('20')
  const [parcelWidth, setParcelWidth] = useState('15')
  const [parcelHeight, setParcelHeight] = useState('10')
  const [insuranceValue, setInsuranceValue] = useState('0')
  const [codAmount, setCodAmount] = useState('0')
  const [warehouseStatus, setWarehouseStatus] = useState('')
  const [trackingCode, setTrackingCode] = useState('')
  const [shippingStatus, setShippingStatus] = useState('')

  const [orderDiscountAmount, setOrderDiscountAmount] = useState('0')
  const [vatEnabled, setVatEnabled] = useState(false)
  const [vatRatePercent, setVatRatePercent] = useState('0')
  const [initialVatEnabled, setInitialVatEnabled] = useState(false)
  const [initialVatRatePercent, setInitialVatRatePercent] = useState('0')
  const [depositAmount, setDepositAmount] = useState('0')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('unpaid')
  const [paymentDueDate, setPaymentDueDate] = useState('')
  const [depositInputMode, setDepositInputMode] = useState<DepositInputMode>('amount')
  const [depositPercent, setDepositPercent] = useState('')
  const [bankName, setBankName] = useState('')
  const [bankAccountNumber, setBankAccountNumber] = useState('')
  const [bankAccountHolder, setBankAccountHolder] = useState('')
  const [transferReference, setTransferReference] = useState('')
  const [paymentNotes, setPaymentNotes] = useState('')

  useEffect(() => {
    if (customerModalOpen && customerModalForm.state) {
      const fetchCities = async () => {
        setIsCitiesLoading(true)

        try {
          setCities(
            await customerApi.getCities({
              state_id: customerModalForm.state!.id,
              is_active: true,
            }),
          )
        } catch (error) {
          console.error('Lỗi khi tải danh sách Huyện/Quận:', error)
          appToast.error(getErrorMessage(error, 'Không thể tải danh sách Huyện/Quận.'))
        } finally {
          setIsCitiesLoading(false)
        }
      }

      void fetchCities()
      return
    }

    setCities([])
  }, [customerModalForm.state, customerModalOpen])

  useEffect(() => {
    if (customerModalOpen && customerModalForm.city) {
      const fetchDistricts = async () => {
        setIsDistrictsLoading(true)

        try {
          setDistricts(
            await customerApi.getDistricts({
              city_id: customerModalForm.city!.id,
              is_active: true,
            }),
          )
        } catch (error) {
          console.error('Lỗi khi tải danh sách Xa/Phường:', error)
          appToast.error(getErrorMessage(error, 'Không thể tải danh sách Xa/Phường.'))
        } finally {
          setIsDistrictsLoading(false)
        }
      }

      void fetchDistricts()
      return
    }

    setDistricts([])
  }, [customerModalForm.city, customerModalOpen])

  useEffect(() => {
    if (!customerModalOpen || !customerModalPrefill?.stateName || customerModalForm.state || states.length === 0) {
      return
    }

    const matchedState =
      states.find((item) => normalizeLocationLookup(item.name) === normalizeLocationLookup(customerModalPrefill.stateName)) ??
      null

    if (!matchedState) {
      return
    }

    setCustomerModalForm((current) => ({
      ...current,
      state: matchedState,
    }))
  }, [customerModalForm.state, customerModalOpen, customerModalPrefill, states])

  useEffect(() => {
    if (!customerModalOpen || !customerModalPrefill?.cityName || !customerModalForm.state || customerModalForm.city || cities.length === 0) {
      return
    }

    const matchedCity =
      cities.find((item) => normalizeLocationLookup(item.name) === normalizeLocationLookup(customerModalPrefill.cityName)) ??
      null

    if (!matchedCity) {
      return
    }

    setCustomerModalForm((current) => ({
      ...current,
      city: matchedCity,
    }))
  }, [cities, customerModalForm.city, customerModalForm.state, customerModalOpen, customerModalPrefill])

  useEffect(() => {
    if (!customerModalOpen || !customerModalPrefill?.districtName || !customerModalForm.city || customerModalForm.district || districts.length === 0) {
      return
    }

    const matchedDistrict =
      districts.find(
        (item) => normalizeLocationLookup(item.name) === normalizeLocationLookup(customerModalPrefill.districtName),
      ) ?? null

    if (!matchedDistrict) {
      return
    }

    setCustomerModalForm((current) => ({
      ...current,
      district: matchedDistrict,
    }))
  }, [customerModalForm.city, customerModalForm.district, customerModalOpen, customerModalPrefill, districts])

  useEffect(() => {
    if (fromState) {
      const fetchFromCities = async () => {
        setIsFromCitiesLoading(true)

        try {
          setFromCities(
            await customerApi.getCities({
              state_id: fromState.id,
              is_active: true,
            }),
          )
        } catch (error) {
          console.error('Lỗi khi tải địa chỉ gửi - Huyện/Quận:', error)
          appToast.error(getErrorMessage(error, 'Không thể tải Huyện/Quận của địa chỉ gửi.'))
        } finally {
          setIsFromCitiesLoading(false)
        }
      }

      void fetchFromCities()
      return
    }

    setFromCities([])
    setFromCity(null)
    setFromDistricts([])
    setFromDistrict(null)
  }, [fromState])

  useEffect(() => {
    if (fromCity) {
      const fetchFromDistricts = async () => {
        setIsFromDistrictsLoading(true)

        try {
          setFromDistricts(
            await customerApi.getDistricts({
              city_id: fromCity.id,
              is_active: true,
            }),
          )
        } catch (error) {
          console.error('Lỗi khi tải địa chỉ gửi - Xã/Phường:', error)
          appToast.error(getErrorMessage(error, 'Không thể tải Xã/Phường của địa chỉ gửi.'))
        } finally {
          setIsFromDistrictsLoading(false)
        }
      }

      void fetchFromDistricts()
      return
    }

    setFromDistricts([])
    setFromDistrict(null)
  }, [fromCity])

  useEffect(() => {
    if (toState) {
      const fetchToCities = async () => {
        setIsToCitiesLoading(true)

        try {
          setToCities(
            await customerApi.getCities({
              state_id: toState.id,
              is_active: true,
            }),
          )
        } catch (error) {
          console.error('Lỗi khi tải địa chỉ nhận - Huyện/Quận:', error)
          appToast.error(getErrorMessage(error, 'Không thể tải Huyện/Quận của địa chỉ nhận.'))
        } finally {
          setIsToCitiesLoading(false)
        }
      }

      void fetchToCities()
      return
    }

    setToCities([])
    setToCity(null)
    setToDistricts([])
    setToDistrict(null)
  }, [toState])

  useEffect(() => {
    if (toCity) {
      const fetchToDistricts = async () => {
        setIsToDistrictsLoading(true)

        try {
          setToDistricts(
            await customerApi.getDistricts({
              city_id: toCity.id,
              is_active: true,
            }),
          )
        } catch (error) {
          console.error('Lỗi khi tải địa chỉ nhận - Xã/Phường:', error)
          appToast.error(getErrorMessage(error, 'Không thể tải Xã/Phường của địa chỉ nhận.'))
        } finally {
          setIsToDistrictsLoading(false)
        }
      }

      void fetchToDistricts()
      return
    }

    setToDistricts([])
    setToDistrict(null)
  }, [toCity])

  const normalizedDiscountAmount = useMemo(
    () =>
      getNormalizedDiscountAmount({
        subTotal,
        discountAmount: orderDiscountAmount,
      }),
    [orderDiscountAmount, subTotal],
  )

  const normalizedTaxAmount = useMemo(
    () =>
      getNormalizedTaxAmount({
        subTotal,
        vatEnabled,
        vatRatePercent,
      }),
    [subTotal, vatEnabled, vatRatePercent],
  )

  const totalAmount = useMemo(
    () =>
      getOrderTotalAmount({
        subTotal,
        discountAmount: normalizedDiscountAmount,
        taxAmount: normalizedTaxAmount,
        shippingFee: Number(shippingFee || 0),
      }),
    [normalizedDiscountAmount, normalizedTaxAmount, shippingFee, subTotal],
  )

  const normalizedDepositAmount = useMemo(
    () =>
      getNormalizedDepositAmount({
        paymentMethod,
        depositInputMode,
        depositPercent,
        depositAmount,
        totalAmount,
      }),
    [depositAmount, depositInputMode, depositPercent, paymentMethod, totalAmount],
  )

  const normalizedPaidAmount = useMemo(
    () =>
      getNormalizedPaidAmount({
        paymentStatus,
        paymentMethod,
        totalAmount,
        depositAmount: normalizedDepositAmount,
      }),
    [normalizedDepositAmount, paymentMethod, paymentStatus, totalAmount],
  )

  const outstandingAmount = useMemo(() => Math.max(totalAmount - normalizedPaidAmount, 0), [normalizedPaidAmount, totalAmount])

  const paymentValidationErrors = useMemo(
    () =>
      getPaymentValidationErrors({
        paymentMethod,
        paymentStatus,
        paymentDueDate,
        depositInputMode,
        depositPercent,
        normalizedDepositAmount,
        totalAmount,
        bankName,
        bankAccountNumber,
        bankAccountHolder,
        processingStatus,
      }),
    [
      bankAccountHolder,
      bankAccountNumber,
      bankName,
      depositInputMode,
      depositPercent,
      normalizedDepositAmount,
      paymentDueDate,
      paymentMethod,
      paymentStatus,
      processingStatus,
      totalAmount,
    ],
  )

  const visiblePaymentErrors = hasAttemptedSave ? paymentValidationErrors : {}
  const derivedPaymentStatus = useMemo(
    () =>
      getDerivedPaymentStatusValue({
        totalAmount,
        paidAmount: normalizedPaidAmount,
      }),
    [normalizedPaidAmount, totalAmount],
  )

  const vatChangedByUser =
    vatEnabled !== initialVatEnabled || Number(vatRatePercent || 0) !== Number(initialVatRatePercent || 0)

  const hasSelectedCustomer = Boolean(customerName.trim() || customerPhone.trim() || customerAddress.trim() || customerId)

  const customerSearchOptions = useMemo<CustomerAutocompleteOption[]>(() => {
    const normalizedKeyword = customerSearch.trim().toLowerCase()
    const matchedCustomers =
      options?.customers.filter((customer) => {
        if (!normalizedKeyword) {
          return true
        }

        const haystack = [customer.full_name, customer.client_code, customer.phone].join(' ').toLowerCase()
        return haystack.includes(normalizedKeyword)
      }) ?? []

    return [
      {
        kind: 'create',
        id: 'create',
      },
      ...matchedCustomers.map((customer) => ({
        kind: 'customer' as const,
        customer,
      })),
    ]
  }, [customerSearch, options?.customers])

  const clearResolvedShippingSelection = () => {
    setServiceId(null)
    setServiceTypeId(null)
  }

  const applyCustomerShippingAddress = async (address: AddressDetailInput | null | undefined) => {
    try {
      clearResolvedShippingSelection()

      if (!address) {
        setToState(null)
        setToCity(null)
        setToDistrict(null)
        setToAddressLine('')
        return
      }

      const statesData =
        states.length > 0
          ? states
          : await customerApi.getStates({
              is_active: true,
            })

      if (states.length === 0) {
        setStates(statesData)
      }

      const selection = await hydrateAddressSelection(address, statesData)

      setToState(selection.state)
      setToCity(selection.city)
      setToDistrict(selection.district)
      setToAddressLine(address.address_line ?? '')
    } catch (error) {
      console.error('Lỗi khi đồng bộ địa chỉ nhận từ khách hàng:', error)
      appToast.error(getErrorMessage(error, 'Không thể đồng bộ địa chỉ nhận từ khách hàng.'))
    }
  }

  const applyStoreDefaults = useCallback(async ({
    shippingAddress,
    bankAccount,
    vat,
    statesData,
  }: {
    shippingAddress: ShippingDefaults
    bankAccount: BankDefaults
    vat: VatDefaults
    statesData: LocationItem[]
  }) => {
    setFromContactName(shippingAddress.contact_name)
    setFromContactPhone(shippingAddress.phone)
    setFromAddressLine(shippingAddress.address_line)
    setBankName(bankAccount.bank_name)
    setBankAccountNumber(bankAccount.account_number)
    setBankAccountHolder(bankAccount.account_holder)
    setVatEnabled(vat.enabled)
    setVatRatePercent(String(Math.max(Number(vat.rate_percent || 0), 0)))
    setInitialVatEnabled(vat.enabled)
    setInitialVatRatePercent(String(Math.max(Number(vat.rate_percent || 0), 0)))

    if (!shippingAddress.state_id || !shippingAddress.city_id) {
      return
    }

    const selection = await hydrateAddressSelection(
      {
        state_id: shippingAddress.state_id,
        city_id: shippingAddress.city_id,
        district_id: shippingAddress.district_id ?? null,
        address_line: shippingAddress.address_line,
      },
      statesData,
    )

    setFromState(selection.state)
    setFromCity(selection.city)
    setFromDistrict(selection.district)
  }, [])

  const applyOrderFormSnapshot = useCallback(async ({
    orderData,
    statesData,
    preservePaymentStatus,
    resetOperationalShippingFields,
    preserveShippingSelection,
  }: {
    orderData: OrderDetailBase
    statesData: LocationItem[]
    preservePaymentStatus: boolean
    resetOperationalShippingFields: boolean
    preserveShippingSelection: boolean
  }) => {
    const parsedPaymentDetails = parsePaymentNoteContent(orderData.payment_notes)
    const inferredPaymentMethod =
      parsedPaymentDetails.method ?? getPaymentMethodFromTypeId(orderData.payment_type_id, orderData.payment_status)

    setCustomerId(orderData.customer_id ? String(orderData.customer_id) : '')
    setCustomerCode(orderData.customer_info.customer_code ?? '')
    setCustomerName(orderData.customer_info.name)
    setCustomerPhone(orderData.customer_info.phone)
    setCustomerAddress(orderData.customer_info.address ?? '')
    setCustomerSearch(
      [orderData.customer_info.name, orderData.customer_info.phone, orderData.customer_info.customer_code]
        .filter(Boolean)
        .join(' • '),
    )
    setPaymentStatus(
      preservePaymentStatus ? orderData.payment_status : inferredPaymentMethod === 'deposit' ? 'deposit' : 'unpaid',
    )
    setPaymentMethod(inferredPaymentMethod)
    setServiceId(preserveShippingSelection ? orderData.service_id ?? null : null)
    setServiceTypeId(preserveShippingSelection ? orderData.service_type_id ?? null : null)
    setShippingService(orderData.shipping_service ?? '')
    setShippingFee(orderData.shipping_fee)

    const [fromSelection, toSelection] = await Promise.all([
      hydrateAddressSelection(orderData.from_address_detail, statesData),
      hydrateAddressSelection(orderData.to_address_detail, statesData),
    ])

    setFromState(fromSelection.state)
    setFromCity(fromSelection.city)
    setFromDistrict(fromSelection.district)
    setToState(toSelection.state)
    setToCity(toSelection.city)
    setToDistrict(toSelection.district)
    setFromContactName(orderData.from_name ?? '')
    setFromContactPhone(orderData.from_phone ?? '')
    setFromAddressLine(orderData.from_address_detail?.address_line ?? orderData.from_address ?? '')
    setToAddressLine(orderData.to_address_detail?.address_line ?? orderData.customer_info.address ?? '')
    setParcelContent(orderData.content ?? '')
    setParcelWeight(orderData.weight ? String(orderData.weight) : '500')
    setParcelLength(orderData.length ? String(orderData.length) : '20')
    setParcelWidth(orderData.width ? String(orderData.width) : '15')
    setParcelHeight(orderData.height ? String(orderData.height) : '10')
    setInsuranceValue(orderData.insurance_value ?? '0')
    setCodAmount(resetOperationalShippingFields ? '0' : orderData.cod_amount ?? '0')
    setOrderDiscountAmount(orderData.discount_amount)
    setVatEnabled(orderData.vat_enabled)
    setVatRatePercent(String(Number(orderData.vat_rate_percent || 0)))
    setInitialVatEnabled(orderData.vat_enabled)
    setInitialVatRatePercent(String(Number(orderData.vat_rate_percent || 0)))
    setDepositAmount(resetOperationalShippingFields ? '0' : orderData.deposit_amount)
    setPaymentDueDate(parsedPaymentDetails.dueDate)
    setDepositInputMode(parsedPaymentDetails.depositMode)
    setDepositPercent(parsedPaymentDetails.depositPercent)
    setBankName(parsedPaymentDetails.bankName)
    setBankAccountNumber(parsedPaymentDetails.accountNumber)
    setBankAccountHolder(parsedPaymentDetails.accountHolder)
    setTransferReference(parsedPaymentDetails.transferReference)
    setWarehouseStatus(resetOperationalShippingFields ? '' : orderData.warehouse_status ?? '')
    setTrackingCode(resetOperationalShippingFields ? '' : orderData.tracking_code ?? '')
    setShippingStatus(resetOperationalShippingFields ? '' : orderData.shipping_status ?? '')
    setPaymentNotes(parsedPaymentDetails.note)
  }, [])

  const applyOrderData = useCallback(async (orderData: OrderDetailBase, statesData: LocationItem[]) => {
    await applyOrderFormSnapshot({
      orderData,
      statesData,
      preservePaymentStatus: true,
      resetOperationalShippingFields: false,
      preserveShippingSelection: true,
    })
  }, [applyOrderFormSnapshot])

  const applyDuplicateOrderData = useCallback(async (orderData: OrderDetailItem, statesData: LocationItem[]) => {
    await applyOrderFormSnapshot({
      orderData,
      statesData,
      preservePaymentStatus: false,
      resetOperationalShippingFields: true,
      preserveShippingSelection: false,
    })
  }, [applyOrderFormSnapshot])

  const handleShippingServiceChange = (value: string) => {
    setShippingService(value)
    clearResolvedShippingSelection()
  }

  const handleCustomerSelect = (value: OrderOptionLookup['customers'][number] | null) => {
    if (!value) {
      setCustomerId('')
      setCustomerCode('')
      setCustomerName('')
      setCustomerPhone('')
      setCustomerAddress('')
      setCustomerSearch('')
      void applyCustomerShippingAddress(null)
      return
    }

    setCustomerId(String(value.id))
    setCustomerCode(value.client_code)
    setCustomerName(value.full_name)
    setCustomerPhone(value.phone)
    setCustomerAddress(formatDefaultCustomerAddress(value))
    setCustomerSearch(`${value.full_name} - ${value.client_code} - ${value.phone}`)
    void applyCustomerShippingAddress(value.default_address?.address ?? null)
  }

  const handleCustomerModalFieldChange = (field: 'fullName' | 'phone' | 'addressLine', value: string) => {
    setCustomerModalForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  const handleCustomerModalDefaultAddressChange = (checked: boolean) => {
    setCustomerModalForm((current) => ({
      ...current,
      setAsDefaultAddress: checked,
    }))
  }

  const handleCustomerModalStateChange = (_event: unknown, value: LocationItem | null) => {
    setCustomerModalForm((current) => ({
      ...current,
      state: value,
      city: null,
      district: null,
    }))
  }

  const handleCustomerModalCityChange = (_event: unknown, value: CityItem | null) => {
    setCustomerModalForm((current) => ({
      ...current,
      city: value,
      district: null,
    }))
  }

  const handleCustomerModalDistrictChange = (_event: unknown, value: DistrictItem | null) => {
    setCustomerModalForm((current) => ({
      ...current,
      district: value,
    }))
  }

  const handleOpenCreateCustomerModal = () => {
    const parsedAddress = parseCustomerAddress(customerAddress)
    setCustomerModalMode('create')
    setCustomerModalForm({
      ...createEmptyCustomerModalForm(),
      fullName: customerSearch.trim(),
      phone: customerPhone.trim(),
      addressLine: parsedAddress.addressLine,
    })
    setCustomerModalPrefill(parsedAddress)
    setCustomerModalOpen(true)
  }

  const handleOpenEditCustomerModal = () => {
    const parsedAddress = parseCustomerAddress(customerAddress)
    const currentCustomer = options?.customers.find((item) => String(item.id) === customerId) ?? null
    setCustomerModalMode('edit')
    setCustomerModalForm({
      fullName: customerName,
      phone: customerPhone,
      addressLine: parsedAddress.addressLine,
      state: null,
      city: null,
      district: null,
      setAsDefaultAddress: Boolean(currentCustomer?.default_address),
    })
    setCustomerModalPrefill(parsedAddress)
    setCustomerModalOpen(true)
  }

  const handleCloseCustomerModal = () => {
    if (isCustomerModalSaving) {
      return
    }

    setCustomerModalOpen(false)
    setCustomerModalPrefill(null)
  }

  const handleClearCustomer = () => {
    handleCustomerSelect(null)
    setCustomerModalForm(createEmptyCustomerModalForm())
    setCustomerModalPrefill(null)
  }

  const handleSaveCustomerModal = async () => {
    const fullName = customerModalForm.fullName.trim()
    const phone = customerModalForm.phone.trim()
    const address = buildCustomerAddress(customerModalForm)
    const shouldSetDefaultAddress =
      customerModalForm.setAsDefaultAddress &&
      Boolean(customerModalForm.addressLine.trim() && customerModalForm.state && customerModalForm.city)

    if (!fullName || !phone) {
      appToast.warning(ORDER_TOAST_MESSAGES.customerNamePhoneRequired)
      return
    }

    if (customerModalMode === 'edit') {
      setCustomerName(fullName)
      setCustomerPhone(phone)
      setCustomerAddress(address)
      setCustomerSearch(`${fullName}${customerCode ? ` - ${customerCode}` : ''} - ${phone}`)

      if (shouldSetDefaultAddress && customerId) {
        setIsCustomerModalSaving(true)

        try {
          const updatedCustomer = await customerApi.updateCustomer(customerId, {
            full_name: fullName,
            phone,
            addresses: [
              {
                type: 'shipping',
                label: 'Địa chỉ chính',
                is_default: true,
                recipient_name: fullName,
                recipient_phone: phone,
                address: {
                  state_id: customerModalForm.state?.id,
                  city_id: customerModalForm.city?.id,
                  district_id: customerModalForm.district?.id ?? null,
                  address_line: customerModalForm.addressLine.trim(),
                },
              },
            ],
          })

          setOptions((current) =>
            current
              ? {
                  ...current,
                  customers: current.customers.map((item) =>
                    item.id === updatedCustomer.id
                      ? {
                          ...item,
                          full_name: updatedCustomer.full_name,
                          phone: updatedCustomer.phone ?? phone,
                          default_address: updatedCustomer.addresses.find((entry) => entry.is_default)
                            ? {
                                id: updatedCustomer.addresses.find((entry) => entry.is_default)!.id,
                                address: updatedCustomer.addresses.find((entry) => entry.is_default)!.address,
                              }
                            : item.default_address,
                        }
                      : item,
                  ),
                }
              : current,
          )

          const updatedDefaultAddress = updatedCustomer.addresses.find((entry) => entry.is_default) ?? null
          setCustomerAddress(
            updatedDefaultAddress
              ? formatDefaultCustomerAddress({
                  id: updatedCustomer.id,
                  client_code: updatedCustomer.client_code,
                  full_name: updatedCustomer.full_name,
                  phone: updatedCustomer.phone ?? phone,
                  default_address: {
                    id: updatedDefaultAddress.id,
                    address: updatedDefaultAddress.address,
                  },
                })
              : address,
          )
          await applyCustomerShippingAddress(updatedDefaultAddress?.address ?? null)
        } catch (error) {
          console.error('Lỗi khi cập nhật địa chỉ mặc định:', error)
          appToast.error(getErrorMessage(error, 'Không thể cập nhật địa chỉ mặc định.'))
          setIsCustomerModalSaving(false)
          return
        } finally {
          setIsCustomerModalSaving(false)
        }
      }

      setCustomerModalOpen(false)
      appToast.success(ORDER_TOAST_MESSAGES.customerInfoUpdatedOnOrder)
      return
    }

    setIsCustomerModalSaving(true)

    try {
      const createdCustomer = await customerApi.createCustomer({
        full_name: fullName,
        phone,
        status: 'active',
        addresses: shouldSetDefaultAddress
          ? [
              {
                type: 'shipping',
                label: 'Địa chỉ chính',
                is_default: true,
                recipient_name: fullName,
                recipient_phone: phone,
                address: {
                  state_id: customerModalForm.state?.id,
                  city_id: customerModalForm.city?.id,
                  district_id: customerModalForm.district?.id ?? null,
                  address_line: customerModalForm.addressLine.trim(),
                },
              },
            ]
          : undefined,
      })

      setOptions((current) =>
        current
          ? {
              ...current,
              customers: [
                {
                  id: createdCustomer.id,
                  client_code: createdCustomer.client_code,
                  full_name: createdCustomer.full_name,
                  phone: createdCustomer.phone ?? phone,
                  default_address: createdCustomer.addresses.find((entry) => entry.is_default)
                    ? {
                        id: createdCustomer.addresses.find((entry) => entry.is_default)!.id,
                        address: createdCustomer.addresses.find((entry) => entry.is_default)!.address,
                      }
                    : null,
                },
                ...current.customers.filter((item) => item.id !== createdCustomer.id),
              ],
            }
          : current,
      )

      setCustomerId(String(createdCustomer.id))
      setCustomerCode(createdCustomer.client_code)
      setCustomerName(createdCustomer.full_name)
      setCustomerPhone(createdCustomer.phone ?? phone)
      const createdDefaultAddress = createdCustomer.addresses.find((entry) => entry.is_default) ?? null
      setCustomerAddress(
        createdDefaultAddress
          ? formatDefaultCustomerAddress({
              id: createdCustomer.id,
              client_code: createdCustomer.client_code,
              full_name: createdCustomer.full_name,
              phone: createdCustomer.phone ?? phone,
              default_address: {
                id: createdDefaultAddress.id,
                address: createdDefaultAddress.address,
              },
            })
          : address,
      )
      setCustomerSearch(`${createdCustomer.full_name} - ${createdCustomer.client_code} - ${createdCustomer.phone ?? phone}`)
      await applyCustomerShippingAddress(createdDefaultAddress?.address ?? null)
      setCustomerModalOpen(false)
      appToast.success(ORDER_TOAST_MESSAGES.customerCreated)
    } catch (error) {
      console.error('Lỗi khi tạo khách hàng:', error)
      appToast.error(getErrorMessage(error, 'Không thể tạo khách hàng mới.'))
    } finally {
      setIsCustomerModalSaving(false)
    }
  }

  const handleFromStateChange = (_event: unknown, value: LocationItem | null) => {
    clearResolvedShippingSelection()
    setFromState(value)
    setFromCity(null)
    setFromDistrict(null)
  }

  const handleFromCityChange = (_event: unknown, value: CityItem | null) => {
    clearResolvedShippingSelection()
    setFromCity(value)
    setFromDistrict(null)
  }

  const handleFromDistrictChange = (_event: unknown, value: DistrictItem | null) => {
    clearResolvedShippingSelection()
    setFromDistrict(value)
  }

  const handleToStateChange = (_event: unknown, value: LocationItem | null) => {
    clearResolvedShippingSelection()
    setToState(value)
    setToCity(null)
    setToDistrict(null)
  }

  const handleToCityChange = (_event: unknown, value: CityItem | null) => {
    clearResolvedShippingSelection()
    setToCity(value)
    setToDistrict(null)
  }

  const handleToDistrictChange = (_event: unknown, value: DistrictItem | null) => {
    clearResolvedShippingSelection()
    setToDistrict(value)
  }

  const handleFromAddressLineChange = (value: string) => {
    clearResolvedShippingSelection()
    setFromAddressLine(value)
  }

  const handleToAddressLineChange = (value: string) => {
    clearResolvedShippingSelection()
    setToAddressLine(value)
  }

  const handleParcelWeightChange = (value: string) => {
    clearResolvedShippingSelection()
    setParcelWeight(value)
  }

  const handleParcelLengthChange = (value: string) => {
    clearResolvedShippingSelection()
    setParcelLength(value)
  }

  const handleParcelWidthChange = (value: string) => {
    clearResolvedShippingSelection()
    setParcelWidth(value)
  }

  const handleParcelHeightChange = (value: string) => {
    clearResolvedShippingSelection()
    setParcelHeight(value)
  }

  const handleInsuranceValueChange = (value: string) => {
    clearResolvedShippingSelection()
    setInsuranceValue(value)
  }

  const handleCodAmountChange = (value: string) => {
    clearResolvedShippingSelection()
    setCodAmount(value)
  }

  const handlePaymentMethodChange = (method: PaymentMethod) => {
    setPaymentMethod(method)
    setPaymentStatus((current) => getNextPaymentStatus(method, current))
  }

  const buildPaymentNote = () =>
    buildPaymentNoteContent({
      method: paymentMethod,
      note: paymentNotes,
      dueDate: paymentDueDate,
      depositMode: depositInputMode,
      depositPercent,
      depositAmount: normalizedDepositAmount,
      bankName,
      accountNumber: bankAccountNumber,
      accountHolder: bankAccountHolder,
      transferReference,
    })

  return {
    paymentStatus,
    setPaymentStatus,
    customerSearch,
    setCustomerSearch,
    customerId,
    customerCode,
    customerName,
    customerPhone,
    customerAddress,
    cities,
    districts,
    isCitiesLoading,
    isDistrictsLoading,
    customerModalOpen,
    customerModalMode,
    customerModalForm,
    isCustomerModalSaving,
    serviceId,
    serviceTypeId,
    shippingService,
    setShippingService: handleShippingServiceChange,
    shippingFee,
    setShippingFee,
    fromContactName,
    setFromContactName,
    fromContactPhone,
    setFromContactPhone,
    fromAddressLine,
    setFromAddressLine: handleFromAddressLineChange,
    fromState,
    fromCity,
    fromDistrict,
    toAddressLine,
    setToAddressLine: handleToAddressLineChange,
    toState,
    toCity,
    toDistrict,
    fromCities,
    fromDistricts,
    toCities,
    toDistricts,
    isFromCitiesLoading,
    isFromDistrictsLoading,
    isToCitiesLoading,
    isToDistrictsLoading,
    parcelContent,
    setParcelContent,
    parcelWeight,
    setParcelWeight: handleParcelWeightChange,
    parcelLength,
    setParcelLength: handleParcelLengthChange,
    parcelWidth,
    setParcelWidth: handleParcelWidthChange,
    parcelHeight,
    setParcelHeight: handleParcelHeightChange,
    insuranceValue,
    setInsuranceValue: handleInsuranceValueChange,
    codAmount,
    setCodAmount: handleCodAmountChange,
    warehouseStatus,
    setWarehouseStatus,
    trackingCode,
    setTrackingCode,
    shippingStatus,
    setShippingStatus,
    orderDiscountAmount,
    setOrderDiscountAmount,
    vatEnabled,
    setVatEnabled,
    vatRatePercent,
    setVatRatePercent,
    setDepositAmount,
    paymentMethod,
    paymentDueDate,
    depositInputMode,
    depositPercent,
    bankName,
    bankAccountNumber,
    bankAccountHolder,
    transferReference,
    paymentNotes,
    setPaymentNotes,
    normalizedDiscountAmount,
    normalizedTaxAmount,
    totalAmount,
    normalizedDepositAmount,
    normalizedPaidAmount,
    outstandingAmount,
    paymentValidationErrors,
    visiblePaymentErrors,
    derivedPaymentStatus,
    vatChangedByUser,
    hasSelectedCustomer,
    customerSearchOptions,
    buildPaymentNote,
    applyStoreDefaults,
    applyOrderData,
    applyDuplicateOrderData,
    handleCustomerSelect,
    handleCustomerModalFieldChange,
    handleCustomerModalDefaultAddressChange,
    handleCustomerModalStateChange,
    handleCustomerModalCityChange,
    handleCustomerModalDistrictChange,
    handleOpenCreateCustomerModal,
    handleOpenEditCustomerModal,
    handleCloseCustomerModal,
    handleClearCustomer,
    handleSaveCustomerModal,
    handleFromStateChange,
    handleFromCityChange,
    handleFromDistrictChange,
    handleToStateChange,
    handleToCityChange,
    handleToDistrictChange,
    handlePaymentMethodChange,
  }
}
