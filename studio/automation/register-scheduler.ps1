# register-scheduler.ps1 - OWNER-RUN. Registers the daily AI Top 5 orchestrator as a Windows
# Scheduled Task. This script is NOT run by the build; you run it yourself when you are ready to let
# the automation fire on a timer.
#
# Timing: 07:15 UTC daily. This is AFTER the ~06:30 UTC feed refresh (so make-ai-top5 reads the fresh
# edition) and clear of the 04:00 auto_scrape run (which holds the single-process browser profile).
# Windows Task Scheduler triggers run in LOCAL time, so we convert 07:15 UTC to this machine's local
# time at registration.
#
# SAFETY: registering the task does NOT bypass the kill-switch. The orchestrator still reads
# studio/automation/config.json and exits immediately unless "enabled": true. So it is safe to
# register while the switch is OFF - the task will wake, see disabled, and exit 0 doing nothing until
# you flip the flag.
#
# Run:        powershell -ExecutionPolicy Bypass -File studio\automation\register-scheduler.ps1
# Undo:       powershell -ExecutionPolicy Bypass -File studio\automation\unregister-scheduler.ps1

$ErrorActionPreference = 'Stop'

$TaskName = 'ProjectBright-AITop5-Daily'
$PBRoot   = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path   # project-bright root
$NodeExe  = (Get-Command node).Source
$Script   = Join-Path $PBRoot 'studio\tools\run-ai-top5-daily.mjs'

if (-not (Test-Path $Script)) { throw "orchestrator not found: $Script" }

# 07:15 UTC -> local time for this machine.
$utc      = (Get-Date '07:15Z')
$local    = $utc.ToLocalTime()
$timeStr  = $local.ToString('HH:mm')

$action   = New-ScheduledTaskAction -Execute $NodeExe -Argument "`"$Script`"" -WorkingDirectory $PBRoot
$trigger  = New-ScheduledTaskTrigger -Daily -At $timeStr
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopOnIdleEnd `
                -ExecutionTimeLimit (New-TimeSpan -Hours 2)

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings `
    -Description 'Daily AI Top 5 auto-produce-to-queue (Stage 1). Honors studio/automation/config.json kill-switch; STOPS at POST_QUEUE pending_review; never publishes.' `
    -Force | Out-Null

Write-Host "Registered '$TaskName' - daily at $timeStr local (= 07:15 UTC)."
Write-Host "Runs: $NodeExe `"$Script`""
Write-Host ""
Write-Host "REMINDER: the kill-switch is still authoritative. The task does nothing until you set"
Write-Host "  `"enabled`": true  in  studio\automation\config.json"
Write-Host "Verify:  Get-ScheduledTask -TaskName '$TaskName'"
