# ChurnGuard — Customer Entry Form

**Customer registration form for the ChurnGuard churn prediction system.**

A clean, glassmorphism-styled form that collects customer demographic and preference data, submits it to the FastAPI backend, and displays a confirmation card with the new customer's scoring status. Deployed on Vercel. Talks to the FastAPI backend on Render.

---

## Live

| | URL |
|-|-----|
| **Entry Form** | *(your Vercel URL)* |
| **API it talks to** | *(your Render URL)* |
| **Ops Dashboard** | *(your other Vercel app)* |

---

## What It Does

```
┌─────────────────────────────────────────────────────┐
│  CHURNGUARD                                          │
│  customer registration                               │
│                                                      │
│  full name                                           │
│  ┌────────────────────────────────────────────────┐  │
│  │ e.g. Sarah Mitchell                           │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  gender              marital status                  │
│  ┌──────────────┐    ┌──────────────┐               │
│  │ Male      ▾  │    │ Single    ▾  │               │
│  └──────────────┘    └──────────────┘               │
│                                                      │
│  city tier           login device                    │
│  ┌──────────────┐    ┌──────────────┐               │
│  │ Tier 1    ▾  │    │ Mobile    ▾  │               │
│  └──────────────┘    └──────────────┘               │
│                                                      │
│  payment mode        order category                  │
│  ┌──────────────┐    ┌──────────────┐               │
│  │ Credit Card▾ │    │ Fashion   ▾  │               │
│  └──────────────┘    └──────────────┘               │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │  register customer →                         │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘

                      ↓ on success

┌─────────────────────────────────────────────────────┐
│  ✓ customer registered                               │
│                                                      │
│  customer ID:  a1b2c3d4-...                          │
│  registered:   2026-05-14 09:00                      │
│  scoreable in: 30 days (tenure + orders required)    │
│                                                      │
│  initial features created:                           │
│  tenure=0mo · orders=0 · complain=false             │
└─────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| **Framework** | React 18 |
| **Build tool** | Vite 5 |
| **Styling** | Tailwind CSS 3 + custom CSS per component |
| **HTTP** | native `fetch()` with retry logic |
| **Deployment** | Vercel |

No external state management library. No form library. Everything is handled by a single custom hook.

---

## Project Structure

```
customer-churn-prediction-entry-form/
│
├── src/
│   ├── main.jsx                        ← React entry point
│   ├── CustomerEntryForm.jsx           ← root form layout
│   ├── CustomerEntryForm.css           ← glassmorphism form styles
│   ├── index.css                       ← global reset + CSS vars
│   │
│   ├── components/
│   │   ├── GlassInput/
│   │   │   ├── GlassInput.jsx          ← styled text input
│   │   │   └── GlassInput.css
│   │   ├── GlassSelect/
│   │   │   ├── GlassSelect.jsx         ← styled dropdown
│   │   │   └── GlassSelect.css
│   │   └── SuccessCard/
│   │       ├── SuccessCard.jsx         ← post-registration confirmation
│   │       └── SuccessCard.css
│   │
│   ├── hooks/
│   │   └── useCustomerForm.js          ← all form logic
│   │
│   ├── data/
│   │   └── formConfig.js               ← field definitions + dropdown options
│   │
│   └── utils/
│       └── keepAlive.js                ← Render cold start prevention
│
├── index.html
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── vercel.json                         ← Vercel SPA routing config
└── package.json
```

---

## File Purpose — Full Reference

### `src/main.jsx`

React entry point. Mounts the app into `#root`. Also calls `startKeepAlive(VITE_API_URL)` before rendering — this pings Render the instant the page loads, waking it up before the user fills out the form.

```jsx
startKeepAlive(import.meta.env.VITE_API_URL)   // ← warm up Render immediately
ReactDOM.createRoot(document.getElementById('root')).render(<CustomerEntryForm />)
```

---

### `src/CustomerEntryForm.jsx`

