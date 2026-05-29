type FlowNode = {
  type?: string;
  data?: {
    prompt?: string | null;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

type ImageFlowData = {
  nodes?: FlowNode[];
  [key: string]: unknown;
};

export function fillMissingGeneratedPrompts<T extends ImageFlowData>(flow: T, fallbackPrompt: string | null | undefined): T {
  const normalizedPrompt = fallbackPrompt?.trim();
  if (!normalizedPrompt || !Array.isArray(flow.nodes)) {
    return flow;
  }

  return {
    ...flow,
    nodes: flow.nodes.map((node) => {
      if (node.type !== "generated") {
        return node;
      }

      const currentPrompt = typeof node.data?.prompt === "string" ? node.data.prompt.trim() : "";
      if (currentPrompt) {
        return node;
      }

      return {
        ...node,
        data: {
          ...node.data,
          prompt: normalizedPrompt,
        },
      };
    }),
  };
}
