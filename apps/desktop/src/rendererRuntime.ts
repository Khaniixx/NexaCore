export type RendererRuntimeSupport = {
  live2d: {
    available: boolean;
    runtime: "pixi";
  };
  vrm: {
    available: boolean;
    runtime: "three-vrm";
  };
};

export function getRendererRuntimeSupport(): RendererRuntimeSupport {
  return {
    live2d: {
      available: true,
      runtime: "pixi",
    },
    vrm: {
      available: true,
      runtime: "three-vrm",
    },
  };
}
