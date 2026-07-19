import request from './request';

export const swrFetcher = (url: string) => request.get(url).then((res: any) => res.data);
