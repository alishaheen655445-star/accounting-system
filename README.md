# Accounting System — University Final Project

A full-stack **double-entry accounting system** with a REST API and a bilingual
(English / Arabic, RTL-aware) web client. It covers the core of a small
accounting ERP: a chart of accounts, customers/suppliers/products, sales
invoices that auto-post journal entries, payments, manual journal entries,
financial reports, user management, and an immutable audit trail — all protected
by JWT authentication and role-based access control.

> Built for the Google **Stitch** "ds" design system. Backend comments and code
> are in English; the UI ships in both English and Arabic.

---

## Table of Contents
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Setup](#setup)
- [Default Users](#default-users)
- [Roles & Permissions](#roles--permissions)
- [API Reference](#api-reference)
- [Internationalization (EN / AR)](#internationalization--en--ar)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)

---

## Features

| Module | What it does |
| --- | --- |
| **Authentication** | JWT login, `/api/auth/me`, bcrypt password hashing (cost 12), route guard on the client. |
| **Chart of Accounts** | Hierarchical accounts (groups + leaves) with types: asset / liability / equity / revenue / expense. |
| **Customers / Suppliers** | CRUD with search + pagination; each is linked to its own AR / AP leaf account. Soft-deactivate. |
| **Products** | CRUD inventory items (name, SKU, price, stock, account links). |
| **Invoices** | Credit sales with line items, subtotal/tax/total. When an invoice is **issued**, it **automatically posts a balanced journal entry** (Dr Customer AR / Cr Sales Revenue, plus Cr Sales Tax Payable when taxed). Draft invoices do not post. |
| **Payments** | Record receipts against an invoice (or a customer); each posts a journal entry (Dr Cash/Bank / Cr Customer AR), with an over-payment guard, and updates the invoice's paid amount/status. |
| **Journal** | Manual double-entry journal with a **balanced-debit-credit guard**; full entry view with lines. |
| **Reports** | Trial balance, chart of accounts, income statement, general ledger (per account), customer statement. |
| **Users** | Admin-only account management (create/edit/activate/deactivate, assign roles). |
| **Audit Log** | Admin-only, read-only, immutable trail of every important action (login, create, update, delete…). |

Every business module writes to the **audit trail** so administrator activity is
traceable (requirement: keep a log of important actions).

---

## Tech Stack

**Backend**
- Node.js + Express 4
- MySQL / MariaDB via `mysql2/promise` (connection pool)
- `jsonwebtoken` (auth), `bcrypt` (password hashing)
- `express-validator` (input validation), `helmet` (security headers), `cors`
- `dotenv` (configuration)

**Frontend**
- Vanilla HTML / CSS / JavaScript (no framework, no build step)
- Tailwind (Play CDN) + Google Material Symbols + Inter font, driven by the
  Stitch design-system tokens (`client/js/tailwind-config.js`, `client/css/styles.css`)

**Infra**
- XAMPP (MySQL) for local development
- `http-server` to serve the static client during development

---

## Architecture

A clean layered backend, one module per entity:

```
request → routes → controller → service → model → MySQL
              ↑          ↑
        validate      auditService.log()
        (auth +
         RBAC)
```

- **routes** — HTTP verbs, mount validation (`validate`) and RBAC middleware
  (`authenticate`, `authorize(...roles)`), then hand off to the controller.
- **controller** — thin: reads req/res, calls the service, formats the response
  via `sendSuccess` / `sendCreated`. Wrapped in `asyncHandler`.
- **service** — business rules, transactions, cross-entity effects (e.g. an
  invoice posting a journal entry), and audit logging.
- **model** — parameterized SQL only (no string-concatenated values), snake_case rows.
- **middleware** — `auth` (JWT verify + role gate), `validate` (express-validator →
  400 with field errors), `errorHandler` (single place formatting all errors).
- **utils** — `ApiError`, `asyncHandler`, `response`, `jwt`, `money`, `i18n`.

The frontend reuses generic building blocks (`crud.js`: table, pagination, form
modal, confirm) so each page only declares its **columns** and **form fields**.
`layout.js` renders a single app shell (sidebar + top bar) from one `NAV` map,
with an RTL-aware "ds" design-system shell.

---

## Project Structure

```
.
├── server/                 # Express API
│   ├── server.js           # entry point: middleware, route mounts, startup
│   ├── config/             # db pool + accounting constants
│   ├── routes/             # one router per entity
│   ├── controllers/        # thin HTTP layer
│   ├── services/           # business logic + audit
│   ├── models/             # parameterized SQL
│   ├── middleware/         # auth, validate, errorHandler
│   ├── validators/         # express-validator chains
│   └── utils/              # ApiError, asyncHandler, response, jwt, money, i18n
├── client/                 # static web app (served by http-server)
│   ├── *.html              # one page per screen (index + 11 screens)
│   ├── js/                 # config, api, auth, ui, layout, crud + per-page logic
│   └── css/styles.css      # design-system styles
├── database/
│   ├── schema.sql          # DROP + CREATE (11 tables)
│   └── seed.sql            # demo data + 3 users + bilingual *_en columns
├── scripts/                # load-db.ps1, serve-client.js, test-*.ps1, verify-*.sql
├── .env.example            # copy to .env and fill values
└── package.json
```

---

## Prerequisites

- **Node.js** 18+ (`npm`)
- **XAMPP** (or any MySQL/MariaDB) with the `mysql.exe` client, OR the MySQL
  binaries at `C:\xampp\mysql\bin\`
- A modern browser

---

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
Copy the template and adjust if needed (defaults match XAMPP):
```bash
cp .env.example .env
```
`.env` keys:
| Key | Default (XAMPP) | Notes |
| --- | --- | --- |
| `PORT` | `3000` | API port |
| `NODE_ENV` | `development` | |
| `DB_HOST` | `127.0.0.1` | |
| `DB_PORT` | `3306` | |
| `DB_USER` | `root` | |
| `DB_PASSWORD` | *(empty)* | XAMPP default |
| `DB_NAME` | `accounting_system` | created by `schema.sql` |
| `JWT_SECRET` | `change-me-...` | **required** — server refuses to start without it |
| `JWT_EXPIRES_IN` | `1h` | |

### 3. Start MySQL
Launch **MySQL** from the XAMPP Control Panel (or start `mysqld`). The DB server
must be listening on `127.0.0.1:3306`.

### 4. Load the database (schema + seed)
```bash
npm run db:load
```
This runs `scripts/load-db.ps1`, which imports `database/schema.sql` then
`database/seed.sql` using `--default-character-set=utf8mb4` so the Arabic seed
text is stored intact.

> ⚠️ `schema.sql` does **DROP + CREATE**, so re-running it wipes any runtime data
> and restores the seed demo data.

### 5. Start the API
```bash
npm start          # or: npm run dev   (nodemon, auto-reload)
```
You should see:
```
✔ Server listening on http://localhost:3000
✔ Try: http://localhost:3000/api/health
```
Confirm with: <http://localhost:3000/api/health>

### 6. Serve the client
In a second terminal:
```bash
npx http-server client -p 5500 -c-1
```
Open **<http://localhost:5500>** and log in (see below).

---

## Default Users

The seed creates three accounts (bcrypt cost 12):

| Username | Password | Role |
| --- | --- | --- |
| `admin` | `Admin@123` | admin |
| `accountant` | `Accountant@123` | accountant |
| `viewer` | `Viewer@123` | viewer |

Log in at the client with `admin` / `Admin@123` to reach every screen,
including **Users** and **Audit Log**.

---

## Roles & Permissions

| Role | Read | Write (customers/suppliers/products/invoices/payments/journal) | Users & Audit |
| --- | :---: | :---: | :---: |
| **admin** | ✅ | ✅ | ✅ |
| **accountant** | ✅ | ✅ | ❌ |
| **viewer** | ✅ | ❌ | ❌ |

Enforced server-side by `authorize(...)` on the routes; the client also hides
admin-only nav items and non-permitted actions (defense-in-depth).

---

## API Reference

All endpoints are prefixed with `/api`. Authenticated routes require the header
`Authorization: Bearer <token>`. List endpoints support `?page=&pageSize=&search=`.

**Auth**
| Method | Path | Access |
| --- | --- | --- |
| POST | `/auth/login` | public |
| GET | `/auth/me` | any signed-in user |

**Customers / Suppliers / Products** (same shape)
| Method | Path | Access |
| --- | --- | --- |
| GET | `/{entity}` | signed-in |
| GET | `/{entity}/:id` | signed-in |
| POST | `/{entity}` | admin, accountant |
| PUT | `/{entity}/:id` | admin, accountant |
| DELETE | `/{entity}/:id` | admin, accountant |

**Invoices**
| Method | Path | Access |
| --- | --- | --- |
| GET | `/invoices`, `/invoices/:id` | signed-in |
| POST | `/invoices` | admin, accountant (auto-posts a journal entry) |

**Payments**
| Method | Path | Access |
| --- | --- | --- |
| GET | `/payments`, `/payments/:id` | signed-in |
| POST | `/payments` | admin, accountant (auto-posts a journal entry) |

**Journal**
| Method | Path | Access |
| --- | --- | --- |
| GET | `/journal`, `/journal/:id`, `/journal/accounts` | signed-in |
| POST | `/journal` | admin, accountant (must be balanced) |

**Reports**
| Method | Path | Access |
| --- | --- | --- |
| GET | `/reports/trial-balance` | signed-in |
| GET | `/reports/chart-of-accounts` | signed-in |
| GET | `/reports/income-statement` | signed-in |
| GET | `/reports/general-ledger/:accountId` | signed-in |
| GET | `/reports/customer-statement/:id` | signed-in |

**Users** (admin only)
| Method | Path | Access |
| --- | --- | --- |
| GET | `/users`, `/users/:id` | admin |
| POST | `/users` | admin |
| PUT | `/users/:id` | admin |
| DELETE | `/users/:id` | admin (soft-deactivate) |

**Audit Log** (admin only, read-only)
| Method | Path | Access |
| --- | --- | --- |
| GET | `/audit` | admin |
| GET | `/audit/entities` | admin |

Plus `GET /api/health` (public) which reports server + DB status.

---

## Internationalization (EN / AR)

The app is fully bilingual with one-click language toggle (state in
`localStorage.app_lang`).

- **UI chrome** (labels, sidebar, headings, buttons, `<title>`) switches via the
  `bi(en, ar)` helper and `data-en` / `data-ar` attributes; RTL direction is
  applied with logical CSS properties, so the layout mirrors automatically.
- **Stored business data** (account names, journal/invoice narrations, notes)
  is **also** localized. Arabic lives in the primary column and English in a twin
  `*_en` column (`name_en`, `description_en`, `memo_en`, `notes_en`). The client
  sends the active language in the **`X-App-Lang`** header, and the backend returns
  the matching text **in the same field name** — so no display code changes are
  needed. English falls back to Arabic when the `*_en` value is empty (e.g. text a
  user typed manually).

---

## Testing

Ready-made scripts under `scripts/`:

| Script | Purpose |
| --- | --- |
| `test-auth.ps1` | login + token flow |
| `test-customers.ps1` | customer CRUD |
| `test-suppliers-products.ps1` | supplier + product CRUD |
| `test-invoices.ps1` | invoice creation + auto journal posting |
| `test-payments.ps1` | payment recording |
| `test-journal.ps1` | manual journal entries + balance guard |
| `test-reports.ps1` | report endpoints |
| `verify-*.sql` | direct DB checks (debits=credits, audit rows, etc.) |

Run one, e.g.:
```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-invoices.ps1
```

**Manual smoke test:** load the DB → start API → serve client → log in as
`admin` → create a customer → create an invoice (watch it post a journal entry) →
record a payment → open Reports → open Users & Audit Log.

---

## Troubleshooting

| Symptom | Likely cause / fix |
| --- | --- |
| `Could not connect to the database: ECONNREFUSED 127.0.0.1:3306` | MySQL isn't running — start it in XAMPP, then `npm start` again. |
| `JWT_SECRET is not set` at startup | Create `.env` (copy `.env.example`) with a non-empty `JWT_SECRET`. |
| Arabic shows as `?` in the DB | Load with `npm run db:load` (it forces `utf8mb4`); don't pipe through PowerShell's default encoding. |
| API changes not taking effect | The plain `node server/server.js` does **not** auto-reload — restart it, or use `npm run dev`. |
| Client changes not showing | `http-server` is started with `-c-1` (cache disabled); hard-refresh the browser. |
| Login rejected for a seeded user | Re-run `npm run db:load`; the seed hashes are for `Admin@123` / `Accountant@123` / `Viewer@123`. |

---

## License
MIT.
