import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  type InstallerApi,
  installerApi as defaultInstallerApi,
  type InstallerStatus,
  type InstallerStep,
  type InstallerStepId,
} from "../installerApi";

type InstallOpenClawProps = {
  installerApi?: InstallerApi;
  onComplete: () => void;
  previewState?: {
    status: InstallerStatus;
    models?: string[];
    activeStepId?: InstallerStepId | null;
  };
};

const STEP_SEQUENCE: InstallerStepId[] = [
  "download",
  "install-openclaw",
  "configure-ai",
  "start-connect",
];

const DEFAULT_MODEL = "llama3.1:8b-instruct";

function getCurrentStep(
  installerStatus: InstallerStatus | null,
): InstallerStep | null {
  if (!installerStatus) {
    return null;
  }

  if (installerStatus.current_step === "complete") {
    return installerStatus.steps["start-connect"];
  }

  return installerStatus.steps[installerStatus.current_step as InstallerStepId] ?? null;
}

function getProgressLabel(
  status: InstallerStatus | null,
  activeStepId: InstallerStepId | null,
): string {
  const currentStep = activeStepId
    ? status?.steps[activeStepId] ?? null
    : getCurrentStep(status);

  if (!status || !currentStep) {
    return "Getting everything ready";
  }

  if (status.connection.connected) {
    return "Your companion is awake";
  }

  if (currentStep.id === "download") {
    const missingCount =
      status.environment.missing_prerequisites.length +
      status.environment.missing_runtime_dependencies.length;
    if (
      status.environment.missing_prerequisites.length === 0 &&
      status.environment.missing_runtime_dependencies.length === 1 &&
      status.environment.missing_runtime_dependencies[0] === "Ollama"
    ) {
      return "Waking the heart";
    }
    return missingCount > 0 ? "Building the heart" : "Checking the heartbeat";
  }

  if (currentStep.id === "install-openclaw") {
    return "Teaching the hands";
  }

  if (currentStep.id === "configure-ai") {
    return "Choosing the brain";
  }

  return "Finishing the build";
}

function getProgressDescription(
  status: InstallerStatus | null,
  activeStepId: InstallerStepId | null,
): string {
  const currentStep = activeStepId
    ? status?.steps[activeStepId] ?? null
    : getCurrentStep(status);

  if (!status || !currentStep) {
    return "Getting everything ready for your companion.";
  }

  if (status.connection.connected) {
    return "Everything is ready. Your companion can wake up now.";
  }

  if (currentStep.id === "download") {
    const onlyOllamaMissing =
      status.environment.missing_prerequisites.length === 0 &&
      status.environment.missing_runtime_dependencies.length === 1 &&
      status.environment.missing_runtime_dependencies[0] === "Ollama";

    if (onlyOllamaMissing) {
      return "Winding up Ollama so your companion can start humming.";
    }

    return "Putting the last support pieces in place so Ollama and OpenClaw can come to life.";
  }

  if (currentStep.id === "install-openclaw") {
    return "Installing OpenClaw so your companion can safely do things for you.";
  }

  if (currentStep.id === "configure-ai") {
    return "Choosing which Ollama brain your companion will use to listen, think, and reply.";
  }

  return "Joining Ollama and OpenClaw into one awake companion.";
}

function getBadgeLabel(status: InstallerStep["status"]): string {
  if (status === "active") {
    return "in progress";
  }
  if (status === "needs_action") {
    return "needs action";
  }
  return status;
}

function getStepTimeHint(stepId: InstallerStepId): string {
  if (stepId === "download") {
    return "Varies";
  }
  if (stepId === "install-openclaw") {
    return "~30 sec";
  }
  if (stepId === "configure-ai") {
    return "~1 min";
  }
  return "~10 sec";
}

function getVisibleTimelineTitle(stepId: InstallerStepId): string {
  if (stepId === "download") {
    return "Download";
  }
  if (stepId === "install-openclaw") {
    return "Install OpenClaw";
  }
  if (stepId === "configure-ai") {
    return "Configure AI";
  }
  return "Connect neural link to body";
}

