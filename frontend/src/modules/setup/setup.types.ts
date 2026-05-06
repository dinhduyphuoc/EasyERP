export type SetupStatusResponse = {
  setupCompleted: boolean
  hasFirstUser: boolean
  hasAdminUser: boolean
  hasTenant: boolean
  hasStore: boolean
}

export type FirstUserData = {
  avatar: File | null
  fullName: string
  email: string
  password: string
}

export type CompanyData = {
  logo: File | null
  name: string
  abbreviation: string
}

export type OnboardingFormData = {
  firstUser: FirstUserData
  company: CompanyData
}

export type InitialSetupResponse = {
  success: boolean
  setupCompleted: boolean
  redirectTo: string
  message: string
}
