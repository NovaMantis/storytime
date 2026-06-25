export interface ApiErrorResponse {
  error: {
    code: string
    message: string
    details?: unknown
  }
}

export function isAbortError(err: unknown): boolean {
  if (err instanceof DOMException && err.name === 'AbortError') {
    return true
  }
  if (err instanceof Error && err.name === 'AbortError') {
    return true
  }
  return false
}

export function useApi() {
  const toast = useToast()

  async function api<T>(url: string, options?: Parameters<typeof $fetch<T>>[1]): Promise<T> {
    try {
      return await $fetch<T>(url, options)
    } catch (err: unknown) {
      if (isAbortError(err)) {
        throw err
      }
      const data = (err as { data?: ApiErrorResponse })?.data
      const message = data?.error?.message || (err instanceof Error ? err.message : 'Request failed')
      toast.add({
        title: 'Error',
        description: message,
        color: 'error'
      })
      throw err
    }
  }

  return { api }
}
