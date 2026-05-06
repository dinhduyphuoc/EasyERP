import { apiClient } from '@/api/api-client'
import type {
  InitialSetupResponse,
  OnboardingFormData,
  SetupStatusResponse,
} from '@/modules/setup/setup.types'

export const setupApi = {
  getStatus() {
    return apiClient.get<never, SetupStatusResponse>('/setup/status')
  },

  initialize(payload: OnboardingFormData) {
    const formData = new FormData()
    formData.append(
      'payload',
      JSON.stringify({
        firstUser: {
          fullName: payload.firstUser.fullName,
          email: payload.firstUser.email,
          password: payload.firstUser.password,
        },
        company: {
          name: payload.company.name,
          abbreviation: payload.company.abbreviation || null,
        },
      }),
    )

    if (payload.firstUser.avatar) {
      formData.append('firstUserAvatar', payload.firstUser.avatar)
    }

    if (payload.company.logo) {
      formData.append('companyLogo', payload.company.logo)
    }

    return apiClient.post<never, InitialSetupResponse>('/setup/initial', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
  },
}
