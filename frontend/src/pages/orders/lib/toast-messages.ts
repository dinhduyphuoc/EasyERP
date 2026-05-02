export const ORDER_TOAST_MESSAGES = {
  missingOrderForShipping: 'Không tìm thấy dữ liệu đơn hàng để lên đơn vận chuyển.',
  printPopupBlocked: 'Trình duyệt đã chặn cửa sổ in. Hãy cho phép pop-up để xuất packing slip.',
  copiedTransferInfo: 'Đã copy thông tin chuyển khoản.',
  copyTransferInfoFailed: 'Không thể copy thông tin chuyển khoản trên trình duyệt này.',
  invalidShippingMeasurements: 'Vui lòng nhập khối lượng và kích thước lớn hơn 0.',
  shippingMeasurementsUpdated: 'Đã cập nhật khối lượng và kích thước đơn hàng.',
  invalidPaymentAmount: 'Vui lòng nhập số tiền thanh toán lớn hơn 0.',
  paymentAmountExceedsRemaining: 'Số tiền thu không được lớn hơn số tiền còn lại.',
  confirmPaidNoteRequired: 'Vui lòng nhập ghi chú xác nhận đã thu đủ tiền.',
  customerNamePhoneRequired: 'Vui lòng nhập họ tên và số điện thoại khách hàng.',
  invalidOrderBeforeSave: 'Vui lòng kiểm tra lại thông tin trước khi lưu đơn hàng.',
  customerInfoUpdatedOnOrder: 'Đã cập nhật thông tin khách hàng trên đơn hàng.',
  customerCreated: 'Tạo khách hàng thành công.',
  invalidPaymentConfig: 'Vui lòng kiểm tra lại thông tin thanh toán trước khi lưu.',
  shippingServiceUpdated: 'Đã cập nhật dịch vụ vận chuyển cho đơn hàng.',
} as const

export const buildMissingShippingFieldsMessage = (fields: string[]): string =>
  `Chưa thể lên đơn vận chuyển. Thiếu: ${fields.join(', ')}.`

export const buildDuplicatedOrderMessage = (duplicatedOrderCode: string, sourceOrderCode: string): string =>
  `Đã tạo bản sao ${duplicatedOrderCode} từ đơn ${sourceOrderCode}.`

export const buildOrderUpdatedMessage = (orderCode: string): string => `Đã cập nhật đơn hàng ${orderCode}.`

export const buildOrderSavedMessage = (orderCode: string, isEditMode: boolean): string =>
  isEditMode ? `Cập nhật đơn hàng ${orderCode} thành công.` : `Tạo đơn hàng ${orderCode} thành công.`

export const buildDuplicateVariantMessage = (sku: string): string => `Biến thể ${sku} đã có trong đơn hàng.`

export const buildPaymentRecordedMessage = (orderCode: string): string => `Đã ghi nhận thanh toán cho đơn ${orderCode}.`

export const buildConfirmPaidSuccessMessage = (orderCode: string): string =>
  `Đã xác nhận thu đủ tiền cho đơn ${orderCode}.`

export const buildCustomerUpdatedMessage = (orderCode: string): string =>
  `Đã cập nhật khách hàng cho đơn ${orderCode}.`

export const buildPaymentConfigUpdatedMessage = (orderCode: string): string =>
  `Đã cập nhật thanh toán cho đơn ${orderCode}.`
