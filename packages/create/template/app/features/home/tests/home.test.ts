import { testApp } from "@boring-dev/test";
import { expect, test } from "vitest";

test("the home page is open to everyone", async () => {
  const page = await testApp().as(null).visit("/");
  expect(page.status).toBe(200);
});
