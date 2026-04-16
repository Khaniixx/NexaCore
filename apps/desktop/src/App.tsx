import { useEffect, useState } from "react";

import { CompanionOnboarding } from "./components/CompanionOnboarding";
import { CompanionWorkspace } from "./components/CompanionWorkspace";
import { installerApi } from "./installerApi";
import { loadOnboardingProfile } from "./onboardingProfile";
import { packApi } from "./packApi";

export default function App() {
  const [installerResolved, setInstallerResolved] = useState(false);
  const [connectionReady, setConnectionReady] = useState(false);
  const [showCompanionWorkspace, setShowCompanionWorkspace] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadInstallerStatus(): Promise<void> {
      try {
        const status = await installerApi.getInstallerStatus();

        if (!active) {
          return;
        }

        let hasActiveCompanion = false;
        if (status.connection.connected) {
          try {
            const packState = await packApi.listPacks();
            if (!active) {
              return;
            }

            hasActiveCompanion =
              packState.active_pack_id !== null ||
              packState.packs.some((pack) => pack.active);

            if (!hasActiveCompanion && packState.packs.length > 0) {
              const selectedPack = await packApi.selectActivePack(packState.packs[0].id);
              if (!active) {
                return;
              }
              hasActiveCompanion = selectedPack.active_pack_id !== null;
            }
          } catch {
            hasActiveCompanion = false;
          }
        }

        const onboardingProfile = loadOnboardingProfile();
        setConnectionReady(status.connection.connected);
        setShowCompanionWorkspace(
          status.connection.connected &&
            (onboardingProfile?.completed === true || hasActiveCompanion),
        );
      } catch {
        if (!active) {
          return;
        }

        setConnectionReady(false);
        setShowCompanionWorkspace(false);
      } finally {
        if (active) {
          setInstallerResolved(true);
        }
      }
    }

    void loadInstallerStatus();

    return () => {
      active = false;
    };
  }, []);

  if (!installerResolved) {
    return (
      <main className="installer-shell installer-shell--loading">
        <section className="installer-hero">
          <div className="installer-copy">
            <span className="eyebrow">NexaCore</span>
            <h1>Loading the local companion environment.</h1>
            <p>
              Checking whether OpenClaw is already installed and connected.
            </p>
          </div>
        </section>
      </main>
    );
  }

  if (!showCompanionWorkspace) {
    return (
      <CompanionOnboarding
        initialConnectionReady={connectionReady}
        onComplete={() => {
          setConnectionReady(true);
          setShowCompanionWorkspace(true);
        }}
      />
    );
  }

  return <CompanionWorkspace />;
}
