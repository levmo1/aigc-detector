export type AppErrorCode =
  | 'TEXT_REQUIRED'
  | 'INVALID_REQUEST'
  | 'MULTIPLE_INPUTS'
  | 'TEXT_TOO_SHORT'
  | 'TEXT_TOO_LONG'
  | 'FILE_REQUIRED'
  | 'FILE_TOO_LARGE'
  | 'UNSUPPORTED_FILE'
  | 'FILE_SIGNATURE_INVALID'
  | 'PDF_TOO_MANY_PAGES'
  | 'PDF_TEXT_EMPTY'
  | 'PDF_PAGE_RENDER_UNSUPPORTED'
  | 'INVALID_TASK_ID'
  | 'TASK_NOT_FOUND'
  | 'TASK_NOT_READY'
  | 'DETECTOR_UNAVAILABLE'
  | 'INVALID_EXPORT_FORMAT'
  | 'INVALID_RULES'
  | 'INVALID_LLM_CONFIG'
  | 'INVALID_HISTORY_CONFIG'
  | 'RATE_LIMITED'
  | 'QUEUE_FULL'
  | 'EXPORT_BUSY'
  | 'EXPORT_TIMEOUT'
  | 'PDF_FONT_MISSING'
  | 'INTERNAL_ERROR'

export class AppError extends Error {
  constructor(
    public readonly code: AppErrorCode,
    message: string,
    public readonly status = 400,
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error

  return new AppError('INTERNAL_ERROR', '处理失败，请稍后重试。', 500)
}

export function errorResponse(error: unknown): Response {
  const appError = toAppError(error)

  return Response.json(
    { error: { code: appError.code, message: appError.message } },
    { status: appError.status },
  )
}
