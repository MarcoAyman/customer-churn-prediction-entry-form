/*
  src/hooks/useCustomerForm.js
  ─────────────────────────────────────────────────────────────────────────────
  CUSTOM HOOK: useCustomerForm

  FIX: Render free tier cold start ("Failed to fetch")
  ─────────────────────────────────────────────────────────────────────────────

  PROBLEM:
    Render free tier sleeps after 15 minutes of inactivity.
    Waking up takes 50+ seconds.
    When the user clicks Register and Render is asleep:
      - The POST request waits
      - The browser times out
      - Result: "Failed to fetch" — no server error, just silence

  SOLUTION — Two-part:

    Part 1: WARMUP ON MOUNT
      The moment the entry form page loads, this hook silently pings
      GET /api/v1/health in the background.
      This wakes Render up immediately.
      By the time the user fills all 7 form fields (30–60 seconds),
      Render is fully awake and the POST succeeds instantly.

    Part 2: RETRY ON COLD START
      If the user submits before the warmup completes (submitted very fast),
      the fetch retries up to 3 times with 5-second gaps.
      A "Waking up server..." message is shown during retries
      so the user knows what is happening and does not click again.

  TIMING CONSTANTS:
    WARMUP_RETRY_DELAY_MS = 5000   — wait 5s between retry attempts
    MAX_SUBMIT_RETRIES    = 3      — retry up to 3 times before giving up
    SUCCESS_AUTO_RESET_MS = 5000   — form resets 5s after success
  ─────────────────────────────────────────────────────────────────────────────
*/

import { useState, useCallback, useEffect } from 'react'
import { FORM_FIELDS, INITIAL_FORM_STATE } from '../data/formConfig'

// ── CONFIGURATION ─────────────────────────────────────────────────────────────

const MOCK_MODE = false

const MOCK_DELAY_MS        = 900
const SUCCESS_AUTO_RESET_MS = 5000
const WARMUP_RETRY_DELAY_MS = 5000   // wait 5s between retries when server is cold
const MAX_SUBMIT_RETRIES    = 3      // retry the POST up to 3 times total

// ── UUID GENERATOR (mock only) ─────────────────────────────────────────────────
function generateMockUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

// ── FORM VALIDATION ────────────────────────────────────────────────────────────
function validateForm(formData) {
  const errors = {}
  FORM_FIELDS.forEach((field) => {
    if (!field.required) return
    if (!formData[field.id] || formData[field.id].trim() === '') {
      errors[field.id] = `${field.label} is required`
    }
  })
  return errors
}

// ── SLEEP HELPER ───────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

