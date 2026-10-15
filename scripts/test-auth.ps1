$ErrorActionPreference = 'Stop'
$base = 'http://localhost:3000'

function Show($label, $obj) { Write-Host "`n=== $label ===" -ForegroundColor Cyan; $obj | ConvertTo-Json -Depth 6 }

# 1) Successful login
$loginBody = @{ identifier = 'admin'; password = 'Admin@123' } | ConvertTo-Json
$login = Invoke-RestMethod -Uri "$base/api/auth/login" -Method Post -ContentType 'application/json' -Body $loginBody
Show '1) LOGIN (valid)' $login
$token = $login.data.token

# 2) Protected route WITH token
$me = Invoke-RestMethod -Uri "$base/api/auth/me" -Headers @{ Authorization = "Bearer $token" }
Show '2) GET /me (with token)' $me

# 3) Protected route WITHOUT token -> expect 401
try {
  Invoke-RestMethod -Uri "$base/api/auth/me" | Out-Null
} catch {
  Show '3) GET /me (no token) -> 401' ($_.ErrorDetails.Message | ConvertFrom-Json)
}

# 4) Wrong password -> expect 401
try {
  $bad = @{ identifier = 'admin'; password = 'wrongpass' } | ConvertTo-Json
  Invoke-RestMethod -Uri "$base/api/auth/login" -Method Post -ContentType 'application/json' -Body $bad | Out-Null
} catch {
  Show '4) LOGIN (wrong password) -> 401' ($_.ErrorDetails.Message | ConvertFrom-Json)
}

# 5) Validation error (password too short) -> expect 400 with field details
try {
  $short = @{ identifier = 'admin'; password = '123' } | ConvertTo-Json
  Invoke-RestMethod -Uri "$base/api/auth/login" -Method Post -ContentType 'application/json' -Body $short | Out-Null
} catch {
  Show '5) LOGIN (validation) -> 400' ($_.ErrorDetails.Message | ConvertFrom-Json)
}

Write-Host "`nAll auth scenarios executed." -ForegroundColor Green
