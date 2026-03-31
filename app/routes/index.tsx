import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/')({
  component: Home,
});

function Home() {
  return (
    <div>
      <h1>Doomsd.ai</h1>
      <p>Service Reliability Index Dashboard</p>
    </div>
  );
}
