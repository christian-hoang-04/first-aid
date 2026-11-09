# Run from PowerShell in the working folder:
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\setup-vercel.ps1
# Uses Vercel's signed native Windows CLI because Node/npm registry requests are blocked here.
# Installs/authenticates/links only; it does not deploy.

$ErrorActionPreference = 'Stop'

$firstAidRoot = Split-Path -Parent $PSScriptRoot
$appPath = Join-Path (Join-Path $firstAidRoot 'ESMARCH---SOS-NOW') 'sos-now'
$installDirectory = Join-Path $env:LOCALAPPDATA 'Programs\VercelCLI'
$vercelExecutable = Join-Path $installDirectory 'vercel.exe'
$registryPackageUrl = 'https://registry.npmjs.org/%40vercel%2Fvc-native-win32-x64/latest'

if (-not (Test-Path -LiteralPath (Join-Path $appPath 'package.json'))) {
    throw "Could not find the SOS NOW web app at '$appPath'."
}
if ($env:PROCESSOR_ARCHITECTURE -ne 'AMD64') {
    throw "This setup script currently requires Windows x64 (AMD64); detected '$env:PROCESSOR_ARCHITECTURE'."
}
foreach ($toolName in @('curl.exe', 'tar.exe')) {
    if (-not (Get-Command $toolName -ErrorAction SilentlyContinue)) {
        throw "Required Windows tool '$toolName' was not found in PATH."
    }
}

function Test-VercelSignature {
    param([Parameter(Mandatory = $true)][string]$Path)

    $signature = Get-AuthenticodeSignature -FilePath $Path
    return $signature.Status -eq 'Valid' -and $signature.SignerCertificate.Subject -match 'Vercel, Inc\.'
}

