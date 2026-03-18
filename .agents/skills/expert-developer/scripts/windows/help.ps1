# Help command for expert-developer framework
# Usage: help [COMMAND]

param(
    [string]$Command = ""
)

$ScriptDir = Split-Path -Parent $PSCommandPath
$SkillDir = Split-Path -Parent (Split-Path -Parent $ScriptDir)
$HelpRegistry = Join-Path $SkillDir "tools\help\help-registry.json"

function Load-HelpRegistry {
    if (-not (Test-Path $HelpRegistry)) {
        Write-Error "Help registry not found at $HelpRegistry"
        return $null
    }
    
    $content = Get-Content $HelpRegistry -Raw
    return $content | ConvertFrom-Json
}

function Show-CommandHelp {
    param([string]$Cmd, [object]$Registry)
    
    $cmdHelp = $Registry.help_commands.$Cmd
    
    if (-not $cmdHelp) {
        Write-Error "No help found for command: $Cmd"
        Write-Host ""
        Write-Host "Available commands:"
        Show-AllCommands $Registry
        return
    }
    
    Write-Host ""
    Write-Host "COMMAND: $Cmd" -ForegroundColor Cyan
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "DESCRIPTION:" -ForegroundColor Yellow
    Write-Host $cmdHelp.description
    Write-Host ""
    
    Write-Host "USAGE:" -ForegroundColor Yellow
    Write-Host $cmdHelp.usage
    Write-Host ""
    
    if ($cmdHelp.options -and $cmdHelp.options.Count -gt 0) {
        Write-Host "OPTIONS:" -ForegroundColor Yellow
        foreach ($opt in $cmdHelp.options.PSObject.Properties) {
            Write-Host "  $($opt.Name)"
            Write-Host "    $($opt.Value)"
        }
        Write-Host ""
    }
    
    if ($cmdHelp.examples -and $cmdHelp.examples.Count -gt 0) {
        Write-Host "EXAMPLES:" -ForegroundColor Yellow
        foreach ($example in $cmdHelp.examples) {
            Write-Host "  $example"
        }
        Write-Host ""
    }
    
    if ($cmdHelp.errors -and $cmdHelp.errors.Count -gt 0) {
        Write-Host "COMMON ERRORS:" -ForegroundColor Yellow
        foreach ($err in $cmdHelp.errors) {
            Write-Host "  - $err"
        }
        Write-Host ""
    }
    
    if ($cmdHelp.see_also -and $cmdHelp.see_also.Count -gt 0) {
        Write-Host "SEE ALSO:" -ForegroundColor Yellow
        Write-Host "  $($cmdHelp.see_also -join ', ')"
        Write-Host ""
    }
}

function Show-AllCommands {
    param([object]$Registry)
    
    Write-Host ""
    Write-Host "AVAILABLE COMMANDS:" -ForegroundColor Cyan
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host ""
    
    foreach ($cmd in $Registry.help_commands.PSObject.Properties) {
        $cmdName = $cmd.Name
        $description = $cmd.Value.description
        Write-Host "$cmdName" -ForegroundColor Green
        Write-Host "  $description"
        Write-Host ""
    }
    
    Write-Host "For detailed help on a command, run:"
    Write-Host "  help <command-name>" -ForegroundColor Green
    Write-Host ""
}

# Main execution
$registry = Load-HelpRegistry

if (-not $registry) {
    exit 1
}

if ([string]::IsNullOrEmpty($Command)) {
    Show-AllCommands $registry
} else {
    Show-CommandHelp $Command $registry
}

exit 0
