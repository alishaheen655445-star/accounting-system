// -----------------------------------------------------------------------------
//  Default General-Ledger account ids used for AUTOMATIC postings (invoices,
//  payments). Kept in ONE place so they are easy to document / change, and can
//  be overridden via .env if a company's chart of accounts uses different ids.
//  These ids match the accounts created in database/seed.sql.
// -----------------------------------------------------------------------------
module.exports = {
  SALES_REVENUE_ACCOUNT_ID: Number(process.env.ACCOUNT_SALES_REVENUE || 14), // 4100 Sales Revenue
  SALES_TAX_PAYABLE_ACCOUNT_ID: Number(process.env.ACCOUNT_TAX_PAYABLE || 11), // 2200 Sales Tax Payable
  CASH_ACCOUNT_ID: Number(process.env.ACCOUNT_CASH || 6), // 1100 Cash on Hand
  BANK_ACCOUNT_ID: Number(process.env.ACCOUNT_BANK || 7), // 1200 Bank Account
};
