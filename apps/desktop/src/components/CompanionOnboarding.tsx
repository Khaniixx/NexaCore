import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";

import nexaCoreLogo from "../assets/nexacore-logo-v1-core-network.svg";
import {
  loadOnboardingProfile,
  persistOnboardingProfile,
  type CompanionPrivacyMode,
} from "../onboardingProfile";
import { packApi, type InstalledPack } from "../packApi";
import { speechInputApi } from "../speechInputApi";
import { InstallOpenClaw } from "./InstallOpenClaw";

type CompanionOnboardingProps = {
  initialConnectionReady: boolean;
  onComplete: () => void;
  initialStage?: OnboardingStage;
  previewMode?: boolean;
  previewPacks?: InstalledPack[];
  previewActivePack?: InstalledPack | null;
  installStepOverride?: ReactNode;
};

type OnboardingStage =
  | "intro"
  | "install"
  | "personality"
  | "model"
  | "voice"
  | "identity"
  | "arrival";

type VoiceOption = {
  id: string;
  title: string;
  detail: string;
  provider?: string;
  voiceId?: string;
  style?: string;
};

const VOICE_OPTIONS: VoiceOption[] = [
  {
    id: "warm-local",
    title: "Warm local voice",
    detail: "Simple, local, and safe as a first voice.",
  },
  {
    id: "chatterbox",
    title: "Chatterbox",
    detail: "More lively when the local engine is installed.",
    provider: "chatterbox",
    voiceId: "default",
    style: "bright",
  },
  {
    id: "style-bert",
    title: "Style-Bert-VITS2",
    detail: "Best fit for stylized character voices later.",
    provider: "style-bert-vits2",
    voiceId: "default",
    style: "expressive",
  },
];

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Could not read the selected file."));
        return;
      }
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(base64);
    };
    reader.onerror = () => {
      reject(new Error("Could not read the selected file."));
    };
    reader.readAsDataURL(file);
  });
}

function personalityCandidates(packs: InstalledPack[]): InstalledPack[] {
  return packs.filter((pack) => {
    const profile = pack.character_profile;
    return Boolean(
      profile?.summary ||
        profile?.opening_message ||
        profile?.scenario ||
        profile?.style_notes?.length,
    );
  });
}

function liveModelCandidates(packs: InstalledPack[]): InstalledPack[] {
  return packs.filter(
    (pack) =>
      pack.model?.renderer === "vrm" ||
      pack.avatar?.presentation_mode === "model",
  );
}

