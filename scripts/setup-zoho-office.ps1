# Run yourself after generating a Self Client grant as office@q-ai.online.
# Secrets are entered through masked prompts, never as command-line arguments.
param([ValidateSet('eu', 'us', 'in', 'au', 'jp', 'ca', 'sa', 'cn')][string]$Region = 'eu')
$ErrorActionPreference = 'Stop'
$zohoSuffixes = @{ eu='eu'; us='com'; in='in'; au='com.au'; jp='jp'; ca='ca'; sa='sa'; cn='com.cn' }
function Read-QSecret([string]$Prompt) {
    $secretValue = Read-Host $Prompt -AsSecureString
    $secretPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secretValue)
    try { [Runtime.InteropServices.Marshal]::PtrToStringBSTR($secretPointer) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($secretPointer) }
}
$zohoTokenBody = @{
    grant_type = 'authorization_code'
    client_id = Read-Host 'Self Client ID'
    client_secret = Read-QSecret 'Self Client secret'
    code = Read-QSecret 'Fresh Generate Code grant (office mailbox)'
}
try {
    $zohoTokenResult = Invoke-RestMethod -Method Post -Uri "https://accounts.zoho.$($zohoSuffixes[$Region])/oauth/v2/token" -ContentType 'application/x-www-form-urlencoded' -Body $zohoTokenBody
    if (-not $zohoTokenResult.refresh_token) { throw 'No refresh token received. Check the Self Client grant, its expiry and data centre.' }
    Set-Clipboard -Value $zohoTokenResult.refresh_token
    Write-Host 'Refresh token copied to clipboard. Paste into ZOHO_MAIL_REFRESH_TOKEN in your hosting secrets, then clear the clipboard with Set-Clipboard -Value "". No token file was created.'
} catch {
    throw 'Zoho token setup failed. Generate a fresh code, confirm the credentials and data centre, then retry. Provider response omitted to protect credentials.'
} finally {
    $zohoTokenBody.Clear()
    $zohoTokenResult = $null
}