if (Test-Path -LiteralPath $vercelExecutable) {
    if (-not (Test-VercelSignature -Path $vercelExecutable)) {
        throw "An executable exists at '$vercelExecutable' but does not have a valid Vercel signature. It was left untouched."
    }
}
else {
    Write-Host 'Fetching Vercel native CLI metadata through curl.exe (Node/npm are not used)...'
    $metadataJson = & curl.exe --fail --silent --show-error --max-time 30 $registryPackageUrl
    if ($LASTEXITCODE -ne 0) {
        throw "Could not fetch Vercel package metadata (curl exit code $LASTEXITCODE)."
    }
    try {
        $metadata = $metadataJson | ConvertFrom-Json
    }
    catch {
        throw 'Vercel package metadata was not valid JSON.'
    }

    if ($metadata.name -ne '@vercel/vc-native-win32-x64' -or $metadata.os -notcontains 'win32' -or $metadata.cpu -notcontains 'x64') {
        throw 'The package metadata does not identify the expected official Windows x64 Vercel CLI.'
    }
    $integrityMatch = [Text.RegularExpressions.Regex]::Match([string]$metadata.dist.integrity, '^sha512-(.+)$')
    if (-not $integrityMatch.Success -or $metadata.dist.tarball -notlike 'https://registry.npmjs.org/*') {
        throw 'The package metadata is missing an expected npm SHA-512 integrity or registry tarball URL.'
    }
    $expectedIntegrity = $integrityMatch.Groups[1].Value

    $temporaryDirectory = Join-Path $env:TEMP ('vercel-native-cli-' + [Guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $temporaryDirectory | Out-Null
    try {
        $archivePath = Join-Path $temporaryDirectory 'vercel-native-cli.tgz'
        & curl.exe --fail --silent --show-error --location --max-time 240 --output $archivePath $metadata.dist.tarball
        if ($LASTEXITCODE -ne 0) {
            throw "Vercel CLI download failed (curl exit code $LASTEXITCODE)."
        }

        $archiveHashHex = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA512).Hash
        $hashBytes = New-Object byte[] ($archiveHashHex.Length / 2)
        for ($index = 0; $index -lt $archiveHashHex.Length; $index += 2) {
            $hashBytes[$index / 2] = [Convert]::ToByte($archiveHashHex.Substring($index, 2), 16)
        }
        $archiveIntegrity = [Convert]::ToBase64String($hashBytes)
        if ($archiveIntegrity -ne $expectedIntegrity) {
            throw 'Vercel CLI archive SHA-512 did not match the npm registry integrity value.'
        }

        & tar.exe -xzf $archivePath -C $temporaryDirectory 'package/bin/vercel.exe'
        if ($LASTEXITCODE -ne 0) {
            throw 'Could not extract the Vercel CLI executable from the verified archive.'
        }
        $downloadedExecutable = Join-Path $temporaryDirectory 'package\bin\vercel.exe'
        if (-not (Test-VercelSignature -Path $downloadedExecutable)) {
            throw 'The extracted CLI did not have a valid Vercel, Inc. Authenticode signature.'
        }

        New-Item -ItemType Directory -Path $installDirectory -Force | Out-Null
        Copy-Item -LiteralPath $downloadedExecutable -Destination $vercelExecutable -Force
    }
    finally {
        $tempRoot = [IO.Path]::GetFullPath($env:TEMP).TrimEnd('\') + '\'
        $tempTarget = [IO.Path]::GetFullPath($temporaryDirectory)
        if ($tempTarget.StartsWith($tempRoot, [StringComparison]::OrdinalIgnoreCase)) {
            Remove-Item -LiteralPath $tempTarget -Recurse -Force -ErrorAction SilentlyContinue
        }
    }
}

$userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
$pathEntries = @($userPath -split ';' | ForEach-Object { $_.Trim().TrimEnd('\') } | Where-Object { $_ })
if ($pathEntries -notcontains $installDirectory.TrimEnd('\')) {
    $newUserPath = if ($userPath) { "$($userPath.TrimEnd(';'));$installDirectory" } else { $installDirectory }
    [Environment]::SetEnvironmentVariable('Path', $newUserPath, 'User')
}
if (($env:Path -split ';' | ForEach-Object { $_.Trim().TrimEnd('\') }) -notcontains $installDirectory.TrimEnd('\')) {
    $env:Path = "$installDirectory;$env:Path"
}

& $vercelExecutable --version
if ($LASTEXITCODE -ne 0) {
    throw 'The verified native Vercel CLI could not run.'
}

Write-Host ''
Write-Host 'Sign in to the Vercel account that owns the existing esmarch.vercel.app project.'
& $vercelExecutable login
if ($LASTEXITCODE -ne 0) {
    throw 'Vercel login did not complete.'
}

& $vercelExecutable whoami
if ($LASTEXITCODE -ne 0) {
    throw 'Vercel CLI authentication could not be confirmed.'
}

Push-Location $appPath
try {
    $linkFile = Join-Path (Join-Path $appPath '.vercel') 'project.json'
    if (Test-Path -LiteralPath $linkFile) {
        Write-Host "This folder already has a Vercel project link; leaving it unchanged: $linkFile"
    }
    else {
        Write-Host ''
        Write-Host 'The next prompt must link to the existing SOS NOW Vercel project.'
        Write-Host 'Select the account/team that owns esmarch.vercel.app, then choose the existing project.'
        Write-Host 'If the existing project is not listed or the CLI offers to create a project, press Ctrl+C.'
        $confirmLink = Read-Host 'Type LINK to open the interactive existing-project link, or anything else to cancel'
        if ($confirmLink -cne 'LINK') {
            throw 'Cancelled before linking. No Vercel project was changed.'
        }

        & $vercelExecutable link
        if ($LASTEXITCODE -ne 0) {
            throw 'Vercel project linking did not complete.'
        }
        if (-not (Test-Path -LiteralPath $linkFile)) {
            throw 'Vercel CLI finished without creating a local project link file. Check that an existing project was selected.'
        }
    }

    Write-Host ''
    Write-Host 'Vercel CLI is authenticated and this app folder is linked. No deployment was started.'
    Write-Host 'The link is local/ignored configuration; do not commit .vercel/project.json.'
}
finally {
    Pop-Location
}
