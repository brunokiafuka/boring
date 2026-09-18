import { testApp } from "@boring/test";
import { expect, test } from "vitest";
import { switchUser } from "../actions/switch-user";

test("anyone can open the session page", async () => {
  const page = await testApp().as(null).visit("/session");
  expect(page.status).toBe(200);
  expect(page.data).toHaveLength(3);
});

test("switching redirects home; unknown users are refused", async () => {
  const app = testApp();
  expect((await app.as(null).submit("/session", switchUser, { userId: "vik" })).redirect).toBe("/customers");
  expect((await app.as(null).submit("/session", switchUser, { userId: "mallory" })).errors.userId).toBe(
    "No such user",
  );
});
