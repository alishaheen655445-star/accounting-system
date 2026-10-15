$ErrorActionPreference = 'Stop'
$base = 'http://localhost:3000'

function Show($label, $obj) { Write-Host "`n=== $label ===" -ForegroundColor Cyan; $obj | ConvertTo-Json -Depth 6 }
function Login($user, $pass) {
  $b = @{ identifier = $user; password = $pass } | ConvertTo-Json
  (Invoke-RestMethod -Uri "$base/api/auth/login" -Method Post -ContentType 'application/json' -Body $b).data.token
}
function TryCall($label, $method, $path, $token, $body) {
  $headers = @{}
  if ($token) { $headers['Authorization'] = "Bearer $token" }
  try {
    $params = @{ Uri = "$base$path"; Method = $method; Headers = $headers; ContentType = 'application/json' }
    if ($body) { $params['Body'] = $body }
    $r = Invoke-RestMethod @params
    Show "$label -> $($r.success) $($r.message)" $r
  } catch {
    Show "$label -> HTTP error" ($_.ErrorDetails.Message | ConvertFrom-Json)
  }
}

$admin = Login 'admin' 'Admin@123'
$viewer = Login 'viewer' 'Viewer@123'

# CREATE by admin
$createBody = @{ name = 'Test Customer Co'; email = 'test@example.com'; phone = '+962-700000000'; creditLimit = 5000.50 } | ConvertTo-Json
TryCall 'CREATE (admin)' 'Post' '/api/customers' $admin $createBody

# LIST (any role)
TryCall 'LIST (viewer)' 'Get' '/api/customers?pageSize=5' $viewer $null

# READ single
TryCall 'READ id=1 (viewer)' 'Get' '/api/customers/1' $viewer $null

# UPDATE by admin
$upd = @{ name = 'Test Customer RENAMED'; creditLimit = 7000 } | ConvertTo-Json
TryCall 'UPDATE id=4 (admin)' 'Put' '/api/customers/4' $admin $upd

# ROLE CHECK: viewer tries to create -> expect 403
$vc = @{ name = 'Viewer Should Fail' } | ConvertTo-Json
TryCall 'CREATE (viewer) -> 403' 'Post' '/api/customers' $viewer $vc

# NO TOKEN -> expect 401
TryCall 'LIST (no token) -> 401' 'Get' '/api/customers' $null $null

# VALIDATION: bad email + negative credit -> expect 400
$bad = @{ name = 'Bad Data'; email = 'not-an-email'; creditLimit = -10 } | ConvertTo-Json
TryCall 'CREATE (validation) -> 400' 'Post' '/api/customers' $admin $bad

# DELETE by admin (soft)
TryCall 'DELETE id=4 (admin)' 'Delete' '/api/customers/4' $admin $null

# NOT FOUND -> expect 404
TryCall 'READ id=9999 -> 404' 'Get' '/api/customers/9999' $admin $null

Write-Host "`nCustomer CRUD + role scenarios executed." -ForegroundColor Green
