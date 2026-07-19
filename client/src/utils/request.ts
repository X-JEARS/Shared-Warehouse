import axios, { InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../stores/authStore';

interface RetryableRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

const request = axios.create({
  baseURL: '/api',
  timeout: 10000,
  withCredentials: true,
});

const refreshClient = axios.create({
  baseURL: '/api',
  timeout: 10000,
  withCredentials: true,
});

const nonRefreshableAuthPaths = [
  '/auth/login',
  '/auth/register',
  '/auth/refresh',
  '/auth/logout',
];

let refreshPromise: Promise<string> | null = null;

const requestRefreshedAccessToken = async () => {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await refreshClient.post('/auth/refresh');
    } catch (error: any) {
      if (error.response?.status !== 409 || attempt === 2) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
    }
  }
  throw new Error('Unable to refresh access token');
};

const refreshAccessToken = (): Promise<string> => {
  if (!refreshPromise) {
    refreshPromise = requestRefreshedAccessToken()
      .then((response) => {
        const token = response.data?.data?.token;
        if (typeof token !== 'string' || !token) {
          throw new Error('Refresh response did not include an access token');
        }
        useAuthStore.getState().setAccessToken(token);
        return token;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
};

// Request interceptor
request.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
request.interceptors.response.use(
  (response) => {
    return response.data;
  },
  async (error) => {
    const originalRequest = error.config as RetryableRequestConfig | undefined;
    const requestPath = originalRequest?.url || '';
    const canRefresh = !nonRefreshableAuthPaths.some((path) => requestPath.includes(path));

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry && canRefresh) {
      originalRequest._retry = true;
      try {
        const token = await refreshAccessToken();
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return request(originalRequest);
      } catch (refreshError: any) {
        useAuthStore.getState().logout();
        window.location.href = '/login';
        return Promise.reject(refreshError.response?.data || refreshError);
      }
    }

    return Promise.reject(error.response?.data || error);
  }
);

export default request;
