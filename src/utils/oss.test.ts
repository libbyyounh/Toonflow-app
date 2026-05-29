import test from "node:test";
import assert from "node:assert/strict";

import { buildPublicFileUrl } from "./oss";

test("buildPublicFileUrl prefers same-origin relative paths by default", () => {
  const url = buildPublicFileUrl({
    userRelPath: "project/image.png",
    prefix: "oss",
    env: {},
    isElectronEnv: false,
  });

  assert.equal(url, "/oss/project/image.png");
});

test("buildPublicFileUrl honors OSSURL in non-electron environments", () => {
  const url = buildPublicFileUrl({
    userRelPath: "project/image.png",
    prefix: "oss",
    env: { OSSURL: "https://cdn.example.com/base/" },
    isElectronEnv: false,
  });

  assert.equal(url, "https://cdn.example.com/base/oss/project/image.png");
});

test("buildPublicFileUrl supports legacy lowercase ossURL", () => {
  const url = buildPublicFileUrl({
    userRelPath: "nested/file.png",
    prefix: "assets",
    env: { ossURL: "https://assets.example.com" },
    isElectronEnv: false,
  });

  assert.equal(url, "https://assets.example.com/assets/nested/file.png");
});

test("buildPublicFileUrl keeps electron on localhost app port", () => {
  const url = buildPublicFileUrl({
    userRelPath: "nested/file.png",
    prefix: "oss",
    env: { PORT: "3123", OSSURL: "https://cdn.example.com" },
    isElectronEnv: true,
  });

  assert.equal(url, "http://localhost:3123/oss/nested/file.png");
});
