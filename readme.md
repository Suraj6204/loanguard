# LoanGuard 🏦

A production-grade Loan Management System with end-to-end loan lifecycle — from borrower application to sanctioning, disbursement, collection, and auto-closure.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 · React 18 · Redux Toolkit · Tailwind CSS |
| Backend | Node.js · Express · TypeScript |
| Database | MongoDB (Mongoose) |
| Auth | JWT + bcrypt |
| File Storage | MongoDB Binary Buffer (no external cloud dependency) |

---

## Project Structure

```
loanguard/
├── client/                 # Next.js frontend
│   ├── src/
│   │   ├── app/            # Pages — Borrower portal, Dashboard modules, Auth
│   │   ├── components/     # Shared UI components
│   │   ├── services/       # Axios API layer
│   │   └── store/          # Redux slices
│   └── package.json
│
├── server/                 # Express backend
│   ├── src/
│   │   ├── config/         # DB connection, env vars
│   │   ├── controllers/    # Route handlers
│   │   ├── middleware/      # Auth, validation, rate limiting
│   │   ├── models/         # Mongoose schemas
│   │   ├── routes/         # API route definitions
│   │   ├── utils/          # Helpers (SHA-256, file utils)
│   │   ├── validators/     # Zod schemas
│   │   ├── types/          # TypeScript interfaces & enums
│   │   ├── seed.ts         # Database seeder
│   │   └── server.ts       # Entry point
│   ├── .env.example        # Environment variable template
│   └── package.json
│
└── README.md
```

---

## Setup Instructions

### Prerequisites

- **Node.js** v18+
- **MongoDB** — running locally or a MongoDB Atlas connection string

### 1. Clone the repo

```bash
git clone https://github.com/Suraj6204/loanguard.git
cd loanguard
```

### 2. Install dependencies

```bash
# Backend
cd server
npm install

# Frontend (in a separate terminal)
cd client
npm install
```

### 3. Configure environment variables

```bash
cd server
cp .env.example .env
```

Open `server/.env` and fill in your values:

```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://127.0.0.1:27017/loanguard   # or your Atlas URI
JWT_SECRET=change-this-to-a-strong-random-secret
JWT_EXPIRES_IN=24h
CORS_ORIGIN=http://localhost:3000
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
AUTH_RATE_LIMIT_MAX=50
```

### 4. Seed the database

```bash
cd server
npm run seed
```

This creates one user per role with the following credentials:

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@loanguard.com | Admin@123 |
| Sales | sales@loanguard.com | Sales@123 |
| Sanction | sanction@loanguard.com | Sanction@123 |
| Disbursement | disbursement@loanguard.com | Disbursement@123 |
| Collection | collection@loanguard.com | Collection@123 |
| Borrower | borrower@loanguard.com | Borrower@123 |

### 5. Start the servers

```bash
# Terminal 1 — Backend (runs on http://localhost:5000)
cd server
npm run dev

# Terminal 2 — Frontend (runs on http://localhost:3000)
cd client
npm run dev
```

Open **http://localhost:3000** in your browser.

---

## Roles & Access

| Role | Access |
|------|--------|
| **Borrower** | Apply for loans, upload documents, track status |
| **Sales** | View registered leads and application pipeline |
| **Sanction** | Approve or reject pending loan applications |
| **Disbursement** | Disburse sanctioned loans |
| **Collection** | Record payments, track outstanding, auto-close loans |
| **Admin** | Full access to all modules + audit logs |

---

## Loan Lifecycle

```
Borrower Applies
      │
      ▼
   PENDING ──────► REJECTED
      │
      ▼
  SANCTIONED
      │
      ▼
  DISBURSED
      │
      ▼ (payments recorded until fully paid)
    CLOSED
```

Only valid state transitions are allowed. The backend enforces the state machine and role-based permissions independently.

---

## Key Features

### Document Validation Pipeline
Uploaded salary slips go through a multi-step validation:
1. **Size check** — max 5 MB
2. **Extension check** — `.pdf`, `.jpg`, `.jpeg`, `.png`
3. **MIME type check**
4. **Magic byte verification** — validates actual file signature (e.g. `%PDF`)
5. **Parseability check** — ensures the file is not corrupt
6. **SHA-256 fingerprint** — detects duplicate uploads
7. **Stored as binary in MongoDB** — no external cloud dependency

### Business Rule Engine (BRE)
Server-side eligibility check before a borrower can apply:
- Age must be 18–65
- Monthly salary ≥ ₹25,000
- Valid PAN format
- Employment mode cannot be Unemployed

