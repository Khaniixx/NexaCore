import type { CSSProperties } from "react";

import type { CompanionState } from "../companionStateMachine";
import type {
  PackAvatarConfig,
  PackModelConfig,
  PackVoiceConfig,
} from "../packApi";

type CompanionAvatarProps = {
  state: CompanionState;
  displayName?: string;
  avatarConfig?: PackAvatarConfig;
  modelConfig?: PackModelConfig;
  voiceConfig?: PackVoiceConfig;
  iconDataUrl?: string | null;
  presenceAnchor?:
    | "desktop-right"
    | "desktop-left"
    | "active-window-right"
    | "active-window-left"
    | "active-window-top-right"
    | "active-window-top-left"
    | "workspace";
  presencePinned?: boolean;
  presenceTargetTitle?: string | null;
  immersive?: boolean;
};

type AvatarPresentationMode = "shell" | "portrait" | "model";
type AvatarModelRenderer = "shell" | "live2d" | "vrm" | null;

function getAnimationName(
  state: CompanionState,
  avatarConfig?: PackAvatarConfig,
): string {
  if (state === "idle") {
    return avatarConfig?.idle_animation ?? "idle";
  }
  if (state === "listening") {
    return avatarConfig?.listening_animation ?? "listening";
  }
  if (state === "thinking") {
    return avatarConfig?.thinking_animation ?? "thinking";
  }
  if (state === "talking") {
    return avatarConfig?.talking_animation ?? "talking";
  }
  if (state === "reaction") {
    return avatarConfig?.reaction_animation ?? "reaction";
  }
  return "error";
}

function getVoiceCue(
  state: CompanionState,
  avatarConfig?: PackAvatarConfig,
  voiceConfig?: PackVoiceConfig,
): string {
  const audioCue = avatarConfig?.audio_cues?.[state];
  if (audioCue) {
    return audioCue;
  }

  const voiceId = voiceConfig?.voice_id ?? "default";
  return state === "idle" ? `${voiceId}-idle-loop` : `${voiceId}-${state}`;
}

function getPresenceCue(state: CompanionState): string {
  if (state === "idle") {
    return "Quietly nearby";
  }
  if (state === "listening") {
    return "Leaning in";
  }
  if (state === "thinking") {
    return "Holding the thread";
  }
  if (state === "talking") {
    return "With you now";
  }
  if (state === "reaction") {
    return "Perking up";
  }
  return "Needs a breath";
}

function getAvatarMode(
  avatarConfig?: PackAvatarConfig,
  modelConfig?: PackModelConfig,
): AvatarPresentationMode {
  if (avatarConfig?.presentation_mode === "portrait") {
    return "portrait";
  }
  if (modelConfig?.renderer === "live2d" || modelConfig?.renderer === "vrm") {
    return "model";
  }
  if (
    avatarConfig?.presentation_mode === "model" ||
    (avatarConfig?.model_path ?? null) !== null
  ) {
    return "model";
  }
  return "shell";
}

function getModelRenderer(modelConfig?: PackModelConfig): AvatarModelRenderer {
  if (modelConfig?.renderer === "live2d" || modelConfig?.renderer === "vrm") {
    return modelConfig.renderer;
  }
  if (modelConfig?.renderer === "shell") {
    return "shell";
  }
  return null;
}

function getAvatarStageLabel(
  mode: AvatarPresentationMode,
  avatarConfig: PackAvatarConfig | undefined,
  modelRenderer: AvatarModelRenderer,
): string {
  if (avatarConfig?.stage_label) {
    return avatarConfig.stage_label;
  }
  if (modelRenderer === "live2d") {
    return "Live2D-ready stage";
  }
  if (modelRenderer === "vrm") {
    return "VRM-ready stage";
  }
  if (mode === "model") {
    return "Model-ready shell";
  }
  if (mode === "portrait") {
    return "Portrait-led shell";
  }
  return "Desk shell";
}

