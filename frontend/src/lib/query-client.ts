import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './api-error';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000, // 30s - file/folder listings don't need to refetch on every focus
      retry: (failureCount, error) => {
        // Never retry client errors (400/401/403/404/409...) - only retry
        // on network failures / 5xx, up to 2 times.
        if (error instanceof ApiError && error.statusCode >= 400 && error.statusCode < 500) {
          return false;
        }
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
});
