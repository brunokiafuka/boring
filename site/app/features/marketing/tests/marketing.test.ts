import { testApp } from "@boring-dev/test";
import { expect, test } from "vitest";

test("the front page is open to everyone", async () => {
  expect((await testApp().as(null).visit("/")).status).toBe(200);
});
