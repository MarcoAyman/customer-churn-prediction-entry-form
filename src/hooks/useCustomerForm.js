/*
  src/entry_form/src/hooks/useCustomerForm.js
  ─────────────────────────────────────────────────────────────────────────────
  CUSTOM HOOK: useCustomerForm

  FIX APPLIED — Warm-up ping on form mount + retry on submission failure.

  WHY THE ENTRY FORM WAS ALSO FAILING:
    The entry form and the dashboard share the same Render backend.
    The form's main.jsx had no warm-up ping — it mounted instantly and
    showed a ready state, but when the user hit "Register Customer" and
    the form POSTed to a cold Render server, Chrome dropped the connection
    before Render could respond (same root cause as the dashboard).

    The result: the user fills in the form, clicks submit, gets a network
    error with no explanation. On Safari it worked because Safari waits longer.

  TWO FIXES:
    1. Warm-up ping on hook mount (useEffect below).
       As soon as the form loads, we ping /health in the background.
       By the time the user fills in the form and clicks submit (10–30s),
       Render is already warm and the POST succeeds immediately.
       The user never sees the warm-up — it's invisible.

    2. Automatic retry on submission failure.
       If the POST fails (network error or 5xx), we wait 3 seconds and
       retry once automatically before showing an error to the user.
       This covers the rare case where warm-up didn't fully complete.

  EXISTING FIX (kept):
    Response envelope unwrapping — body.data instead of body directly.
  ─────────────────────────────────────────────────────────────────────────────
*/

import { useState, useCallback, useEffect } from 'react'
import { FORM_FIELDS, INITIAL_FORM_STATE } from '../data/formConfig'

// ── CONFIGURATION ─────────────────────────────────────────────────────────────

const BASE_URL = import.meta.env.VITE_API_URL || ''

// How long to wait (ms) before auto-resetting the form after success
const AUTO_RESET_DELAY_MS = 5_000

// How many times to retry a failed POST before showing an error
const MAX_SUBMIT_RETRIES = 1

// How long to wait between submit retry attempts
const SUBMIT_RETRY_DELAY_MS = 3_000


// ── WARM-UP HELPER ────────────────────────────────────────────────────────────

/**
 * Silently pings /health in the background when the form mounts.
 * The user never sees this — it just ensures Render is warm before
 * they finish filling in the form and click submit.
 * Does nothing if BASE_URL is not set (local dev without backend).
 */
async function pingServerInBackground() {
  if (!BASE_URL) return

  try {
    await fetch(`${BASE_URL}/api/v1/health`, {
      signal: AbortSignal.timeout(60_000),
    })
    console.log('[EntryForm] ✓ Server warm — form is ready')
  } catch (err) {
    // Silent failure — the form still renders and the submit will retry anyway
    console.warn('[EntryForm] Warm-up ping failed:', err.message)
  }
}


// ── HOOK ──────────────────────────────────────────────────────────────────────

export function useCustomerForm() {
  const [formData, setFormData]     = useState(INITIAL_FORM_STATE)
  const [status, setStatus]         = useState('idle')   // idle | submitting | success | error
  const [responseData, setResponse] = useState(null)
  const [errorMessage, setError]    = useState(null)


  // FIX: warm-up ping fires as soon as the form component mounts.
  // By the time a user reads the form, fills 7 fields, and clicks submit,
  // Render has had 20–60 seconds to wake up — more than enough.
  useEffect(() => {
    pingServerInBackground()
  }, [])  // empty deps: runs once on mount


  const handleChange = useCallback((field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }, [])


  /**
   * Submits the registration form with automatic retry on failure.
   * @param {number} attempt - current attempt number (0 = first try)
   */
  const submitAttempt = useCallback(async (data, attempt = 0) => {
    const res = await fetch(`${BASE_URL}/api/v1/customers/register`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(data),
      // 30s timeout per attempt — enough for a slow server but not forever
      signal:  AbortSignal.timeout(30_000),
    })

    if (!res.ok) {
      const errorBody = await res.json().catch(() => ({}))
      throw new Error(errorBody.message || errorBody.detail || `HTTP ${res.status}`)
    }

    const body = await res.json()
    // Unwrap the standard { success, data, message } envelope
    return body.data ?? body
  }, [])


  const handleSubmit = useCallback(async () => {
    // Validate all required fields before submitting
    const missing = FORM_FIELDS
      .filter(f => f.required && !formData[f.id])
      .map(f => f.label)

    if (missing.length > 0) {
      setError(`Please fill in: ${missing.join(', ')}`)
      setStatus('error')
      return
    }

    setStatus('submitting')
    setError(null)

    let lastError = null

    for (let attempt = 0; attempt <= MAX_SUBMIT_RETRIES; attempt++) {
      try {
        // Wait before retry (not before the first attempt)
        if (attempt > 0) {
          console.log(`[EntryForm] Retrying submission (attempt ${attempt + 1})...`)
          await new Promise(resolve => setTimeout(resolve, SUBMIT_RETRY_DELAY_MS))
        }

        const data = await submitAttempt(formData, attempt)
        setResponse(data)
        setStatus('success')

        // Auto-reset form after AUTO_RESET_DELAY_MS
        setTimeout(() => {
          setFormData(INITIAL_FORM_STATE)
          setResponse(null)
          setStatus('idle')
        }, AUTO_RESET_DELAY_MS)

        return  // success — stop retry loop

      } catch (err) {
        lastError = err
        console.warn(`[EntryForm] Attempt ${attempt + 1} failed:`, err.message)
      }
    }

    // All attempts exhausted
    setError(
      lastError?.message?.includes('timeout')
        ? 'Server is starting up — please try again in a moment.'
        : (lastError?.message || 'Registration failed. Please try again.')
    )
    setStatus('error')

  }, [formData, submitAttempt])


  return {
    formData,
    status,
    responseData,
    errorMessage,
    handleChange,
    handleSubmit,
    isSubmitting: status === 'submitting',
    isSuccess:    status === 'success',
    isError:      status === 'error',
  }
}