Root layout component. Renders the form title, subtitle, all form fields from `FORM_FIELDS` config, the submit button, and conditionally the `SuccessCard` after registration.

Uses `useCustomerForm()` for all state and logic. The component itself has no state — it is purely presentational.

Field rendering is driven by `FORM_FIELDS` from `formConfig.js`:
- `type: 'text'` → renders `<GlassInput />`
- `type: 'select'` → renders `<GlassSelect />`
- `colSpan: 'full'` → field takes the full row width
- `colSpan: 'half'` → two fields sit side by side

```jsx
{FORM_FIELDS.map(field =>
  field.type === 'text'
    ? <GlassInput key={field.id} ... />
    : <GlassSelect key={field.id} ... />
)}
```

**Submit button states:**
- `idle` → "register customer →"
- `loading` → "registering..." (disabled, shows spinner)
- `success` → hidden (SuccessCard shown instead)
- `error` → "register customer →" (re-enabled, error message shown below)

---

### Components

#### `GlassInput/GlassInput.jsx`

Styled text input with glassmorphism CSS. Props:

```
id          field identifier
label       shown above the input
value       controlled value
onChange    callback → useCustomerForm.handleChange
placeholder hint text when empty
error       error string — shown in red below the input if set
```

Clears its own error as soon as the user types into it (handled by `handleChange` in the hook, not the component).

---

#### `GlassSelect/GlassSelect.jsx`

Styled dropdown with the same glassmorphism treatment as `GlassInput`. Props:

```
id          field identifier
label       shown above the dropdown
value       controlled value (empty string = placeholder shown)
onChange    callback → useCustomerForm.handleChange
options     array of { value, label } from formConfig.js
error       error string — shown in red below the dropdown if set
```

The first option is always a placeholder ("select one") with an empty value so unselected fields fail the required validation.

---

#### `SuccessCard/SuccessCard.jsx`

Shown after a successful registration, replacing the form. Displays:

- Customer UUID (from API response)
- Registration timestamp
- Days until scoreable (30 — `tenure_months >= 1 AND order_count >= 1` gate)
- Initial feature values created by `feature_service.py` on the backend

Auto-hides after 5 seconds and resets the form back to empty. The reset timer is started by `useCustomerForm` (not the component), so it always fires regardless of whether the user interacts with the card.

---

### `src/hooks/useCustomerForm.js`

**All form logic lives here.** The form component is a pure renderer — `useCustomerForm` manages:

```
formData      — controlled state for all fields
errors        — validation errors per field
submitStatus  — 'idle' | 'loading' | 'success' | 'error'
successData   — API response after successful registration
errorMessage  — user-readable error string
serverStatus  — 'idle' | 'warming' | 'ready'
```

#### Warmup on mount

The moment the hook is created (form loads), it silently fires `GET /api/v1/health`:

```js
useEffect(() => {
  warmUp()   // fire immediately
}, [])       // once only
```

The average customer takes 30–60 seconds to fill all 7 fields. This warmup window is enough time for Render to fully wake up. By the time the user clicks Register, the server is ready.

---

#### Validation

Client-side validation runs before any network request:

```js
FORM_FIELDS.forEach(field => {
  if (field.required && (!formData[field.id] || formData[field.id].trim() === '')) {
    errors[field.id] = `${field.label} is required`
  }
})
```

`full_name` is optional — Kaggle-seeded rows have no names. All other fields are required. Errors appear inline below each field and clear as soon as the user corrects the value.

---

#### Cold start retry logic

If the user submits before the warmup completes — or if Render is exceptionally slow — the POST request retries up to 3 times with 5-second gaps:

```
Attempt 1: POST /api/v1/customers/register
  ↓ Failed to fetch (Render still asleep)
  
  Show: "Waking up server... attempt 2 of 3. Render free tier needs up to 50 seconds."
  Wait 5 seconds

Attempt 2: POST /api/v1/customers/register
  ↓ Failed to fetch (still waking)

  Show: "Waking up server... attempt 3 of 3."
  Wait 5 seconds

Attempt 3: POST /api/v1/customers/register
  ↓ 200 OK → success

```

