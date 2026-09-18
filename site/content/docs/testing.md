---
title: Testing
order: 5
description: One style: drive the app through its real request path as a chosen user.
---

One style. Tests live in `app/features/<feature>/tests/*.test.ts`, and the Vite plugin tells Vitest where they are.

```ts
import { testApp } from "@boring-dev/test";
import { expect, test } from "vitest";

test("a viewer can look but not save", async () => {
  const app = testApp(); // fresh in-memory database
  expect((await app.as(vik).visit(settings)).status).toBe(200);

  const refused = await app.as(vik).submit(settings, updateCustomer, valid);
  expect(refused.status).toBe(403);
});

test("the sync job runs after commit", async () => {
  const app = testApp();
  await app.as(ada).submit(settings, updateCustomer, valid);
  await app.jobs.drain();
  expect((await app.as(ada).visit(settings)).data.syncedAt).not.toBeNull();
});
```

Tests go through the real request path as a chosen user, without rendering. `visit` returns the status, the data
the view would read, the resource keys the loader touched, and any redirect. `submit` posts to an action and adds
the result and its field errors. Policies are plain functions, so they can also be tested directly.

Pass `null` to `as()` for a signed-out visitor.