export function InstallOpenClaw({
  installerApi = defaultInstallerApi,
  onComplete,
  previewState,
}: InstallOpenClawProps) {
  const [installerStatus, setInstallerStatus] = useState<InstallerStatus | null>(
    previewState?.status ?? null,
  );
  const [, setModels] = useState<string[]>(
    previewState?.models?.length ? previewState.models : [DEFAULT_MODEL],
  );
  const [selectedModel, setSelectedModel] = useState(
    previewState?.models?.[0] ?? DEFAULT_MODEL,
  );
  const [activeStepId, setActiveStepId] = useState<InstallerStepId | null>(
    previewState?.activeStepId ?? null,
  );
  const [isBusy, setIsBusy] = useState(previewState ? false : true);
  const [isHydrated, setIsHydrated] = useState(Boolean(previewState));
  const autoAdvanceRef = useRef(false);

  const currentStep = getCurrentStep(installerStatus);

  const progressValue = useMemo(() => {
    if (!installerStatus) {
      return 0;
    }

    if (installerStatus.connection.connected) {
      return 100;
    }

    const completeCount = STEP_SEQUENCE.filter(
      (stepId) => installerStatus.steps[stepId].status === "complete",
    ).length;
    if (activeStepId) {
      const activeIndex = STEP_SEQUENCE.indexOf(activeStepId);
      if (activeIndex >= 0) {
        return Math.round(
          ((activeIndex + 0.5) / STEP_SEQUENCE.length) * 100,
        );
      }
    }
    return Math.round((completeCount / STEP_SEQUENCE.length) * 100);
  }, [activeStepId, installerStatus]);

  const refreshStatus = useCallback(async (): Promise<InstallerStatus> => {
    const [nextStatus, availableModels] = await Promise.all([
      installerApi.getInstallerStatus(),
      installerApi.getModels().catch(() => [DEFAULT_MODEL]),
    ]);
    setInstallerStatus(nextStatus);
    setModels(availableModels.length ? availableModels : [DEFAULT_MODEL]);
    setSelectedModel((currentModel) => {
      const preferredModel = nextStatus.ai.model;
      if (availableModels.includes(preferredModel)) {
        return preferredModel;
      }
      if (availableModels.includes(currentModel)) {
        return currentModel;
      }
      if (availableModels.includes(DEFAULT_MODEL)) {
        return DEFAULT_MODEL;
      }
      return availableModels[0] ?? DEFAULT_MODEL;
    });
    return nextStatus;
  }, [installerApi]);

  const runStep = useCallback(
    async (stepId: InstallerStepId): Promise<InstallerStatus | null> => {
      setIsBusy(true);
      setActiveStepId(stepId);

      try {
        if (stepId === "download") {
          await installerApi.downloadSetup();
        } else if (stepId === "install-openclaw") {
          await installerApi.installOpenClaw();
        } else if (stepId === "configure-ai") {
          await installerApi.configureAI(selectedModel);
        } else {
          await installerApi.startAndConnect();
        }

        let nextStatus = await refreshStatus();
        if (
          stepId === "configure-ai" &&
          !previewState &&
          !nextStatus.connection.connected &&
          nextStatus.current_step === "start-connect"
        ) {
          await installerApi.startAndConnect();
          nextStatus = await refreshStatus();
        }
        if (nextStatus.connection.connected) {
          onComplete();
        }
        return nextStatus;
      } catch {
        return await refreshStatus();
      } finally {
        setActiveStepId(null);
        setIsBusy(false);
        setIsHydrated(true);
      }
    },
    [installerApi, onComplete, previewState, refreshStatus, selectedModel],
  );

  const handleRepair = useCallback(async (): Promise<void> => {
    setIsBusy(true);

    try {
      const result = await installerApi.repair();
      setInstallerStatus(result.status);
      setActiveStepId(null);
      if (result.status.connection.connected) {
        onComplete();
      }
    } catch {
      try {
        await refreshStatus();
      } catch {
        // Leave the current recovery guidance visible if refresh fails.
      }
    } finally {
      setIsBusy(false);
      setIsHydrated(true);
    }
  }, [installerApi, onComplete, refreshStatus]);

  useEffect(() => {
    if (previewState) {
      setInstallerStatus(previewState.status);
      setModels(previewState.models?.length ? previewState.models : [DEFAULT_MODEL]);
      setSelectedModel((currentValue) => {
        if (previewState.models?.includes(currentValue)) {
          return currentValue;
        }
        return previewState.models?.[0] ?? DEFAULT_MODEL;
      });
      setActiveStepId(previewState.activeStepId ?? null);
      setIsBusy(false);
      setIsHydrated(true);
    }
  }, [previewState]);

  useEffect(() => {
    if (previewState) {
      return;
    }

    let active = true;

    async function load(): Promise<void> {
      try {
        const nextStatus = await refreshStatus();
        if (!active) {
          return;
        }

        if (nextStatus.connection.connected) {
          onComplete();
        }
      } finally {
        if (active) {
          setIsBusy(false);
          setIsHydrated(true);
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [onComplete, previewState, refreshStatus]);

  useEffect(() => {
    if (previewState || !installerStatus || !isHydrated || isBusy || autoAdvanceRef.current) {
      return;
    }

    if (installerStatus.connection.connected) {
      onComplete();
      return;
    }

    const activeStep = getCurrentStep(installerStatus);
    if (!activeStep) {
      return;
    }

    let nextStep: InstallerStepId | null = null;
    if (
      activeStep.id === "download" &&
      (activeStep.status === "pending" || activeStep.status === "active")
    ) {
      nextStep = "download";
    } else if (
      activeStep.id === "install-openclaw" &&
      (activeStep.status === "pending" || activeStep.status === "active")
    ) {
      nextStep = "install-openclaw";
    } else if (
      activeStep.id === "configure-ai" &&
      (activeStep.status === "pending" || activeStep.status === "active")
    ) {
      nextStep = "configure-ai";
    } else if (
      activeStep.id === "start-connect" &&
      (activeStep.status === "pending" || activeStep.status === "active")
    ) {
      nextStep = "start-connect";
    }

    if (!nextStep) {
      return;
    }

    autoAdvanceRef.current = true;
    void runStep(nextStep).finally(() => {
      autoAdvanceRef.current = false;
    });
  }, [installerStatus, isBusy, isHydrated, onComplete, previewState, runStep]);

  if (!installerStatus) {
    return (
      <main className="installer-shell installer-shell--loading">
        <section className="installer-stage installer-stage--loading">
          <h1>Loading your local setup.</h1>
          <p>Checking whether this PC already has a saved OpenClaw install.</p>
        </section>
      </main>
    );
  }

  const renderedActiveStepId = previewState?.activeStepId ?? activeStepId;
  const progressLabel = getProgressLabel(installerStatus, renderedActiveStepId);
  const progressDescription = getProgressDescription(
    installerStatus,
    renderedActiveStepId,
  );
  const recoveryInstructions = currentStep?.recovery_instructions ?? [];

  return (
    <main className="installer-shell">
      <section className="installer-stage">
        <div className="installer-atmosphere" aria-hidden="true">
          <span className="installer-atmosphere__orb installer-atmosphere__orb--one" />
          <span className="installer-atmosphere__orb installer-atmosphere__orb--two" />
        </div>
        <h1>Assembling your companion.</h1>

        <section className="installer-meter" aria-label="Current assembly part">
          <div className="installer-meter__progress">
            <div className="installer-progress-card__header">
              <span>{progressLabel}</span>
              <strong>{progressValue}%</strong>
            </div>
            <div className="installer-progress-bar" aria-hidden="true">
              <span
                className="installer-progress-bar__value"
                style={{ width: `${progressValue}%` }}
              />
            </div>
            <p>{progressDescription}</p>
          </div>
          {(currentStep?.status === "failed" ||
            currentStep?.status === "needs_action") && (
            <>
              <p className="installer-error" role="status">
                We paused safely. Use the button below and we will keep going.
              </p>
              {recoveryInstructions.length > 0 && (
                <div className="installer-meter__notes" aria-label="Setup guidance">
                  {recoveryInstructions.map((instruction) => (
                    <p key={instruction}>{instruction}</p>
                  ))}
                </div>
              )}
              <div className="installer-meter__actions">
                {currentStep.can_repair && (
                  <button
                    className="installer-button installer-button--secondary"
                    type="button"
                    onClick={() => void handleRepair()}
                    disabled={isBusy}
                  >
                    Fix it and keep going
                  </button>
                )}
                {currentStep.can_retry && (
                  <button
                    className="installer-button"
                    type="button"
                    onClick={() => void runStep(currentStep.id)}
                    disabled={isBusy}
                  >
                    Try again
                  </button>
                )}
              </div>
            </>
          )}
        </section>

        <ol className="installer-timeline" aria-label="Installer steps">
          {STEP_SEQUENCE.map((stepId, index) => {
            const step = installerStatus.steps[stepId];
            const renderedStatus =
              renderedActiveStepId === step.id &&
              (step.status === "pending" || step.status === "active")
                ? "active"
                : step.status;
            return (
              <li
                className={`installer-timeline__item installer-timeline__item--${renderedStatus}`}
                key={step.id}
              >
                <span
                  className={`installer-timeline__marker installer-timeline__marker--${renderedStatus}`}
                  aria-hidden="true"
                >
                  {renderedStatus === "complete"
                    ? "✓"
                    : renderedStatus === "active"
                      ? ""
                      : index + 1}
                </span>
                <div className="installer-timeline__copy">
                  <strong>{getVisibleTimelineTitle(step.id)}</strong>
                </div>
                <span
                  className={`installer-timeline__meta installer-timeline__meta--${renderedStatus}`}
                >
                  {renderedStatus === "pending"
                    ? getStepTimeHint(step.id)
                    : getBadgeLabel(renderedStatus)}
                </span>
              </li>
            );
          })}
        </ol>
      </section>

    </main>
  );
}
