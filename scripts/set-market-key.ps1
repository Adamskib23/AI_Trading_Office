$ErrorActionPreference='Stop'
$projectRoot=Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot
if ((Get-Content -Raw -LiteralPath '.env.local') -notmatch 'VITE_CONVEX_URL=["'']?http://(127\.0\.0\.1|localhost):3210') { throw 'Expected local backend on port 3210.' }
$secureKey=Read-Host 'Paste your free Twelve Data API key (hidden)' -AsSecureString
$keyPointer=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
try {
  $keyValue=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($keyPointer)
  if ([string]::IsNullOrWhiteSpace($keyValue)) { throw 'API key was empty.' }
  # Pipe the value to the CLI instead of including it in command arguments/history.
  $keyValue | & node node_modules/convex/bin/main.js env set TWELVE_DATA_API_KEY
  if ($LASTEXITCODE -ne 0) { throw 'Backend environment update failed. Check that Convex is running.' }
  Write-Output 'Key saved in the local backend. No paid plan or trading account is needed.'
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($keyPointer)
  Remove-Variable keyValue,secureKey -ErrorAction SilentlyContinue
}