function iconFor(stage: string) {
  switch (stage) {
    case "personality":
      return (
        <svg viewBox="0 0 32 32" aria-hidden="true">
          <path
            d="M10 11.5a6 6 0 1 1 12 0c0 2.4-1.3 4.2-2.9 5.8-.9.9-1.8 1.7-2.1 2.7h-2c-.3-1-1.2-1.8-2.1-2.7-1.6-1.6-2.9-3.4-2.9-5.8Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M13 23h6M14 26h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case "model":
      return (
        <svg viewBox="0 0 32 32" aria-hidden="true">
          <path
            d="M16 4 25 9.2v13.6L16 28l-9-5.2V9.2L16 4Zm0 4.2-5 2.9v6l5 2.9 5-2.9v-6l-5-2.9Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "voice":
      return (
        <svg viewBox="0 0 32 32" aria-hidden="true">
          <path
            d="M16 6c-2.2 0-4 1.8-4 4v7c0 2.2 1.8 4 4 4s4-1.8 4-4v-7c0-2.2-1.8-4-4-4Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <path
            d="M9 16a7 7 0 1 0 14 0M16 23v4M12 27h8"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      );
    case "identity":
      return (
        <svg viewBox="0 0 32 32" aria-hidden="true">
          <path
            d="M16 17a5 5 0 1 0-5-5 5 5 0 0 0 5 5Zm-8 9a8 8 0 0 1 16 0"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 32 32" aria-hidden="true">
          <circle cx="16" cy="16" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path d="M16 10v6l4 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
  }
}

export function CompanionOnboarding({
  initialConnectionReady,
  onComplete,
  initialStage,
  previewMode = false,
  previewPacks = [],
  previewActivePack = null,
  installStepOverride,
}: CompanionOnboardingProps) {
  const savedProfile = useMemo(
    () => (previewMode ? null : loadOnboardingProfile()),
    [previewMode],
  );
  const [stage, setStage] = useState<OnboardingStage>(
    initialStage ?? (initialConnectionReady ? "personality" : "intro"),
  );
  const [packs, setPacks] = useState<InstalledPack[]>(previewPacks);
  const [activePack, setActivePack] = useState<InstalledPack | null>(
    previewActivePack,
  );
  const [selectedPersonalityId, setSelectedPersonalityId] = useState<string | null>(
    previewActivePack?.id ?? null,
  );
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>("warm-local");
  const [userName, setUserName] = useState(savedProfile?.user_name ?? "");
  const [companionName, setCompanionName] = useState(
    savedProfile?.companion_name ?? "",
  );
  const [privacyMode, setPrivacyMode] = useState<CompanionPrivacyMode>(
    savedProfile?.privacy_mode ?? "push-to-talk",
  );
  const [bootExiting, setBootExiting] = useState(false);
  const [bootText, setBootText] = useState("");
  const [bootCaretVisible, setBootCaretVisible] = useState(true);
  const [loadingPacks, setLoadingPacks] = useState(false);
  const [actionPending, setActionPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const personalityInputRef = useRef<HTMLInputElement | null>(null);
  const modelInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (stage !== "intro") {
      setBootExiting(false);
      setBootText("");
      setBootCaretVisible(true);
      return;
    }

    const message = "Neural link starting";
    const timeouts: number[] = [];
    setBootExiting(false);
    setBootText("");
    setBootCaretVisible(true);

    const typingStartDelay = 1500;
    const perCharacterDelay = 44;
    const initialCaretSequence = [
      { at: 320, visible: false },
      { at: 640, visible: true },
      { at: 960, visible: false },
      { at: 1280, visible: true },
      { at: 1600, visible: false },
      { at: 1920, visible: true },
    ];

    initialCaretSequence.forEach(({ at, visible }) => {
      timeouts.push(
        window.setTimeout(() => {
          setBootCaretVisible(visible);
        }, at),
      );
    });

    const typingKickoff = Math.max(typingStartDelay, 1920);
    timeouts.push(
      window.setTimeout(() => {
        for (let index = 0; index < message.length; index += 1) {
          timeouts.push(
            window.setTimeout(() => {
              setBootText(message.slice(0, index + 1));
            }, index * perCharacterDelay),
          );
        }

        const textCompleteDelay = message.length * perCharacterDelay;
        const finalCaretSequence = [
          { at: textCompleteDelay + 240, visible: false },
          { at: textCompleteDelay + 480, visible: true },
          { at: textCompleteDelay + 720, visible: false },
          { at: textCompleteDelay + 960, visible: true },
          { at: textCompleteDelay + 1200, visible: false },
          { at: textCompleteDelay + 1440, visible: true },
        ];

        finalCaretSequence.forEach(({ at, visible }) => {
          timeouts.push(
            window.setTimeout(() => {
              setBootCaretVisible(visible);
            }, at),
          );
        });

        timeouts.push(
          window.setTimeout(() => {
            setBootCaretVisible(false);
          }, textCompleteDelay + 1560),
        );
      }, typingKickoff),
    );

    return () => {
      timeouts.forEach((timeoutHandle) => window.clearTimeout(timeoutHandle));
    };
  }, [stage]);

  useEffect(() => {
    if (previewMode || stage !== "intro") {
      setBootExiting(false);
      return;
    }

    const exitTimeoutId = window.setTimeout(() => {
      setBootExiting(true);
    }, 4650);
    const timeoutId = window.setTimeout(() => {
      setStage(initialConnectionReady ? "personality" : "install");
    }, 5000);

    return () => {
      window.clearTimeout(exitTimeoutId);
      window.clearTimeout(timeoutId);
    };
  }, [initialConnectionReady, previewMode, stage]);

  const personalityPacks = personalityCandidates(packs);
  const modelPacks = liveModelCandidates(packs);
  const selectedPersonality =
    personalityPacks.find((pack) => pack.id === selectedPersonalityId) ?? null;
  const selectedModel =
    modelPacks.find((pack) => pack.id === selectedModelId) ?? null;
  const selectedVoice =
    VOICE_OPTIONS.find((option) => option.id === selectedVoiceId) ?? VOICE_OPTIONS[0];
  const chosenCompanionName =
    companionName.trim() || selectedPersonality?.display_name || activePack?.display_name || "Nexa";
  const chosenUserName = userName.trim() || "friend";

  function renderStageScene(currentStage: OnboardingStage) {
    if (currentStage === "personality") {
      return (
        <aside className="nexa-stage-scene" aria-label="Personality preview">
          <div className="nexa-stage-scene__orb">
            <div className="nexa-stage-scene__core">{iconFor("personality")}</div>
          </div>
          <div className="nexa-stage-scene__text">
            <span className="eyebrow">Current read</span>
            <strong>{selectedPersonality?.display_name ?? "Waiting for a personality"}</strong>
            <p>
              {selectedPersonality?.character_profile?.opening_message ??
                "Import a Tavern card and the first hello will appear here."}
            </p>
          </div>
        </aside>
      );
    }

    if (currentStage === "model") {
      return (
        <aside className="nexa-stage-scene" aria-label="Model preview">
          <div className="nexa-stage-scene__pedestal">
            <div className="nexa-stage-scene__model">
              <div className="nexa-stage-scene__model-ring" />
              <div className="nexa-stage-scene__model-cube">{iconFor("model")}</div>
            </div>
          </div>
          <div className="nexa-stage-scene__text">
            <span className="eyebrow">Live body</span>
            <strong>{selectedModel?.display_name ?? "Waiting for a live model"}</strong>
            <p>A live model is what makes the companion feel present instead of flat.</p>
          </div>
        </aside>
      );
    }

    if (currentStage === "voice") {
      return (
        <aside className="nexa-stage-scene" aria-label="Voice preview">
          <div className="nexa-stage-scene__wave">
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
          <div className="nexa-stage-scene__text">
            <span className="eyebrow">Current voice</span>
            <strong>{selectedVoice.title}</strong>
            <p>{selectedVoice.detail}</p>
          </div>
        </aside>
      );
    }

    if (currentStage === "identity") {
      return (
        <aside className="nexa-stage-scene" aria-label="Greeting preview">
          <div className="nexa-stage-scene__greeting">
            <span className="eyebrow">First hello</span>
            <p>
              Hey, {userName.trim() || "there"}. I&apos;m {chosenCompanionName}. What matters first?
            </p>
          </div>
          <div className="nexa-stage-scene__text">
            <span className="eyebrow">Desk behavior</span>
            <strong>
              {privacyMode === "always-listening" ? "Always listening" : "Press to listen"}
            </strong>
            <p>Pick the calmer default now. You can change it later.</p>
          </div>
        </aside>
      );
    }

    return null;
  }

  useEffect(() => {
    if (previewMode) {
      return;
    }

    let cancelled = false;
    async function loadPacks() {
      setLoadingPacks(true);
      try {
        const response = await packApi.listPacks();
        if (cancelled) {
          return;
        }
        setPacks(response.packs);
        const currentActivePack =
          response.packs.find((pack) => pack.id === response.active_pack_id) ?? null;
        setActivePack(currentActivePack);
        const firstPersonality = personalityCandidates(response.packs)[0] ?? null;
        const firstModel = liveModelCandidates(response.packs)[0] ?? null;
        setSelectedPersonalityId((currentValue) => currentValue ?? currentActivePack?.id ?? firstPersonality?.id ?? null);
        setSelectedModelId((currentValue) => currentValue ?? firstModel?.id ?? null);
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Could not load local companions yet.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingPacks(false);
        }
      }
    }

    void loadPacks();
    return () => {
      cancelled = true;
    };
  }, [previewMode]);

  useEffect(() => {
    if (!selectedPersonality && personalityPacks[0]) {
      setSelectedPersonalityId(personalityPacks[0].id);
    }
  }, [personalityPacks, selectedPersonality]);

  useEffect(() => {
    if (!selectedModel && modelPacks[0]) {
      setSelectedModelId(modelPacks[0].id);
    }
  }, [modelPacks, selectedModel]);

  async function refreshPacksAndKeepSelection(nextActivePackId?: string | null) {
    if (previewMode) {
      return;
    }
    const response = await packApi.listPacks();
    setPacks(response.packs);
    const resolvedActivePack =
      response.packs.find((pack) => pack.id === (nextActivePackId ?? response.active_pack_id)) ??
      null;
    setActivePack(resolvedActivePack);
    if (resolvedActivePack) {
      setSelectedPersonalityId((currentValue) => currentValue ?? resolvedActivePack.id);
    }
  }

  async function handleImportPersonality(
    event: React.ChangeEvent<HTMLInputElement>,
  ): Promise<void> {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    setActionPending(true);
    setErrorMessage(null);
    try {
      const imageBase64 = await fileToBase64(file);
      const response = await packApi.importTavernCard(file.name, imageBase64);
      await refreshPacksAndKeepSelection(response.pack.id);
      setSelectedPersonalityId(response.pack.id);
      setCompanionName((currentValue) =>
        currentValue.trim() ? currentValue : response.pack.display_name,
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not import that personality card.",
      );
    } finally {
      setActionPending(false);
    }
  }

  async function handleImportModel(
    event: React.ChangeEvent<HTMLInputElement>,
  ): Promise<void> {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    setActionPending(true);
    setErrorMessage(null);
    try {
      const modelBase64 = await fileToBase64(file);
      const response = await packApi.importVrmModel(file.name, modelBase64);
      await refreshPacksAndKeepSelection(response.pack.id);
      setSelectedModelId(response.pack.id);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not import that VRM model.",
      );
    } finally {
      setActionPending(false);
    }
  }

  function continueFromPersonality() {
    if (!selectedPersonality) {
      setErrorMessage("Import or choose a personality first.");
      return;
    }
    setCompanionName((currentValue) =>
      currentValue.trim() ? currentValue : selectedPersonality.display_name,
    );
    setErrorMessage(null);
    setStage("model");
  }

  function continueFromModel() {
    if (!selectedModel) {
      setErrorMessage("Import or choose a live model first.");
      return;
    }
    setErrorMessage(null);
    setStage("voice");
  }

  async function finishSetup(): Promise<void> {
    if (!selectedPersonality) {
      setErrorMessage("Choose a personality first.");
      return;
    }
    if (!selectedModel) {
      setErrorMessage("Choose a live model first.");
      return;
    }
    if (!userName.trim() || !chosenCompanionName.trim()) {
      setErrorMessage("Enter your name and your companion's name first.");
      return;
    }

    setActionPending(true);
    setErrorMessage(null);
    try {
      if (!previewMode) {
        await speechInputApi.updateSettings({
          enabled: privacyMode === "always-listening",
        });

        const response = await packApi.createCharacterPack({
          display_name: chosenCompanionName,
          summary: selectedPersonality.character_profile?.summary ?? "",
          opening_message:
            selectedPersonality.character_profile?.opening_message ?? null,
          scenario: selectedPersonality.character_profile?.scenario ?? null,
          style_notes: selectedPersonality.character_profile?.style_notes ?? [],
          source_pack_id: selectedModel.id,
          voice_provider: selectedVoice.provider,
          voice_id: selectedVoice.voiceId,
          voice_style: selectedVoice.style,
        });
        await packApi.selectActivePack(response.pack.id);
        await refreshPacksAndKeepSelection(response.pack.id);
        setActivePack(response.pack);
        persistOnboardingProfile({
          completed: false,
          user_name: userName.trim(),
          companion_name: chosenCompanionName,
          preferred_channels: ["desktop-overlay"],
          privacy_mode: privacyMode,
          microphone_label: "Default microphone",
          memory_summary: "",
        });
      } else {
        setActivePack(selectedPersonality);
      }
      setStage("arrival");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not finish setup yet.",
      );
    } finally {
      setActionPending(false);
    }
  }

  function finishOnboarding() {
    if (!previewMode) {
      persistOnboardingProfile({
        completed: true,
        user_name: userName.trim(),
        companion_name: chosenCompanionName,
        preferred_channels: ["desktop-overlay"],
        privacy_mode: privacyMode,
        microphone_label: "Default microphone",
        memory_summary: "",
      });
    }
    onComplete();
  }

  if (stage === "install") {
    return (
      <section className="onboarding-install onboarding-install--enter">
        {installStepOverride ?? (
          <InstallOpenClaw
            onComplete={() => {
              setStage("personality");
            }}
          />
        )}
      </section>
    );
  }

  if (stage === "intro") {
    return (
      <main className="nexa-onboarding nexa-onboarding--poster nexa-onboarding--boot-shell">
        <section
          className={`nexa-onboarding__poster nexa-onboarding__poster--boot ${
            bootExiting ? "nexa-onboarding__poster--boot-exit" : ""
          }`}
        >
          <div className="nexa-onboarding__boot">
            <div className="nexa-onboarding__boot-copy">
              <p className="nexa-onboarding__boot-title">
                <span className="nexa-onboarding__boot-text">{bootText}</span>
                <span
                  className={`nexa-onboarding__boot-caret ${
                    bootCaretVisible ? "nexa-onboarding__boot-caret--visible" : ""
                  }`}
                  aria-hidden="true"
                >
                  |
                </span>
              </p>
            </div>
          </div>
        </section>
      </main>
    );
  }

  if (stage === "arrival") {
    return (
      <main className="nexa-onboarding">
        <section className="nexa-step nexa-step--arrival">
          <div className="nexa-step__copy">
            <span className="eyebrow">Wake your companion</span>
            <h1>{chosenCompanionName} is ready.</h1>
            <p>
              Hey, {chosenUserName}. NexaCore is warm, local, and ready to appear
              in the corner of your screen.
            </p>
          </div>
          <div className="nexa-arrival">
            <div className="nexa-arrival__avatar" aria-hidden="true">
              <div className="nexa-arrival__halo" />
              <div className="nexa-arrival__halo nexa-arrival__halo--outer" />
              <img src={nexaCoreLogo} alt="" />
            </div>
            <div className="nexa-arrival__signal">
              <span className="nexa-arrival__signal-line" />
              <span>Companion signal stable</span>
            </div>
            <p className="nexa-arrival__hello">
              Hey, {chosenUserName}. What would you like to do first?
            </p>
            <p className="nexa-arrival__subhello">
              Your local brain is connected, your chosen voice is ready, and the
              live body is staged for the desk.
            </p>
            <div className="nexa-arrival__summary">
              <span>{selectedModel?.display_name ?? "Live model ready"}</span>
              <span>{selectedVoice.title}</span>
              <span>
                {privacyMode === "always-listening"
                  ? "Always listening"
                  : "Press mic to listen"}
              </span>
            </div>
          </div>
          <div className="nexa-step__actions">
            <button className="settings-action-button" type="button" onClick={() => setStage("identity")}>
              Back
            </button>
            <button
              className="settings-action-button settings-action-button--primary"
              type="button"
              onClick={finishOnboarding}
            >
              Wake {chosenCompanionName}
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="nexa-onboarding">
      <section className="nexa-step">
        {stage === "personality" ? (
          <>
            <div className="nexa-step__hero">
              <div className="nexa-step__copy">
                <span className="eyebrow">Step 1</span>
                <h1>Choose the personality.</h1>
                <p>
                  Import a Tavern card or pick one you already have. Keep it simple
                  and keep moving.
                </p>
                <a
                  className="nexa-step__link"
                  href="https://chub.ai/"
                  rel="noreferrer"
                  target="_blank"
                >
                  Find personalities
                </a>
              </div>
              {renderStageScene("personality")}
            </div>
            <div className="nexa-step__surface">
              <div className="nexa-step__surface-topline">
                <button
                  className="settings-action-button settings-action-button--primary"
                  disabled={actionPending}
                  type="button"
                  onClick={() => personalityInputRef.current?.click()}
                >
                  {actionPending ? "Importing..." : "Import personality"}
                </button>
                <input
                  ref={personalityInputRef}
                  accept=".png,image/png"
                  hidden
                  type="file"
                  onChange={(event) => {
                    void handleImportPersonality(event);
                  }}
                />
              </div>
              <div className="nexa-choice-list" role="list" aria-label="Installed personalities">
                {personalityPacks.map((pack) => (
                  <button
                    key={pack.id}
                    className={`nexa-choice ${selectedPersonalityId === pack.id ? "nexa-choice--active" : ""}`}
                    type="button"
                    onClick={() => {
                      setSelectedPersonalityId(pack.id);
                      setCompanionName((currentValue) =>
                        currentValue.trim() ? currentValue : pack.display_name,
                      );
                    }}
                  >
                    <span className="nexa-choice__icon">{iconFor("personality")}</span>
                    <span className="nexa-choice__content">
                      <strong>{pack.display_name}</strong>
                      <span>
                        {pack.character_profile?.summary ?? "Imported personality ready."}
                      </span>
                    </span>
                  </button>
                ))}
                {!loadingPacks && personalityPacks.length === 0 ? (
                  <p className="nexa-empty-state">No personalities yet. Import one card to start.</p>
                ) : null}
              </div>
            </div>
            <div className="nexa-step__actions">
              <button
                className="settings-action-button settings-action-button--primary"
                type="button"
                onClick={continueFromPersonality}
              >
                Continue
              </button>
            </div>
          </>
        ) : null}

        {stage === "model" ? (
          <>
            <div className="nexa-step__hero">
              <div className="nexa-step__copy">
                <span className="eyebrow">Step 2</span>
                <h1>Choose the look.</h1>
                <p>
                  Import a VRM or choose one you already added. This is what makes
                  the companion feel alive on the desk.
                </p>
                <a
                  className="nexa-step__link"
                  href="https://hub.vroid.com/en"
                  rel="noreferrer"
                  target="_blank"
                >
                  Find free VRM models
                </a>
              </div>
              {renderStageScene("model")}
            </div>
            <div className="nexa-step__surface">
              <div className="nexa-step__surface-topline">
                <button
                  className="settings-action-button settings-action-button--primary"
                  disabled={actionPending}
                  type="button"
                  onClick={() => modelInputRef.current?.click()}
                >
                  {actionPending ? "Importing..." : "Import VRM"}
                </button>
                <input
                  ref={modelInputRef}
                  accept=".vrm"
                  hidden
                  type="file"
                  onChange={(event) => {
                    void handleImportModel(event);
                  }}
                />
              </div>
              <div className="nexa-choice-list" role="list" aria-label="Installed live models">
                {modelPacks.map((pack) => (
                  <button
                    key={pack.id}
                    className={`nexa-choice ${selectedModelId === pack.id ? "nexa-choice--active" : ""}`}
                    type="button"
                    onClick={() => setSelectedModelId(pack.id)}
                  >
                    <span className="nexa-choice__icon">{iconFor("model")}</span>
                    <span className="nexa-choice__content">
                      <strong>{pack.display_name}</strong>
                      <span>{pack.model?.renderer === "vrm" ? "VRM model ready." : "Live model ready."}</span>
                    </span>
                  </button>
                ))}
                {!loadingPacks && modelPacks.length === 0 ? (
                  <p className="nexa-empty-state">No live models yet. Import a VRM to continue.</p>
                ) : null}
              </div>
            </div>
            <div className="nexa-step__actions">
              <button className="settings-action-button" type="button" onClick={() => setStage("personality")}>
                Back
              </button>
              <button
                className="settings-action-button settings-action-button--primary"
                type="button"
                onClick={continueFromModel}
              >
                Continue
              </button>
            </div>
          </>
        ) : null}

        {stage === "voice" ? (
          <>
            <div className="nexa-step__hero">
              <div className="nexa-step__copy">
                <span className="eyebrow">Step 3</span>
                <h1>Choose the voice.</h1>
                <p>
                  Pick the voice path you want first. You can always refine the sound
                  later.
                </p>
              </div>
              {renderStageScene("voice")}
            </div>
            <div className="nexa-step__surface">
              <div className="nexa-choice-list nexa-choice-list--voice" role="list" aria-label="Voice options">
                {VOICE_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    className={`nexa-choice ${selectedVoiceId === option.id ? "nexa-choice--active" : ""}`}
                    type="button"
                    onClick={() => setSelectedVoiceId(option.id)}
                  >
                    <span className="nexa-choice__icon">{iconFor("voice")}</span>
                    <span className="nexa-choice__content">
                      <strong>{option.title}</strong>
                      <span>{option.detail}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <div className="nexa-step__actions">
              <button className="settings-action-button" type="button" onClick={() => setStage("model")}>
                Back
              </button>
              <button
                className="settings-action-button settings-action-button--primary"
                type="button"
                onClick={() => {
                  setErrorMessage(null);
                  setStage("identity");
                }}
              >
                Continue
              </button>
            </div>
          </>
        ) : null}

        {stage === "identity" ? (
          <>
            <div className="nexa-step__hero">
              <div className="nexa-step__copy">
                <span className="eyebrow">Step 4</span>
                <h1>Choose your names and privacy.</h1>
                <p>
                  Keep this short. Choose what you call each other, then choose how
                  your companion listens.
                </p>
              </div>
              {renderStageScene("identity")}
            </div>
            <div className="nexa-step__surface">
              <div className="nexa-identity-grid">
                <label className="settings-field">
                  <span className="settings-field__label">Your name</span>
                  <input
                    type="text"
                    value={userName}
                    placeholder="Enter your name here"
                    onChange={(event) => setUserName(event.target.value)}
                  />
                </label>
                <label className="settings-field">
                  <span className="settings-field__label">Companion name</span>
                  <input
                    type="text"
                    value={companionName}
                    placeholder="Enter your companion's name here"
                    onChange={(event) => setCompanionName(event.target.value)}
                  />
                </label>
              </div>
              <div className="nexa-choice-list" role="list" aria-label="Listening options">
                <button
                  className={`nexa-choice ${privacyMode === "push-to-talk" ? "nexa-choice--active" : ""}`}
                  type="button"
                  onClick={() => setPrivacyMode("push-to-talk")}
                >
                  <span className="nexa-choice__icon">{iconFor("identity")}</span>
                  <span className="nexa-choice__content">
                    <strong>Only listen when I press the mic</strong>
                    <span>Best if you want calm, clear control.</span>
                  </span>
                </button>
                <button
                  className={`nexa-choice ${privacyMode === "always-listening" ? "nexa-choice--active" : ""}`}
                  type="button"
                  onClick={() => setPrivacyMode("always-listening")}
                >
                  <span className="nexa-choice__icon">{iconFor("identity")}</span>
                  <span className="nexa-choice__content">
                    <strong>Always listen while the desk is open</strong>
                    <span>Best if you want faster check-ins and hands-free use.</span>
                  </span>
                </button>
              </div>
            </div>
            <div className="nexa-step__actions">
              <button className="settings-action-button" type="button" onClick={() => setStage("voice")}>
                Back
              </button>
              <button
                className="settings-action-button settings-action-button--primary"
                disabled={actionPending}
                type="button"
                onClick={() => {
                  void finishSetup();
                }}
              >
                {actionPending ? "Finishing setup..." : "Finish setup"}
              </button>
            </div>
          </>
        ) : null}

        {errorMessage ? (
          <p className="installer-error" role="alert">
            {errorMessage}
          </p>
        ) : null}
      </section>
    </main>
  );
}
