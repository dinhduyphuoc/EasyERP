import { useEffect, useMemo, useState, type ReactElement } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined'
import {
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  Typography,
} from '@mui/material'
import { customerApi, type LocationItem } from '@/pages/customers/customer.api'
import { appToast } from '@/shared/ui/toast/toast.helpers'
import { borderedCardSx } from '@/shared/ui/paper'
import { useAuth } from '@/modules/auth/use-auth'
import { orderApi, type OrderCreatePayload, type OrderDetailItem, type OrderEditItem, type OrderOptionLookup } from '../api'
import {
  CustomerModal,
  CustomerSection,
  ItemsSection,
  SidebarSections,
} from '../components'
import { useOrderItems, type ItemForm, useOrderForm } from '../hooks'
import {
  buildDuplicateVariantMessage,
  buildOrderSavedMessage,
  getErrorMessage,
  ORDER_TOAST_MESSAGES,
  PaymentInformationCard,
  PAYMENT_METHOD_TYPE_IDS,
  invalidateOrdersCollectionCache,
  formatCurrencyInput,
} from '../lib'
import { generalSettingsApi } from '@/pages/settings/general-settings.api'

type CreateLocationState = {
  duplicateFrom?: OrderDetailItem
}

type ProductSearchOption = OrderOptionLookup['products'][number]

const parseCurrencyValue = (value: string | number | null | undefined): number => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0
  }

  const digits = String(value ?? '').replace(/\D/g, '')
  return Number(digits || '0')
}

const formatStockNumber = (value: number | null | undefined): string => Number(value ?? 0).toLocaleString('vi-VN')

const createItemFromProduct = (product: ProductSearchOption): ItemForm => ({
  variant_sku: product.sku,
  product_id: product.product_id,
  product_name: product.product_name,
  sku: product.sku,
  image_url: product.image_url,
  stock_on_hand: product.stock_on_hand ?? 0,
  stock_available: product.stock_available ?? 0,
  quantity: '1',
  unit_price: formatCurrencyInput(product.selling_price),
  discount_amount: '0',
  notes: '',
  noteOpen: false,
})

