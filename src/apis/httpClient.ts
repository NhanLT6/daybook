import axios, { type AxiosInstance, type AxiosError } from 'axios';

// Custom error class for API errors
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public originalError?: AxiosError,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Create base HTTP client for general API calls
export const httpClient: AxiosInstance = axios.create({
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response interceptor - handle errors globally
httpClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    // Handle different types of errors
    if (!axios.isAxiosError(error)) {
      return Promise.reject(new ApiError('Unexpected error occurred'));
    }

    // Network errors (no response)
    if (!error.response) {
      if (error.code === 'ECONNABORTED') {
        return Promise.reject(new ApiError('Request timed out. Please check your connection.'));
      }
      if (error.code === 'ERR_NETWORK') {
        return Promise.reject(new ApiError('Network error. Please check your internet connection.'));
      }
      return Promise.reject(new ApiError(error.message || 'Network error occurred'));
    }

    // HTTP errors with response
    const statusCode = error.response.status;
    const errorData = error.response.data as Record<string, unknown>;
    const errorMessage =
      (errorData?.message as string) || (errorData?.error as string) || error.message || 'An error occurred';

    return Promise.reject(new ApiError(errorMessage, statusCode, error));
  },
);
