$ErrorActionPreference = 'Stop'
$base = 'http://localhost:3000'

function Show($label, $obj) { Write-Host "`n=== $label ===" -ForegroundColor Cyan; $obj | ConvertTo-Json -Depth 8 }
function Login($user, $pass) {
  $b = @{ identifier = $user; password = $pass } | ConvertTo-Json
  (Invoke-RestMethod -Uri "$base/api/auth/login" -Method Post -ContentType 'application/json' -Body $b).data.token
}
function TryCall($label, $method, $path, $token, $body) {
  $headers = @{ Authorization = "Bearer $token" }
  try {
    $params = @{ Uri = "$base$path"; Method = $method; Headers = $headers; ContentType = 'application/json' }
    if ($body) { $params['Body'] = $body }
    $r = Invoke-RestMethod @params
    Show "$label -> success=$($r.success) : $($r.message)" $r
    return $r
  } catch {
    Show "$label -> HTTP error" ($_.ErrorDetails.Message | ConvertFrom-Json)
    return $null
  }
}

$acct = Login 'accountant' 'Accountant@123'

# ISSUED invoice: customer 1, 2x Laptop(product 1 @800) + 1x Chair(product 2 @120), tax 15%
# Expected: subtotal = 1600+120 = 1720.00 ; tax = 258.00 ; total = 1978.00
$inv = @{
  customerId = 1; invoiceDate = '2026-04-01'; dueDate = '2026-05-01'; taxRate = 15; status = 'issued'
  items = @(
    @{ productId = 1; quantity = 2 },
    @{ productId = 2; quantity = 1 }
  )
} | ConvertTo-Json -Depth 6
$created = TryCall 'CREATE issued invoice -> 201' 'Post' '/api/invoices' $acct $inv

if ($created) {
  $invId = $created.data.invoice.id
  # Fetch the auto-generated journal entry (reference_type=invoice, reference_id=$invId) via list
  $list = TryCall 'LIST journal (check auto entry)' 'Get' '/api/journal?pageSize=3' $acct $null
}

# DRAFT invoice (no journal entry expected)
$draft = @{
  customerId = 2; invoiceDate = '2026-04-02'; taxRate = 0; status = 'draft'
  items = @(@{ description = 'Consulting (ad-hoc)'; quantity = 3; unitPrice = 50 })
} | ConvertTo-Json -Depth 6
TryCall 'CREATE draft invoice -> 201' 'Post' '/api/invoices' $acct $draft

# ROLE CHECK: viewer cannot create invoice -> 403
$viewer = Login 'viewer' 'Viewer@123'
TryCall 'CREATE invoice (viewer) -> 403' 'Post' '/api/invoices' $viewer $inv

# VALIDATION: empty items -> 400
$bad = @{ customerId = 1; invoiceDate = '2026-04-01'; items = @() } | ConvertTo-Json -Depth 6
TryCall 'CREATE invoice (no items) -> 400' 'Post' '/api/invoices' $acct $bad

Write-Host "`nInvoice scenarios executed." -ForegroundColor Green
