import { useEffect, useRef, useState } from "react";

type PixiApp = {
  view: HTMLCanvasElement;
  stage: {
    addChild: (child: unknown) => void;
  };
  ticker: {
    add: (callback: () => void) => void;
  };
  destroy: (
    removeView?: boolean,
    options?: {
      children?: boolean;
      texture?: boolean;
      baseTexture?: boolean;
    },
  ) => void;
};

type PixiSprite = {
  anchor: {
    set: (value: number) => void;
  };
  x: number;
  y: number;
  scale: {
    x: number;
    set: (value: number) => void;
  };
};

type PixiAura = {
  clear: () => void;
  beginFill: (color: number, alpha: number) => void;
  drawEllipse: (x: number, y: number, width: number, height: number) => void;
  endFill: () => void;
};

type Live2DPixiPreviewProps = {
  imageUrl: string | null | undefined;
  accentColor?: string | null;
  auraColor?: string | null;
  listeningIntensity: number;
  speechIntensity: number;
  displayName: string;
};

function parseHexColor(value: string | null | undefined, fallback: number): number {
  if (!value || !/^#[0-9a-fA-F]{6}$/.test(value)) {
    return fallback;
  }
  return Number.parseInt(value.slice(1), 16);
}

export function Live2DPixiPreview({
  imageUrl,
  accentColor,
  auraColor,
  listeningIntensity,
  speechIntensity,
  displayName,
}: Live2DPixiPreviewProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const runtimeValuesRef = useRef({
    listeningIntensity,
    speechIntensity,
  });
  const [runtimeState, setRuntimeState] = useState<"ready" | "fallback">("fallback");

  runtimeValuesRef.current = {
    listeningIntensity,
    speechIntensity,
  };

  useEffect(() => {
    const hostElement = hostRef.current;
    const previewUrl = imageUrl;
    if (!hostElement || !previewUrl) {
      setRuntimeState("fallback");
      return;
    }
    const hostNode = hostElement;
    const resolvedPreviewUrl = previewUrl;

    let cancelled = false;
    let app: PixiApp | null = null;
    let sprite: PixiSprite | null = null;
    let aura: PixiAura | null = null;

    async function mountPreview(): Promise<void> {
      try {
        const pixi = await import("pixi.js-legacy");
        if (cancelled) {
          return;
        }

        app = new pixi.Application({
          width: 260,
          height: 320,
          backgroundAlpha: 0,
          antialias: true,
          resolution: Math.max(window.devicePixelRatio || 1, 1),
          autoDensity: true,
        }) as unknown as PixiApp;
        hostNode.appendChild(app.view);

        aura = new pixi.Graphics() as unknown as PixiAura;
        const auraColorValue = parseHexColor(auraColor, 0x87ead8);
        aura.beginFill(auraColorValue, 0.16);
        aura.drawEllipse(130, 166, 94, 118);
        aura.endFill();
        app.stage.addChild(aura);

        const texture = await pixi.Texture.fromURL(resolvedPreviewUrl);
        if (cancelled) {
          return;
        }

        sprite = new pixi.Sprite(texture) as unknown as PixiSprite;
        sprite.anchor.set(0.5);
        sprite.x = 130;
        sprite.y = 164;
        const maxWidth = 176;
        const maxHeight = 238;
        const scale = Math.min(
          maxWidth / Math.max(texture.width, 1),
          maxHeight / Math.max(texture.height, 1),
        );
        sprite.scale.set(scale);
        app.stage.addChild(sprite);

        const accentColorValue = parseHexColor(accentColor, 0x9db9ff);
        const rim = new pixi.Graphics();
        rim.lineStyle(2, accentColorValue, 0.28);
        rim.drawRoundedRect(34, 34, 192, 252, 28);
        app.stage.addChild(rim);

        const stageSprite = sprite;
        const stageAura = aura;
        const stageAuraColor = auraColorValue;
        const baseY = stageSprite.y;
        const baseScale = stageSprite.scale.x;
        app.ticker.add(() => {
          if (!stageSprite || !stageAura) {
            return;
          }
          const elapsed = performance.now() / 1000;
          const { listeningIntensity: listen, speechIntensity: speech } = runtimeValuesRef.current;
          const speechLift = speech * 7;
          const listenLift = listen * 5;
          const idleFloat = Math.sin(elapsed * 1.8) * 4;
          const motionScale = 1 + speech * 0.035 + listen * 0.02;

          stageSprite.y = baseY + idleFloat - speechLift - listenLift;
          stageSprite.scale.set(baseScale * motionScale);

          stageAura.clear();
          stageAura.beginFill(stageAuraColor, 0.12 + listen * 0.12 + speech * 0.08);
          stageAura.drawEllipse(
            130,
            166 - listenLift * 0.35,
            94 + speech * 10,
            118 + listen * 12,
          );
          stageAura.endFill();
        });

        setRuntimeState("ready");
      } catch {
        setRuntimeState("fallback");
      }
    }

    void mountPreview();

    return () => {
      cancelled = true;
      if (app) {
        app.destroy(true, {
          children: true,
          texture: false,
          baseTexture: false,
        });
      }
      hostNode.innerHTML = "";
    };
  }, [accentColor, auraColor, imageUrl]);

  return (
    <div
      ref={hostRef}
      aria-label={`${displayName} Pixi preview`}
      className={`live2d-stage__pixi live2d-stage__pixi--${runtimeState}`}
      data-live2d-runtime={runtimeState}
      data-live2d-runtime-engine="pixi"
    >
      {runtimeState === "fallback" ? (
        imageUrl ? (
          <img alt="" className="live2d-stage__pixi-fallback-image" src={imageUrl} />
        ) : (
          <span className="live2d-stage__pixi-fallback-letter">
            {displayName.charAt(0).toUpperCase()}
          </span>
        )
      ) : null}
    </div>
  );
}
