import { useCallback, useEffect, useState } from 'react'
import { appToast } from '@/shared/ui/toast/toast.helpers'
import { shippingApi } from '@/pages/shipping/shipping.api'
import { orderApi, type OrderActionName, type OrderDetailItem } from '../api'
import { ORDER_TOAST_MESSAGES } from '../lib/toast-messages'

const DEFAULT_SHIPPING_WEIGHT = 500
const DEFAULT_SHIPPING_LENGTH = 20
const DEFAULT_SHIPPING_WIDTH = 15
const DEFAULT_SHIPPING_HEIGHT = 10

export type ShippingActionDialogState = {
  action: 'push_to_delivery' | 'mark_delivered'
  shippingService: string
  trackingCode: string
  shippingStatus: string
}

export type ShippingServiceOption = {
  key: string
  providerCode: string
  providerDisplayName: string
  providerLogoUrl: string | null
  serviceId: number
  serviceTypeId: number
  serviceName: string
  availableServiceNames: string[]
  fee: number | null
  expectedDeliveryTime: string | null
}

export type ShippingProviderServiceCatalog = {
  providerCode: string
  providerDisplayName: string
  providerLogoUrl: string | null
  services: Array<{
    serviceId: number
    serviceTypeId: number
    serviceName: string
  }>
}

const normalizeShippingProviderName = (value: string | null | undefined) => {
  if (!value) {
    return ''
  }

  return value.split(' - ')[0]?.trim() ?? ''
}

const buildShippingOptionKey = (providerCode: string, serviceId: number, serviceTypeId: number) =>
  `${providerCode}:${serviceId}:${serviceTypeId}`

const toExpectedDeliveryTimestamp = (value: string | null) => {
  if (!value) {
    return Number.POSITIVE_INFINITY
  }

  const timestamp = new Date(value).getTime()
  return Number.isFinite(timestamp) ? timestamp : Number.POSITIVE_INFINITY
}

const compareShippingOptions = (left: ShippingServiceOption, right: ShippingServiceOption) => {
  const leftFee = left.fee ?? Number.POSITIVE_INFINITY
  const rightFee = right.fee ?? Number.POSITIVE_INFINITY

  if (leftFee !== rightFee) {
    return leftFee - rightFee
  }

  const leftEta = toExpectedDeliveryTimestamp(left.expectedDeliveryTime)
  const rightEta = toExpectedDeliveryTimestamp(right.expectedDeliveryTime)

  if (leftEta !== rightEta) {
    return leftEta - rightEta
  }

  const providerCompare = left.providerDisplayName.localeCompare(right.providerDisplayName)
  if (providerCompare !== 0) {
    return providerCompare
  }

  return left.serviceName.localeCompare(right.serviceName)
}

const hasResolvedAddress = (address?: {
  state_id: number
  city_id: number
  district_id: number | null
} | null) => Boolean(address?.state_id && address.city_id && address.district_id)

const normalizePositiveMeasurement = (value: number | null | undefined, fallback: number) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return fallback
  }

  return Math.round(value)
}

