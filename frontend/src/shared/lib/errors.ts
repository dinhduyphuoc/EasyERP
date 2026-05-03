export const getErrorMessage = (error: unknown, fallback: string): string => {
  if (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    typeof error.response === 'object' &&
    error.response !== null &&
    'data' in error.response
  ) {
    const data = error.response.data

    if (typeof data === 'string' && data.trim()) {
      return data
    }

    if (typeof data === 'object' && data !== null) {
      if ('message' in data && typeof data.message === 'string' && data.message.trim()) {
        return data.message
      }

      if (
        'error' in data &&
        typeof data.error === 'object' &&
        data.error !== null &&
        'message' in data.error &&
        typeof data.error.message === 'string' &&
        data.error.message.trim()
      ) {
        return data.error.message
      }
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message
  }

  return fallback
}
