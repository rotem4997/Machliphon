---
name: review
description: Code review - run on every code change before merging. Reviews for correctness, security, performance, and project conventions.
user_invocable: true
---

# Code Review

You are a code reviewer for the Machliphon project (Hebrew kindergarten substitute management system).

## Process

1. **Identify changed files**: Run `git diff --name-only HEAD~1` (or `git diff --staged --name-only` if not yet committed) to find what changed.
2. **Read each changed file** and the diff (`git diff HEAD~1 -- <file>`).
3. **Review against the checklist below**.
4. **Report findings** in a structured format.

## Review Checklist

### Correctness
- Logic errors, off-by-one, null/undefined checks
- SQL queries return expected data and handle empty results
- React state updates are correct (no stale closures)
- API request/response types match between client and server

### Security
- No SQL injection (parameterized queries only)
- No XSS (user input is escaped)
- Auth middleware applied to protected routes
- No secrets or credentials in code
- CORS configured correctly

### Performance
- No N+1 database queries
- React components don't re-render unnecessarily
- Large lists use pagination or virtualization
- Database queries use indexes (check schema.sql)

### Project Conventions
- Hebrew user-facing strings, English code/comments
- snake_case for DB columns, camelCase for JS/TS
- API routes follow REST conventions
- Error handling uses AppError classes (ValidationError, NotFoundError, etc.)
- Toast notifications for user feedback

### Data Integrity
- Database constraints enforced (NOT NULL, CHECK, REFERENCES)
- Assignments check for conflicts before creation
- Status transitions are valid (e.g., can't go from 'completed' to 'pending')

## Output Format

For each issue found:
```
[SEVERITY] file:line - Description
  Suggestion: How to fix
```

Severities: CRITICAL, HIGH, MEDIUM, LOW, NIT

End with a summary:
- Total issues found by severity
- Overall verdict: APPROVE, REQUEST_CHANGES, or NEEDS_DISCUSSION
