PRODUCTION-GRADE LOAN MANAGEMENT SYSTEM — BUILD PROMPT

Master build prompt for Next.js + TypeScript + Tailwind CSS + Redux Toolkit + Node.js + Express.js + MongoDB + JWT + Supabase Storage

Goal: Build a professional, secure, production-oriented Loan Management System that goes beyond basic CRUD. The core differentiator is trust: document integrity, database-level conflict protection, controlled loan state transitions, strong RBAC, server-authoritative financial calculations, and a complete audit trail.


1. MASTER PROMPT — COPY/PASTE INTO YOUR AI CODING TOOL

Build a complete production-grade Loan Management System (LMS) as a full-stack web application.

TECH STACK — MUST USE

- Frontend: Next.js App Router, TypeScript, Tailwind CSS
- State management: Redux Toolkit
- Backend: Node.js, Express.js, TypeScript
- Database: MongoDB with Mongoose
- Authentication: JWT + bcrypt
- File storage: Supabase Storage
- API style: REST
- Use strict TypeScript. Avoid `any` unless absolutely unavoidable.
- Use environment variables and provide `.env.example`.

PRODUCT GOAL

Do not build a generic CRUD dashboard. Build a trustworthy lending workflow where document validity, database constraints, financial consistency, authorization, conflict handling, and auditability are first-class concerns.

CORE LOAN LIFECYCLE

Borrower:
Signup/Login -> Personal Details -> BRE Eligibility -> Salary Slip Upload -> Loan Configuration -> Apply

Operations:
Applied/Pending -> Sanction -> Sanctioned OR Rejected -> Disbursement -> Disbursed -> Collection -> Closed

Only valid state transitions are allowed. Never expose a generic endpoint that lets a client arbitrarily set loan status.

ROLES

- Admin: all dashboard modules
- Sales: sales/lead module only
- Sanction: sanction module only
- Disbursement: disbursement module only
- Collection: collection module only
- Borrower: borrower portal and own application data only

Enforce authorization on both frontend and backend. Frontend menu hiding is only a UX feature; backend APIs must independently reject unauthorized requests.


BORROWER FLOW

1. Authentication

- Signup and login.
- Hash passwords using bcrypt.
- Issue JWT after authentication.
- Protect all private routes.
- Never store plaintext passwords.
- Do not put secrets in frontend code.
- Return correct 401/403 responses.


2. Personal Details + Business Rule Engine

Collect:

- Full name
- PAN
- Date of birth
- Monthly salary
- Employment mode: Salaried / Self-Employed / Unemployed

Server-side BRE rejection rules:

- Age must be between 23 and 50 inclusive.
- Salary must be at least ₹25,000/month.
- PAN must match a valid PAN format.
- Employment mode cannot be Unemployed.

Implement BRE as modular rules:

AgeRule, SalaryRule, PANRule, EmploymentRule.

Return structured rejection reasons, for example:

{
  "eligible": false,
  "reasons": [
    {
      "rule": "MIN_SALARY",
      "message": "Monthly salary must be at least ₹25,000"
    }
  ]
}

Client-side validation may improve UX, but the server-side BRE is authoritative.


3. Salary Slip Upload — HIGH PRIORITY

Accept PDF/JPG/JPEG/PNG and maximum 5 MB.

Implement a multi-layer document validation pipeline:

Upload
-> size validation
-> extension validation
-> MIME validation
-> actual file signature / magic-byte validation
-> parseability/corruption check where practical
-> SHA-256 fingerprint
-> duplicate detection
-> store in Supabase Storage
-> persist document metadata

Do NOT trust filename extension or browser-provided MIME type alone.

Store document metadata:

- applicationId
- storageKey/path
- originalName
- mimeType
- size
- sha256
- validationStatus
- validationResults
- uploadedBy
- uploadedAt

Use SHA-256 to detect identical files. Enforce duplicate protection with a database uniqueness constraint where appropriate.

