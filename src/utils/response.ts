import { ApiResponse } from '@/types';

/**
 * Create a successful API response
 */
export function successResponse<T>(data: T, message?: string): ApiResponse<T> {
  return {
    success: true,
    data,
  };
}

/**
 * Create an error API response
 */
export function errorResponse(
  code: string,
  message: string,
  details?: Record<string, any>
): ApiResponse {
  return {
    success: false,
    error: {
      code,
      message,
      ...(details && { details }),
    },
  };
}

/**
 * Common error responses
 */
export const Errors = {
  BAD_REQUEST: (message: string = 'Bad Request') =>
    errorResponse('BAD_REQUEST', message),

  UNAUTHORIZED: (message: string = 'Unauthorized') =>
    errorResponse('UNAUTHORIZED', message),

  FORBIDDEN: (message: string = 'Forbidden') =>
    errorResponse('FORBIDDEN', message),

  NOT_FOUND: (resource: string) =>
    errorResponse('NOT_FOUND', `${resource} not found`),

  CONFLICT: (message: string = 'Conflict') =>
    errorResponse('CONFLICT', message),

  RATE_LIMIT: () =>
    errorResponse(
      'RATE_LIMIT',
      'Too many requests. Please try again later.'
    ),

  INTERNAL_ERROR: (message: string = 'Internal Server Error') =>
    errorResponse('INTERNAL_ERROR', message),

  DATABASE_ERROR: (message: string = 'Database error') =>
    errorResponse('DATABASE_ERROR', message),

  VALIDATION_ERROR: (details: Record<string, any>) =>
    errorResponse('VALIDATION_ERROR', 'Validation failed', details),

  EXPIRED: (resource: string) =>
    errorResponse('EXPIRED', `${resource} has expired`),

  INVALID_CREDENTIALS: () =>
    errorResponse('INVALID_CREDENTIALS', 'Invalid API credentials'),
};
