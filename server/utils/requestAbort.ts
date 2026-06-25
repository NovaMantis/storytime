import type { H3Event } from 'h3'

export function getRequestAbortSignal(event: H3Event): AbortSignal {
  const controller = new AbortController()
  const req = event.node.req
  const res = event.node.res

  const onAbort = () => {
    if (!res.writableEnded) {
      controller.abort()
    }
  }

  req.on('aborted', onAbort)
  req.on('close', onAbort)
  res.on('finish', () => {
    req.off('aborted', onAbort)
    req.off('close', onAbort)
  })

  return controller.signal
}

export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new Error('Request aborted')
  }
}
