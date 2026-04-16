declare module "three" {
  export type VectorLike = {
    x: number;
    y: number;
    z: number;
    set(x: number, y: number, z: number): void;
  };

  export type RotationLike = {
    x: number;
    y: number;
    z: number;
  };

  export class Object3D {
    position: VectorLike;
    rotation: RotationLike;
    add(...objects: Object3D[]): void;
    traverse(callback: (object: Object3D) => void): void;
  }

  export class AmbientLight extends Object3D {
    constructor(color: number, intensity?: number);
  }

  export class Clock {
    elapsedTime: number;
    getDelta(): number;
  }

  export class DirectionalLight extends Object3D {
    constructor(color: number, intensity?: number);
  }

  export class Group extends Object3D {}

  export class PerspectiveCamera extends Object3D {
    aspect: number;
    constructor(fov: number, aspect: number, near: number, far: number);
    updateProjectionMatrix(): void;
  }

  export class Scene extends Object3D {}

  export class WebGLRenderer {
    domElement: HTMLCanvasElement;
    outputColorSpace: string;
    constructor(options?: {
      alpha?: boolean;
      antialias?: boolean;
      powerPreference?: "default" | "high-performance" | "low-power";
    });
    dispose(): void;
    render(scene: Scene, camera: PerspectiveCamera): void;
    setPixelRatio(value: number): void;
    setSize(width: number, height: number, updateStyle?: boolean): void;
  }
}

declare module "three/examples/jsm/loaders/GLTFLoader.js" {
  import type { Object3D } from "three";

  export type GLTFResult = {
    scene: Object3D;
    userData: Record<string, unknown>;
  };

  export class GLTFLoader {
    register(callback: (parser: unknown) => unknown): void;
    load(
      url: string,
      onLoad: (gltf: GLTFResult) => void,
      onProgress?: ((event: unknown) => void) | undefined,
      onError?: ((error: unknown) => void) | undefined,
    ): void;
  }
}
