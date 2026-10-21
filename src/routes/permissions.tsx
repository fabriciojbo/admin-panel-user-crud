import { createFileRoute } from '@tanstack/react-router'
import { Home } from './index'
export const Route = createFileRoute('/permissions')({
  component: () => <Home initialPage="permissions" />,
})
