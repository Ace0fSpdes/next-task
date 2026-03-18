# Build semantic search index from .agents/ documents
# Usage: build-index [--base-dir PATH] [--output PATH] [--verbose]

param(
    [string]$BaseDir = ".",
    [string]$Output = "",
    [switch]$Verbose = $false
)

$ScriptDir = Split-Path -Parent $PSCommandPath
$SkillDir = Split-Path -Parent (Split-Path -Parent $ScriptDir)
$PythonScript = Join-Path $SkillDir "build-index.py"
$LogsFile = Join-Path $SkillDir "scripts\tools\logs.json"

# Determine output path
if ([string]::IsNullOrEmpty($Output)) {
    $Output = Join-Path $BaseDir ".agents\index.json"
}

# Ensure base dir exists
if (-not (Test-Path $BaseDir)) {
    Write-Error "Base directory not found: $BaseDir"
    exit 1
}

# Create logs directory if needed
$LogsDir = Split-Path -Parent $LogsFile
if (-not (Test-Path $LogsDir)) {
    New-Item -ItemType Directory -Path $LogsDir -Force | Out-Null
}

# Build command
$pythonCmd = @(
    $PythonScript
    "--docs-dir", (Join-Path $BaseDir ".agents")
    "--output", $Output
)

if ($Verbose) {
    $pythonCmd += "--verbose"
}

# Run Python script
try {
    if ($Verbose) {
        Write-Host "[INFO] Running: python3 $($pythonCmd -join ' ')"
    }
    
    $result = & python3 @pythonCmd 2>&1
    $exitCode = $LASTEXITCODE
    
    # Parse result
    $resultObj = $result | ConvertFrom-Json
    
    # Log execution
    $logEntry = @{
        timestamp = (Get-Date -AsUTC).ToString("o") + "Z"
        command = "build-index"
        parameters = @{
            base_dir = $BaseDir
            output = $Output
            verbose = $Verbose
        }
        success = $resultObj.success
        result = $resultObj
    }
    
    # Append to logs
    $logs = @{ logs = @() }
    if (Test-Path $LogsFile) {
        try {
            $logs = Get-Content $LogsFile -Raw | ConvertFrom-Json
        } catch { }
    }
    
    $logs.logs += $logEntry
    $logs | ConvertTo-Json -Depth 10 | Set-Content $LogsFile
    
    # Output result
    Write-Output ($resultObj | ConvertTo-Json -Depth 10)
    
    if ($resultObj.success) {
        if ($Verbose) {
            Write-Host "[OK] Index built successfully"
            Write-Host "[STATS] Documents: $($resultObj.documents_indexed)"
            Write-Host "[STATS] Vocabulary: $($resultObj.vocabulary_size)"
            Write-Host "[STATS] Categories: $($resultObj.categories -join ', ')"
        }
        exit 0
    } else {
        Write-Error "Build failed: $($resultObj.error)"
        exit 1
    }
}
catch {
    Write-Error "Failed to execute build-index: $_"
    exit 1
}
