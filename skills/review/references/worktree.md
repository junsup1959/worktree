# Worktree input

Use this reference for current staged, unstaged, and untracked changes, or for
comparing two worktrees or directories.

## Inspect the current result

Useful views include:

```text
git status --short --untracked-files=all
git diff --find-renames
git diff --cached --find-renames
git diff HEAD --find-renames
git diff --no-index <left> <right>
```

Use only the views supported by the repository state. `git diff` omits
untracked files, and `git diff HEAD` is unavailable for an unborn `HEAD`.
Open relevant untracked files directly. When a file has both staged and
unstaged edits, review the resulting worktree content as well as the split
patches when that distinction matters.

For two directories, compare file presence and relevant contents. Account for
renames, deletions, symlinks, permissions, binary files, and ignored or
generated outputs when they affect behavior. A nonzero `git diff --no-index`
status normally means differences were found, not that inspection failed.

Use `HEAD` as the code baseline only when it exists and fits the request. Do not
modify, stage, clean, or discard the user's changes during review. Report files
or content that could not be inspected, especially ignored and binary outputs.