Important: the retry only fires on `Failed to fetch` (network error = server not reachable). If the server returns HTTP 4xx or 5xx (validation error, duplicate, etc.), the error is shown immediately without retrying — those are application errors, not cold start errors.

---

#### Submit flow

```
handleSubmit()
  │
  ├── validateForm(formData)
  │     if errors → setErrors() → return (no network call)
  │
  ├── setSubmitStatus('loading')
  │
  ├── for attempt 1..3:
  │     POST /api/v1/customers/register
  │       ├── 200 OK → setSuccessData() → setSubmitStatus('success')
  │       │            setTimeout(resetForm, 5000)
  │       │            break
  │       ├── 4xx/5xx → throw (no retry, show error message)
  │       └── network error → wait 5s → retry
  │
  └── on exhausted retries → setSubmitStatus('error') → setErrorMessage()
```

---

### `src/data/formConfig.js`

**Single source of truth for all field configuration.**

Contains:

**`FORM_FIELDS`** — array of field definition objects:
```js
{
  id:          'gender',
  label:       'gender',
  type:        'select',        // 'text' or 'select'
  options:     GENDER_OPTIONS,  // only for type: 'select'
  required:    true,
  colSpan:     'half',          // 'full' or 'half'
  placeholder: '...',           // only for type: 'text'
}
```

**Dropdown options** — all values match PostgreSQL ENUMs in `schema.sql` exactly. If the backend rejects a value, update it here:

| Constant | Field | Values |
|----------|-------|--------|
| `GENDER_OPTIONS` | gender | Male · Female |
| `MARITAL_OPTIONS` | marital_status | Single · Married · Divorced |
| `CITY_TIER_OPTIONS` | city_tier | 1 · 2 · 3 (sent as integer) |
| `PAYMENT_OPTIONS` | preferred_payment_mode | Credit Card · Debit Card · COD · E wallet · UPI |
| `DEVICE_OPTIONS` | preferred_login_device | Mobile Phone · Computer |
| `ORDER_CAT_OPTIONS` | preferred_order_cat | Grocery · Fashion · Mobile · Laptop & Accessory · Others |

**`INITIAL_FORM_STATE`** — generated dynamically from `FORM_FIELDS` so it never goes out of sync:
```js
export const INITIAL_FORM_STATE = FORM_FIELDS.reduce((acc, field) => {
  acc[field.id] = ''
  return acc
}, {})
```

**`INITIAL_FEATURES`** — the feature values `feature_service.py` inserts at registration. Shown in `SuccessCard` for transparency:
```
tenure_months=0.0, order_count=0, complain=false, cashback_amount=0.0, ...
```

**`DAYS_UNTIL_SCOREABLE`** — 30. Matches the scoring gate in `batch_scorer.py` (`tenure_months >= 1`). Shown in the SuccessCard.

---

### `src/utils/keepAlive.js`

Same utility as the dashboard — prevents Render's free tier from sleeping.

Three-part strategy:

| Mechanism | What it does |
|-----------|-------------|
| **Immediate ping on mount** | Fires `GET /api/v1/health` when JS loads — warms Render before user fills form |
| **Scheduled pings every 10 min** | Keeps inactivity timer from reaching Render's 15-min threshold |
| **Ping on tab visibility change** | If tab was backgrounded for a while, pings the moment it comes back into focus |

`PING_INTERVAL_MS = 10 * 60 * 1000` (10 minutes) — chosen to leave a 5-minute buffer below Render's 15-minute sleep threshold.

Silent failures — if a ping fails, a warning is logged and the interval continues. This never shows UI errors or affects form state.

---

## What Happens After Submission

