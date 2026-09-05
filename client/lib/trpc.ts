import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '../../server/routers';
import { httpBatchLink } from '@trpc/client';
import superjson from 'superjson';

// رابط الموقع المستضاف على Render
const API_URL = 'https://eleven-cf6o.onrender.com';

export const trpc = createTRPCReact<AppRouter>();

export const trpcClient = trpc.createClient({
  transformer: superjson,
  links: [
    httpBatchLink({
      url: `${API_URL}/api/trpc`,   // ← أضفت /api
    }),
  ],
});