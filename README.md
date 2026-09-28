# Emergency Ambulance Dispatch System — Backend

REST API backend for an emergency ambulance dispatch platform. Patients request
an ambulance, an admin acting as dispatcher assigns a specific ambulance and
hospital, the driver fulfils the trip, and the patient pays the fare once the
trip completes.

**Stack:** Node.js 20+ · Express 5 · TypeScript · Prisma 7 · PostgreSQL · JWT auth · Zod 4 · Stripe · Biome

---

## Table of contents

- [How it works](#how-it-works)
- [Prerequisites](#prerequisites)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Roles and seeding](#roles-and-seeding)
- [API reference](#api-reference)
- [Response envelope and authentication](#response-envelope-and-authentication)
- [Data model](#data-model)
- [Project structure](#project-structure)
- [Postman collection](#postman-collection)
- [Scripts](#scripts)
- [Conventions for new modules](#conventions-for-new-modules)
- [Deployment](#deployment)

---

## How it works

The whole system is driven by one status machine on `EmergencyRequest`
(a *trip*). There are **56 endpoints** across 7 route groups.

```
                 ┌────────────── cancel (patient) ──────────────┐
                 │                                                ▼
PENDING ──assign──> ASSIGNED ──accept──> ACCEPTED ──> EN_ROUTE ──> PICKED_UP
                                                              │          │
                                                              │          ▼
                                                              │    HOSPITAL_ARRIVED
                                                              │          │
                                                              └──────────┴──> COMPLETED
```

Exactly **four** status updates are legal, each one single-step forward:

| From           | To                | Also recorded                       |
| -------------- | ----------------- | ----------------------------------- |
| `ACCEPTED`     | `EN_ROUTE`        | –                                   |
| `EN_ROUTE`     | `PICKED_UP`       | `pickedUpAt`                        |
| `PICKED_UP`    | `HOSPITAL_ARRIVED`| `arrivedAt`                         |
| `HOSPITAL_ARRIVED` | `COMPLETED`    | `completedAt`, `fare`, `distanceKm`  |

Who does what:

- **Patient** creates a request (`PENDING`) and may cancel it while the status is
  `PENDING`, `ASSIGNED`, `ACCEPTED`, or `EN_ROUTE` — once the patient is in the
  ambulance, cancellation is refused.
- **Admin** picks the ambulance by hand (there is no auto-matching engine),
  raises or lowers priority, and selects the destination hospital. Priority is
  only an ordering field — the dispatcher's queue is just the request list
  sorted by `createdAt` and filterable by `status` and `priority`.
- **Driver** accepts the trip and walks it through the four transitions. A
  driver cannot go offline while holding an active trip.
- **Fare** is computed at `COMPLETED`, not at booking: the trip's
  `pickupLatitude`/`pickupLongitude` and the selected hospital's coordinates are
  run through a haversine distance, then
  `fare = ambulanceType.baseFare + ambulanceType.perKmRate × distanceKm`,
  rounded to 2 decimals. If either end is missing coordinates the distance falls
  back to 10 km. The patient is notified of the final amount.
- **Payment** happens after completion via Stripe, using a PaymentIntent created
  against the computed fare.

Side effects that keep the fleet consistent, all inside a transaction:

- Assigning sets the ambulance `AVAILABLE → BUSY`.
- Completing sets it back `BUSY → AVAILABLE` and sets the driver's
  `isAvailable = true`.
- Cancelling frees the ambulance and the driver, and notifies the driver.
- `HOSPITAL_ARRIVED` and `COMPLETED` are rejected until an admin has selected a
  hospital for the trip.

---

## Prerequisites

| Tool           | Version | Check with |
| -------------- | ------- | ---------- |
| **Node.js**    | 20+     | `node -v`  |
| **PostgreSQL** | 14+     | `psql -V`  |

Any package manager works. The examples below use `npm`.

---

## Getting started

**1. Install dependencies**

```bash
npm install
```

The `postinstall` hook already runs `prisma generate` and `npm run build`, so
this step is enough to produce the typed Prisma client in `src/generated/prisma`
and a bundle in `dist/`.

**2. Set up your environment file**

```bash
cp .env.example .env
```

Open `.env` and fill in the blank values — at minimum `DATABASE_URL` and the two
JWT secrets. `.env.example` documents every variable. See
[Environment variables](#environment-variables) below.

**3. Run the migrations**

```bash
npx prisma migrate dev
```

This also generates the Prisma client. The database does not need to exist
first — the command creates it.

**4. Start the server**

```bash
npm run dev
```

You should see:

```
Connected to the database successfully.
Admin Created : { ... }              # first run only
Ambulance Types Seeded!
Hospitals Seeded!
Emergency Contacts Seeded!
Server is running on port 5000
```

Confirm it's up:

```bash
curl http://localhost:5000/
# {"success":true,"message":"Welcome to Emergency Ambulance Dispatch System Backend"}
```

If you ever edit anything under `prisma/schema/`, regenerate the client:

```bash
npx prisma generate
```

`src/generated/prisma` is git-ignored and almost every file under `src/` imports
from it, so a fresh clone must run this before it will compile.

---

## Environment variables

`src/app/config/index.ts` is the only place `process.env` is read — application
code imports `config` from there.

| Variable                   | Required | What it's for                                                     |
| -------------------------- | -------- | ----------------------------------------------------------------- |
| `NODE_ENV`                 | no       | `development` returns detailed errors and non-secure cookies        |
| `PORT`                     | no       | Port the HTTP server listens on (defaults to `5000`)               |
| `DATABASE_URL`             | **yes**  | Postgres connection string, used by both Prisma and the app        |
| `JWT_ACCESS_SECRET`        | **yes**  | Signing key for access tokens                                      |
| `JWT_REFRESH_SECRET`       | **yes**  | Signing key for refresh tokens                                     |
| `JWT_ACCESS_EXPIRES_IN`    | **yes**  | Access token lifetime (e.g. `1d`)                                  |
| `JWT_REFRESH_EXPIRES_IN`   | **yes**  | Refresh token lifetime (e.g. `7d`)                                 |
| `BCRYPT_SALT_ROUNDS`       | no       | bcrypt cost factor for password hashing (e.g. `10`)                |
| `BACKEND_URL`              | no       | Absolute base URL of this API                                      |
| `FRONTEND_URL`             | no       | Added to the CORS allowlist                                        |
| `GOOGLE_CLIENT_ID`         | no       | OAuth 2.0 client id used to verify Google idTokens                 |
| `ADMIN_NAME`               | no       | Name of the seeded admin account                                   |
| `ADMIN_EMAIL`              | no       | Email of the seeded admin account                                  |
| `ADMIN_PASSWORD`           | no       | Password of the seeded admin account                               |
| `STRIPE_PUBLISHABLE_KEY`   | no       | Stripe publishable key, for the browser client                     |
| `STRIPE_SECRET_KEY`        | no       | Stripe secret key, for creating and confirming PaymentIntents      |
| `STRIPE_WEBHOOK_SECRET`    | no       | Signing secret for verifying `stripe-signature` on the webhook     |

The three `ADMIN_*` variables are only needed on a first run — once an admin
exists, the seeder logs `Admin Already Exists!` and skips. If any of the three is
missing on a first run the seeder logs an error and the server continues without
an admin.

**Stripe keys are optional at boot.** `src/app/lib/stripe.ts` exports a lazy
`Proxy` that only constructs the client when a Stripe property is touched, so the
server starts fine with no Stripe configuration at all. The payment endpoints
then fail at call time with a plain error instead.

Replace the JWT secrets and the admin password before deploying anywhere.

---

## Roles and seeding

Three roles exist: `PATIENT`, `DRIVER`, and `ADMIN` (which doubles as the
dispatcher). Registration always assigns the role based on the endpoint used —
a `role` in the request body is ignored, so no one can self-register as admin.

On every server start, `src/server.ts` connects to the database and runs the
seeder, which is idempotent — every step is guarded by an existence check, so
restarts are safe:

| Seeded                | Contents                                                             |
| --------------------- | -------------------------------------------------------------------- |
| Admin account         | One `ADMIN` user, built from the `ADMIN_*` env vars                   |
| 4 ambulance types     | BLS, ALS, Patient Transport, Neonatal — each with its own fare rates  |
| 3 hospitals           | General, Trauma, and Specialized hospitals, with coordinates          |
| 4 emergency contacts  | National hotline, ambulance, police, and fire services               |

`npm run seed` runs exactly the same seeding without starting the HTTP server.

---

## API reference

Base URL: `http://localhost:5000`

| Prefix             | Role  | Endpoints |
| ------------------ | ----- | --------- |
| `/api/v1/public`   | none  | 4         |
| `/api/v1/auth`     | mixed | 7         |
| `/api/v1/patient`  | `PATIENT` | 8     |
| `/api/v1/driver`   | `DRIVER`  | 9     |
| `/api/v1/admin`    | `ADMIN`   | 24    |
| `/api/v1/payment`  | mixed | 3         |

### Shared query parameters

Every paginated list endpoint accepts:

| Param        | Default      | Notes                                                        |
| ------------ | ------------ | ------------------------------------------------------------ |
| `page`       | `1`          | Any positive integer, otherwise falls back to `1`            |
| `limit`      | `10`         | Capped at `100`                                              |
| `sortBy`     | `createdAt`  | Passed straight to Prisma `orderBy`                          |
| `sortOrder`  | `desc`       | Anything other than `asc` is treated as `desc`               |
| `searchTerm` | –            | Only on the admin lists listed below                          |

List responses include a `meta` object: `{ page, limit, total, totalPages }`.

Date filters (`startDate` / `endDate`) are inclusive, and invalid dates are
silently ignored rather than rejected.

---

### Health

| Method | Path | Auth | Notes                                   |
| ------ | ---- | ---- | --------------------------------------- |
| `GET`  | `/`  | –    | Returns `{ success, message }` directly |

---

### Public — `/api/v1/public`

No authentication. These endpoints back the marketing and emergency-info pages
of the frontend.

| Method | Path                    | Body / Query        | Notes                                                                 |
| ------ | ----------------------- | ------------------- | --------------------------------------------------------------------- |
| `GET`  | `/ambulance-types`      | –                   | Active ambulance types only, alphabetical                             |
| `GET`  | `/hospitals`            | `type?`             | Active, non-deleted hospitals, alphabetical. Not paginated           |
| `GET`  | `/hospitals/:id`        | –                   | Single active hospital, 404 otherwise                                |
| `GET`  | `/emergency-info`       | –                   | Active emergency contacts plus a static `system` block and `safetyGuidelines` |

---

### Auth — `/api/v1/auth`

| Method | Path                    | Auth     | Body                                                                                                   |
| ------ | ----------------------- | -------- | ------------------------------------------------------------------------------------------------------ |
| `POST` | `/register/patient`     | –        | `name` (3–100), `email`, `password`, `patient?` (`contactNumber?`, `address?`)                        |
| `POST` | `/register/driver`      | –        | `name`, `email`, `password`, `licenseNumber` (3+), `vehicleNumber` (2+), `contactNumber?`, `ambulanceType?` |
| `POST` | `/login`                | –        | `email`, `password`                                                                                    |
| `POST` | `/google`               | –        | `idToken`                                                                                              |
| `GET`  | `/me`                   | any role | –                                                                                                      |
| `POST` | `/refresh-token`        | cookie   | Reads the `refreshToken` cookie; body tokens are ignored                                               |
| `POST` | `/logout`               | –        | Clears both auth cookies                                                                               |

**Password policy** (both registration endpoints): minimum 8 characters, with at
least one lowercase letter, one uppercase letter, one number, and one special
character.

`register` and `login` return `accessToken` and `refreshToken` in the JSON body
*and* as httpOnly cookies. `refresh-token` reads only the cookie, re-checks that
the user still exists and is `ACTIVE`, and mints a fresh pair of tokens.

**Google login** (`POST /auth/google`) verifies the idToken against
`GOOGLE_CLIENT_ID` and then:

- **New email** → provisions a `PATIENT` account with a linked `patient` profile.
- **Existing patient or driver** → links the Google id to that account; both
  login methods work afterwards.
- **Blocked, deleted, or admin accounts** → rejected.

Drivers never *register* through Google — a first-time Google login is always a
patient — but an existing driver may link Google later. Conversely, a
Google-only account cannot log in with a password.

---

### Patient — `/api/v1/patient`

Every route requires a `PATIENT` token. All list and by-id reads are scoped to
the caller's own `Patient` profile, so a patient can only ever see their own
records.

| Method | Path                              | Body / Query                                            | Notes                                                    |
| ------ | --------------------------------- | ------------------------------------------------------- | -------------------------------------------------------- |
| `POST` | `/emergency-requests`             | `patientName` (2+), `patientContact` (5+), `emergencyType`, `pickupLocation` (5–255), `priority?` (`MEDIUM`), `pickupLatitude?`, `pickupLongitude?`, `additionalNote?` (≤500) | Status is hard-set to `PENDING`; not client-settable |
| `GET`  | `/emergency-requests`             | `page`, `limit`, `sortBy`, `sortOrder`, `status?`       | Paginated, own requests only                             |
| `GET`  | `/emergency-requests/:id`         | –                                                       | 404 if it is not yours                                   |
| `PATCH`| `/emergency-requests/:id/cancel`  | –                                                       | Allowed while `PENDING`/`ASSIGNED`/`ACCEPTED`/`EN_ROUTE`; frees the ambulance, notifies the driver |
| `GET`  | `/trips`                          | same as `/emergency-requests`                            | Trip-history view over the same records                  |
| `GET`  | `/trips/:id`                      | –                                                       | Same lookup as `/emergency-requests/:id`                 |
| `GET`  | `/notifications`                  | –                                                       | Newest first, capped at 50, no pagination                |
| `PATCH`| `/notifications/:id/read`         | –                                                       | Sets `isRead` and `readAt`; 404 if not yours             |

`emergencyType` is one of `MEDICAL`, `ACCIDENT`, `FIRE`, `CARDIAC`, `TRAUMA`,
`OBSTETRIC`, `OTHER`. `priority` is one of `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`.

---

### Driver — `/api/v1/driver`

Every route requires a `DRIVER` token. All trip queries are scoped to the
caller's own `driverId`.

| Method | Path                      | Body / Query                          | Notes                                                                     |
| ------ | ------------------------- | ------------------------------------- | ------------------------------------------------------------------------- |
| `GET`  | `/profile`                | –                                     | Driver + user status + linked ambulance and its type                     |
| `PATCH`| `/availability`           | `isAvailable` (boolean, required)     | Going offline is refused while holding an active trip; coming online is always allowed |
| `GET`  | `/trips/current`          | –                                     | Most recent active trip, or `null`                                       |
| `GET`  | `/trips`                  | `page`, `limit`, `sortBy`, `sortOrder`, `status?` | Paginated, own trips only                                    |
| `GET`  | `/trips/:id`              | –                                     | Own trip only                                                             |
| `POST` | `/trips/:id/accept`       | –                                     | Requires status exactly `ASSIGNED`; notifies the patient                 |
| `PATCH`| `/trips/:id/status`       | `status` — `EN_ROUTE` \| `PICKED_UP` \| `HOSPITAL_ARRIVED` \| `COMPLETED` | One legal step forward per call; anything else is a 400     |
| `GET`  | `/notifications`          | –                                     | Newest first, capped at 50                                               |
| `PATCH`| `/notifications/:id/read` | –                                     | Sets `isRead` and `readAt`                                               |

Note that `ACCEPTED` is not settable through `/trips/:id/status` — it comes from
`acceptTrip` alone. Completing a trip requires that an admin already selected a
hospital.

---

### Admin — `/api/v1/admin`

Every route requires an `ADMIN` token. Reads filter out soft-deleted records.

#### Emergency requests

| Method | Path                                | Body / Query                                       | Notes                                                        |
| ------ | ----------------------------------- | -------------------------------------------------- | ------------------------------------------------------------ |
| `GET`  | `/emergency-requests`               | `page`, `limit`, `sortBy`, `sortOrder`, `status?`, `priority?` | The dispatcher queue                                  |
| `GET`  | `/emergency-requests/:id`           | –                                                    | Full trip with patient, ambulance, driver, hospital, payment |
| `PATCH`| `/emergency-requests/:id/priority`  | `priority` (required)                                | Refused once the trip is `COMPLETED` or `CANCELLED`          |
| `POST` | `/emergency-requests/:id/assign`    | `ambulanceId` (required)                             | Only from `PENDING`. Requires an `AVAILABLE` ambulance whose driver is available and `ACTIVE`. Sets the ambulance `BUSY` and notifies the driver |
| `PATCH`| `/emergency-requests/:id/hospital`  | `hospitalId` (required)                              | Requires an active trip; refused while `PENDING`, `COMPLETED`, or `CANCELLED` |

The assign endpoint enforces its preconditions in order and reports which one
failed: the request must be `PENDING`, the ambulance must exist, be
`AVAILABLE`, not be soft-deleted, and have a driver who is not deleted, is
available, and has an `ACTIVE` user account.

#### Hospitals

| Method   | Path            | Body / Query                                              | Notes                                       |
| -------- | --------------- | --------------------------------------------------------- | ------------------------------------------- |
| `POST`   | `/hospitals`    | `name` (2+), `address` (3+), `contactNumber?`, `email?`, `type?`, `latitude?`, `longitude?` | `type` defaults to `GENERAL`  |
| `GET`    | `/hospitals`    | `page`, `limit`, `sortBy`, `sortOrder`, `type?`, `searchTerm?` | `searchTerm` matches name or address  |
| `GET`    | `/hospitals/:id`| –                                                         |                                             |
| `PATCH`  | `/hospitals/:id`| any create field, all optional                            |                                             |
| `DELETE` | `/hospitals/:id`| –                                                         | Soft delete. Refused while an active trip references it |

`type` is one of `GENERAL`, `EMERGENCY`, `TRAUMA`, `SPECIALIZED`.

#### Ambulances

| Method   | Path              | Body / Query                                                        | Notes                                                |
| -------- | ----------------- | ------------------------------------------------------------------- | ---------------------------------------------------- |
| `POST`   | `/ambulances`     | `vehicleNumber` (2+), `ambulanceTypeId`, `status?`, `driverId?`, `currentLatitude?`, `currentLongitude?` | `vehicleNumber` must be globally unique; `status` defaults to `AVAILABLE` |
| `GET`    | `/ambulances`     | `page`, `limit`, `sortBy`, `sortOrder`, `status?`, `searchTerm?`     | `searchTerm` matches vehicle number                    |
| `GET`    | `/ambulances/:id` | –                                                                     |                                                      |
| `PATCH`  | `/ambulances/:id` | any create field, all optional                                        | Re-checks uniqueness, excluding itself                 |
| `DELETE` | `/ambulances/:id` | –                                                                     | Soft delete. Refused while an active trip references it |

`status` is one of `AVAILABLE`, `BUSY`, `MAINTENANCE`, `INACTIVE`. A `driverId`
may only be linked to one ambulance.

#### Drivers

| Method | Path                  | Body / Query                                                        | Notes                                                  |
| ------ | --------------------- | ------------------------------------------------------------------- | ------------------------------------------------------ |
| `GET`  | `/drivers`            | `page`, `limit`, `sortBy`, `sortOrder`, `searchTerm?`               | `searchTerm` matches name, email, license, or vehicle  |
| `GET`  | `/drivers/:id`        | –                                                                   |                                                        |
| `PATCH`| `/drivers/:id`        | `name?`, `licenseNumber?`, `vehicleNumber?`, `contactNumber?`, `ambulanceType?` | Duplicate license numbers return 409        |
| `PATCH`| `/drivers/:id/status` | `status` — `ACTIVE` \| `BLOCKED`                                    | Writes to the linked user account; `DELETED` is not accepted here |

#### Trips

| Method | Path         | Body / Query                                                                  | Notes                                                     |
| ------ | ------------ | ----------------------------------------------------------------------------- | --------------------------------------------------------- |
| `GET`  | `/trips`     | `page`, `limit`, `sortBy`, `sortOrder`, `status?`, `driverId?`, `ambulanceId?`, `startDate?`, `endDate?` | Filtered by trip status and date range    |
| `GET`  | `/trips/:id` | –                                                                             |                                                           |

#### Dashboard and reports

| Method | Path                    | Query                             | Returns                                                                 |
| ------ | ----------------------- | --------------------------------- | ----------------------------------------------------------------------- |
| `GET`  | `/dashboard/stats`      | –                                 | 14 counters run in parallel: request totals by status, ambulance totals by status, patient/driver/hospital counts, and total revenue from completed payments |
| `GET`  | `/reports/trips`        | same params as `/trips`, plus `status?` | The trip list plus a `summary` with `total` and counts `byStatus` |
| `GET`  | `/reports/revenue`      | `startDate?`, `endDate?`           | `period`, `totalRevenue`, `totalTransactions`, a `dailyRevenue` bucket per day, and the transaction list ordered newest first. Filtered to completed payments |

---

### Payment — `/api/v1/payment`

| Method | Path       | Auth     | Body                                      |
| ------ | ---------- | -------- | ----------------------------------------- |
| `POST` | `/create`  | `PATIENT` | `tripId`, `method?` (`STRIPE`)           |
| `POST` | `/confirm` | `PATIENT` | `paymentIntentId`, `tripId`               |
| `POST` | `/webhook` | none     | Raw Stripe payload + `stripe-signature` header |

Both guarded endpoints first require that the trip exists, belongs to the
calling patient, is `COMPLETED`, and has a computed `fare`.

**`/create`** refuses if a completed payment already exists for the trip, and
otherwise reuses the trip's single pending `Payment` row (or creates it) with
`amount` set to the computed fare. For `method = STRIPE` it creates a
PaymentIntent for `amount × 100` in `usd` — dollars to cents — carrying
`tripId` and `userId` in the metadata, stores the intent id, and returns
`{ clientSecret, paymentId, amount }`. Non-Stripe methods skip the gateway and
return `{ paymentId, amount, message }`.

**`/confirm`** retrieves the PaymentIntent, requires `status === "succeeded"`,
and marks the payment `COMPLETED` with a transaction id and `paidAt`.

**`/webhook`** is mounted with `express.raw()` so the body reaches the handler
as an untouched `Buffer`, which is required for signature verification. It
rejects a missing `stripe-signature` header with a 400, then calls
`stripe.webhooks.constructEvent` and handles `payment_intent.succeeded` and
`checkout.session.completed` using the `metadata.tripId` / `metadata.userId`.
Unhandled event types are logged and ignored; the endpoint always replies 200
`Webhook triggered successfully`.

---

## Response envelope and authentication

Every response built by `sendResponse` has this shape:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "...",
  "data": {},
  "meta": { "page": 1, "limit": 10, "total": 42, "totalPages": 5 }
}
```

`meta` is present only on paginated list endpoints. The health check at `/` is the
one exception — it is written directly rather than through `sendResponse`.

Errors thrown as `AppError` are converted to JSON by `globalErrorHandler`,
carrying the same envelope with `success: false`. Unmatched routes return 404
via `notFound`.

**Sending a token.** `Authorization` accepts either `Bearer <token>` or the raw
token with no prefix, and the `accessToken` cookie is checked first if present.

```bash
curl http://localhost:5000/api/v1/auth/me \
  -H "Authorization: Bearer <accessToken>"
```

**Cookie settings.** Both tokens are `httpOnly` with a 1-day (access) and 7-day
(refresh) `maxAge`. With `NODE_ENV=development` they are `SameSite=Lax` without
`Secure`; in production they are `SameSite=None; Secure` for cross-site frontend
deployments.

**Role guard.** `auth(...roles)` in `src/app/middleware/checkAuth.ts` verifies the
JWT, checks the role against the list it was given, then reloads the user from
the database and rejects `BLOCKED` accounts. The re-read means a blocked or
deleted user loses access immediately rather than at token expiry.

---

## Data model

10 models, defined as separate files under `prisma/schema/` and mapped onto
snake_case tables.

| Model                | Notes                                                                            |
| -------------------- | -------------------------------------------------------------------------------- |
| `User`               | Login identity. `email` unique, optional `password`, optional `googleId`, `role`, `status`, `authProvider`, `needPasswordChange`, `imageUrl` |
| `Patient`            | 1-to-1 with `User`. `contactNumber`, `address`                                    |
| `Driver`             | 1-to-1 with `User`. `licenseNumber` unique, `vehicleNumber`, `isAvailable`          |
| `Ambulance`          | `vehicleNumber` unique, `status`, live `currentLatitude`/`currentLongitude`, at most one `driver` |
| `AmbulanceType`      | `baseFare`, `perKmRate`, `capacity`, `isActive`                                    |
| `EmergencyRequest`   | The trip. Location, priority, status, and the full timestamp trail (`assignedAt` → `cancelledAt`), plus `fare` and `distanceKm` |
| `Hospital`           | `type`, coordinates, `isActive`                                                    |
| `Payment`            | 1-to-1 with a trip. `amount`, `method`, `status`, `stripePaymentIntentId`, `transactionId`, `paidAt` |
| `Notification`       | Per-user, with `isRead` and `readAt`                                               |
| `EmergencyContact`   | Public info: `name`, `phone`, `type`, `description`, `isActive`                     |

A `User` has at most one `Patient` or one `Driver`. Registration writes both rows
in a single nested Prisma call. Deletes are soft — `isDeleted` / `deletedAt` exist
on `User`, `Patient`, `Driver`, `Ambulance`, and `Hospital`, and every read path
filters on them.

Enums live together in `prisma/schema/enums.prisma`:

| Enum                | Values                                                                              |
| ------------------- | ----------------------------------------------------------------------------------- |
| `Role`              | `ADMIN`, `DRIVER`, `PATIENT`                                                        |
| `UserStatus`        | `ACTIVE`, `BLOCKED`, `DELETED`                                                      |
| `AuthProvider`      | `GOOGLE`, `CREDENTIAL`                                                              |
| `Priority`          | `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`                                                 |
| `EmergencyType`     | `MEDICAL`, `ACCIDENT`, `FIRE`, `CARDIAC`, `TRAUMA`, `OBSTETRIC`, `OTHER`            |
| `TripStatus`        | `PENDING`, `ASSIGNED`, `ACCEPTED`, `EN_ROUTE`, `PICKED_UP`, `HOSPITAL_ARRIVED`, `COMPLETED`, `CANCELLED` |
| `AmbulanceStatus`   | `AVAILABLE`, `BUSY`, `MAINTENANCE`, `INACTIVE`                                      |
| `HospitalType`      | `GENERAL`, `EMERGENCY`, `TRAUMA`, `SPECIALIZED`                                     |
| `PaymentStatus`     | `PENDING`, `COMPLETED`, `FAILED`                                                    |
| `PaymentMethod`     | `STRIPE`, `SSLCOMMERZ`                                                              |

---

## Project structure

```
.
├── api/index.mjs                    # Vercel entry: re-exports the bundled Express app
├── vercel.json                      # routes all traffic to api/index.mjs
├── prisma.config.ts                 # schema dir, migrations path, datasource URL
├── tsup.config.ts                   # bundles src/server.ts + src/app.ts into dist/
├── biome.json                       # formatter + linter config (tabs, double quotes)
├── postman/                         # full end-to-end Postman collection
├── scripts/seed.ts                  # standalone seeding entry
│
├── prisma/
│   ├── schema/                      # 13 files: one per model, one for all enums
│   │   ├── schema.prisma            # generator + datasource only
│   │   ├── enums.prisma
│   │   ├── user.prisma   patient.prisma    driver.prisma
│   │   ├── ambulance.prisma  ambulanceType.prisma
│   │   ├── emergencyRequest.prisma  emergencyContact.prisma
│   │   ├── hospital.prisma   notification.prisma
│   │   └── payment.prisma
│   └── migrations/                  # generated SQL, committed to git
│
└── src/
    ├── server.ts                    # connects to the DB, seeds, then listens
    ├── app.ts                       # cors, body parsing, raw webhook body, routes, errors
    ├── generated/prisma/            # generated client — git-ignored
    └── app/
        ├── config/index.ts          # reads and exposes every environment variable
        ├── interfaces/index.ts      # shared query type (IQuery)
        ├── lib/
        │   ├── prisma.ts            # shared PrismaClient instance
        │   ├── googleAuth.ts        # Google OAuth2 client
        │   └── stripe.ts            # lazy Stripe Proxy — only builds a client on use
        ├── middleware/
        │   ├── checkAuth.ts         # exports `auth(...roles)`, the JWT + role guard
        │   ├── globalErrorHandler.ts
        │   ├── notFound.ts
        │   └── validateRequest.ts   # zod validation middleware
        ├── utils/
        │   ├── AppError.ts          # error class carrying an HTTP status code
        │   ├── catchAsync.ts        # wraps async handlers so errors reach the handler
        │   ├── sendResponse.ts      # the standard response envelope
        │   ├── jwt.ts               # sign / verify helpers
        │   ├── pagination.ts        # page/limit/sort parsing and meta building
        │   ├── query.ts             # collapses Express query objects to strings
        │   ├── fare.ts              # haversine distance + fare calculation
        │   ├── notify.ts            # notification creation helper
        │   └── seed.ts              # admin + public reference data
        └── module/                  # 6 modules, 5 files each
            ├── auth/
            ├── public/
            ├── patient/
            ├── driver/
            ├── admin/
            └── payment/
```

Each module follows the same five-file shape:

| File                  | Responsibility                                                       |
| --------------------- | -------------------------------------------------------------------- |
| `<name>.route.ts`     | Wires `auth(...roles)` and `validateRequest(...)` to controller fns    |
| `<name>.controller.ts`| Reads `req.body` / `req.query` / `req.user`, calls the service, `sendResponse` |
| `<name>.service.ts`   | All business logic and Prisma calls                                   |
| `<name>.validation.ts`| Zod schemas for the module's request bodies                           |
| `<name>.interface.ts` | TypeScript types for the module's payloads                            |

---

## Postman collection

`postman/emergency-ambulance-dispatch.postman_collection.json` walks the entire
system end to end in 11 ordered folders:

| # | Folder                      | Covers                                              |
| - | --------------------------- | --------------------------------------------------- |
| 0 | Base                        | Health check                                         |
| 1 | Public                      | The four unauthenticated endpoints                   |
| 2 | Auth                        | Patient + driver registration, admin/patient login, `/me`, refresh, logout |
| 3 | Admin - Infrastructure      | Create and maintain ambulances, hospitals, drivers; block and unblock a driver |
| 4 | Patient - Create Request    | Raise an emergency request and list it               |
| 5 | Admin - Dispatch            | Queue, raise priority, assign an ambulance, pick a hospital |
| 6 | Driver - Complete Trip      | Read notifications, accept, walk the four status steps, check profile |
| 7 | Patient - Verify & Pay      | Trip history, notifications, attempt a late cancel   |
| 8 | Payment - Stripe            | Create an intent, re-create it, confirm it           |
| 9 | Admin - Dashboard & Reports | Stats, trip report, revenue report, trip list        |
| 10| Negative / RBAC Tests       | Wrong role, missing token, invalid body, duplicate email, illegal status skip |

The collection is self-chaining: test scripts capture tokens and ids into
collection variables (`adminToken`, `driverToken`, `patientToken`, `tripId`,
`ambulanceId`, `hospitalId`, `paymentIntentId`, and others) as you go, so you
can run the folders top to bottom without copy-pasting anything by hand. The
default `base_url` is `http://localhost:5000/api/v1`.

Several requests are named for the status code they are meant to return
(`POST assign again (expect 400)`, `PATCH /driver/availability (false while
active, expect 400)`, `Skip status to COMPLETED (expect 400)`), so the collection
doubles as an RBAC and validation test pass.

---

## Scripts

```bash
npm run dev          # start with auto-reload (tsx watch src/server.ts)
npm run build        # bundle with tsup into dist/ (also catches type errors)
npm run start        # run the bundled server (node dist/server.js)
npm run seed         # run the seeders without starting the HTTP server
npm run format:check # biome format check
npm run format:fix   # biome format write
npm run lint:check   # biome lint
npm run lint:fix     # biome lint write
```

Biome is configured for tab indentation and double quotes, and ignores
`src/generated`. The full check suite is:

```bash
npm run lint:check && npm run format:check && npx tsc --noEmit
```

Prisma CLI is called directly:

```bash
npx prisma generate     # regenerate the client after editing prisma/schema/
npx prisma migrate dev  # create + apply a migration
npx prisma studio       # browser GUI for your data, at http://localhost:5555
```

---

## Conventions for new modules

New features go under `src/app/module/<name>/` following the five-file template
above, then get mounted in `app.ts` next to the existing lines. Two rules keep
module boundaries clean:

- **Controllers never call Prisma directly**, and **services never touch `req` /
  `res`** — they take plain arguments and return plain data.
- **Never spread `req.body` straight into a Prisma call** — destructure the exact
  fields you expect, so a client cannot set fields the validation schema does not
  mention. This is what keeps `status` server-controlled on emergency requests.

Wrap async controller handlers in `catchAsync` so rejected promises reach
`globalErrorHandler`, and throw `AppError` with an explicit `httpStatus` for any
expected failure.

---

## Deployment

The Vercel setup bundles the app rather than transpiling it in place.
`api/index.mjs` is a three-line file that imports the built Express app and
exports it as the default handler:

```js
import app from "../dist/app.js";

export default app;
```

`vercel.json` builds that entry with `@vercel/node`, includes `dist/**`, and
routes every path to it, so the API is stateless and all routes are handled
without a separate `functions` directory. `npm run postinstall` runs
`prisma generate && npm run build`, which means `dist/` is produced during
`vercel install` — no extra build step is needed in the dashboard.

`tsup.config.ts` outputs ESM only, with a `createRequire` banner to shim
`require()` for CommonJS dependencies, and a `require` shim is what keeps the
generated Prisma client working in the bundle. For any host that runs
`npm start` directly instead, the same build produces `dist/server.js`, which
connects to the database and runs the seeders before listening.