The form submits to `POST /api/v1/customers/register`. FastAPI:

1. Validates the request body with Pydantic
2. Runs business rule checks (`data_integrity.py`)
3. Inserts a row into `customers` table (Supabase)
4. Calls `feature_service.py` → inserts initial row into `customer_features` (tenure=0, orders=0, etc.)
5. Pushes a `new_customer` event over SSE → the Ops Dashboard EventFeed shows the event within seconds
6. Returns `{ success: true, data: { customer_id, registered_at, days_until_scoreable, ... } }`

The form displays the response data in `SuccessCard` and resets after 5 seconds.

The new customer is **not immediately scoreable**. The batch scoring gate requires `tenure_months >= 1 AND order_count >= 1`. The customer will appear in the dashboard with an "ONBOARDING" badge until they meet the gate.

---

## How It Connects to the Rest of the System

```
                    ┌─────────────────────────────────────────┐
                    │  Customer Entry Form (Vercel)            │
                    │                                          │
                    │  useCustomerForm                         │
                    │   ├── warmup: GET /api/v1/health         │
                    │   └── submit: POST /api/v1/customers/    │
                    │               register                   │
                    └────────────────┬────────────────────────┘
                                     │ HTTP POST
                                     ▼
                    ┌────────────────────────────────────────┐
                    │  FastAPI on Render                      │
                    │                                         │
                    │  POST /api/v1/customers/register        │
                    │    ├── validates Pydantic schema        │
                    │    ├── data_integrity.py checks         │
                    │    ├── customer_service.py → INSERT     │
                    │    ├── feature_service.py → INSERT      │
                    │    ├── sse_service.py → new_customer    │
                    │    └── returns customer_id + status     │
                    └──────────┬─────────────────────────────┘
                               │
                   ┌───────────┴────────────────────────────────────┐
                   │                                                 │
                   ▼                                                 ▼
     ┌─────────────────────┐                   ┌──────────────────────────────┐
     │  Supabase           │                   │  Ops Dashboard (Vercel)      │
     │                     │                   │                              │
     │  customers ← INSERT │                   │  EventFeed receives          │
     │  customer_features  │                   │  new_customer SSE event      │
     │  ← INSERT           │                   │  within seconds              │
     └─────────────────────┘                   └──────────────────────────────┘

                  (every 20 days)
                       │
                       ▼
         GitHub Actions batch scoring
         → customer becomes eligible after
           tenure_months >= 1 AND order_count >= 1
         → predicted · appears in AtRiskTable
```

---

## Environment Variables

Set these in your Vercel project dashboard under **Settings → Environment Variables**:

| Variable | Value | Required |
|----------|-------|----------|
| `VITE_API_URL` | Your Render API URL e.g. `https://churnguard-api.onrender.com` | ✓ |

No admin key needed — the customer registration endpoint is public (`POST /api/v1/customers/register` does not require `X-Admin-Key`).

---

## Running Locally

```bash
git clone https://github.com/MarcoAyman/customer-churn-prediction-entry-form.git
cd customer-churn-prediction-entry-form

npm install

# Create .env.local for local dev
echo "VITE_API_URL=https://your-render-url.onrender.com" > .env.local

npm run dev
# → http://localhost:5173
```

**Development without backend:** Set `MOCK_MODE = true` in `useCustomerForm.js`. Submissions will resolve after a 900ms fake delay with a generated UUID.

---

## Deployment

Deployed automatically on Vercel:

```
git push origin main → Vercel auto-deploys → live in ~45 seconds
```

`vercel.json` configures SPA routing:

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/" }]
}
```

---

## Author

**Marco Hanna** · ML/AI Engineer
- GitHub: [@MarcoAyman](https://github.com/MarcoAyman)
- Portfolio: [marco-hanna-portfolio.vercel.app](https://marco-hanna-portfolio.vercel.app)

---

## License

MIT — see [LICENSE](./LICENSE)