function getAvatarBadge(
  mode: AvatarPresentationMode,
  modelRenderer: AvatarModelRenderer,
): string {
  if (modelRenderer === "live2d") {
    return "Live2D-ready";
  }
  if (modelRenderer === "vrm") {
    return "VRM-ready";
  }
  if (mode === "model") {
    return "Model-ready";
  }
  if (mode === "portrait") {
    return "Portrait-led";
  }
  return "Shell";
}

function getAvatarReadiness(
  mode: AvatarPresentationMode,
  modelRenderer: AvatarModelRenderer,
  modelConfig: PackModelConfig | undefined,
  iconDataUrl: string | null | undefined,
): string {
  if (modelRenderer === "live2d") {
    return modelConfig?.asset_path
      ? "Pack has a Live2D model manifest ready for the next renderer."
      : "Pack is flagged for Live2D rendering once model assets arrive.";
  }
  if (modelRenderer === "vrm") {
    return modelConfig?.asset_path
      ? "Pack has a VRM model manifest ready for richer rendering."
      : "Pack is flagged for VRM rendering once model assets arrive.";
  }
  if (mode === "model") {
    return "Pack has a model path ready for richer rendering.";
  }
  if (iconDataUrl) {
    return "Pack icon is driving this shell presentation.";
  }
  return "Fallback shell is carrying the active companion identity.";
}

function getAttachmentMode(
  presencePinned: boolean,
  presenceAnchor: CompanionAvatarProps["presenceAnchor"],
): "attached" | "docked" | "workspace" {
  if (!presencePinned || presenceAnchor === "workspace" || presenceAnchor === undefined) {
    return "workspace";
  }
  if (
    presenceAnchor === "active-window-left" ||
    presenceAnchor === "active-window-right" ||
    presenceAnchor === "active-window-top-left" ||
    presenceAnchor === "active-window-top-right"
  ) {
    return "attached";
  }
  return "docked";
}

function getAttachmentLabel(
  attachmentMode: "attached" | "docked" | "workspace",
  presenceAnchor: CompanionAvatarProps["presenceAnchor"],
  presenceTargetTitle: string | null | undefined,
): string {
  if (attachmentMode === "attached") {
    if (presenceTargetTitle) {
      return presenceAnchor === "active-window-top-left" ||
        presenceAnchor === "active-window-top-right"
        ? `Perched on ${presenceTargetTitle}`
        : `Following ${presenceTargetTitle}`;
    }
    return presenceAnchor === "active-window-left"
      ? "Attached left of active app"
      : presenceAnchor === "active-window-top-left"
        ? "Perched on top-left of active app"
        : presenceAnchor === "active-window-top-right"
          ? "Perched on top-right of active app"
      : "Attached right of active app";
  }
  if (attachmentMode === "docked") {
    return presenceAnchor === "desktop-left"
      ? "Docked to desktop left"
      : "Docked to desktop right";
  }
  return "Resting in workspace";
}

function getAttachmentCue(
  attachmentMode: "attached" | "docked" | "workspace",
  presenceTargetTitle: string | null | undefined,
): string {
  if (attachmentMode === "attached") {
    return presenceTargetTitle
      ? `Keeping close to ${presenceTargetTitle}`
      : "Keeping close to the active window";
  }
  if (attachmentMode === "docked") {
    return "Holding a steady place on the desktop edge";
  }
  return "Staying in the main workspace";
}