Important: SHA-256 proves file integrity/sameness, not that the salary slip is genuinely issued by an employer. Do not falsely label a file as externally authenticated.

Use private Supabase Storage if possible. Generate signed URLs for authorized viewing instead of exposing permanent public file URLs.


4. Loan Configuration

Loan amount range: ₹50,000 to ₹5,00,000.

Tenure: 30 to 365 days.

Fixed interest rate: 12% per annum.

Simple Interest:

SI = (P × R × T) / (365 × 100)

Total Repayment = P + SI

Frontend must show a live calculation panel while sliders move.

IMPORTANT:

The frontend calculation is only a preview. On Apply, the backend must validate the requested amount/tenure and calculate the authoritative interest and repayment values itself. Never trust client-supplied financial totals.

Persist:

- principal
- annualInterestRate
- tenureDays
- interestAmount
- totalRepayment
- totalPaid
- outstandingAmount
- status


5. Application Creation

On Apply:

- Verify authenticated borrower.
- Verify BRE eligibility.
- Verify valid document.
- Validate amount and tenure.
- Recalculate loan math on server.
- Create application with PENDING/APPLIED status.
- Record an audit event.
- Prevent duplicate active applications if your business rules define such a restriction.


DATABASE DESIGN

Create at least:

1. users
2. loanApplications
3. documents
4. payments
5. auditLogs

Optionally:

6. refreshTokens/session records if implementing refresh-token rotation.


RECOMMENDED USER FIELDS

_id, name, email, passwordHash, role, pan, dateOfBirth, monthlySalary, employmentMode, createdAt, updatedAt


RECOMMENDED LOAN FIELDS

_id, borrowerId, documentId, principal, tenureDays, annualInterestRate, interestAmount, totalRepayment, totalPaid, outstandingAmount, status, rejectionReason, sanctionedBy, sanctionedAt, disbursedBy, disbursedAt, createdAt, updatedAt


RECOMMENDED DOCUMENT FIELDS

_id, applicationId, storageKey, originalName, mimeType, size, sha256, validationStatus, validationResults, uploadedBy, createdAt


RECOMMENDED PAYMENT FIELDS

_id, loanId, utrNumber, amount, paymentDate, recordedBy, createdAt


RECOMMENDED AUDIT LOG FIELDS

_id, actorId, actorRole, action, entityType, entityId, previousState, newState, metadata, ipAddress, userAgent, createdAt


DATABASE-FIRST CONFLICT AND SECURITY DESIGN

Treat database constraints as the final line of defense.

Create unique indexes for:

- users.email
- users.pan where appropriate
- payments.utrNumber
- documents.sha256 where appropriate

Do not rely only on "check then insert" application logic.

Handle duplicate-key errors cleanly and return a meaningful conflict response, typically HTTP 409.


PAYMENT / COLLECTION FLOW

Collection executives can record payments only for DISBURSED loans.

Payment fields:

- UTR number
- amount
- date

Validation:

- UTR is required and globally unique across all payments.
- Amount must be positive.
- Payment cannot exceed current outstanding balance.
- Payment date must be valid.
- Loan must exist.
- Loan must be DISBURSED.
- User must have Collection/Admin permission.

Calculate outstanding from authoritative server/database state, not from the browser.

When:

totalPaid == totalRepayment

automatically transition the loan to CLOSED.

Do not allow totalPaid to exceed totalRepayment.


CONCURRENCY / RACE CONDITION PROTECTION

Design payment recording to survive two Collection executives submitting payments at nearly the same time.

Use MongoDB transactions and/or atomic update patterns where appropriate.

Within the protected operation:

- verify loan state
- read/recalculate authoritative paid/outstanding values
- verify amount <= outstanding
- create payment
- update loan totals/state
- create audit record

Avoid a simple vulnerable pattern of "read outstanding -> calculate -> write" without concurrency protection.


