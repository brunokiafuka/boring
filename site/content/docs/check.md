---
title: boring check
order: 6
description: The rules boring check enforces, and what boring explain tells you.
---

The shape is checked, not hoped for. `boring check` reads the same compiled route tree as the server and reports
drift with a rule number and the line.

```text
✓ route tree is valid: 4 routes, no duplicates or conflicts
✓ features only meet through their public APIs
✓ no feature dependency cycles
✓ app/shared depends on no feature
✓ UI, business rules and server code point the right way
✓ actions declare input schemas and policies
✓ no parallel state or mutation systems
✓ features with actions have tests

Boring score: 100/100
```

## Rules

| Rule | Finding                                     |
| ---- | ------------------------------------------- |
| B104 | a global store contains URL-shaped state    |
| B110 | deep import across a feature boundary       |
| B111 | import into another feature's `internal/`   |
| B112 | `app/shared` imports from a feature         |
| B113 | feature dependency cycle                    |
| B114 | public API leaks `internal/`                |
| B120 | business module imports UI                  |
| B121 | a component imports a view                  |
| B130 | route tree problem                          |
| B201 | action declares no input schema             |
| B202 | action declares no policy                   |
| B217 | UI imports server code                      |
| B301 | hand-rolled mutation bypasses form + action |
| B401 | feature has actions but no tests            |

Suppress with a reason and an expiry: `// boring-ignore B110 until 2026-12-01: why`.

## boring explain

With no argument, `boring explain` prints what features exist, what each exposes, every URL, and how layouts
compose. Given an action file, it explains the action: what it mutates, what it requires, where it is used, what it
invalidates, and what it enqueues.

```text
$ boring explain app/features/customer/actions/update-customer.ts
· updateCustomer is a canonical action
├ mutates Customer
├ requires customer:update
├ validates input with a schema
├ used by /customers/:id/settings
├ invalidates Customer/:id
└ enqueues sync-customer after commit
```
