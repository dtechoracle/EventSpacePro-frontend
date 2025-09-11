export interface ApiValidationError {
  path: string;
  message: string;
  code: string;
}

export interface ApiError {
  message: string;
  errors?: ApiValidationError[];
}
