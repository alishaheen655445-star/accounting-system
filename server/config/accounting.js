// -----------------------------------------------------------------------------
//  Default General-Ledger account ids used for AUTOMATIC postings (invoices,
//  payments). Kept in ONE place so they are easy to document / change, and can
//  be overridden via .env if a company's chart of accounts uses different ids.
//  These ids match the accounts created in database/seed.sql.
// -----------------------------------------------------------------------------
module.exports = {
  SALES_REVENUE_ACCOUNT_ID: Number(process.env.ACCOUNT_SALES_REVENUE || 14), // 4100 Sales Revenue
  SERVICE_REVENUE_ACCOUNT_ID: Number(process.env.ACCOUNT_SERVICE_REVENUE || 15), // 4200 Service Revenue
  SALES_TAX_PAYABLE_ACCOUNT_ID: Number(process.env.ACCOUNT_TAX_PAYABLE || 11), // 2200 Sales Tax Payable
  CASH_ACCOUNT_ID: Number(process.env.ACCOUNT_CASH || 6), // 1100 Cash on Hand
  BANK_ACCOUNT_ID: Number(process.env.ACCOUNT_BANK || 7), // 1200 Bank Account
  // Inventory postings (Level B stock accounting). A product may override the
  // inventory account via products.inventory_account_id; COGS is a single account.
  INVENTORY_ACCOUNT_ID: Number(process.env.ACCOUNT_INVENTORY || 9), // 1400 Inventory (default stock asset)
  COGS_ACCOUNT_ID: Number(process.env.ACCOUNT_COGS || 16),           // 5100 Cost of Goods Sold
  // Control-account CODES under which each new customer/supplier gets an auto-created
  // leaf sub-account (so invoices/payments can post and per-party balances derive).
  // Seed children: 1301.. (AR) and 2101.. (AP) sit beside these controls.
  RECEIVABLE_CONTROL_CODE: process.env.ACCOUNT_AR_CONTROL_CODE || '1300', // Accounts Receivable
  PAYABLE_CONTROL_CODE: process.env.ACCOUNT_AP_CONTROL_CODE || '2100',    // Accounts Payable
};
