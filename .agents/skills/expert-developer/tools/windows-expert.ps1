<#
.SYNOPSIS
    Windows Expert - Extensible governance framework for PowerShell-based development tasks

.DESCRIPTION
    Provides a modular, extensible framework for executing development tasks on Windows.
    
    Features:
    - Plugin-based architecture for adding new tasks
    - Structured logging to .agents/skills/expert-developer/scripts/tools/logs.json
    - Fail-loud error reporting with full context
    - Configurable through JSON configuration files
    - Automatic task discovery and registration

.PARAMETER Task
    The task to execute (e.g., 'init-agents-dir')

.PARAMETER BaseDir
    Base directory for task execution (default: current directory)

.PARAMETER Config
    Path to configuration file (default: auto-discover)

.EXAMPLE
    .\windows-expert.ps1 -Task init-agents-dir
    .\windows-expert.ps1 -Task init-agents-dir -BaseDir "C:\Users\Project"

.NOTES
    Platform: Windows PowerShell 5.1+
    Framework: Extensible plugin architecture
    Logging: JSON append-only logs
#>

param(
    [Parameter(Mandatory=$true)]
    [string]$Task,
    
    [string]$BaseDir = ".",
    [string]$Config = $null
)

$ErrorActionPreference = "Stop"
$VerbosePreference = "Continue"

# ============================================================================
# FRAMEWORK CONFIGURATION
# ============================================================================

$FRAMEWORK = @{
     Name        = "windows-expert"
     Version     = "1.0.0"
     Platform    = "Windows"
     ScriptDir   = Split-Path -Parent $MyInvocation.MyCommand.Path
     SkillDir    = Split-Path -Parent $PSScriptRoot
     TasksDir    = Join-Path (Split-Path -Parent $PSScriptRoot) "scripts/tasks"
     LogsDir     = Split-Path -Parent $PSScriptRoot
     ConfigFile  = $Config
 }

 $FRAMEWORK.LogsFile = Join-Path $FRAMEWORK.LogsDir "logs.json"

# ============================================================================
# LOGGING SYSTEM
# ============================================================================

function Initialize-Logging {
    <#
    .SYNOPSIS
        Initialize logging directory and system
    #>
    param()
    
    if (-not (Test-Path $FRAMEWORK.LogsDir)) {
        New-Item -ItemType Directory -Path $FRAMEWORK.LogsDir -Force | Out-Null
    }
}

function New-LogEntry {
    <#
    .SYNOPSIS
        Create a new log entry object
    #>
    param(
        [string]$Status,
        [string]$Operation,
        [hashtable]$Details = @{},
        [string[]]$Errors = @()
    )
    
    return @{
        id          = "$([DateTime]::UtcNow.Ticks)-$(Get-Random)"
        timestamp   = [DateTime]::UtcNow.ToString("o")
        framework   = $FRAMEWORK.Name
        version     = $FRAMEWORK.Version
        platform    = $FRAMEWORK.Platform
        task        = $Task
        operation   = $Operation
        status      = $Status
        baseDir     = (Resolve-Path $BaseDir -ErrorAction SilentlyContinue).Path
        details     = $Details
        errors      = $Errors
    }
}

function Write-Log {
    <#
    .SYNOPSIS
        Write log entry to logs.json
    #>
    param(
        [Parameter(ValueFromPipeline=$true)]
        [hashtable]$Entry
    )
    
    process {
        try {
            $logs = @()
            if (Test-Path $FRAMEWORK.LogsFile) {
                $logs = Get-Content $FRAMEWORK.LogsFile | ConvertFrom-Json
            }
            
            $logs += $Entry
            $logs | ConvertTo-Json -Depth 10 | Set-Content $FRAMEWORK.LogsFile
        }
        catch {
            Write-Warning "Failed to write log: $_"
        }
    }
}

# ============================================================================
# TASK REGISTRY & DISCOVERY
# ============================================================================

$TASK_REGISTRY = @{}

function Register-Task {
    <#
    .SYNOPSIS
        Register a task in the framework
    #>
    param(
        [Parameter(Mandatory=$true)]
        [string]$Name,
        
        [Parameter(Mandatory=$true)]
        [scriptblock]$Handler,
        
        [string]$Description = ""
    )
    
    $TASK_REGISTRY[$Name] = @{
        Name        = $Name
        Handler     = $Handler
        Description = $Description
    }
    
    Write-Verbose "Registered task: $Name"
}