LOAN STATE MACHINE

Implement explicit valid transitions.

Example:

PENDING/APPLIED -> SANCTIONED
PENDING/APPLIED -> REJECTED
SANCTIONED -> DISBURSED
DISBURSED -> CLOSED

Do not allow:

PENDING -> DISBURSED
PENDING -> CLOSED
REJECTED -> DISBURSED
CLOSED -> DISBURSED

The exact transition map should be centralized in backend business logic.

Each transition must also check the actor role:

- Sanction role can approve/reject eligible applied loans.
- Disbursement role can disburse sanctioned loans.
- Collection role records payments on disbursed loans.
- Admin can perform authorized administrative operations.


SANCTION

Show applied loans with:

- borrower summary
- requested amount
- tenure
- interest/repayment
- document status
- BRE result
- application timeline

Actions:

Approve -> SANCTIONED

Reject -> REJECTED, with mandatory rejection reason


DISBURSEMENT

Show SANCTIONED loans.

Action:

Disburse -> DISBURSED

Persist:

- disbursedBy
- disbursedAt


COLLECTION

Show DISBURSED loans.

Display:

- principal
- total repayment
- total paid
- outstanding
- payment history

Record payment and update the timeline.

Auto-close when fully paid.


AUDIT TRAIL — MAJOR DIFFERENTIATOR

Create an append-only auditLogs collection.

Record important events:

- LOGIN
- APPLICATION_CREATED
- BRE_PASSED
- BRE_FAILED
- DOCUMENT_UPLOADED
- DOCUMENT_VALIDATION_FAILED
- DOCUMENT_VALIDATED
- LOAN_APPROVED
- LOAN_REJECTED
- LOAN_DISBURSED
- PAYMENT_RECORDED
- LOAN_CLOSED
- AUTHORIZATION_DENIED
- IMPORTANT_SECURITY_EVENTS

Each log should capture:

- actor
- role
- action
- entity type/id
- previous state
- new state
- metadata
- timestamp
- IP/user-agent where appropriate

Normal users must not be able to edit/delete audit records. Prefer an append-only application design.


LOAN TIMELINE UI

Build a polished timeline using audit events:

- Application Created
- BRE Passed/Failed
- Document Validated
- Loan Applied
- Sanctioned/Rejected
- Disbursed
- Payments
- Closed

Show actor and timestamp where appropriate.


DASHBOARD

Build a professional operations dashboard.

Sales:

- registered leads
- users who started but have not applied
- application progress
- document-pending users

Sanction:

- pending reviews
- approved/rejected counts
- recent applications

Disbursement:

- sanctioned loans ready for disbursement
- recently disbursed loans

Collection:

- active disbursed loans
- total outstanding
- recent payments
- recently closed loans

Admin:

- consolidated view of all modules
- role-aware navigation
- system activity/audit overview


PROFESSIONAL UI/UX

Create a modern fintech-style interface, not a basic admin template.

Requirements:

- responsive desktop/tablet/mobile
- clean typography
- consistent spacing
- professional color system
- cards, tables, badges, drawers/modals where useful
- skeleton loading states
- empty states
- error states
- success feedback
- confirmation dialogs for irreversible actions
- accessible form labels and keyboard-friendly interactions
- clear status badges
- pagination/filtering/search where useful
- polished borrower stepper/progress indicator
- loan calculation card
- document validation status indicator
- loan timeline
- responsive dashboard sidebar
- top navigation with user/role information
- no excessive animations


BORROWER UI

Use a multi-step application experience:

Step 1: Sign up/Login
Step 2: Personal Details + eligibility
Step 3: Salary Slip Upload + validation status
Step 4: Loan Amount/Tenure + repayment calculation
Step 5: Review + Apply

Clearly show why an application is blocked.

Prevent moving forward when required validations fail.


SECURITY REQUIREMENTS

