import { createFileRoute, redirect } from '@tanstack/react-router';

// The preview layout became the homepage; keep old links working
export const Route = createFileRoute('/v2')({
  beforeLoad: () => {
    throw redirect({ to: '/', statusCode: 301 });
  },
});
