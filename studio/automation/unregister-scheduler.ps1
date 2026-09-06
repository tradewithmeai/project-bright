# unregister-scheduler.ps1 - OWNER-RUN. Removes the daily AI Top 5 scheduled task.
# This does not touch the kill-switch or any code - it only deletes the Windows Scheduled Task so the
# orchestrator stops firing on a timer. You can still run it manually afterwards.
#
# Run: powershell -ExecutionPolicy Bypass -File studio\automation\unregister-scheduler.ps1

$ErrorActionPreference = 'Stop'
$TaskName = 'ProjectBright-AITop5-Daily'

$existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($null -eq $existing) {
    Write-Host "Task '$TaskName' is not registered - nothing to do."
    return
}

Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
Write-Host "Unregistered '$TaskName'. The daily automation will no longer fire on a timer."
