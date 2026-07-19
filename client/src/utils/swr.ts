import request from './request';
import type { AxiosRequestConfig } from 'axios';

type SwrRequestKey = string | readonly [string, AxiosRequestConfig];

export const swrFetcher = (key: SwrRequestKey) => {
  const [url, config] = typeof key === 'string' ? [key, undefined] : key;
  return request.get(url, config).then((res: any) => res.data);
};
