import { useEffect, useRef, useState } from "react";

import { VRM, VRMLoaderPlugin, VRMUtils } from "@pixiv/three-vrm";
import {
  AmbientLight,
  Clock,
  DirectionalLight,
  Group,
  Object3D,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from "three";
import {
  GLTFLoader,
  type GLTFResult,
} from "three/examples/jsm/loaders/GLTFLoader.js";

type VrmCanvasPreviewProps = {
  modelUrl?: string | null;
  displayName: string;
  state: "idle" | "listening" | "thinking" | "talking" | "reaction" | "error";
};

export function VrmCanvasPreview({
  modelUrl,
  displayName,
  state,
}: VrmCanvasPreviewProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [runtimeState, setRuntimeState] = useState<"loading" | "ready" | "fallback">(
    modelUrl ? "loading" : "fallback",
  );

  useEffect(() => {
    const hostElement = hostRef.current;
    if (!hostElement || !modelUrl) {
      setRuntimeState("fallback");
      return;
    }
    const currentHost = hostElement;

    let cancelled = false;
    let renderer: WebGLRenderer | null = null;
    let frameId = 0;
    let currentVrm: VRM | null = null;
    let pivot: Group | null = null;
    const resolvedModelUrl = modelUrl;

    const scene = new Scene();
    const camera = new PerspectiveCamera(30, 1, 0.1, 20);
    const clock = new Clock();

    function mountRenderer(): WebGLRenderer {
      const nextRenderer = new WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
      });
      nextRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      nextRenderer.outputColorSpace = "srgb";
      currentHost.innerHTML = "";
      currentHost.appendChild(nextRenderer.domElement);
      return nextRenderer;
    }

    function resizeRenderer(): void {
      if (!renderer) {
        return;
      }
      const width = Math.max(currentHost.clientWidth, 320);
      const height = Math.max(currentHost.clientHeight, 420);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    }

    function updatePose(elapsed: number): void {
      if (!currentVrm || !pivot) {
        return;
      }

      const bob =
        state === "talking"
          ? Math.sin(elapsed * 5.8) * 0.018
          : state === "listening"
            ? Math.sin(elapsed * 4.1) * 0.014
            : Math.sin(elapsed * 2.2) * 0.01;
      const sway =
        state === "reaction"
          ? Math.sin(elapsed * 3.5) * 0.1
          : state === "thinking"
            ? Math.sin(elapsed * 1.6) * 0.035
            : Math.sin(elapsed * 1.15) * 0.02;

      pivot.position.y = -1.15 + bob;
      pivot.rotation.y = Math.PI + sway;
    }

    async function mountModel(): Promise<void> {
      try {
        renderer = mountRenderer();
        resizeRenderer();

        camera.position.set(0, 1.35, 2.15);

        const ambient = new AmbientLight(0xffffff, 1.8);
        const key = new DirectionalLight(0xc8efff, 1.9);
        key.position.set(0.8, 1.8, 1.6);
        const rim = new DirectionalLight(0x7dd8ff, 1.15);
        rim.position.set(-1.2, 1.1, -0.6);

        scene.add(ambient, key, rim);

        const loader = new GLTFLoader();
        loader.register((parser: unknown) => new VRMLoaderPlugin(parser as never));

        loader.load(
          resolvedModelUrl,
          (gltf: GLTFResult) => {
            if (cancelled) {
              return;
            }

            const vrm = gltf.userData.vrm as VRM | undefined;
            if (!vrm) {
              setRuntimeState("fallback");
              return;
            }

            VRMUtils.removeUnnecessaryVertices(gltf.scene);
            VRMUtils.removeUnnecessaryJoints(gltf.scene);
            VRMUtils.rotateVRM0(vrm);

            pivot = new Group();
            pivot.position.set(0, -1.15, 0);
            pivot.rotation.y = Math.PI;
            pivot.add(vrm.scene);
            scene.add(pivot);

            currentVrm = vrm;
            setRuntimeState("ready");
          },
          undefined,
          () => {
            if (!cancelled) {
              setRuntimeState("fallback");
            }
          },
        );

        const renderFrame = () => {
          if (cancelled || !renderer) {
            return;
          }
          const delta = clock.getDelta();
          const elapsed = clock.elapsedTime;
          currentVrm?.update(delta);
          updatePose(elapsed);
          renderer.render(scene, camera);
          frameId = window.requestAnimationFrame(renderFrame);
        };

        frameId = window.requestAnimationFrame(renderFrame);
        window.addEventListener("resize", resizeRenderer);
      } catch {
        setRuntimeState("fallback");
      }
    }

    void mountModel();

    return () => {
      cancelled = true;
      window.removeEventListener("resize", resizeRenderer);
      if (frameId !== 0) {
        window.cancelAnimationFrame(frameId);
      }
      currentVrm?.scene.traverse((object: Object3D) => {
        const mesh = object as Object3D & {
          geometry?: { dispose?: () => void };
          material?:
            | { dispose?: () => void }
            | Array<{ dispose?: () => void }>;
        };
        mesh.geometry?.dispose?.();
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((material) => material.dispose?.());
        } else {
          mesh.material?.dispose?.();
        }
      });
      currentVrm = null;
      renderer?.dispose();
      currentHost.innerHTML = "";
    };
  }, [displayName, modelUrl, state]);

  return (
    <div
      ref={hostRef}
      aria-label={`${displayName} VRM preview`}
      className={`vrm-canvas-preview vrm-canvas-preview--${runtimeState}`}
      data-vrm-runtime={runtimeState}
    >
      {runtimeState !== "ready" ? (
        <span className="vrm-canvas-preview__fallback" aria-hidden="true">
          {displayName.charAt(0).toUpperCase()}
        </span>
      ) : null}
    </div>
  );
}
