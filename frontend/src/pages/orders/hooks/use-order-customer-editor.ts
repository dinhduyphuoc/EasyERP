import { useCallback, useEffect, useState } from 'react'
import { customerApi, type CityItem, type DistrictItem, type LocationItem } from '@/pages/customers/customer.api'
import { appToast } from '@/shared/ui/toast/toast.helpers'
import { orderApi, type OrderDetailItem } from '../api'
import type { CustomerModalForm } from '../components'
import { buildCustomerUpdatedMessage, ORDER_TOAST_MESSAGES } from '../lib/toast-messages'

type ParsedCustomerAddress = {
  addressLine: string
  districtName: string
  cityName: string
  stateName: string
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

export function useOrderCustomerEditor({
  order,
  orderId,
  onOrderUpdated,
  getErrorMessage,
}: {
  order: OrderDetailItem | null
  orderId: string | undefined
  onOrderUpdated: (order: OrderDetailItem) => void
  getErrorMessage: (error: unknown, fallback: string) => string
}) {
  const [customerModalOpen, setCustomerModalOpen] = useState(false)
  const [customerModalForm, setCustomerModalForm] = useState<CustomerModalForm>(createEmptyCustomerModalForm)
  const [customerModalPrefill, setCustomerModalPrefill] = useState<ParsedCustomerAddress | null>(null)
  const [customerModalStates, setCustomerModalStates] = useState<LocationItem[]>([])
  const [customerModalCities, setCustomerModalCities] = useState<CityItem[]>([])
  const [customerModalDistricts, setCustomerModalDistricts] = useState<DistrictItem[]>([])
  const [isCustomerModalStatesLoading, setIsCustomerModalStatesLoading] = useState(false)
  const [isCustomerModalCitiesLoading, setIsCustomerModalCitiesLoading] = useState(false)
  const [isCustomerModalDistrictsLoading, setIsCustomerModalDistrictsLoading] = useState(false)
  const [isCustomerModalSaving, setIsCustomerModalSaving] = useState(false)

  useEffect(() => {
    if (!customerModalOpen) {
      return
    }

    let cancelled = false

    const loadStates = async () => {
      try {
        setIsCustomerModalStatesLoading(true)
        const nextStates = await customerApi.getStates({ is_active: true })

        if (!cancelled) {
          setCustomerModalStates(nextStates)
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Lỗi khi tải tỉnh/thành phố khách hàng:', error)
          appToast.error(getErrorMessage(error, 'Không thể tải danh sách tỉnh/thành phố.'))
        }
      } finally {
        if (!cancelled) {
          setIsCustomerModalStatesLoading(false)
        }
      }
    }

    void loadStates()

    return () => {
      cancelled = true
    }
  }, [customerModalOpen, getErrorMessage])

  useEffect(() => {
    if (!customerModalOpen || !customerModalForm.state) {
      setCustomerModalCities([])
      return
    }

    const selectedState = customerModalForm.state
    let cancelled = false

    const loadCities = async () => {
      try {
        setIsCustomerModalCitiesLoading(true)
        const nextCities = await customerApi.getCities({
          state_id: selectedState.id,
          is_active: true,
        })

        if (!cancelled) {
          setCustomerModalCities(nextCities)
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Lỗi khi tải quận/huyện khách hàng:', error)
          appToast.error(getErrorMessage(error, 'Không thể tải danh sách quận/huyện.'))
        }
      } finally {
        if (!cancelled) {
          setIsCustomerModalCitiesLoading(false)
        }
      }
    }

    void loadCities()

    return () => {
      cancelled = true
    }
  }, [customerModalForm.state, customerModalOpen, getErrorMessage])

  useEffect(() => {
    if (!customerModalOpen || !customerModalForm.city) {
      setCustomerModalDistricts([])
      return
    }

    const selectedCity = customerModalForm.city
    let cancelled = false

    const loadDistricts = async () => {
      try {
        setIsCustomerModalDistrictsLoading(true)
        const nextDistricts = await customerApi.getDistricts({
          city_id: selectedCity.id,
          is_active: true,
        })

        if (!cancelled) {
          setCustomerModalDistricts(nextDistricts)
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Lỗi khi tải phường/xã khách hàng:', error)
          appToast.error(getErrorMessage(error, 'Không thể tải danh sách phường/xã.'))
        }
      } finally {
        if (!cancelled) {
          setIsCustomerModalDistrictsLoading(false)
        }
      }
    }

    void loadDistricts()

    return () => {
      cancelled = true
    }
  }, [customerModalForm.city, customerModalOpen, getErrorMessage])

  useEffect(() => {
    if (!customerModalOpen || !customerModalPrefill?.stateName || customerModalForm.state || customerModalStates.length === 0) {
      return
    }

    const matchedState =
      customerModalStates.find(
        (item) => normalizeLocationLookup(item.name) === normalizeLocationLookup(customerModalPrefill.stateName),
      ) ?? null

    if (!matchedState) {
      return
    }

    setCustomerModalForm((current) => ({
      ...current,
      state: matchedState,
    }))
  }, [customerModalForm.state, customerModalOpen, customerModalPrefill, customerModalStates])

  useEffect(() => {
    if (!customerModalOpen || !customerModalPrefill?.cityName || !customerModalForm.state || customerModalForm.city || customerModalCities.length === 0) {
      return
    }

    const matchedCity =
      customerModalCities.find(
        (item) => normalizeLocationLookup(item.name) === normalizeLocationLookup(customerModalPrefill.cityName),
      ) ?? null

    if (!matchedCity) {
      return
    }

    setCustomerModalForm((current) => ({
      ...current,
      city: matchedCity,
    }))
  }, [customerModalCities, customerModalForm.city, customerModalForm.state, customerModalOpen, customerModalPrefill])

  useEffect(() => {
    if (!customerModalOpen || !customerModalPrefill?.districtName || !customerModalForm.city || customerModalForm.district || customerModalDistricts.length === 0) {
      return
    }

    const matchedDistrict =
      customerModalDistricts.find(
        (item) => normalizeLocationLookup(item.name) === normalizeLocationLookup(customerModalPrefill.districtName),
      ) ?? null

    if (!matchedDistrict) {
      return
    }

    setCustomerModalForm((current) => ({
      ...current,
      district: matchedDistrict,
    }))
  }, [customerModalDistricts, customerModalForm.city, customerModalForm.district, customerModalOpen, customerModalPrefill])

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

  const handleCloseCustomerModal = () => {
    if (isCustomerModalSaving) {
      return
    }

    setCustomerModalOpen(false)
    setCustomerModalPrefill(null)
  }

  const handleOpenEditCustomerModal = useCallback(async () => {
    if (!order?.customer_id) {
      return
    }

    const parsedAddress = order.to_address_detail
      ? {
          addressLine: order.to_address_detail.address_line ?? '',
          districtName: order.to_address_detail.district_name ?? '',
          cityName: order.to_address_detail.city_name ?? '',
          stateName: order.to_address_detail.state_name ?? '',
        }
      : parseCustomerAddress(order.customer_info.address ?? '')

    setCustomerModalForm({
      ...createEmptyCustomerModalForm(),
      fullName: order.customer_info.name,
      phone: order.customer_info.phone,
      addressLine: parsedAddress.addressLine,
      setAsDefaultAddress: false,
    })
    setCustomerModalPrefill(parsedAddress)
    setCustomerModalCities([])
    setCustomerModalDistricts([])
    setCustomerModalOpen(true)

    try {
      const customer = await customerApi.getCustomerById(order.customer_id)
      const defaultAddress = customer.addresses.find((item) => item.is_default)?.address ?? null

      setCustomerModalForm((current) => ({
        ...current,
        setAsDefaultAddress: Boolean(defaultAddress),
      }))

      if (!order.to_address_detail && defaultAddress) {
        setCustomerModalPrefill({
          addressLine: defaultAddress.address_line ?? '',
          districtName: defaultAddress.district_name ?? '',
          cityName: defaultAddress.city_name ?? '',
          stateName: defaultAddress.state_name ?? '',
        })
        setCustomerModalForm((current) => ({
          ...current,
          addressLine: defaultAddress.address_line ?? current.addressLine,
        }))
      }
    } catch (error) {
      console.error('Lỗi khi tải thông tin khách hàng:', error)
      appToast.error(getErrorMessage(error, 'Không thể tải thông tin khách hàng để chỉnh sửa.'))
    }
  }, [getErrorMessage, order])

  const handleSaveCustomerModal = useCallback(async () => {
    if (!order?.customer_id || !orderId) {
      return
    }

    const fullName = customerModalForm.fullName.trim()
    const phone = customerModalForm.phone.trim()
    const address = buildCustomerAddress(customerModalForm)
    const hasStructuredAddress = Boolean(
      customerModalForm.addressLine.trim() && customerModalForm.state && customerModalForm.city,
    )
    const shouldSetDefaultAddress = customerModalForm.setAsDefaultAddress && hasStructuredAddress

    if (!fullName || !phone) {
      appToast.warning(ORDER_TOAST_MESSAGES.customerNamePhoneRequired)
      return
    }

    try {
      setIsCustomerModalSaving(true)

      await customerApi.updateCustomer(order.customer_id, {
        full_name: fullName,
        phone,
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

      const updatedOrder = await orderApi.updateOrder(orderId, {
        customer_info: {
          customer_code: order.customer_info.customer_code ?? null,
          name: fullName,
          phone,
          address: address || null,
        },
        ...(hasStructuredAddress
          ? {
              to_address_detail: {
                state_id: customerModalForm.state?.id ?? null,
                city_id: customerModalForm.city?.id ?? null,
                district_id: customerModalForm.district?.id ?? null,
                address_line: customerModalForm.addressLine.trim() || null,
              },
            }
          : {}),
      })

      onOrderUpdated(updatedOrder)
      setCustomerModalOpen(false)
      setCustomerModalPrefill(null)
      appToast.success(buildCustomerUpdatedMessage(updatedOrder.order_code))
    } catch (error) {
      console.error('Lỗi khi cập nhật khách hàng từ đơn hàng:', error)
      appToast.error(getErrorMessage(error, 'Không thể cập nhật thông tin khách hàng.'))
    } finally {
      setIsCustomerModalSaving(false)
    }
  }, [customerModalForm, getErrorMessage, onOrderUpdated, order, orderId])

  return {
    customerModalOpen,
    customerModalForm,
    customerModalStates,
    customerModalCities,
    customerModalDistricts,
    isCustomerModalStatesLoading,
    isCustomerModalCitiesLoading,
    isCustomerModalDistrictsLoading,
    isCustomerModalSaving,
    handleCustomerModalFieldChange,
    handleCustomerModalDefaultAddressChange,
    handleCustomerModalStateChange,
    handleCustomerModalCityChange,
    handleCustomerModalDistrictChange,
    handleCloseCustomerModal,
    handleOpenEditCustomerModal,
    handleSaveCustomerModal,
  }
}