function Discover-Tasks {
    <#
    .SYNOPSIS
        Discover and load tasks from tasks directory
    #>
    param()
    
    if (-not (Test-Path $FRAMEWORK.TasksDir)) {
        Write-Verbose "Tasks directory not found: $($FRAMEWORK.TasksDir)"
        return
    }
    
    Get-ChildItem -Path $FRAMEWORK.TasksDir -Filter "*.ps1" | ForEach-Object {
        Write-Verbose "Loading task: $($_.Name)"
        & $_.FullName
    }
}

# ============================================================================
# BUILT-IN TASKS
# ============================================================================

Register-Task -Name "init-agents-dir" -Description "Initialize .agents/ directory structure" -Handler {
    param([string]$BaseDir)
    
    $pythonScript = Join-Path $FRAMEWORK.SkillDir "scripts/init-agents-dir.py"
    
    if (-not (Test-Path $pythonScript)) {
        throw "Python script not found: $pythonScript"
    }
    
    Write-Verbose "Executing: python3 '$pythonScript' '$BaseDir'"
    $output = & python3 "$pythonScript" "$BaseDir" 2>&1
    
    if ($LASTEXITCODE -ne 0) {
        throw "Script exited with code $($LASTEXITCODE): $output"
    }
    
    $result = $output | ConvertFrom-Json
    return @{
        success = $result.success
        created = $result.created
        baseDir = $result.baseDir
    }
}

# ============================================================================
# TASK EXECUTION ENGINE
# ============================================================================

function Invoke-Task {
    <#
    .SYNOPSIS
        Execute a registered task with error handling and logging
    #>
    param(
        [Parameter(Mandatory=$true)]
        [string]$TaskName,
        
        [string]$BaseDir = "."
    )
    
    $startTime = Get-Date
    
    try {
        # Check if task exists
        if (-not $TASK_REGISTRY.ContainsKey($TaskName)) {
            throw "Task not found: $TaskName. Available tasks: $($TASK_REGISTRY.Keys -join ', ')"
        }
        
        $taskDef = $TASK_REGISTRY[$TaskName]
        Write-Verbose "Executing task: $TaskName"
        
        # Execute task
        $result = & $taskDef.Handler -BaseDir $BaseDir
        
        # Log success
        $duration = (Get-Date) - $startTime
        $logEntry = New-LogEntry -Status "success" -Operation $TaskName -Details $result
        $logEntry.duration = [int]$duration.TotalMilliseconds
        
        $logEntry | Write-Log
        
        # Report success
        Write-Host "✓ Task completed successfully: $TaskName" -ForegroundColor Green
        Write-Host "  Created: $($result.created.Count) items" -ForegroundColor Green
        Write-Host "  Log: $($FRAMEWORK.LogsFile)" -ForegroundColor Green
        
        return $true
    }
    catch {
        # Log failure
        $duration = (Get-Date) - $startTime
        $logEntry = New-LogEntry -Status "failure" -Operation $TaskName -Errors @($_.Exception.Message, $_.ScriptStackTrace)
        $logEntry.duration = [int]$duration.TotalMilliseconds
        
        $logEntry | Write-Log
        
        # Fail loud
        Write-Host "✗ Task failed: $TaskName" -ForegroundColor Red
        Write-Host $_.Exception.Message -ForegroundColor Red
        Write-Host "" -ForegroundColor Red
        Write-Host "Log: $($FRAMEWORK.LogsFile)" -ForegroundColor Yellow
        Write-Host "Stack:" -ForegroundColor Yellow
        Write-Host $_.ScriptStackTrace -ForegroundColor Yellow
        
        return $false
    }
}

# ============================================================================
# MAIN ENTRY POINT
# ============================================================================

function Main {
    <#
    .SYNOPSIS
        Framework entry point
    #>
    param()
    
    Write-Verbose "$($FRAMEWORK.Name) v$($FRAMEWORK.Version) on $($FRAMEWORK.Platform)"
    Write-Verbose "Task: $Task"
    Write-Verbose "Base Dir: $BaseDir"
    
    # Initialize
    Initialize-Logging
    
    # Discover and load external tasks
    Discover-Tasks
    
    # Execute task
    $success = Invoke-Task -TaskName $Task -BaseDir $BaseDir
    
    exit ($success ? 0 : 1)
}

# Run framework
Main