export function useOrderShipping({
  order,
  orderId,
  activeStoreId,
  storeShippingAddress,
  nextActionAction,
  onOrderUpdated,
  runAction,
  getErrorMessage,
}: {
  order: OrderDetailItem | null
  orderId: string | undefined
  activeStoreId: string | undefined
  storeShippingAddress: {
    state_id: number | null
    city_id: number | null
    district_id: number | null
    address_line: string
  } | null
  nextActionAction: OrderActionName | null
  onOrderUpdated: (order: OrderDetailItem) => void
  runAction: (action: OrderActionName, payload?: Record<string, string | number | null | undefined>) => Promise<void>
  getErrorMessage: (error: unknown, fallback: string) => string
}) {
  const [shippingDialog, setShippingDialog] = useState<ShippingActionDialogState | null>(null)
  const [shippingOptions, setShippingOptions] = useState<ShippingServiceOption[]>([])
  const [shippingServiceCatalogs, setShippingServiceCatalogs] = useState<ShippingProviderServiceCatalog[]>([])
  const [isShippingOptionsLoading, setIsShippingOptionsLoading] = useState(false)
  const [isSavingShippingOption, setIsSavingShippingOption] = useState(false)
  const [shippingOptionsError, setShippingOptionsError] = useState('')

  const hasStoreShippingAddress =
    Boolean(storeShippingAddress?.state_id) &&
    Boolean(storeShippingAddress?.city_id) &&
    Boolean(storeShippingAddress?.district_id)
  const hasCustomerShippingAddress = hasResolvedAddress(order?.to_address_detail)
  const hasCreatedShipment =
    ['delivering', 'delivered', 'completed', 'returned'].includes(order?.processing_status ?? '') ||
    Boolean(order?.tracking_code?.trim())
  const resolvedWeight = normalizePositiveMeasurement(order?.weight, DEFAULT_SHIPPING_WEIGHT)
  const resolvedLength = normalizePositiveMeasurement(order?.length, DEFAULT_SHIPPING_LENGTH)
  const resolvedWidth = normalizePositiveMeasurement(order?.width, DEFAULT_SHIPPING_WIDTH)
  const resolvedHeight = normalizePositiveMeasurement(order?.height, DEFAULT_SHIPPING_HEIGHT)

  useEffect(() => {
    if (!order || !hasStoreShippingAddress || !hasCustomerShippingAddress || hasCreatedShipment) {
      setShippingOptions([])
      setShippingServiceCatalogs([])
      setShippingOptionsError('')
      setIsShippingOptionsLoading(false)
      return
    }

    let cancelled = false

    const fetchShippingOptions = async () => {
      try {
        setIsShippingOptionsLoading(true)
        setShippingOptionsError('')

        const providersResponse = await shippingApi.listProviders(activeStoreId)
        const connectedProviders = providersResponse.items.filter((item) => item.status.code === 'connected')

        const providerResults = await Promise.all(
          connectedProviders.map(async (provider) => {
            try {
              const servicesResponse = await shippingApi.listAvailableServicesByLocation(provider.code, {
                store_id: activeStoreId,
                from_location: {
                  state_id: storeShippingAddress?.state_id ?? null,
                  city_id: storeShippingAddress?.city_id ?? null,
                  district_id: storeShippingAddress?.district_id ?? null,
                },
                to_location: {
                  address_id: order.to_address_detail?.id ?? null,
                  state_id: order.to_address_detail?.state_id ?? null,
                  city_id: order.to_address_detail?.city_id ?? null,
                  district_id: order.to_address_detail?.district_id ?? null,
                },
                weight: resolvedWeight,
                length: resolvedLength,
                width: resolvedWidth,
                height: resolvedHeight,
                insurance_value: order.insurance_value ? Number(order.insurance_value) : null,
                cod_value: order.cod_amount ? Number(order.cod_amount) : null,
                items: order.order_items.map((item) => ({
                  name: item.product_name,
                  quantity: item.quantity,
                })),
              })
              const availableServiceNames = servicesResponse.items.map((item) => item.short_name)

              return {
                catalog: {
                  providerCode: provider.code,
                  providerDisplayName: provider.display_name,
                  providerLogoUrl: provider.logo_url,
                  services: servicesResponse.items.map((item) => ({
                    serviceId: item.service_id,
                    serviceTypeId: item.service_type_id,
                    serviceName: item.short_name,
                  })),
                } satisfies ShippingProviderServiceCatalog,
                options: servicesResponse.items.map((item) => ({
                  key: buildShippingOptionKey(provider.code, item.service_id, item.service_type_id),
                  providerCode: provider.code,
                  providerDisplayName: provider.display_name,
                  providerLogoUrl: provider.logo_url,
                  serviceId: item.service_id,
                  serviceTypeId: item.service_type_id,
                  serviceName: item.short_name,
                  availableServiceNames,
                  fee: typeof item.fee?.total === 'number' ? Number(item.fee.total) : null,
                  expectedDeliveryTime: item.expected_delivery_time ?? null,
                })) satisfies ShippingServiceOption[],
              }
            } catch (error) {
              console.error(`Khong the tai dich vu van chuyen cho ${provider.code}:`, error)
              return {
                catalog: {
                  providerCode: provider.code,
                  providerDisplayName: provider.display_name,
                  providerLogoUrl: provider.logo_url,
                  services: [],
                } satisfies ShippingProviderServiceCatalog,
                options: [],
              }
            }
          }),
        )

        if (cancelled) {
          return
        }

        const nextCatalogs = providerResults
          .filter((item) => item.catalog.services.length > 0)
          .map((item) => item.catalog)
        const nextOptions = providerResults.flatMap((item) => item.options).sort(compareShippingOptions)

        setShippingServiceCatalogs(nextCatalogs)
        setShippingOptions(nextOptions)

        if (nextCatalogs.length === 0) {
          setShippingOptionsError('Chua lay duoc dich vu van chuyen phu hop cho dia chi hien tai.')
        }
      } catch (error) {
        if (cancelled) {
          return
        }

        console.error('Loi khi tai danh sach dich vu van chuyen:', error)
        setShippingOptions([])
        setShippingServiceCatalogs([])
        setShippingOptionsError('Khong the tai danh sach dich vu van chuyen.')
      } finally {
        if (!cancelled) {
          setIsShippingOptionsLoading(false)
        }
      }
    }

    void fetchShippingOptions()

    return () => {
      cancelled = true
    }
  }, [
    activeStoreId,
    hasCustomerShippingAddress,
    hasCreatedShipment,
    hasStoreShippingAddress,
    order,
    resolvedHeight,
    resolvedLength,
    resolvedWeight,
    resolvedWidth,
    storeShippingAddress,
  ])

  const selectedShippingOptionKey =
    shippingOptions.find(
      (item) =>
        item.serviceId === order?.service_id &&
        item.serviceTypeId === order?.service_type_id &&
        item.providerDisplayName.toLowerCase() ===
          normalizeShippingProviderName(order?.shipping_service).toLowerCase(),
    )?.key ??
    shippingOptions.find(
      (item) => item.serviceId === order?.service_id && item.serviceTypeId === order?.service_type_id,
    )?.key ??
    ''

  const selectedShippingOption =
    shippingOptions.find((item) => item.key === selectedShippingOptionKey) ?? null

  const hasSelectedShippingService =
    Boolean(selectedShippingOption) ||
    Boolean(order?.service_id && order?.service_type_id && order?.shipping_service)

  const requiresSelectedShippingService = nextActionAction === 'push_to_delivery'
  const isNextActionBlockedByShippingService =
    requiresSelectedShippingService && !hasSelectedShippingService

  const handleSelectShippingOption = useCallback(
    async (option: ShippingServiceOption) => {
      if (!orderId || !order) {
        return
      }

      if (
        order.service_id === option.serviceId &&
        order.service_type_id === option.serviceTypeId &&
        normalizeShippingProviderName(order.shipping_service).toLowerCase() ===
          option.providerDisplayName.toLowerCase()
      ) {
        return
      }

      try {
        setIsSavingShippingOption(true)
        const resolvedFee = option.fee

        if (resolvedFee === null) {
          throw new Error('Không thể tính phí cho dịch vụ vận chuyển đã chọn.')
        }

        setShippingOptions((current) =>
          current.map((item) =>
            item.key === option.key ? { ...item, fee: resolvedFee } : item,
          ),
        )

        const updatedOrder = await orderApi.updateOrder(orderId, {
          service_id: option.serviceId,
          service_type_id: option.serviceTypeId,
          shipping_fee: resolvedFee,
          shipping_service: option.providerDisplayName,
        })

        onOrderUpdated(updatedOrder)
        appToast.success(ORDER_TOAST_MESSAGES.shippingServiceUpdated)
      } catch (error) {
        console.error('Lỗi khi cập nhật dịch vụ vận chuyển:', error)
        appToast.error(getErrorMessage(error, 'Không thể cập nhật dịch vụ vận chuyển.'))
      } finally {
        setIsSavingShippingOption(false)
      }
    },
    [getErrorMessage, onOrderUpdated, order, orderId],
  )

  const openShippingActionDialog = useCallback(
    (action: 'push_to_delivery' | 'mark_delivered') => {
      if (!order) {
        return
      }

      const selectedOption =
        shippingOptions.find(
          (item) => item.serviceId === order.service_id && item.serviceTypeId === order.service_type_id,
        ) ?? null
      const nextShippingService =
        selectedOption
          ? selectedOption.providerDisplayName
          : normalizeShippingProviderName(order.shipping_service) || 'GHN'

      setShippingDialog({
        action,
        shippingService: nextShippingService,
        trackingCode: order.tracking_code ?? '',
        shippingStatus:
          action === 'push_to_delivery'
            ? order.shipping_status ?? 'delivering'
            : order.shipping_status ?? 'delivered',
      })
    },
    [order, shippingOptions],
  )

  const submitShippingAction = useCallback(async () => {
    if (!shippingDialog) {
      return
    }

    await runAction(shippingDialog.action, {
      shipping_service: shippingDialog.shippingService.trim(),
      tracking_code: shippingDialog.trackingCode.trim(),
      shipping_status: shippingDialog.shippingStatus.trim(),
    })
    setShippingDialog(null)
  }, [runAction, shippingDialog])

  const updateShippingDialog = useCallback(
    (updater: (current: NonNullable<ShippingActionDialogState>) => NonNullable<ShippingActionDialogState>) => {
      setShippingDialog((current) => (current ? updater(current) : current))
    },
    [],
  )

  return {
    shippingDialog,
    shippingOptions,
    shippingServiceCatalogs,
    isShippingOptionsLoading,
    isSavingShippingOption,
    shippingOptionsError,
    hasStoreShippingAddress,
    hasCustomerShippingAddress,
    selectedShippingOptionKey,
    selectedShippingOption,
    hasSelectedShippingService,
    isNextActionBlockedByShippingService,
    handleSelectShippingOption,
    openShippingActionDialog,
    submitShippingAction,
    updateShippingDialog,
    closeShippingDialog: () => setShippingDialog(null),
  }
}
