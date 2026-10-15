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
function PutJson($path, $body, $token) {
  Invoke-RestMethod -Uri "$base$path" -Method Put -Headers @{ Authorization = "Bearer $token" } -ContentType 'application/json' -Body ($body | ConvertTo-Json -Depth 6)
}
function GetJson($path, $token) {
  Invoke-RestMethod -Uri "$base$path" -Headers @{ Authorization = "Bearer $token" }
}
function DelJson($path, $token) {
  Invoke-RestMethod -Uri "$base$path" -Method Delete -Headers @{ Authorization = "Bearer $token" }
}
function TryPost($path, $body, $token) {
  try { (PostJson $path $body $token) | Out-Null; '  -> accepted' }
  catch { "  -> rejected ($($_.Exception.Response.StatusCode.value__))" }
}

$admin = Login 'admin' 'Admin@123'
$viewer = Login 'viewer' 'Viewer@123'

# ---------------------------- SUPPLIERS ----------------------------
Write-Host "`n########## SUPPLIERS ##########" -ForegroundColor Yellow

# 1) Create with auto-generated code
$sup = (PostJson '/api/suppliers' @{ name = 'Alexandria Goods'; email = 'sales@alexgoods.example'; phone = '+20-3-555-0303'; address = 'Alexandria, Egypt'; openingBalance = '500.00'; accountId = 24 } $admin).data.supplier
Show 'SUPPLIER CREATED (auto code)' $sup
$supId = $sup.id

# 2) Create with explicit code, then duplicate that code -> 409
$sup2 = (PostJson '/api/suppliers' @{ supplierCode = 'SUP-X1'; name = 'Nile Traders' } $admin).data.supplier
Write-Host "Explicit code = $($sup2.supplier_code)"
Write-Host "`n=== DUPLICATE CODE SUP-X1 ==="
TryPost '/api/suppliers' @{ supplierCode = 'SUP-X1'; name = 'Copy Cat' } $admin

# 3) Update (partial)
$supUpd = (PutJson "/api/suppliers/$supId" @{ phone = '+20-3-999-9999' } $admin).data.supplier
Show 'SUPPLIER AFTER UPDATE' @{ phone = $supUpd.phone; name = $supUpd.name }

# 4) Validation: missing name -> 400
Write-Host "`n=== SUPPLIER MISSING NAME ==="
TryPost '/api/suppliers' @{ email = 'no-name@example.com' } $admin

# 5) Viewer read allowed (200), viewer create forbidden (403)
$viewerList = (GetJson '/api/suppliers' $viewer)
Write-Host "`n=== VIEWER LIST SUPPLIERS (allowed) === count=$($viewerList.data.Count)"
Write-Host "`n=== VIEWER CREATE SUPPLIER (should 403) ==="
TryPost '/api/suppliers' @{ name = 'Not Allowed' } $viewer

# 6) Soft delete
(DelJson "/api/suppliers/$supId" $admin) | Out-Null
$supAfterDel = (GetJson "/api/suppliers/$supId" $admin).data.supplier
Show 'SUPPLIER AFTER SOFT DELETE' @{ is_active = $supAfterDel.is_active }

# ---------------------------- PRODUCTS ----------------------------
Write-Host "`n########## PRODUCTS ##########" -ForegroundColor Yellow

# 7) Create with auto sku + explicit prices
$prod = (PostJson '/api/products' @{ name = 'USB-C Cable'; description = '2m braided cable'; unit = 'pcs'; sellingPrice = '15.00'; costPrice = '6.00'; revenueAccountId = 14; inventoryAccountId = 9 } $admin).data.product
Show 'PRODUCT CREATED (auto sku)' $prod
$prodId = $prod.id

# 8) Duplicate sku -> 409
Write-Host "`n=== DUPLICATE SKU P-001 ==="
TryPost '/api/products' @{ sku = 'P-001'; name = 'Clone' } $admin

# 9) Validation: negative price -> 400
Write-Host "`n=== PRODUCT NEGATIVE PRICE ==="
TryPost '/api/products' @{ name = 'Bad'; sellingPrice = '-5' } $admin

# 10) Update selling price
$prodUpd = (PutJson "/api/products/$prodId" @{ sellingPrice = '18.50' } $admin).data.product
Show 'PRODUCT AFTER UPDATE' @{ selling_price = $prodUpd.selling_price; name = $prodUpd.name }

# 11) Search products by name
$found = (GetJson '/api/products?search=USB' $admin)
Write-Host "`n=== SEARCH 'USB' === matches=$($found.data.Count) total=$($found.meta.total)"

# 12) Viewer cannot create product -> 403
Write-Host "`n=== VIEWER CREATE PRODUCT (should 403) ==="
TryPost '/api/products' @{ name = 'Viewer product' } $viewer

Write-Host "`nSuppliers + Products scenarios executed." -ForegroundColor Green
