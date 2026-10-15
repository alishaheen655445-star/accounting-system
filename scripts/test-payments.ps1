$ErrorActionPreference = 'Stop'
$base = 'http://localhost:3000'

function Show($label, $obj) { Write-Host "`n=== $label ===" -ForegroundColor Cyan; $obj | ConvertTo-Json -Depth 8 }
function Login($user, $pass) {
  $b = @{ identifier = $user; password = $pass } | ConvertTo-Json
  (Invoke-RestMethod -Uri "$base/api/auth/login" -Method Post -ContentType 'application/json' -Body $b).data.token
}
function PostJson($path, $body, $token) {
  Invoke-RestMethod -Uri "$base$path" -Method Post -Headers @{ Authorization = "Bearer $token" } -ContentType 'application/json' -Body ($body | ConvertTo-Json -Depth 6)
}
function GetJson($path, $token) {
  Invoke-RestMethod -Uri "$base$path" -Headers @{ Authorization = "Bearer $token" }
}
function TryPost($path, $body, $token) {
  try { (PostJson $path $body $token) | Out-Null; '  -> accepted' }
  catch { "  -> rejected ($($_.Exception.Response.StatusCode.value__))" }
}

$admin = Login 'admin' 'Admin@123'
$viewer = Login 'viewer' 'Viewer@123'

# 1) Create an issued invoice for customer 1 (Al Noor): 2 x Laptop(800) + 1 x Service(50) = 1650, tax 15% = 247.50, total 1897.50
$inv = (PostJson '/api/invoices' @{
  customerId = 1; invoiceDate = '2026-04-01'; status = 'issued'; taxRate = 15;
  items = @(@{ productId = 1; quantity = 2 }, @{ productId = 3; quantity = 1 })
} $admin).data.invoice
Show 'NEW INVOICE' $inv
$invId = $inv.id
Write-Host "Invoice total = $($inv.total_amount), status = $($inv.status)"

# 2) Partial payment 1000 cash
$p1 = (PostJson '/api/payments' @{ invoiceId = $invId; amount = '1000.00'; paymentDate = '2026-04-10'; method = 'cash' } $admin).data
Show 'PARTIAL PAYMENT 1000' $p1

# 3) Invoice should now be partial with amount_paid 1000
$invAfter1 = (GetJson "/api/invoices/$invId" $admin).data.invoice
Show 'INVOICE AFTER PARTIAL' @{ status = $invAfter1.status; amount_paid = $invAfter1.amount_paid }

# 4) Over-payment attempt (remaining = 897.50; try 5000) -> should reject
Write-Host "`n=== OVERPAYMENT ATTEMPT (5000) ==="
TryPost '/api/payments' @{ invoiceId = $invId; amount = '5000.00'; paymentDate = '2026-04-11'; method = 'cash' } $admin

# 5) Pay the rest 897.50 bank -> invoice becomes paid
$p2 = (PostJson '/api/payments' @{ invoiceId = $invId; amount = '897.50'; paymentDate = '2026-04-12'; method = 'bank' } $admin).data
Show 'FINAL PAYMENT 897.50' $p2
$invAfter2 = (GetJson "/api/invoices/$invId" $admin).data.invoice
Show 'INVOICE AFTER FULL PAYMENT' @{ status = $invAfter2.status; amount_paid = $invAfter2.amount_paid }

# 6) Extra payment on already-paid invoice -> reject
Write-Host "`n=== PAY ALREADY-PAID INVOICE ==="
TryPost '/api/payments' @{ invoiceId = $invId; amount = '10.00'; paymentDate = '2026-04-13'; method = 'cash' } $admin

# 7) Role check: viewer cannot record a payment -> 403
Write-Host "`n=== VIEWER ATTEMPTS PAYMENT ==="
TryPost '/api/payments' @{ invoiceId = $invId; amount = '10.00'; paymentDate = '2026-04-13'; method = 'cash' } $viewer

# 8) Customer statement now shows payments
Show 'CUSTOMER 1 STATEMENT' (GetJson '/api/reports/customer-statement/1' $admin).data.summary

Write-Host "`nPayment scenarios executed." -ForegroundColor Green