- bcrypt password hashing
- JWT authentication
- backend authorization middleware
- role-based middleware
- resource-level authorization for borrower-owned data
- input validation on every write endpoint
- sanitize/validate data
- safe error messages
- rate limiting on authentication and sensitive endpoints
- CORS configured from environment
- Helmet/security headers
- never expose passwordHash
- never expose internal secrets
- secure Supabase Storage access
- signed URLs for private documents
- database indexes for important uniqueness constraints
- centralized error handling
- 401 for unauthenticated requests
- 403 for authenticated but unauthorized requests
- 409 for database/business conflicts where appropriate
- 422 or 400 for invalid input, using a consistent API convention


REST API DESIGN

Design clean routes such as:

POST /api/auth/register
POST /api/auth/login
GET /api/auth/me

POST /api/applications
GET /api/applications/me
GET /api/applications/:id

POST /api/documents/upload
GET /api/documents/:id

GET /api/operations/sales/leads
GET /api/operations/sanction/loans
POST /api/loans/:id/sanction
POST /api/loans/:id/reject

GET /api/operations/disbursement/loans
POST /api/loans/:id/disburse

GET /api/operations/collection/loans
POST /api/loans/:id/payments

GET /api/loans/:id/timeline
GET /api/admin/audit-logs

Adapt routes if a better REST design is justified.

Keep controllers thin and move business rules into services.


BACKEND ARCHITECTURE

Use a clean structure such as:

src/
  config/
  controllers/
  middleware/
  models/
  routes/
  services/
  validators/
  rules/
  utils/
  types/
  constants/
  app.ts
  server.ts

Important services:

- authService
- breService
- documentService
- loanService
- paymentService
- auditService
- storageService

Keep business logic out of route files.


FRONTEND ARCHITECTURE

Use:

app/
components/
features/
  auth/
  borrower/
  loans/
  dashboard/
  documents/
  payments/
  audit/
store/
services/
hooks/
types/
utils/

Use Redux Toolkit for global/auth/application state where appropriate.

Do not put every local form field into Redux unnecessarily.


API ERROR FORMAT

Use a consistent structure:

{
  "success": false,
  "message": "Human readable message",
  "code": "DUPLICATE_UTR",
  "details": {}
}

Handle loading/error/success states consistently in the UI.


DATABASE INDEXING

Add indexes deliberately for:

- email
- PAN where uniqueness applies
- loan borrowerId
- loan status
- payment loanId
- payment UTR
- document applicationId
- document SHA-256
- audit entityId + createdAt
- timestamps used for dashboard queries

Do not add indexes blindly; explain important index choices in README.


SEED DATA

Create a seed script that creates one account for every required role:

Admin
Sales
Sanction
Disbursement
Collection
Borrower

Use known evaluator credentials and document them in README.


TESTING

Add meaningful tests for the highest-risk logic:

- BRE pass
- BRE fail for every rule
- PAN validation
- loan interest calculation
- invalid state transition
- unauthorized role
- duplicate UTR
- payment greater than outstanding
- automatic loan closure
- duplicate document fingerprint
- concurrent payment protection where practical


README

Include:

- project overview
- architecture diagram
- setup steps
- environment variables
- Supabase bucket configuration
- MongoDB setup
- seed credentials
- API overview
- loan state machine
- BRE rules
- document validation pipeline
- database indexes and why they exist
- security decisions
- conflict/race-condition handling
- screenshots
- demo instructions


FINAL QUALITY BAR

The application must feel like a real internal lending product:

- trustworthy
- secure
- auditable
- consistent under conflicts
- responsive
- professional
- easy to evaluate

Do not add random AI/chatbot/microservice features just to increase feature count.

Prioritize a complete, reliable end-to-end loan lifecycle and make the core financial/document workflow exceptionally well engineered.


2. RECOMMENDED UNIQUE DIFFERENTIATORS

These are the features that should make the project visibly stronger than a normal MERN CRUD implementation.

