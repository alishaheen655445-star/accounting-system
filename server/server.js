// -----------------------------------------------------------------------------
//  server.js — application entry point (Phase 2: minimal, DB-connected server)
//  Later phases add: routes, controllers, auth middleware, error handler.
// -----------------------------------------------------------------------------
require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');

const { pool, testConnection } = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const customerRoutes = require('./routes/customerRoutes');
const supplierRoutes = require('./routes/supplierRoutes');
const productRoutes = require('./routes/productRoutes');
const journalRoutes = require('./routes/journalRoutes');
const invoiceRoutes = require('./routes/invoiceRoutes');
const purchaseRoutes = require('./routes/purchaseRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const supplierPaymentRoutes = require('./routes/supplierPaymentRoutes');
const reportsRoutes = require('./routes/reportsRoutes');
const userRoutes = require('./routes/userRoutes');
const auditRoutes = require('./routes/auditRoutes');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Global middleware -------------------------------------------------------
app.use(helmet());                 // security headers (req. security list)
app.use(cors());                   // cross-origin policy (configured per origin later)
app.use(express.json());           // parse JSON request bodies

// --- Health check: proves server + DB are both alive -------------------------
app.get('/api/health', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT COUNT(*) AS customer_count FROM customers');
    res.json({
      success: true,
      message: 'API is running',
      database: 'connected',
      customers_in_db: rows[0].customer_count,
    });
  } catch (err) {
    // 500 = server/DB error; we do NOT leak err.message to the client (security)
    console.error('Health check DB error:', err.message);
    res.status(500).json({ success: false, message: 'Database connection failed' });
  }
});

// --- API routes --------------------------------------------------------------
app.use('/api/auth', authRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/products', productRoutes);
app.use('/api/journal', journalRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/supplier-payments', supplierPaymentRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/users', userRoutes);
app.use('/api/audit', auditRoutes);

// --- Centralized 404 + error handling (req. 21) ------------------------------
app.use(notFound);      // any unmatched route -> 404 ApiError
app.use(errorHandler);  // single place that formats ALL error responses

// --- Start only after confirming the DB is reachable -------------------------
async function start() {
  try {
    await testConnection();
    app.listen(PORT, () => {
      console.log(`✔ Server listening on http://localhost:${PORT}`);
      console.log(`✔ Try: http://localhost:${PORT}/api/health`);
    });
  } catch (err) {
    console.error('✘ Could not connect to the database:', err.message);
    console.error('  Make sure MySQL (XAMPP) is running and DB "accounting_system" exists.');
    process.exit(1);
  }
}

start();
