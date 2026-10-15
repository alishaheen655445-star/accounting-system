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
  } catch {
    Show "$label -> HTTP error" ($_.ErrorDetails.Message | ConvertFrom-Json)
  }
}

$admin = Login 'admin' 'Admin@123'

# 1) BALANCED entry: Dr Cash(6) 1000 / Cr Sales Revenue(14) 1000
$ok = @{
  entryDate = '2026-03-01'; description = 'Test balanced entry'
  lines = @(
    @{ accountId = 6;  debit = 1000; credit = 0 },
    @{ accountId = 14; debit = 0;    credit = 1000 }
  )
} | ConvertTo-Json -Depth 6
TryCall '1) BALANCED entry -> 201' 'Post' '/api/journal' $admin $ok

# 2) UNBALANCED entry: Dr 1000 / Cr 900  -> expect 400
$bad = @{
  entryDate = '2026-03-01'; description = 'Unbalanced entry'
  lines = @(
    @{ accountId = 6;  debit = 1000; credit = 0 },
    @{ accountId = 14; debit = 0;    credit = 900 }
  )
} | ConvertTo-Json -Depth 6
TryCall '2) UNBALANCED -> 400' 'Post' '/api/journal' $admin $bad

# 3) GROUP account (id 1 = 'Assets' group) -> expect 400
$grp = @{
  entryDate = '2026-03-01'; description = 'Posting to a group account'
  lines = @(
    @{ accountId = 1;  debit = 500; credit = 0 },
    @{ accountId = 14; debit = 0;   credit = 500 }
  )
} | ConvertTo-Json -Depth 6
TryCall '3) GROUP account -> 400' 'Post' '/api/journal' $admin $grp

# 4) One line with BOTH debit and credit -> expect 400
$both = @{
  entryDate = '2026-03-01'; description = 'Line with both sides'
  lines = @(
    @{ accountId = 6;  debit = 300; credit = 300 },
    @{ accountId = 14; debit = 0;   credit = 300 }
  )
} | ConvertTo-Json -Depth 6
TryCall '4) BOTH sides on a line -> 400' 'Post' '/api/journal' $admin $both

# 5) Multi-line balanced (3 lines): Dr Cash 700 + Dr Bank 300 / Cr Revenue 1000
$multi = @{
  entryDate = '2026-03-02'; description = 'Split payment received'
  lines = @(
    @{ accountId = 6;  debit = 700; credit = 0 },
    @{ accountId = 7;  debit = 300; credit = 0 },
    @{ accountId = 14; debit = 0;   credit = 1000 }
  )
} | ConvertTo-Json -Depth 6
TryCall '5) MULTI-LINE balanced -> 201' 'Post' '/api/journal' $admin $multi

# 6) LIST entries
TryCall '6) LIST entries' 'Get' '/api/journal?pageSize=5' $admin $null

Write-Host "`nJournal scenarios executed." -ForegroundColor Green
