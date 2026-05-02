export const getErrorMessage = (error: unknown, fallback: string): string => {
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
    if (
      'message' in error.response.data &&
      typeof error.response.data.message === 'string' &&
      error.response.data.message.trim()
    ) {
      return error.response.data.message
    }

    if (
      'error' in error.response.data &&
      typeof error.response.data.error === 'object' &&
      error.response.data.error !== null &&
      'message' in error.response.data.error &&
      typeof error.response.data.error.message === 'string' &&
      error.response.data.error.message.trim()
    ) {
      return error.response.data.error.message
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message
  }

  return fallback
}
