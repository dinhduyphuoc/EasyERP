export function formatNumber(value: string | number | null | undefined): string {
  const numericValue = Number(value ?? 0)

  if (!Number.isFinite(numericValue)) {
    return '0'
  }

  return numericValue.toLocaleString('vi-VN')
}

export function formatCurrency(
  value: string | number | null | undefined,
  options?: {
    suffix?: string
  },
): string {
  const suffix = options?.suffix ?? 'đ'
  return `${formatNumber(value)} ${suffix}`
}

export function formatCurrencyInput(
  value: string | number | null | undefined,
  options?: {
    zeroAsEmpty?: boolean
  },
): string {
  const digits = String(value ?? '').replace(/\D/g, '')
  const numericValue = Number(digits || '0')

  if (options?.zeroAsEmpty !== false && numericValue <= 0) {
    return ''
  }

  return numericValue.toLocaleString('vi-VN')
}