### Financial Integrity
- Interest is calculated server-side: `SI = (P × R × T) / (365 × 100)`
- Frontend shows a live preview, but the backend recalculates on submission
- Payments are validated atomically — no overpayment, no race conditions
- Loans auto-close when `totalPaid == totalRepayment`

### Audit Trail
Every significant action is logged to an append-only `auditLogs` collection:
- Login, registration
- Document uploads and validation results
- Loan creation, sanction, rejection, disbursement
- Payment recording
- Loan closure

Audit events power the **Loan Timeline** UI visible on each application.

### Draft Auto-Save
Borrower application progress (current step, uploaded document, loan configuration) is saved to `localStorage` so users can refresh or return without losing work.

---

## API Overview

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register a new borrower |
| POST | `/api/auth/login` | Login |
| GET | `/api/auth/me` | Get current user |

### Borrower
| Method | Endpoint | Description |
|--------|----------|-------------|
| PUT | `/api/borrower/profile` | Update personal details |
| POST | `/api/borrower/bre-check` | Run BRE eligibility check |

### Documents
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/documents/upload` | Upload salary slip |
| GET | `/api/documents/:id` | Get document metadata |
| GET | `/api/documents/:id/view` | Stream document binary |
| GET | `/api/documents/me` | List my documents |

### Loans
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/applications/calculate` | Preview loan calculation |
| POST | `/api/applications/apply` | Submit loan application |
| GET | `/api/applications/me` | My applications |
| GET | `/api/loans/:id` | Get loan by ID |
| GET | `/api/loans/:id/timeline` | Get audit timeline |
| POST | `/api/loans/:id/sanction` | Approve loan |
| POST | `/api/loans/:id/reject` | Reject loan |
| POST | `/api/loans/:id/disburse` | Disburse loan |
| POST | `/api/loans/:id/payments` | Record payment |
| GET | `/api/loans/:id/payments` | Get payment history |

### Operations
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/operations/sales/leads` | Sales lead pipeline |
| GET | `/api/operations/sanction/loans` | Sanction queue |
| GET | `/api/operations/disbursement/loans` | Disbursement queue |
| GET | `/api/operations/collection/loans` | Collection queue |
| GET | `/api/admin/dashboard` | Admin dashboard stats |
| GET | `/api/admin/audit-logs` | Full audit log |

---

## Security

- **Passwords** hashed with bcrypt (12 salt rounds)
- **JWT** authentication on all protected routes
- **RBAC middleware** on every operations endpoint
- **Resource-level auth** — borrowers can only access their own data
- **Rate limiting** on auth and general endpoints
- **Helmet** security headers
- **CORS** restricted to configured origin
- **Document storage** — binary data served through an authenticated API proxy, not via public URLs
- **Database indexes** — unique constraints on `email`, `PAN`, `UTR`, `SHA-256` to prevent duplicates at the DB level
- **Atomic payments** — MongoDB transactions protect against concurrent payment race conditions

---

## Scripts

### Server
```bash
npm run dev      # Start dev server with hot-reload (tsx watch)
npm run build    # Compile TypeScript
npm run start    # Run compiled output
npm run seed     # Seed database with demo users
```

### Client
```bash
npm run dev      # Start Next.js dev server
npm run build    # Production build
npm run start    # Serve production build
```

---

## Deployment

### Deploy Backend (Render / Railway / any Node host)

1. Set the **Root Directory** to `server`.
2. **Build Command**: `npm install && npm run build`
3. **Start Command**: `npm run start`
4. Set these **Environment Variables** on the hosting platform:
   ```
   NODE_ENV=production
   PORT=5000
   MONGODB_URI=<your-atlas-connection-string>
   JWT_SECRET=<strong-random-secret>
   JWT_EXPIRES_IN=24h
   CORS_ORIGIN=https://your-frontend-domain.com
   ```
5. After the first deploy, run the seed (one-time via shell/console):
   ```bash
   npm run seed
   ```

### Deploy Frontend (Vercel / Render / any Node host)

1. Set the **Root Directory** to `client`.
2. **Build Command**: `npm install && npm run build`
3. **Start Command**: `npm run start`
4. Set these **Environment Variables** on the hosting platform:
   ```
   NEXT_PUBLIC_API_URL=https://your-backend-domain.com
   ```

> **Note:** The Next.js `rewrites` in `next.config.js` proxy all `/api/*` requests to the backend URL. This means the frontend and backend can be deployed on different domains without CORS issues on the client side. Just make sure the backend's `CORS_ORIGIN` env var matches your frontend's deployed URL.

