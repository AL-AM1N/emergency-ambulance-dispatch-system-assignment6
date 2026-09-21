# Emergency Ambulance Dispatch System — Backend

REST API backend for an emergency ambulance dispatch platform. Patients request
ambulances, ambulance drivers fulfil them, and admins (who also act as
dispatchers) manage the platform.

**Stack:** Node.js · Express 5 · TypeScript · Prisma 7 · PostgreSQL · JWT auth

## Current status

The only feature built so far is **authentication**: patients and drivers can
register and log in, users can authenticate with Google, and every role can
fetch their own profile. Dispatch, trips, and driver availability are planned but
not implemented yet.

## Prerequisites

| Tool           | Version | Check with |
| -------------- | ------- | ---------- |
| **Node.js**    | 20+     | `node -v`  |
| **PostgreSQL** | 14+     | `psql -V`  |

Any package manager works. The examples below use `npm`.

## Getting started

**1. Install dependencies**

```bash
npm install
```

**2. Set up your environment file**

```bash
cp .env.example .env
```

Open `.env` and point `DATABASE_URL` at a Postgres database you can connect to.
The database does not need to exist beforehand — `prisma migrate dev` creates it.

**3. Generate the Prisma client**

```bash
npx prisma generate
```

Prisma writes a typed client into `src/generated/prisma`. That folder is
git-ignored, and almost every file under `src/` imports from it, so a fresh clone
must run this before it compiles.

**4. Run the migrations**

```bash
npx prisma migrate dev
```

**5. Start the server**

```bash
npm run dev
```

You should see:

```
Connected to the database successfully.
Admin Created :  { ... }          # first run only
Server is running on port 5000
```

Confirm it's up:

```bash
curl http://localhost:5000/
# {"success":true,"message":"Welcome to Emergency Ambulance Dispatch System Backend"}
```

## Environment variables

`src/app/config/index.ts` is the only place `process.env` is read — application
code imports `config` from there.

| Variable                 | What it's for                                                       |
| ------------------------ | ------------------------------------------------------------------- |
| `NODE_ENV`               | `development` returns detailed errors and enables non-secure cookies |
| `PORT`                   | Port the HTTP server listens on                                     |
| `DATABASE_URL`           | Postgres connection string, used by both Prisma and the app         |
| `JWT_ACCESS_SECRET`      | Signing key for access tokens                                       |
| `JWT_REFRESH_SECRET`     | Signing key for refresh tokens                                      |
| `JWT_ACCESS_EXPIRES_IN`  | Access token lifetime (e.g. `1d`)                                   |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token lifetime                                              |
| `BCRYPT_SALT_ROUNDS`     | bcrypt cost factor for password hashing                             |
| `BACKEND_URL`            | Absolute base URL of this API                                       |
| `FRONTEND_URL`           | Added to the CORS allowlist                                         |
| `GOOGLE_CLIENT_ID`       | OAuth 2.0 client id used to verify Google idTokens                  |
| `ADMIN_NAME`             | Name of the seeded admin account                                    |
| `ADMIN_EMAIL`            | Email of the seeded admin account                                   |
| `ADMIN_PASSWORD`         | Password of the seeded admin account                                |

Replace the JWT secrets and admin password before deploying.

## Roles

Three roles exist: `PATIENT`, `DRIVER`, and `ADMIN` (which doubles as the
dispatcher). Registration always assigns the role based on the endpoint used —
a `role` in the request body is ignored, so no one can self-register as admin.
The admin account is **seeded from `.env`** on server start.

## The API

Base URL: `http://localhost:5000`

| Method | Path                           | Auth     | Body                                                                              |
| ------ | ------------------------------ | -------- | --------------------------------------------------------------------------------- |
| `GET`  | `/`                            | –        | health check                                                                       |
| `POST` | `/api/v1/auth/register/patient`| –        | `name`, `email`, `password`, `patient?` (`contactNumber`, `address`)               |
| `POST` | `/api/v1/auth/register/driver` | –        | `name`, `email`, `password`, `licenseNumber`, `vehicleNumber`, `contactNumber?`, `ambulanceType?` |
| `POST` | `/api/v1/auth/login`           | –        | `email`, `password`                                                                |
| `POST` | `/api/v1/auth/google`          | –        | `idToken`                                                                          |
| `GET`  | `/api/v1/auth/me`              | any role | –                                                                                  |
| `POST` | `/api/v1/auth/refresh-token`   | cookie   | reads the `refreshToken` cookie                                                    |
| `POST` | `/api/v1/auth/logout`          | –        | –                                                                                  |

