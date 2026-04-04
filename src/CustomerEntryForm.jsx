/*
  src/CustomerEntryForm.jsx
  ─────────────────────────────────────────────────────────────────────────────
  ROOT COMPONENT: CustomerEntryForm

  FIX: Shows server warmup status so the user knows Render is starting up.
  If the server is warming (cold start), a subtle indicator appears at the
  top of the form. Once the server responds, it disappears.
  ─────────────────────────────────────────────────────────────────────────────
*/

import './CustomerEntryForm.css'

import GlassInput   from './components/GlassInput/GlassInput'
import GlassSelect  from './components/GlassSelect/GlassSelect'
import SuccessCard  from './components/SuccessCard/SuccessCard'
import { useCustomerForm } from './hooks/useCustomerForm'
import { FORM_FIELDS }     from './data/formConfig'


export default function CustomerEntryForm() {

  const {
    formData,
    errors,
    submitStatus,
    successData,
    errorMessage,
    serverStatus,   // 'idle' | 'warming' | 'ready'
    handleChange,
    handleSubmit,
    resetForm,
  } = useCustomerForm()

  const isLoading = submitStatus === 'loading'
  const isSuccess = submitStatus === 'success'
  const isError   = submitStatus === 'error'

  const fullFields = FORM_FIELDS.filter(f => f.colSpan === 'full')
  const halfFields = FORM_FIELDS.filter(f => f.colSpan === 'half')


  return (
    <div className="scene">

      {/* Ambient glow orbs */}
      <div className="scene__orb scene__orb--teal"   aria-hidden="true" />
      <div className="scene__orb scene__orb--indigo" aria-hidden="true" />

      {/* Decorative dots */}
      <span className="scene__dot" style={{ top: '18%', left: '9%' }}   aria-hidden="true" />
      <span className="scene__dot" style={{ top: '70%', left: '13%' }}  aria-hidden="true" />
      <span className="scene__dot" style={{ top: '35%', right: '11%' }} aria-hidden="true" />
      <span className="scene__dot" style={{ top: '60%', right: '7%' }}  aria-hidden="true" />
      <span className="scene__dot" style={{ top: '82%', right: '18%' }} aria-hidden="true" />


      {/* OUTER GLASS PANEL */}
      <div className="outer-glass">
        <div className="glass-highlight" aria-hidden="true" />

        {/* Brand row */}
        <div className="brand-row">
          <div className="brand-dots" aria-hidden="true">
            {Array.from({ length: 9 }).map((_, i) => (
              <span key={i} className="brand-dot" />
            ))}
          </div>
          <span className="brand-name">ChurnGuard</span>
          <span className="brand-tag">data entry</span>

          {/* Server warmup indicator — only visible when Render is waking */}
          {serverStatus === 'warming' && (
            <span className="server-warming-badge" title="Render free tier is waking up">
              <span className="server-warming-dot" aria-hidden="true" />
              warming up
            </span>
          )}
          {serverStatus === 'ready' && (
            <span className="server-ready-badge">
              ✓ ready
            </span>
          )}
        </div>


        {/* INNER CARD — form surface */}
        <div className="inner-card">
          <div className="glass-highlight" aria-hidden="true" />

          <h1 className="form-heading">Register Customer</h1>
          <p  className="form-subheading">to your ChurnGuard workspace</p>


          {/* Full-width fields */}
          {fullFields.map((field) => (
            <div key={field.id} className="field-full">
              <GlassInput
                id={field.id}
                label={field.label}
                value={formData[field.id]}
                placeholder={field.placeholder}
                error={errors[field.id] ?? ''}
                onChange={(val) => handleChange(field.id, val)}
                disabled={isLoading || isSuccess}
              />
            </div>
          ))}


          {/* Two-column grid fields */}
          {Array.from(
            { length: Math.ceil(halfFields.length / 2) },
            (_, i) => halfFields.slice(i * 2, i * 2 + 2)
          ).map((pair, rowIndex) => (
            <div key={rowIndex} className="field-row">
              {pair.map((field) => (
                <GlassSelect
                  key={field.id}
                  id={field.id}
                  label={field.label}
                  value={formData[field.id]}
                  options={field.options}
                  error={errors[field.id] ?? ''}
                  onChange={(val) => handleChange(field.id, val)}
                  disabled={isLoading || isSuccess}
                />
              ))}
            </div>
          ))}


          <div className="form-divider" />


          {/* Submit button */}
          <button
            className={`submit-btn ${isLoading ? 'submit-btn--loading' : ''} ${isSuccess ? 'submit-btn--success' : ''}`}
            onClick={handleSubmit}
            disabled={isLoading || isSuccess}
            aria-busy={isLoading}
          >
            {isLoading ? (
              <span className="submit-btn__loading">
                <span className="submit-btn__spinner" aria-hidden="true" />
                {/* Show different message when retrying cold start */}
                {errorMessage.includes('Waking') ? 'Waking server...' : 'Registering...'}
              </span>
            ) : isSuccess ? (
              <span>Customer Created</span>
            ) : (
              <span>Register Customer</span>
            )}
          </button>


          {/* Error / retry message */}
          {(isError || (isLoading && errorMessage)) && errorMessage && (
            <p
              className={`form-error-message ${errorMessage.includes('Waking') ? 'form-error-message--warming' : ''}`}
              role="alert"
            >
              {errorMessage}
            </p>
          )}


          {/* Success card */}
          {isSuccess && successData && (
            <SuccessCard
              data={successData}
              onReset={resetForm}
            />
          )}

        </div>
      </div>

    </div>
  )
}
