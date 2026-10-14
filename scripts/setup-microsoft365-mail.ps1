param(
  [Parameter(Mandatory=$true)][string]$Mailbox,
  [Parameter(Mandatory=$true)][string]$TenantId
)
$ErrorActionPreference = 'Stop'
$ClientId = Read-Host 'Microsoft Entra application (client) ID'
if ($ClientId -notmatch '^[0-9a-fA-F-]{36}$') { throw 'Enter the 36-character application client ID.' }
if ($TenantId -notmatch '^[0-9a-fA-F-]{36}$') { throw 'TenantId must be the Microsoft Entra tenant GUID.' }
if ($Mailbox -notmatch '^[^\s@]+@[^\s@]+\.[^\s@]+$') { throw 'Enter the mailbox address to authorize.' }
$Authority = "https://login.microsoftonline.com/$TenantId/oauth2/v2.0"
$Scopes = 'offline_access Mail.ReadWrite Mail.Send Mail.ReadWrite.Shared Mail.Send.Shared'
try {
  $device = Invoke-RestMethod -Method Post -Uri "$Authority/devicecode" -Body @{ client_id=$ClientId; scope=$Scopes }
} catch { throw 'Microsoft device authorization could not start. Check the tenant, client ID, public-client setting, and delegated API permissions.' }
Write-Host "Open $($device.verification_uri) and enter code $($device.user_code) while signed in as a user with access to $Mailbox."
$deadline = [DateTimeOffset]::UtcNow.AddSeconds([int]$device.expires_in)
$interval = [Math]::Max(5,[int]$device.interval)
while ([DateTimeOffset]::UtcNow -lt $deadline) {
  Start-Sleep -Seconds $interval
  try {
    $token = Invoke-RestMethod -Method Post -Uri "$Authority/token" -Body @{ client_id=$ClientId; grant_type='urn:ietf:params:oauth:grant-type:device_code'; device_code=$device.device_code }
    if ($token.refresh_token) {
      Set-Clipboard -Value $token.refresh_token
      Write-Host "A refresh token for $Mailbox has been copied to the clipboard. Paste it only into the matching hosting secret, then run Set-Clipboard -Value '' to clear it."
      exit 0
    }
  } catch {
    $errorBody = $_.ErrorDetails.Message
    if ($errorBody -match 'authorization_pending') { continue }
    if ($errorBody -match 'slow_down') { $interval += 5; continue }
    throw 'Microsoft device authorization failed or was declined. Start again and check the account and app permissions.'
  }
}
throw 'The device code expired before authorization completed. Start again.'