export function OrdersCreatePage(): ReactElement {
  const location = useLocation()
  const navigate = useNavigate()
  const params = useParams()
  const { user } = useAuth()
  const orderId = params.id
  const isEditMode = Boolean(orderId)
  const duplicateSource = (location.state as CreateLocationState | null)?.duplicateFrom ?? null

  const [options, setOptions] = useState<OrderOptionLookup | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isCustomerOptionsLoading, setIsCustomerOptionsLoading] = useState(false)
  const [isProductOptionsLoading, setIsProductOptionsLoading] = useState(false)
  const [debouncedCustomerSearch, setDebouncedCustomerSearch] = useState('')
  const [debouncedProductSearch, setDebouncedProductSearch] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [hasAttemptedSave, setHasAttemptedSave] = useState(false)
  const [loadedOrder, setLoadedOrder] = useState<OrderEditItem | null>(null)

  const [orderCode, setOrderCode] = useState('')
  const [orderDate, setOrderDate] = useState(new Date().toISOString().slice(0, 10))
  const [orderType, setOrderType] = useState<'sale' | 'return'>('sale')
  const [processingStatus, setProcessingStatus] = useState<
    'draft' | 'placed' | 'delivering' | 'delivered' | 'completed' | 'cancelled' | 'returned'
  >('placed')
  const [salesChannel, setSalesChannel] = useState('')
  const [states, setStates] = useState<LocationItem[]>([])
  const [isStatesLoading, setIsStatesLoading] = useState(false)
  const [invoiceCode, setInvoiceCode] = useState('')
  const [createdBy, setCreatedBy] = useState(user?.full_name ?? '')
  const [confirmedBy, setConfirmedBy] = useState('')
  const [orderNotes, setOrderNotes] = useState('')
  const [statusTimeline, setStatusTimeline] = useState<Record<string, unknown>>({})
  const {
    itemRows,
    productSearchInput,
    productSearchResetKey,
    selectedItemIndexSet,
    selectedItemCount,
    areAllItemsSelected,
    areSomeItemsSelected,
    replaceItems,
    handleProductSearchChange,
    handleProductSearchSelect,
    updateItem,
    handleToggleItemSelection,
    handleToggleAllItems,
    handleBulkDeleteItems,
  } = useOrderItems<ProductSearchOption>({
    createItemFromProduct,
    parseCurrencyValue,
  })

  const subTotal = useMemo(() => itemRows.reduce((sum, item) => sum + item.subTotal, 0), [itemRows])
  const selectedVariantSkuSet = useMemo(
    () => new Set(itemRows.map((item) => item.variant_sku || item.sku).filter(Boolean)),
    [itemRows],
  )
  const availableProductOptions = useMemo(
    () => (options?.products ?? []).filter((product) => !selectedVariantSkuSet.has(product.sku)),
    [options?.products, selectedVariantSkuSet],
  )

  const {
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
    shippingFee,
    fromContactName,
    fromContactPhone,
    fromAddressLine,
    fromState,
    fromCity,
    fromDistrict,
    toAddressLine,
    toState,
    toCity,
    toDistrict,
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
    orderDiscountAmount,
    setOrderDiscountAmount,
    vatEnabled,
    setVatEnabled,
    vatRatePercent,
    setVatRatePercent,
    paymentMethod,
    setDepositAmount,
    normalizedDiscountAmount,
    normalizedTaxAmount,
    totalAmount,
    normalizedDepositAmount,
    normalizedPaidAmount,
    outstandingAmount,
    paymentValidationErrors,
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
    handlePaymentMethodChange,
  } = useOrderForm({
    options,
    setOptions,
    states,
    setStates,
    hasAttemptedSave,
    subTotal,
    processingStatus,
  })

  useEffect(() => {
    if (user?.full_name && !createdBy.trim()) {
      setCreatedBy(user.full_name)
    }
  }, [createdBy, user?.full_name])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedCustomerSearch(customerSearch.trim())
    }, 250)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [customerSearch])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedProductSearch(productSearchInput.trim())
    }, 250)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [productSearchInput])

  useEffect(() => {
    let isCancelled = false

    const fetchFormData = async () => {
      setIsLoading(true)
      setIsStatesLoading(true)

      try {
        const [optionsData, statesData, storeSettings, orderData] = await Promise.all([
          orderApi.getOrderOptions(),
          customerApi.getStates({ is_active: true }),
          generalSettingsApi.getGeneralSettings(),
          isEditMode && orderId ? orderApi.getOrderForEdit(orderId) : Promise.resolve(null),
        ])

        if (isCancelled) {
          return
        }

        let hydratedOptions = optionsData
        setStates(statesData)

        if (orderData) {
          const preloadSkus = orderData.order_items.map((item) => item.variant_sku ?? item.sku).filter(Boolean)
          const [customerResponse, productResponse] = await Promise.all([
            orderData.customer_id
              ? orderApi.searchCustomers({ ids: String(orderData.customer_id), limit: 20 })
              : Promise.resolve({ items: [] }),
            preloadSkus.length > 0
              ? orderApi.searchProducts({ skus: preloadSkus.join(','), limit: Math.max(preloadSkus.length, 20) })
              : Promise.resolve({ items: [] }),
          ])

          hydratedOptions = {
            ...optionsData,
            customers: customerResponse.items,
            products: productResponse.items,
          }
          setOptions(hydratedOptions)

          if (isCancelled) {
            return
          }

          setLoadedOrder(orderData)
          setOrderCode(orderData.order_code)
          setOrderDate(orderData.order_date.slice(0, 10))
          setOrderType(orderData.order_type)
          setProcessingStatus(orderData.processing_status)
          setSalesChannel(orderData.sales_channel ?? '')
          await applyOrderData(orderData, statesData)
          setInvoiceCode(orderData.invoice_code ?? '')
          setCreatedBy(orderData.created_by ?? user?.full_name ?? '')
          setConfirmedBy(orderData.confirmed_by ?? '')
          setOrderNotes(orderData.order_notes ?? '')
          setStatusTimeline(orderData.status_timeline ?? {})
          const productOptionMap = new Map(hydratedOptions.products.map((product) => [product.sku, product]))

          replaceItems(
            orderData.order_items.length > 0
              ? orderData.order_items.map((item) => {
                  const productOption = productOptionMap.get(item.variant_sku ?? item.sku)

                  return {
                    variant_sku: item.variant_sku ?? '',
                    product_id: item.product_id,
                    product_name: item.product_name,
                    sku: item.sku,
                    image_url: productOption?.image_url ?? null,
                    stock_on_hand: productOption?.stock_on_hand ?? 0,
                    stock_available: productOption?.stock_available ?? 0,
                    quantity: String(item.quantity),
                    unit_price: formatCurrencyInput(item.unit_price),
                    discount_amount: item.discount_amount,
                    notes: item.notes ?? '',
                    noteOpen: Boolean(item.notes),
                  }
                })
              : [],
          )
          return
        }

        if (duplicateSource) {
          const preloadSkus = duplicateSource.order_items.map((item) => item.variant_sku ?? item.sku).filter(Boolean)
          const [customerResponse, productResponse] = await Promise.all([
            duplicateSource.customer_id
              ? orderApi.searchCustomers({ ids: String(duplicateSource.customer_id), limit: 20 })
              : Promise.resolve({ items: [] }),
            preloadSkus.length > 0
              ? orderApi.searchProducts({ skus: preloadSkus.join(','), limit: Math.max(preloadSkus.length, 20) })
              : Promise.resolve({ items: [] }),
          ])

          hydratedOptions = {
            ...optionsData,
            customers: customerResponse.items,
            products: productResponse.items,
          }
          setOptions(hydratedOptions)

          if (isCancelled) {
            return
          }

          setLoadedOrder(null)
          setOrderCode('')
          setOrderDate(new Date().toISOString().slice(0, 10))
          setOrderType(duplicateSource.order_type)
          setProcessingStatus('placed')
          setSalesChannel(duplicateSource.sales_channel ?? '')
          await applyDuplicateOrderData(duplicateSource, statesData)
          setInvoiceCode('')
          setCreatedBy(user?.full_name ?? '')
          setConfirmedBy('')
          setOrderNotes(duplicateSource.order_notes ?? '')
          setStatusTimeline({})
          const productOptionMap = new Map(hydratedOptions.products.map((product) => [product.sku, product]))

          replaceItems(
            duplicateSource.order_items.length > 0
              ? duplicateSource.order_items.map((item) => {
                  const productOption = productOptionMap.get(item.variant_sku ?? item.sku)

                  return {
                    variant_sku: item.variant_sku ?? '',
                    product_id: item.product_id,
                    product_name: item.product_name,
                    sku: item.sku,
                    image_url: productOption?.image_url ?? null,
                    stock_on_hand: productOption?.stock_on_hand ?? 0,
                    stock_available: productOption?.stock_available ?? 0,
                    quantity: String(item.quantity),
                    unit_price: formatCurrencyInput(item.unit_price),
                    discount_amount: item.discount_amount,
                    notes: item.notes ?? '',
                    noteOpen: Boolean(item.notes),
                  }
                })
              : [],
          )
          appToast.info(`Đã sao chép từ đơn hàng ${duplicateSource.order_code}. Bạn đang tạo một bản sao mới.`)
          return
        }

        setOptions(hydratedOptions)

        await applyStoreDefaults({
          shippingAddress: storeSettings.defaults.shipping_address,
          bankAccount: storeSettings.defaults.bank_account,
          vat: storeSettings.defaults.vat,
          statesData,
        })
      } catch (error) {
        if (!isCancelled) {
          console.error('Lỗi khi tải dữ liệu đơn hàng:', error)
          appToast.error(getErrorMessage(error, 'Không thể tải dữ liệu đơn hàng.'))
        }
      } finally {
        if (!isCancelled) {
          setIsStatesLoading(false)
          setIsLoading(false)
        }
      }
    }

    void fetchFormData()

    return () => {
      isCancelled = true
    }
  }, [applyDuplicateOrderData, applyOrderData, applyStoreDefaults, duplicateSource, isEditMode, orderId, user?.full_name])

  useEffect(() => {
    if (!options) {
      return
    }

    let isCancelled = false

    const fetchCustomerOptions = async () => {
      try {
        setIsCustomerOptionsLoading(true)
        const keyword = debouncedCustomerSearch
        const response = await orderApi.searchCustomers({
          ...(customerId && hasSelectedCustomer ? { ids: String(customerId) } : keyword ? { search: keyword } : {}),
          limit: 20,
        })

        if (isCancelled) {
          return
        }

        setOptions((current) =>
          current
            ? {
                ...current,
                customers: response.items,
              }
            : current,
        )
      } catch (error) {
        if (!isCancelled) {
          console.error('Lỗi khi tải gợi ý khách hàng:', error)
        }
      } finally {
        if (!isCancelled) {
          setIsCustomerOptionsLoading(false)
        }
      }
    }

    void fetchCustomerOptions()

    return () => {
      isCancelled = true
    }
  }, [customerId, debouncedCustomerSearch, hasSelectedCustomer, Boolean(options)])

  useEffect(() => {
    if (!options) {
      return
    }

    let isCancelled = false

    const fetchProductOptions = async () => {
      try {
        setIsProductOptionsLoading(true)
        const selectedSkus = itemRows.map((item) => item.variant_sku || item.sku).filter(Boolean)
        const keyword = debouncedProductSearch
        const response = await orderApi.searchProducts({
          ...(keyword ? { search: keyword } : {}),
          ...(selectedSkus.length > 0 && !keyword ? { skus: selectedSkus.join(',') } : {}),
          limit: selectedSkus.length > 0 && !keyword ? Math.max(selectedSkus.length, 20) : 20,
        })

        if (isCancelled) {
          return
        }

        setOptions((current) =>
          current
            ? {
                ...current,
                products: response.items,
              }
            : current,
        )
      } catch (error) {
        if (!isCancelled) {
          console.error('Lỗi khi tải gợi ý sản phẩm:', error)
        }
      } finally {
        if (!isCancelled) {
          setIsProductOptionsLoading(false)
        }
      }
    }

    void fetchProductOptions()

    return () => {
      isCancelled = true
    }
  }, [debouncedProductSearch, itemRows, Boolean(options)])

  const errors = useMemo(() => {
    const nextErrors: Record<string, string> = {}

    if (!customerName.trim()) {
      nextErrors.customer_name = 'Tên khách hàng là bắt buộc.'
    }

    if (!customerPhone.trim()) {
      nextErrors.customer_phone = 'Số điện thoại là bắt buộc.'
    }

    const validItems = itemRows.filter((item) => item.product_name.trim() || item.sku.trim())

    if (processingStatus !== 'draft' && validItems.length === 0) {
      nextErrors.order_items = 'Đơn hàng cần ít nhất một sản phẩm.'
    }

    if (
      processingStatus !== 'draft' &&
      validItems.some((item) => !item.product_name.trim() || !item.sku.trim() || Number(item.quantity) <= 0)
    ) {
      nextErrors.order_items = 'Mỗi dòng sản phẩm cần có tên, SKU và số lượng hợp lệ.'
    }

    return {
      ...nextErrors,
      ...paymentValidationErrors,
    }
  }, [
    customerName,
    customerPhone,
    itemRows,
    paymentValidationErrors,
    processingStatus,
  ])
  const visibleErrors = hasAttemptedSave ? errors : {}
  const canSave = !isLoading && !isSaving && Object.keys(errors).length === 0
  const canEditOrder = !isEditMode || !loadedOrder || ['draft', 'placed'].includes(loadedOrder.processing_status)

  const buildStatusTimeline = (): Record<string, string> => {
    const stages = ['created', 'placed', 'delivering', 'delivered', 'completed']
    const currentStageMap: Record<string, number> = {
      draft: 0,
      placed: 1,
      delivering: 2,
      delivered: 3,
      completed: 4,
      cancelled: 4,
      returned: 4,
    }
    const currentIndex = currentStageMap[processingStatus]
    const createdAt = new Date(orderDate).toISOString()

    return stages.reduce<Record<string, string>>((accumulator, stage, index) => {
      if (index <= currentIndex) {
        accumulator[stage] = createdAt
      }

      return accumulator
    }, {})
  }

  const handleSave = async () => {
    setHasAttemptedSave(true)

    if (!canSave) {
      appToast.warning(ORDER_TOAST_MESSAGES.invalidOrderBeforeSave)
      return
    }

    if (
      vatChangedByUser && 
      !window.confirm('Thay đổi VAT sẽ thể ảnh hưởng đến đơn hàng hiện tại. Bạn có chắc chắn muốn tiếp tục?.')
    ) {
      return
    }

    setIsSaving(true)

    try {
      const payload: OrderCreatePayload = {
        order_type: orderType,
        order_date: new Date(orderDate).toISOString(),
        customer_id: customerId ? Number(customerId) : null,
        payment_type_id: paymentMethod === 'unpaid' ? null : PAYMENT_METHOD_TYPE_IDS[paymentMethod],
        customer_info: {
          customer_code: customerCode.trim() || null,
          name: customerName.trim(),
          phone: customerPhone.trim(),
          address:
            [
              toAddressLine.trim(),
              toDistrict?.name ?? null,
              toCity?.name ?? null,
              toState?.name ?? null,
            ]
              .filter(Boolean)
              .join(', ') || customerAddress.trim() || null,
        },
        from_address_detail:
          fromState && fromCity && fromAddressLine.trim()
            ? {
                state_id: fromState.id,
                city_id: fromCity.id,
                district_id: fromDistrict?.id ?? null,
                address_line: fromAddressLine.trim() || null,
              }
            : null,
        to_address_detail:
          toState && toCity && (toAddressLine.trim() || customerAddress.trim())
            ? {
                state_id: toState.id,
                city_id: toCity.id,
                district_id: toDistrict?.id ?? null,
                address_line: toAddressLine.trim() || customerAddress.trim() || null,
              }
            : null,
        from_name: fromContactName.trim() || null,
        from_phone: fromContactPhone.trim() || null,
        from_address: fromAddressLine.trim() || null,
        from_ward_name: fromDistrict?.name ?? null,
        from_district_name: fromCity?.name ?? null,
        from_province_name: fromState?.name ?? null,
        cod_amount: Number(codAmount || 0),
        content: parcelContent.trim() || null,
        weight: Number(parcelWeight || 0) || null,
        length: Number(parcelLength || 0) || null,
        width: Number(parcelWidth || 0) || null,
        height: Number(parcelHeight || 0) || null,
        insurance_value: Number(insuranceValue || 0),
        service_id: serviceId,
        service_type_id: serviceTypeId,
        discount_amount: normalizedDiscountAmount,
        vat_enabled: vatEnabled,
        tax_amount: normalizedTaxAmount,
        vat_rate_percent: vatEnabled ? Number(vatRatePercent || 0) : 0,
        vat_changed_by_user: vatChangedByUser,
        shipping_fee: Number(shippingFee || 0),
        deposit_amount: derivedPaymentStatus === 'deposit' ? normalizedPaidAmount : 0,
        paid_amount: normalizedPaidAmount,
        payment_status: derivedPaymentStatus,
        processing_status: processingStatus,
        shipping_service: shippingService.trim() || null,
        sales_channel: salesChannel.trim() || null,
        order_notes: orderNotes.trim() || null,
        payment_notes: buildPaymentNote(),
        warehouse_status: warehouseStatus.trim() || null,
        tracking_code: trackingCode.trim() || null,
        shipping_status: shippingStatus.trim() || null,
        invoice_code: invoiceCode.trim() || null,
        created_by: createdBy.trim() || null,
        confirmed_by: confirmedBy.trim() || null,
        status_timeline: isEditMode ? statusTimeline : buildStatusTimeline(),
        order_items: itemRows
          .filter((item) => item.product_name.trim() || item.sku.trim())
          .map((item) => ({
            product_id: item.product_id,
            variant_sku: item.variant_sku || null,
            product_name: item.product_name.trim(),
            sku: item.sku.trim(),
            quantity: Number(item.quantity),
            unit_price: parseCurrencyValue(item.unit_price),
            discount_amount: Number(item.discount_amount || 0),
            notes: item.notes.trim() || undefined,
          })),
      }

      if (orderCode.trim()) {
        payload.order_code = orderCode.trim()
      }

      const order =
        isEditMode && orderId ? await orderApi.updateOrder(orderId, payload) : await orderApi.createOrder(payload)

      appToast.success(buildOrderSavedMessage(order.order_code, isEditMode))
      invalidateOrdersCollectionCache('all')
      invalidateOrdersCollectionCache('drafts')
      invalidateOrdersCollectionCache('returns')
      invalidateOrdersCollectionCache('cancelled')
      invalidateOrdersCollectionCache('incomplete')
      navigate(`/orders/${order.id}`)
    } catch (error) {
      console.error('Lỗi khi tạo đơn hàng:', error)
      appToast.error(
        getErrorMessage(
          error,
          isEditMode ? 'Không thể cập nhật đơn hàng. Vui lòng thử lại.' : 'Không thể tạo đơn hàng. Vui lòng thử lại.',
        ),
      )
    } finally {
      setIsSaving(false)
    }
  }

  const handleProductSelect = (product: ProductSearchOption | null) => {
    if (!product) {
      handleProductSearchSelect(null)
      return
    }

    if (selectedVariantSkuSet.has(product.sku)) {
      appToast.warning(buildDuplicateVariantMessage(product.sku))
      return
    }

    handleProductSearchSelect(product)
  }

  return (
    <Box sx={{ px: { xs: 2, md: 3, xl: 4 }, pb: 8 }}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={2}
          sx={{ marginBottom: 2, justifyContent: 'space-between', alignItems: { md: 'center' } }}
        >
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
            <Paper onClick={() => (navigate('/orders'))} sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              p: 1
            }}>
              <ArrowBackIcon sx={{color: '#344054' }} />
            </Paper>
            <Typography variant="h5" sx={{ fontWeight: 600, color: '#0f172a' }}>
              {isEditMode ? 'Chỉnh sửa đơn hàng' : duplicateSource ? 'Sao chép đơn hàng' : 'Tạo đơn hàng'}
            </Typography>
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <Button
              variant="contained"
              color="secondary"
              startIcon={isSaving ? <CircularProgress size={16} color="inherit" /> : <SaveOutlinedIcon />}
              onClick={() => void handleSave()}
              disabled={!canSave || !canEditOrder}
            >
              Lưu
            </Button>
          </Stack>
        </Stack>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 6fr) minmax(320px, 4fr)' },
          gap: 2.5,
          alignItems: 'start',
        }}
      >
        <Stack spacing={2.5}>
          <Paper sx={borderedCardSx}>
            <CustomerSection
              hasSelectedCustomer={hasSelectedCustomer}
              customerName={customerName}
              customerPhone={customerPhone}
              customerCode={customerCode}
              customerAddress={customerAddress}
              customerSearch={customerSearch}
              customerSearchOptions={customerSearchOptions}
              outstandingAmount={outstandingAmount}
              isLoading={isLoading || isCustomerOptionsLoading}
              customerNameError={visibleErrors.customer_name}
              customerPhoneError={visibleErrors.customer_phone}
              onCustomerSearchChange={setCustomerSearch}
              onCreateCustomer={handleOpenCreateCustomerModal}
              onEditCustomer={handleOpenEditCustomerModal}
              onClearCustomer={handleClearCustomer}
              onSelectCustomer={handleCustomerSelect}
            />
          </Paper>

          <ItemsSection
            productSearchResetKey={productSearchResetKey}
            productOptions={availableProductOptions}
            productSearchInput={productSearchInput}
            isLoading={isLoading || isProductOptionsLoading}
            orderItemsError={visibleErrors.order_items}
            selectedItemCount={selectedItemCount}
            areAllItemsSelected={areAllItemsSelected}
            areSomeItemsSelected={areSomeItemsSelected}
            itemRows={itemRows}
            selectedItemIndexSet={selectedItemIndexSet}
            onProductSearchChange={handleProductSearchChange}
            onProductSelect={handleProductSelect}
            onBulkDeleteItems={handleBulkDeleteItems}
            onToggleAllItems={handleToggleAllItems}
            onToggleItemSelection={handleToggleItemSelection}
            onUpdateItem={updateItem}
            formatStockNumber={formatStockNumber}
          />

          <PaymentInformationCard
            renderVatToggleOnly
            itemCount={itemRows.length}
            canEdit={canEditOrder}
            paymentMethod={paymentMethod}
            onPaymentStatusChange={setPaymentStatus}
            discountAmount={orderDiscountAmount}
            taxAmount={normalizedTaxAmount}
            subTotal={subTotal}
            shippingFee={Number(shippingFee || 0)}
            totalAmount={totalAmount}
            depositAmount={normalizedDepositAmount}
            vatEnabled={vatEnabled}
            vatRatePercent={Number(vatRatePercent || 0)}
            errors={visibleErrors}
            onPaymentMethodChange={handlePaymentMethodChange}
            onDiscountAmountChange={setOrderDiscountAmount}
            onDepositAmountChange={setDepositAmount}
            onVatEnabledChange={setVatEnabled}
            onVatRatePercentChange={setVatRatePercent}
          />
        </Stack>

        <SidebarSections
          orderCode={orderCode}
          orderDate={orderDate}
          orderType={orderType}
          processingStatus={processingStatus}
          salesChannel={salesChannel}
          orderNotes={orderNotes}
          processingStatusOptions={options?.processing_statuses ?? []}
          processingStatusError={visibleErrors.processing_status}
          onOrderCodeChange={setOrderCode}
          onOrderDateChange={setOrderDate}
          onOrderTypeChange={setOrderType}
          onProcessingStatusChange={setProcessingStatus}
          onSalesChannelChange={setSalesChannel}
          onOrderNotesChange={setOrderNotes}
        />
      </Box>

      <CustomerModal
        open={customerModalOpen}
        mode={customerModalMode}
        form={customerModalForm}
        states={states}
        cities={cities}
        districts={districts}
        isStatesLoading={isStatesLoading}
        isCitiesLoading={isCitiesLoading}
        isDistrictsLoading={isDistrictsLoading}
        isSaving={isCustomerModalSaving}
        onClose={handleCloseCustomerModal}
        onSave={() => void handleSaveCustomerModal()}
        onFieldChange={handleCustomerModalFieldChange}
        onDefaultAddressChange={handleCustomerModalDefaultAddressChange}
        onStateChange={handleCustomerModalStateChange}
        onCityChange={handleCustomerModalCityChange}
        onDistrictChange={handleCustomerModalDistrictChange}
      />

    </Box>
  )
}
