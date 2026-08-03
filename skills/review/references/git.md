# Git input

Use this reference for a commit, branch, tag, or revision range.

## Interpret the comparison

- Honor an explicit base and target from the user.
- For a branch review, the merge base usually represents the point of divergence.
- For one commit, its parent is usually the comparison point.
- `A..B` names a commit set in log commands, while `git diff A B` compares the
  two endpoints. `git diff A...B` compares the merge base of A and B with B.
- If `HEAD` has no parent, combine this reference with `worktree.md` and inspect
  staged, unstaged, and untracked content directly.

Useful evidence may come from:

```text
git merge-base <base> <target>
git log --oneline <base>..<target>
git diff --find-renames <base> <target>
git show --stat --oneline <commit>
```

Choose only commands that answer the review question. Read changed source and
the smallest relevant set of callers, tests, schemas, and configuration rather
than relying on the unified diff alone.

## Watch for omitted meaning

- Treat additions, deletions, renames, executable-bit changes, submodules, and
  binary or generated files according to their runtime effect.
- Check whether later commits repair or depend on an earlier change when the
  target contains multiple commits.
- Distinguish a code comparison baseline from behavior requirements documented
  by tests, APIs, schemas, or specifications.
- State limitations when history is shallow, a revision is unavailable, or the
  requested range is ambiguous enough to change the conclusion.
