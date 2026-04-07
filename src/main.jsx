/*
  src/main.jsx
  ─────────────────────────────────────────────────────────────────────────────
  Drop this into BOTH apps:
    src/operational_dashboard/src/main.jsx
    src/entry_form/src/main.jsx
  (change the Dashboard import to match each app's root component)

  EXECUTION ORDER on page load:

    1. startKeepAlive()  — non-blocking, starts immediately
       → immediate ping to /health (bonus warm-up)
       → 10-min interval registered
       → visibilitychange listener registered

    2. warmUpServer()    — BLOCKING, waits up to 60s
       → waits for Render to confirm it's alive before mounting React
       → React only mounts against a warm server

    3. ReactDOM.render() — only runs after step 2 resolves
       → all hooks hit a live server on their very first request
  ─────────────────────────────────────────────────────────────────────────────
*/

import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import './index.css'
import Dashboard from './Dashboard'   // ← change to your root component if different

import { startKeepAlive } from './utils/keepAlive'

const BASE_URL = import.meta.env.VITE_API_URL || ''


// ── 1. KEEP-ALIVE (non-blocking) ──────────────────────────────────────────────
// Starts immediately. The immediate ping inside startKeepAlive() also
// acts as the first warm-up signal while warmUpServer() waits for the response.
startKeepAlive(BASE_URL)


// ── 2. BLOCKING WARM-UP ───────────────────────────────────────────────────────
async function warmUpServer() {
  if (!BASE_URL) {
    console.log('[WarmUp] No VITE_API_URL — skipping (local dev)')
    return
  }

  console.log('[WarmUp] Waiting for server to confirm ready...')

  try {
    const res = await fetch(`${BASE_URL}/api/v1/health`, {
      signal: AbortSignal.timeout(60_000),
    })
    console.log(res.ok
      ? '[WarmUp] ✓ Server confirmed ready — mounting React'
      : `[WarmUp] Server responded ${res.status} — mounting anyway`
    )
  } catch (err) {
    console.warn('[WarmUp] No response in 60s:', err.message, '— mounting anyway')
  }
}


// ── 3. REACT QUERY CLIENT ────────────────────────────────────────────────────
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:            30_000,
      retry:                3,
      retryDelay:           (attempt) => Math.min(2_000 * 2 ** attempt, 30_000),
      refetchOnWindowFocus: false,
    },
  },
})


// ── 4. MOUNT — only after server confirms ready ───────────────────────────────
warmUpServer().then(() => {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <Dashboard />
      </QueryClientProvider>
    </React.StrictMode>
  )
})
