import test from "node:test";
import assert from "node:assert/strict";

import { fillMissingGeneratedPrompts } from "./imageFlowPromptFallback.ts";

test("fillMissingGeneratedPrompts falls back to the current record prompt when a generated node prompt is empty", () => {
  const flow = {
    nodes: [
      {
        id: "generated-1",
        type: "generated",
        data: {
          generatedImage: "/oss/generated.jpg",
          prompt: "",
          references: [],
        },
      },
      {
        id: "upload-1",
        type: "upload",
        data: {
          image: "/oss/reference.jpg",
        },
      },
    ],
    edges: [],
  };

  const hydrated = fillMissingGeneratedPrompts(flow, "current prompt");

  assert.equal(hydrated.nodes[0].data.prompt, "current prompt");
  assert.equal(hydrated.nodes[1].data.image, "/oss/reference.jpg");
});

test("fillMissingGeneratedPrompts preserves an existing generated node prompt", () => {
  const flow = {
    nodes: [
      {
        id: "generated-1",
        type: "generated",
        data: {
          generatedImage: "/oss/generated.jpg",
          prompt: "flow prompt",
          references: [],
        },
      },
    ],
    edges: [],
  };

  const hydrated = fillMissingGeneratedPrompts(flow, "current prompt");

  assert.equal(hydrated.nodes[0].data.prompt, "flow prompt");
});