Every response from `sendResponse` has this shape:

```json
{ "success": true, "statusCode": 201, "message": "...", "data": {} }
```

`register` and `login` return `accessToken` and `refreshToken` in the JSON body
and as httpOnly cookies. With `NODE_ENV=development`, cookies are `SameSite=Lax`
without `Secure`; in production they are `SameSite=None; Secure`.

### Examples

```bash
# Register a patient
curl -X POST http://localhost:5000/api/v1/auth/register/patient \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Patient","email":"patient@example.com","password":"Password@123"}'

# Log in
curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"patient@example.com","password":"Password@123"}'

# Fetch your own profile
curl http://localhost:5000/api/v1/auth/me \
  -H "Authorization: Bearer <accessToken>"
```

`Authorization` accepts either `Bearer <token>` or the raw token.

### Google login

`POST /api/v1/auth/google` verifies the Google `idToken` against
`GOOGLE_CLIENT_ID`. The same account can log in with email/password and Google:

- **New Google email** → a `PATIENT` account is created.
- **Existing patient or driver** → the Google id is linked to that account, and
  both login methods work afterwards.
- **Admin or blocked/deleted accounts** → rejected.

Drivers never *register* through Google (a first-time Google login is always a
patient), but an existing driver may link Google later.

## Project structure

```
src/
├── server.ts                       # connects to the DB, seeds admin, then listens
├── app.ts                          # express app: cors, body parsing, routes, error handling
├── generated/prisma/               # Prisma client — git-ignored, run `npx prisma generate`
└── app/
    ├── config/index.ts             # reads and exposes every environment variable
    ├── interfaces/index.ts         # shared query/pagination types
    ├── lib/
    │   ├── prisma.ts               # shared PrismaClient instance
    │   └── googleAuth.ts           # Google OAuth2 client
    ├── middleware/
    │   ├── checkAuth.ts            # exports `auth(...roles)`, the JWT + role guard
    │   ├── globalErrorHandler.ts   # turns thrown errors into JSON responses
    │   ├── notFound.ts             # catch-all for unmatched routes
    │   └── validateRequest.ts      # zod validation middleware
    ├── utils/
    │   ├── AppError.ts             # error class carrying an HTTP status code
    │   ├── catchAsync.ts           # wraps async handlers so errors reach the error handler
    │   ├── jwt.ts                  # sign / verify helpers
    │   ├── seed.ts                 # seeds the admin account
    │   └── sendResponse.ts         # the standard response envelope
    └── module/
        └── auth/                   # authentication module
            ├── auth.route.ts
            ├── auth.controller.ts
            ├── auth.service.ts
            ├── auth.interface.ts
            └── auth.validation.ts

prisma/
├── schema/
│   ├── schema.prisma                # generator + datasource only
│   ├── enums.prisma                 # Role, UserStatus, AuthProvider
│   ├── user.prisma
│   ├── patient.prisma
│   └── driver.prisma
└── migrations/                      # generated SQL, committed to git
```

**Data model:** a `User` has at most one `Patient` (1-to-1) or one `Driver`
(1-to-1). Registration writes both rows in one nested Prisma call. Deletes are
meant to be soft — `isDeleted` / `deletedAt` exist on the models — but nothing
sets them yet.

## Extending this starter

New features go under `src/app/module/<name>/` with four files:

| File                   | Responsibility                                                       |
| ---------------------- | -------------------------------------------------------------------- |
| `<name>.route.ts`      | Wires `auth(...roles)` to controller functions                        |
| `<name>.controller.ts` | Reads `req.body` / `req.user`, calls the service, calls `sendResponse` |
| `<name>.service.ts`    | All business logic and Prisma calls                                   |
| `<name>.interface.ts`  | TypeScript types for the module's payloads                            |

Then mount it in `app.ts` next to the existing line. Two rules keep module
boundaries clean:

- **Controllers never call Prisma directly**, and **services never touch `req` /
  `res`**.
- **Never spread `req.body` straight into a Prisma call** — destructure the exact
  fields you expect.

## Scripts

```bash
npm run dev          # start with auto-reload (tsx watch)
npm run build        # bundle with tsup (also catches type errors)
npm run start        # run the bundled server
npm run format:check # biome format check
npm run format:fix   # biome format write
npm run lint:check   # biome lint
npm run lint:fix     # biome lint write
```

Prisma CLI is called directly:

```bash
npx prisma generate     # regenerate the client after editing prisma/schema/
npx prisma migrate dev  # create + apply a migration
npx prisma studio       # browser GUI for your data, at http://localhost:5555
```
