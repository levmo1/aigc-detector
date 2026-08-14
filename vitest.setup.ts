import '@testing-library/jest-dom/vitest'
import { createElement } from 'react'
import { vi } from 'vitest'

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return {
    ...actual,
    Link: ({ to, children, ...rest }: { to: string; children: React.ReactNode }) =>
      createElement('a', { href: to, ...rest }, children),
    useNavigate: () => vi.fn(),
    useLocation: () => ({ pathname: '/' }),
    useParams: () => ({}),
  }
})