1. Document integrity
Implementation: Magic bytes + MIME + size + parseability
Why it matters: Prevents trusting a renamed or malformed file

2. Document fingerprint
Implementation: SHA-256 + uniqueness protection
Why it matters: Detects identical duplicate uploads

3. Database-first conflicts
Implementation: Unique indexes + 409 handling
Why it matters: Protects against concurrent duplicate requests

4. Financial consistency
Implementation: Server-side calculation + atomic payment flow
Why it matters: Prevents manipulated totals and race conditions

5. Loan state machine
Implementation: Explicit transition map + role checks
Why it matters: Prevents illegal lifecycle jumps

6. Audit trail
Implementation: Append-only auditLogs
Why it matters: Makes every important financial action traceable

7. Private document storage
Implementation: Supabase private bucket + signed URLs
Why it matters: Reduces unauthorized document exposure

8. Resource authorization
Implementation: Borrower can access only own records
Why it matters: Prevents ID-based data leakage

9. Operational timeline
Implementation: Audit events rendered as a loan timeline
Why it matters: Turns backend traceability into useful UX


3. END-TO-END FLOW TO DEMONSTRATE

- Borrower signs up and logs in.
- Borrower enters personal information.
- BRE runs on the server and shows clear pass/fail reasons.
- Borrower uploads salary slip; the system validates size, type, file signature, integrity, and duplicate fingerprint.
- Borrower selects loan amount and tenure; UI calculates repayment live.
- Backend recalculates the authoritative financial values and creates the application.
- Sanction executive reviews the application and approves or rejects with a reason.
- Disbursement executive disburses only a sanctioned loan.
- Collection executive records payments with globally unique UTR numbers.
- The backend prevents overpayment and handles concurrent payment attempts safely.
- When total paid equals total repayment, the loan automatically becomes CLOSED.
- The loan timeline displays the full audit history.


4. DATABASE-SAFETY CHECKLIST

- Unique email index.
- Unique PAN index where the business model requires one PAN per borrower.
- Unique UTR index across all payments.
- Unique SHA-256 document fingerprint where duplicate files must be prevented.
- Indexes for borrowerId, status, loanId, applicationId, and audit query patterns.
- Never depend only on a frontend check for uniqueness.
- Catch MongoDB duplicate-key errors and return a clear 409 Conflict response.
- Use transactions/atomic updates for multi-document financial operations.
- Never trust client-provided totalPaid, outstandingAmount, interestAmount, or totalRepayment.


5. SECURITY CHECKLIST

- Passwords hashed with bcrypt.
- JWT-protected APIs.
- RBAC middleware on every protected operations endpoint.
- Resource-level authorization for borrower-owned applications/documents.
- Private Supabase Storage with signed URLs.
- File size, extension, MIME and magic-byte checks.
- Input validation for every write operation.
- Rate limiting for login and sensitive endpoints.
- Helmet/security headers and strict CORS configuration.
- Consistent 401 / 403 / 409 / 400-or-422 semantics.
- Audit important authorization failures and state-changing financial events.


6. INTERVIEW-READY PROJECT USP

Suggested explanation:

“I focused on making the LMS reliable rather than just CRUD-based. For documents, I validate the actual file signature and generate a SHA-256 fingerprint to detect duplicates. For financial operations, I enforce database-level uniqueness, especially for UTRs, and protect payment updates from race conditions. I implemented the loan lifecycle as a state machine, so users cannot arbitrarily jump from pending to disbursed. Finally, every important action is recorded in an audit trail, which lets the system reconstruct the complete history of a loan.”


7. IMPORTANT SCOPE RULE

Finish the complete borrower → BRE → document validation → apply → sanction → disbursement → collection → auto-close flow first.

The assignment places the highest weight on the end-to-end flow, followed by TypeScript/code quality, BRE/loan math, and RBAC.

Use the advanced features above to strengthen those core areas rather than replacing them with unrelated extras.