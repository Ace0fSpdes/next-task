# Semantic search in .agents/ knowledge base
# Usage: search-knowledge --query TEXT [--scope SCOPE] [--limit N] [--page N] [--base-dir PATH]

param(
    [Parameter(Mandatory=$true)]
    [string]$Query,
    
    [string]$Scope = "",
    [int]$Limit = 5,
    [int]$Page = 1,
    [string]$BaseDir = "."
)

$ScriptDir = Split-Path -Parent $PSCommandPath
$SkillDir = Split-Path -Parent (Split-Path -Parent $ScriptDir)
$PythonScript = Join-Path $SkillDir "search-index.py"
$IndexPath = Join-Path $BaseDir ".agents\index.json"
$LogsFile = Join-Path $SkillDir "scripts\tools\logs.json"

# Validate index exists
if (-not (Test-Path $IndexPath)) {
    Write-Error "Index not found at $IndexPath. Run 'build-index' first."
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
    "--query", $Query
    "--index", $IndexPath
    "--limit", $Limit
    "--page", $Page
)

if (-not [string]::IsNullOrEmpty($Scope)) {
    $pythonCmd += "--scope"
    $pythonCmd += $Scope
}

# Run Python script
try {
    $result = & python3 @pythonCmd 2>&1
    $exitCode = $LASTEXITCODE
    
    # Parse result
    $resultObj = $result | ConvertFrom-Json
    
    # Log execution
    $logEntry = @{
        timestamp = (Get-Date -AsUTC).ToString("o") + "Z"
        command = "search-knowledge"
        parameters = @{
            query = $Query
            scope = $Scope
            limit = $Limit
            page = $Page
        }
        success = $resultObj.success
        total_results = $resultObj.total_results
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
    
    # Format and display results
    if ($resultObj.success -and $resultObj.results.Count -gt 0) {
        Write-Host ""
        Write-Host "SEARCH RESULTS" -ForegroundColor Cyan
        Write-Host "============================================" -ForegroundColor Cyan
        Write-Host "Query: $Query" -ForegroundColor Yellow
        if (-not [string]::IsNullOrEmpty($Scope)) {
            Write-Host "Scope: $Scope" -ForegroundColor Yellow
        }
        Write-Host "Page: $($resultObj.pagination.page)/$($resultObj.pagination.total_pages)" -ForegroundColor Yellow
        Write-Host "Results: $($resultObj.results.Count) of $($resultObj.total_results)" -ForegroundColor Yellow
        Write-Host ""
        
        foreach ($i in 0..($resultObj.results.Count - 1)) {
            $result = $resultObj.results[$i]
            Write-Host "[$($i+1)] $($result.title)" -ForegroundColor Green
            Write-Host "    Path: $($result.path)"
            Write-Host "    Category: $($result.category)"
            Write-Host "    Score: $($result.relevance_score)"
            if ($result.semantic_tags.Count -gt 0) {
                Write-Host "    Tags: $($result.semantic_tags -join ', ')"
            }
            Write-Host ""
        }
        
        # Pagination info
        if ($resultObj.pagination.has_next) {
            Write-Host "Next page: search-knowledge --query `"$Query`" --page $($Page + 1)" -ForegroundColor Cyan
            Write-Host ""
        }
        
        Write-Output ($resultObj | ConvertTo-Json -Depth 10)
        exit 0
    }
    elseif ($resultObj.success) {
        Write-Host ""
        Write-Host "No results found for: $Query" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Suggestions:" -ForegroundColor Cyan
        Write-Host "  - Try different search terms"
        Write-Host "  - Remove --scope filter to search all documents"
        Write-Host "  - Run 'build-index' to refresh the index"
        Write-Host ""
        Write-Output ($resultObj | ConvertTo-Json -Depth 10)
        exit 0
    }
    else {
        Write-Error "Search failed: $($resultObj.message)"
        Write-Output ($resultObj | ConvertTo-Json -Depth 10)
        exit 1
    }
}
catch {
    Write-Error "Failed to execute search: $_"
    exit 1
}
