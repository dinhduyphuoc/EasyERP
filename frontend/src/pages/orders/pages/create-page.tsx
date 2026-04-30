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
import { orderApi, type OrderCreatePayload, type OrderListItem, type OrderOptionLookup } from '../api'
import {
  CustomerModal,
  CustomerSection,
  ItemsSection,
  ShippingSection,
  SidebarSections,
} from '../components'
import { useOrderItems, type ItemForm, useOrderForm } from '../hooks'
import { PaymentInformationCard, PAYMENT_METHOD_TYPE_IDS, invalidateOrdersCollectionCache, formatCurrencyInput } from '../lib'
import { generalSettingsApi } from '@/pages/settings/general-settings.api'

type CreateLocationState = {
  duplicateFrom?: OrderListItem
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

const getErrorMessage = (error: unknown, fallback: string) => {
  if (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    typeof error.response === 'object' &&
    error.response !== null &&
    'data' in error.response &&
    typeof error.response.data === 'object' &&
    error.response.data !== null
  ) {
    if ('message' in error.response.data && typeof error.response.data.message === 'string') {
      return error.response.data.message
    }

    if (
      'error' in error.response.data &&
      typeof error.response.data.error === 'object' &&
      error.response.data.error !== null &&
      'message' in error.response.data.error &&
      typeof error.response.data.error.message === 'string'
    ) {
      return error.response.data.error.message
    }
  }

  return fallback
}

export function OrdersCreatePage(): ReactElement {
  const location = useLocation()
  const navigate = useNavigate()
  const params = useParams()
  const { user, hasPermission } = useAuth()
  const orderId = params.id
  const isEditMode = Boolean(orderId)
  const duplicateSource = (location.state as CreateLocationState | null)?.duplicateFrom ?? null

  const [options, setOptions] = useState<OrderOptionLookup | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [hasAttemptedSave, setHasAttemptedSave] = useState(false)
  const [loadedOrder, setLoadedOrder] = useState<OrderListItem | null>(null)

  const [orderCode, setOrderCode] = useState('')
  const [orderDate, setOrderDate] = useState(new Date().toISOString().slice(0, 10))
  const [orderType, setOrderType] = useState<'sale' | 'return'>('sale')
  const [processingStatus, setProcessingStatus] = useState<
    'draft' | 'placed' | 'confirmed' | 'picked_up' | 'delivering' | 'completed' | 'cancelled' | 'returned'
  >('draft')
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
    setShippingService,
    shippingFee,
    setShippingFee,
    fromContactName,
    setFromContactName,
    fromContactPhone,
    setFromContactPhone,
    fromAddressLine,
    setFromAddressLine,
    fromState,
    fromCity,
    fromDistrict,
    toAddressLine,
    setToAddressLine,
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
    setParcelWeight,
    parcelLength,
    setParcelLength,
    parcelWidth,
    setParcelWidth,
    parcelHeight,
    setParcelHeight,
    insuranceValue,
    setInsuranceValue,
    codAmount,
    setCodAmount,
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
    handleFromStateChange,
    handleFromCityChange,
    handleFromDistrictChange,
    handleToStateChange,
    handleToCityChange,
    handleToDistrictChange,
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
    const fetchFormData = async () => {
      setIsLoading(true)
      setIsStatesLoading(true)

      try {
        const [optionsData, statesData, storeSettings, orderData] = await Promise.all([
          orderApi.getOrderOptions(),
          customerApi.getStates({ is_active: true }),
          generalSettingsApi.getGeneralSettings(),
          isEditMode && orderId ? orderApi.getOrderById(orderId) : Promise.resolve(null),
        ])

        setOptions(optionsData)
        setStates(statesData)

        if (orderData) {
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
          const productOptionMap = new Map(optionsData.products.map((product) => [product.sku, product]))

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
          setLoadedOrder(null)
          setOrderCode('')
          setOrderDate(new Date().toISOString().slice(0, 10))
          setOrderType(duplicateSource.order_type)
          setProcessingStatus('draft')
          setSalesChannel(duplicateSource.sales_channel ?? '')
          await applyDuplicateOrderData(duplicateSource, statesData)
          setInvoiceCode('')
          setCreatedBy(user?.full_name ?? '')
          setConfirmedBy('')
          setOrderNotes(duplicateSource.order_notes ?? '')
          setStatusTimeline({})
          const productOptionMap = new Map(optionsData.products.map((product) => [product.sku, product]))

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

        await applyStoreDefaults({
          shippingAddress: storeSettings.defaults.shipping_address,
          bankAccount: storeSettings.defaults.bank_account,
          statesData,
        })
      } catch (error) {
        console.error('Lỗi khi tải dữ liệu đơn hàng:', error)
        appToast.error(getErrorMessage(error, 'Không thể tải dữ liệu đơn hàng.'))
      } finally {
        setIsStatesLoading(false)
        setIsLoading(false)
      }
    }

    void fetchFormData()
  }, [applyDuplicateOrderData, applyOrderData, applyStoreDefaults, duplicateSource, isEditMode, orderId, user?.full_name])

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
  const canEditVat = hasPermission('orders.vat.update')

  const buildStatusTimeline = (): Record<string, string> => {
    const stages = ['placed', 'confirmed', 'picked_up', 'delivering', 'completed']
    const currentStageMap: Record<string, number> = {
      draft: -1,
      placed: 0,
      confirmed: 1,
      picked_up: 2,
      delivering: 3,
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
      appToast.warning('Vui lòng kiểm tra lại thông tin trước khi lưu đơn hàng.')
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
        to_district_id: null,
        to_ward_code: null,
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

      appToast.success(
        isEditMode ? `Cập nhật đơn hàng ${order.order_code} thành công.` : `Tạo đơn hàng ${order.order_code} thành công.`,
      )
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
              isLoading={isLoading}
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
            productOptions={options?.products ?? []}
            productSearchInput={productSearchInput}
            isLoading={isLoading}
            orderItemsError={visibleErrors.order_items}
            selectedItemCount={selectedItemCount}
            areAllItemsSelected={areAllItemsSelected}
            areSomeItemsSelected={areSomeItemsSelected}
            itemRows={itemRows}
            selectedItemIndexSet={selectedItemIndexSet}
            onProductSearchChange={handleProductSearchChange}
            onProductSelect={handleProductSearchSelect}
            onBulkDeleteItems={handleBulkDeleteItems}
            onToggleAllItems={handleToggleAllItems}
            onToggleItemSelection={handleToggleItemSelection}
            onUpdateItem={updateItem}
            formatStockNumber={formatStockNumber}
          />

          <ShippingSection
            customerName={customerName}
            customerPhone={customerPhone}
            shippingService={shippingService}
            shippingFee={shippingFee}
            fromContactName={fromContactName}
            fromContactPhone={fromContactPhone}
            fromAddressLine={fromAddressLine}
            fromState={fromState}
            fromCity={fromCity}
            fromDistrict={fromDistrict}
            fromCities={fromCities}
            fromDistricts={fromDistricts}
            isFromCitiesLoading={isFromCitiesLoading}
            isFromDistrictsLoading={isFromDistrictsLoading}
            toAddressLine={toAddressLine}
            toState={toState}
            toCity={toCity}
            toDistrict={toDistrict}
            toCities={toCities}
            toDistricts={toDistricts}
            isToCitiesLoading={isToCitiesLoading}
            isToDistrictsLoading={isToDistrictsLoading}
            parcelContent={parcelContent}
            parcelWeight={parcelWeight}
            parcelLength={parcelLength}
            parcelWidth={parcelWidth}
            parcelHeight={parcelHeight}
            insuranceValue={insuranceValue}
            codAmount={codAmount}
            warehouseStatus={warehouseStatus}
            trackingCode={trackingCode}
            shippingStatus={shippingStatus}
            states={states}
            onShippingServiceChange={setShippingService}
            onShippingFeeChange={setShippingFee}
            onFromContactNameChange={setFromContactName}
            onFromContactPhoneChange={setFromContactPhone}
            onFromAddressLineChange={setFromAddressLine}
            onFromStateChange={handleFromStateChange}
            onFromCityChange={handleFromCityChange}
            onFromDistrictChange={handleFromDistrictChange}
            onToAddressLineChange={setToAddressLine}
            onToStateChange={handleToStateChange}
            onToCityChange={handleToCityChange}
            onToDistrictChange={handleToDistrictChange}
            onParcelContentChange={setParcelContent}
            onParcelWeightChange={setParcelWeight}
            onParcelLengthChange={setParcelLength}
            onParcelWidthChange={setParcelWidth}
            onParcelHeightChange={setParcelHeight}
            onInsuranceValueChange={setInsuranceValue}
            onCodAmountChange={setCodAmount}
            onWarehouseStatusChange={setWarehouseStatus}
            onTrackingCodeChange={setTrackingCode}
            onShippingStatusChange={setShippingStatus}
          />

          <PaymentInformationCard
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
            canEditVat={canEditVat}
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


