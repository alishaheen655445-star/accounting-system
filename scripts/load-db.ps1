# Load database schema + seed into local MySQL (XAMPP).
# Usage:  powershell -NoProfile -ExecutionPolicy Bypass -File scripts\load-db.ps1
#
# Why Start-Process -RedirectStandardInput instead of `Get-Content | mysql`?
# The seed contains Arabic text (UTF-8). A PowerShell pipe would re-encode the
# stream using $OutputEncoding (ASCII on Windows PowerShell 5.1) and turn the
# Arabic into '?'. RedirectStandardInput feeds the file's RAW bytes straight to
# the mysql client, and --default-character-set=utf8mb4 keeps them intact.
$mysql = 'C:\xampp\mysql\bin\mysql.exe'
$root  = Split-Path -Parent $PSScriptRoot

function Import-Sql($file) {
  Write-Host "--- Loading $file ---"
  $p = Start-Process -FilePath $mysql `
        -ArgumentList '-u','root','--default-character-set=utf8mb4' `
        -RedirectStandardInput (Join-Path $root $file) `
        -NoNewWindow -Wait -PassThru
  Write-Host "$file exit code: $($p.ExitCode)"
  return $p.ExitCode
}

$code1 = Import-Sql 'database\schema.sql'
$code2 = Import-Sql 'database\seed.sql'

if ($code1 -eq 0 -and $code2 -eq 0) { Write-Host 'DONE - database loaded successfully.' }
else { Write-Host 'FAILED - check the exit codes above.' }
