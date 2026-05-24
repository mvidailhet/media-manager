Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ProjectDir = if ($env:PROJECT_DIR) { $env:PROJECT_DIR } else { "C:\Users\miche\Documents\Projects\media-manager" }
$PromptFile = Join-Path $ProjectDir ".codex\automations\nightly-ready-for-agent-prompt.md"
$LogDir = if ($env:LOG_DIR) { $env:LOG_DIR } else { Join-Path $env:USERPROFILE ".codex\automations\nightly-ready-for-agent-implementation" }
$LogFile = Join-Path $LogDir "scheduled-task.log"
$MaxIssues = if ($env:MAX_ISSUES) { [int]$env:MAX_ISSUES } else { 5 }
$RepositoryName = if ($env:REPOSITORY_NAME) { $env:REPOSITORY_NAME } else { "mvidailhet/media-manager" }
$ReadyForAgentLabel = if ($env:READY_FOR_AGENT_LABEL) { $env:READY_FOR_AGENT_LABEL } else { "ready-for-agent" }
$ExpectedCommandDirectories = @(
  "C:\Program Files\nodejs",
  (Join-Path $env:APPDATA "npm"),
  "C:\Program Files\GitHub CLI"
)

function Add-CommandDirectoriesToPath {
  $existingDirectories = $env:PATH -split ";" | Where-Object { $_ }
  $availableCommandDirectories = $ExpectedCommandDirectories |
    Where-Object { Test-Path $_ }

  $env:PATH = ($availableCommandDirectories + $existingDirectories) -join ";"
}

function Get-RequiredCommandPath {
  param(
    [Parameter(Mandatory = $true)]
    [string] $CommandName,

    [Parameter(Mandatory = $true)]
    [string] $InstallHint
  )

  $command = Get-Command $CommandName -ErrorAction SilentlyContinue
  if ($null -eq $command) {
    throw "$CommandName was not found on PATH. $InstallHint"
  }

  return $command.Source
}

function Get-CodexCommandPath {
  if ($env:CODEX_BIN) {
    return $env:CODEX_BIN
  }

  return "codex"
}

function Get-GitHubCliCommandPath {
  if ($env:GH_BIN) {
    return $env:GH_BIN
  }

  $gitHubCliCommand = Get-Command "gh.exe" -ErrorAction SilentlyContinue
  if ($null -ne $gitHubCliCommand) {
    return $gitHubCliCommand.Source
  }

  $defaultGitHubCliPath = "C:\Program Files\GitHub CLI\gh.exe"
  if (Test-Path $defaultGitHubCliPath) {
    return $defaultGitHubCliPath
  }

  return Get-RequiredCommandPath `
    -CommandName "gh" `
    -InstallHint "Install GitHub CLI for Windows, then run 'gh auth login'."
}

function Write-AutomationLog {
  param(
    [Parameter(Mandatory = $true)]
    [AllowEmptyString()]
    [string] $Message
  )

  $Message | Out-File -FilePath $LogFile -Encoding utf8 -Append
}

function Get-UtcTimestamp {
  return (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
}

Add-CommandDirectoriesToPath
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

try {
  Write-AutomationLog ""
  Write-AutomationLog "===== nightly-ready-for-agent $(Get-UtcTimestamp) ====="

  if (-not (Test-Path $ProjectDir)) {
    throw "Project directory does not exist: $ProjectDir"
  }

  if (-not (Test-Path $PromptFile)) {
    throw "Prompt file does not exist: $PromptFile"
  }

  $GitHubCliPath = Get-GitHubCliCommandPath
  $CodexPath = Get-CodexCommandPath

  Set-Location $ProjectDir

  & $GitHubCliPath auth status *>> $LogFile
  if ($LASTEXITCODE -ne 0) {
    throw "GitHub CLI is not authenticated. Run 'gh auth login' before the scheduled task runs."
  }

  $readyIssues = @(& $GitHubCliPath issue list `
    --repo $RepositoryName `
    --label $ReadyForAgentLabel `
    --state open `
    --limit $MaxIssues `
    --json number `
    --jq ".[].number")

  if ($LASTEXITCODE -ne 0) {
    throw "Failed to list GitHub issues for $RepositoryName."
  }

  if ($readyIssues.Count -eq 0) {
    Write-AutomationLog "No ready-for-agent issues found."
    exit 0
  }

  Write-AutomationLog "Found $($readyIssues.Count) ready-for-agent issue(s), capped at MAX_ISSUES=$MaxIssues."

  $promptTemplate = Get-Content -Path $PromptFile -Raw

  foreach ($issueNumber in $readyIssues) {
    $issueLogFile = Join-Path $LogDir "issue-$issueNumber.log"

    Write-AutomationLog ""
    Write-AutomationLog "----- issue #$issueNumber start $(Get-UtcTimestamp) -----"

    $issuePrompt = $promptTemplate.Replace("ISSUE_NUMBER", "#$issueNumber")
    $previousErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
      $issuePrompt | & $CodexPath exec `
        --cd $ProjectDir `
        --sandbox danger-full-access `
        --dangerously-bypass-approvals-and-sandbox `
        --model gpt-5.5 `
        -c "model_reasoning_effort=`"medium`"" `
        - *>> $issueLogFile
    } finally {
      $ErrorActionPreference = $previousErrorActionPreference
    }

    if ($LASTEXITCODE -ne 0) {
      Write-AutomationLog "Issue #$issueNumber failed with exit code $LASTEXITCODE."
    }

    Write-AutomationLog "----- issue #$issueNumber end $(Get-UtcTimestamp) -----"
    Write-AutomationLog "Issue #$issueNumber log: $issueLogFile"
  }
} catch {
  Write-AutomationLog "ERROR: $($_.Exception.Message)"
  throw
}
