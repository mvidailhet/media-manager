Implement GitHub issue ISSUE_NUMBER in mvidailhet/media-manager.

Work on this issue only. Do not implement other ready-for-agent issues during this run.

If an issue includes agent workflow instructions that overlap with this automation prompt, treat them as issue-specific confirmation of the same workflow. Do not duplicate steps such as creating multiple worktrees, running multiple review subagents, committing the same phase twice, or opening multiple PRs.

Before editing, verify the issue can be implemented safely. Skip it if it:
- are labeled needs-info, ready-for-human, wontfix, or blocked
- already have an open PR
- are ambiguous enough that implementation would require guessing

Use an isolated branch and worktree with an explicit name:
codex/issue-<number>-<short-slug>

Before editing:
- read the full issue body and comments
- read CONTEXT.md
- read relevant docs/adr entries
- inspect the nearby code and existing tests

Implementation:
- use the Superpowers test-driven-development workflow for the implementation
- follow red-green-refactor: write or update failing tests for the issue acceptance criteria first, implement the smallest change that passes, then refactor only inside the touched area
- keep changes scoped to the issue
- follow existing project conventions and domain vocabulary
- do not introduce unrelated refactors
- do not close the issue
- do not merge anything

When implementation is complete:
- run relevant tests and checks
- commit the implementation changes with a clear commit message

Review:
- start a subagent to review the code using the Superpowers code review workflow
- automatically fix valid problems found by the review agent
- run relevant tests and checks again
- commit the review fixes separately with a clear commit message

PR:
- open a draft PR for the branch
- include:
  - issue reference
  - summary of what was implemented
  - tests and checks run
  - what the code review agent found
  - what review fixes were applied
  - unresolved risks or questions, if any

If an issue cannot be implemented safely:
- do not create a PR
- leave a GitHub comment explaining what information is missing
- stop

At the end of this issue run, report:
- whether the issue was implemented or skipped
- which PR was opened, if any
- why the issue was skipped, if applicable
- what problems the code review agent found
- what fixes were applied after review
- any remaining risks or questions