// ── MAIN HOOK ──────────────────────────────────────────────────────────────────
export function useCustomerForm() {
  const [formData,     setFormData]     = useState(INITIAL_FORM_STATE)
  const [errors,       setErrors]       = useState({})
  const [submitStatus, setSubmitStatus] = useState('idle')
  const [successData,  setSuccessData]  = useState(null)
  const [errorMessage, setErrorMessage] = useState('')

  // Tracks the warmup state so the UI can show a hint
  // 'idle'    — not started yet
  // 'warming' — health check in progress (Render is waking up)
  // 'ready'   — server responded, all clear
  const [serverStatus, setServerStatus] = useState('idle')


  // ── WARMUP ON MOUNT ─────────────────────────────────────────────────────────
  // Fire a silent GET /api/v1/health the moment this hook is created.
  // This wakes Render before the user submits.
  // No error shown to user if it fails — we handle retries in handleSubmit.
  useEffect(() => {
    if (MOCK_MODE) return   // no warmup needed in mock mode

    const BASE_URL = import.meta.env.VITE_API_URL || ''

    async function warmUp() {
      setServerStatus('warming')
      console.log('[Warmup] Pinging Render to prevent cold start...')

      try {
        const res = await fetch(`${BASE_URL}/api/v1/health`, {
          method: 'GET',
          // No timeout — we just want to wake Render, not block the UI
        })
        if (res.ok) {
          setServerStatus('ready')
          console.log('[Warmup] Server is awake ✓')
        } else {
          // Server responded but not 200 — still awake enough
          setServerStatus('ready')
          console.log('[Warmup] Server responded with', res.status)
        }
      } catch (err) {
        // Warmup failed — Render might still be starting up
        // handleSubmit will retry if needed
        setServerStatus('idle')
        console.warn('[Warmup] Server not yet reachable — will retry on submit:', err.message)
      }
    }

    warmUp()
  }, [])  // runs once on mount


  // ── handleChange ─────────────────────────────────────────────────────────────
  const handleChange = useCallback((fieldId, value) => {
    setFormData(prev => ({ ...prev, [fieldId]: value }))
    setErrors(prev => {
      if (!prev[fieldId]) return prev
      const next = { ...prev }
      delete next[fieldId]
      return next
    })
  }, [])


  // ── handleSubmit ──────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {

    // Step 1: client-side validation
    const validationErrors = validateForm(formData)
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return
    }

    setErrors({})
    setErrorMessage('')
    setSubmitStatus('loading')

    try {
      let responseData

      if (MOCK_MODE) {
        await sleep(MOCK_DELAY_MS)
        responseData = {
          customer_id:          generateMockUUID(),
          registered_at:        new Date().toISOString(),
          days_until_scoreable: 30,
          status:               'created',
          initial_features:     {},
        }

      } else {
        // ── REAL API with cold-start retry ──────────────────────────────────
        const BASE_URL = import.meta.env.VITE_API_URL || ''

        const payload = {
          ...formData,
          city_tier: formData.city_tier ? parseInt(formData.city_tier, 10) : null,
        }

        let lastError = null

        for (let attempt = 1; attempt <= MAX_SUBMIT_RETRIES; attempt++) {

          // Show the user what is happening on retry attempts
          if (attempt > 1) {
            setErrorMessage(
              `Waking up server... attempt ${attempt} of ${MAX_SUBMIT_RETRIES}. ` +
              `Render free tier needs up to 50 seconds to start. Please wait.`
            )
            // Wait before retrying so Render has time to wake up
            await sleep(WARMUP_RETRY_DELAY_MS)
          }

          try {
            const response = await fetch(`${BASE_URL}/api/v1/customers/register`, {
              method:  'POST',
              headers: { 'Content-Type': 'application/json' },
              body:    JSON.stringify(payload),
            })

            if (!response.ok) {
              // Server responded but with an error (4xx / 5xx)
              // This is NOT a cold start issue — do not retry
              const errorBody = await response.json().catch(() => ({}))
              throw new Error(
                errorBody.detail ??
                errorBody.message ??
                `Registration failed (HTTP ${response.status})`
              )
            }

            // ── Success — unwrap the APIResponse envelope ──────────────────
            // FastAPI returns: { "success": true, "data": {...}, "message": "..." }
            // SuccessCard needs body.data, not the wrapper
            const body = await response.json()
            responseData = body.data ?? body
            lastError = null
            break  // success — exit the retry loop

          } catch (fetchErr) {
            lastError = fetchErr

            // "Failed to fetch" = network error (cold start, timeout, offline)
            // Retry for these. For actual HTTP errors (4xx/5xx), we already threw above.
            const isColdStart = (
              fetchErr.message === 'Failed to fetch' ||
              fetchErr.message?.includes('fetch') ||
              fetchErr.name === 'TypeError'
            )

            if (isColdStart && attempt < MAX_SUBMIT_RETRIES) {
              console.warn(
                `[Submit] Attempt ${attempt} failed (likely cold start): ${fetchErr.message}. ` +
                `Retrying in ${WARMUP_RETRY_DELAY_MS / 1000}s...`
              )
              // Loop continues to next attempt
            } else {
              // Not a network error, or we've run out of retries
              throw fetchErr
            }
          }
        }

        // If we exhausted all retries, lastError is still set
        if (lastError) {
          throw lastError
        }
      }

      // ── Registration succeeded ──────────────────────────────────────────────
      setErrorMessage('')   // clear any "Waking up..." message
      setSuccessData(responseData)
      setSubmitStatus('success')
      setServerStatus('ready')

      // Auto-reset after 5 seconds
      setTimeout(() => {
        resetForm()
      }, SUCCESS_AUTO_RESET_MS)

    } catch (err) {
      setSubmitStatus('error')

      // User-friendly message for cold start that exhausted all retries
      if (
        err.message === 'Failed to fetch' ||
        err.message?.includes('fetch')
      ) {
        setErrorMessage(
          'Server is still starting up. Wait 30 seconds then try again. ' +
          'Render free tier can take up to 50 seconds to wake.'
        )
      } else {
        setErrorMessage(err.message ?? 'Registration failed. Please try again.')
      }
    }
  }, [formData])


  // ── resetForm ─────────────────────────────────────────────────────────────────
  const resetForm = useCallback(() => {
    setFormData(INITIAL_FORM_STATE)
    setErrors({})
    setSubmitStatus('idle')
    setSuccessData(null)
    setErrorMessage('')
    // Keep serverStatus as 'ready' — server is still awake
  }, [])


  return {
    formData,
    errors,
    submitStatus,
    successData,
    errorMessage,
    serverStatus,   // 'idle' | 'warming' | 'ready'
    handleChange,
    handleSubmit,
    resetForm,
  }
}
