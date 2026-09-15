# LoanGuard 🏦

A production-grade, secure Loan Management System (LMS) built with a modern full-stack architecture. LoanGuard goes beyond basic CRUD operations to prioritize trust, document integrity, controlled state transitions, strong Role-Based Access Control (RBAC), and a complete audit trail.

## 🚀 Tech Stack

### Frontend (Client)
- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS (Custom Fintech theme with glassmorphism)
- **State Management:** Redux Toolkit
- **API Communication:** Axios with global interceptors

### Backend (Server)
- **Runtime:** Node.js
- **Framework:** Express.js
- **Language:** TypeScript
- **Database:** MongoDB with Mongoose
- **Authentication:** JWT + bcrypt
- **Storage:** Cloudinary Storage
- **Validation:** Zod

## 🌟 Key Features

1. **Role-Based Access Control (RBAC):**
   - Distinct portals for Borrowers, Sales, Sanction, Disbursement, Collection, and Admin roles.
   - Strict middleware-level enforcement of role permissions.

2. **Business Rule Engine (BRE):**
   - Automated eligibility checks based on age, salary, and employment mode before allowing application submissions.

3. **Document Integrity & Validation:**
   - Secure file uploads directly to Cloudinary.
   - "Magic byte" validation to ensure file types.
   - SHA-256 hashing to verify document integrity and prevent tampering.

4. **Robust State Machine:**
   - Strict linear transitions for loans: `APPLIED` ➔ `SANCTIONED` ➔ `DISBURSED` ➔ `CLOSED`.
   - Prevents invalid state jumps.

5. **Financial Consistency & Concurrency:**
   - Database-level transactions and snapshot reads to prevent race conditions during payment recording.
   - Server-authoritative financial calculations for interest and outstanding balances.

6. **Comprehensive Audit Trail:**
   - Append-only logging of all critical actions in the system.
   - Captures who performed the action, what entity was affected, the new state, and metadata (IP, User Agent).

## 📂 Project Structure

The project is structured as a monorepo with two main directories:

- `/client` - Next.js frontend application.
- `/server` - Express.js backend API.

## 🛠️ Setup Instructions

### Backend Setup

1. Navigate to the server directory:
   ```bash
   cd server
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure environment variables:
   - Copy `.env.example` to `.env` and fill in your MongoDB URI, JWT secret, and Supabase credentials.
4. Run the seed script to populate initial roles (Admin, Sales, Sanction, etc.):
   ```bash
   npx ts-node src/seed.ts
   ```
5. Start the development server:
   ```bash
   npm run dev
   ```

### Frontend Setup

1. Navigate to the client directory:
   ```bash
   cd client
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```

## 🔐 Default Demo Credentials

The database seeder creates default accounts for testing the RBAC system:

- **Admin:** `admin@loanguard.com` / `Admin@123`
- **Sales:** `sales@loanguard.com` / `Sales@123`
- **Sanction:** `sanction@loanguard.com` / `Sanction@123`
- **Disbursement:** `disbursement@loanguard.com` / `Disbursement@123`
- **Collection:** `collection@loanguard.com` / `Collection@123`
- **Borrower:** `borrower@loanguard.com` / `Borrower@123`
