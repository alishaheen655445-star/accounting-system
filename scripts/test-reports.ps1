$ErrorActionPreference = 'Stop'
$base = 'http://localhost:3000'

function Show($label, $obj) { Write-Host "`n=== $label ===" -ForegroundColor Cyan; $obj | ConvertTo-Json -Depth 8 }
function Login($user, $pass) {
  $b = @{ identifier = $user; password = $pass } | ConvertTo-Json
  (Invoke-RestMethod -Uri "$base/api/auth/login" -Method Post -ContentType 'application/json' -Body $b).data.token
}
function Get2($path, $token) {
  (Invoke-RestMethod -Uri "$base$path" -Headers @{ Authorization = "Bearer $token" })
}

$admin = Login 'admin' 'Admin@123'

Show 'TRIAL BALANCE' (Get2 '/api/reports/trial-balance' $admin)
Show 'INCOME STATEMENT' (Get2 '/api/reports/income-statement' $admin)
Show 'GENERAL LEDGER - AR Al Noor (account 21)' (Get2 '/api/reports/general-ledger/21' $admin)
Show 'CUSTOMER STATEMENT - customer 1' (Get2 '/api/reports/customer-statement/1' $admin)

Write-Host "`nReport scenarios executed." -ForegroundColor Green
