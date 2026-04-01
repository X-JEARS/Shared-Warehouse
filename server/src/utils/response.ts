import { Response } from 'express';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export const success = <T>(res: Response, data: T, message?: string, statusCode: number = 200) => {
  const response: ApiResponse<T> = {
    success: true,
    data,
    ...(message && { message }),
  };
  return res.status(statusCode).json(response);
};

export const error = (res: Response, message: string, statusCode: number = 400, errorDetails?: string) => {
  const response: ApiResponse = {
    success: false,
    message,
    ...(errorDetails && { error: errorDetails }),
  };
  return res.status(statusCode).json(response);
};

export const paginated = <T>(
  res: Response,
  data: T[],
  total: number,
  page: number,
  pageSize: number
) => {
  return success(res, {
    items: data,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  });
};