export function CompanionAvatar({
  state,
  displayName = "Aster",
  avatarConfig,
  modelConfig,
  voiceConfig,
  iconDataUrl,
  presenceAnchor = "workspace",
  presencePinned = false,
  presenceTargetTitle,
  immersive = false,
}: CompanionAvatarProps) {
  const stateLabel = state.charAt(0).toUpperCase() + state.slice(1);
  const animationName = getAnimationName(state, avatarConfig);
  const voiceCue = getVoiceCue(state, avatarConfig, voiceConfig);
  const presenceCue = getPresenceCue(state);
  const avatarMode = getAvatarMode(avatarConfig, modelConfig);
  const modelRenderer = getModelRenderer(modelConfig);
  const stageLabel = getAvatarStageLabel(avatarMode, avatarConfig, modelRenderer);
  const stageBadge = getAvatarBadge(avatarMode, modelRenderer);
  const readinessLabel = getAvatarReadiness(
    avatarMode,
    modelRenderer,
    modelConfig,
    iconDataUrl,
  );
  const attachmentMode = getAttachmentMode(presencePinned, presenceAnchor);
  const attachmentLabel = getAttachmentLabel(
    attachmentMode,
    presenceAnchor,
    presenceTargetTitle,
  );
  const attachmentCue = getAttachmentCue(attachmentMode, presenceTargetTitle);
  const avatarStyle = {
    "--avatar-accent": avatarConfig?.accent_color ?? "#9db9ff",
    "--avatar-aura": avatarConfig?.aura_color ?? "#87ead8",
  } as CSSProperties;

  return (
    <div
      className={`avatar-shell avatar-shell--${state} avatar-shell--${avatarMode} avatar-shell--${attachmentMode}`}
      aria-live="polite"
      aria-label={`${displayName} avatar is ${state}`}
      data-animation={animationName}
      data-avatar-mode={avatarMode}
      data-model-renderer={modelRenderer ?? "none"}
      data-attachment-mode={attachmentMode}
      data-attachment-label={attachmentLabel}
      data-idle-loop={state === "idle" ? "true" : "false"}
      data-presence-cue={presenceCue}
      data-stage-label={stageLabel}
      data-voice-clip={voiceCue}
      style={avatarStyle}
    >
      {!immersive ? (
        <>
          <div className="avatar-plaque" aria-hidden="true">
            <span className="avatar-plaque__label">{stageLabel}</span>
            <span className={`avatar-plaque__badge avatar-plaque__badge--${avatarMode}`}>
              {stageBadge}
            </span>
          </div>
          <div className="avatar-dock" aria-hidden="true">
            <span className={`avatar-dock__chip avatar-dock__chip--${attachmentMode}`}>
              {attachmentLabel}
            </span>
            <span className={`avatar-dock__rail avatar-dock__rail--${attachmentMode}`} />
          </div>
        </>
      ) : null}
      <div className="avatar-aura" />
      <div className="avatar-ears" aria-hidden="true">
        <span className={`avatar-ear avatar-ear--left avatar-ear--${state}`} />
        <span className={`avatar-ear avatar-ear--right avatar-ear--${state}`} />
      </div>
      <div className="avatar-body">
        <div className={`avatar-tail avatar-tail--${state}`} aria-hidden="true" />
        <div className="avatar-medallion" aria-hidden="true">
          {iconDataUrl ? (
            <img
              alt=""
              className="avatar-medallion__image"
              src={iconDataUrl}
            />
          ) : (
            <span className="avatar-medallion__fallback">
              {displayName.charAt(0).toUpperCase()}
            </span>
          )}
        </div>
        {avatarMode === "model" && !immersive ? (
          <div className="avatar-model-ring" aria-hidden="true">
            {modelRenderer === "live2d"
              ? "live2d manifest ready"
              : modelRenderer === "vrm"
                ? "vrm manifest ready"
                : "model path ready"}
          </div>
        ) : null}
        <div className="avatar-face">
          <span className={`avatar-eye avatar-eye--${state}`} />
          <span className={`avatar-eye avatar-eye--${state}`} />
          <span className={`avatar-mouth avatar-mouth--${state}`} />
        </div>
      </div>
      {!immersive ? (
        <div className={`avatar-whisper avatar-whisper--${state}`} aria-hidden="true">
          {presenceCue}
        </div>
      ) : null}
      <span className="avatar-screen-reader">
        {displayName} is using the {animationName} animation with the {voiceCue} cue.
        {` ${stageLabel}. ${readinessLabel} ${attachmentCue}. ${displayName} feels ${presenceCue.toLowerCase()}.`}
      </span>
      {!immersive ? (
        <div className="avatar-status">
          <span className="avatar-status__label">State</span>
          <strong>{stateLabel}</strong>
        </div>
      ) : null}
    </div>
  );
}
