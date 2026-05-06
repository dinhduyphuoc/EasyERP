import type { CompanyData, FirstUserData } from '@/modules/setup/setup.types'

export type OnboardingFieldErrors = {
  firstUser: {
    fullName?: string
    email?: string
    password?: string
  }
  company: {
    name?: string
  }
}

export const createEmptyOnboardingErrors = (): OnboardingFieldErrors => ({
  firstUser: {},
  company: {},
})

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/

export function validateEmailField(value: string): string | undefined {
  if (!value.trim()) {
    return 'Vui lòng nhập email.'
  }

  if (!isValidEmail(value.trim())) {
    return 'Email chưa đúng định dạng.'
  }

  return undefined
}

export function validatePasswordField(value: string): string | undefined {
  if (!value) {
    return 'Vui lòng nhập mật khẩu.'
  }

  if (!PASSWORD_RULE.test(value)) {
    return 'Mật khẩu phải có ít nhất 8 ký tự, gồm chữ thường, chữ hoa, số và ký tự đặc biệt.'
  }

  return undefined
}

export function validateFirstUserStep(data: FirstUserData): OnboardingFieldErrors['firstUser'] {
  const errors: OnboardingFieldErrors['firstUser'] = {}

  if (!data.fullName.trim()) {
    errors.fullName = 'Vui lòng nhập họ tên.'
  }

  const emailError = validateEmailField(data.email)
  if (emailError) {
    errors.email = emailError
  }

  const passwordError = validatePasswordField(data.password)
  if (passwordError) {
    errors.password = passwordError
  }

  return errors
}

export function validateCompanyStep(data: CompanyData): OnboardingFieldErrors['company'] {
  const errors: OnboardingFieldErrors['company'] = {}

  if (!data.name.trim()) {
    errors.name = 'Vui lòng nhập tên công ty.'
  }

  return errors
}
