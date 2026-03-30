export type CompanionWindowPresence = {
  enabled: boolean;
  clickThroughEnabled: boolean;
  anchor?: "desktop-right" | "desktop-left" | "workspace";
};

const DEFAULT_WORKSPACE_WIDTH = 1240;
const DEFAULT_WORKSPACE_HEIGHT = 820;
const PINNED_WIDTH = 440;
const PINNED_HEIGHT = 760;
const PINNED_MARGIN = 24;

type SavedWindowPlacement = {
  width: number;
  height: number;
  x: number;
  y: number;
};

let savedWorkspacePlacement: SavedWindowPlacement | null = null;
let affinityWasApplied = false;

export async function applyOverlayWindowState(
  settings: CompanionWindowPresence,
): Promise<void> {
  try {
    const { PhysicalPosition, PhysicalSize } = await import("@tauri-apps/api/dpi");
    const { currentMonitor, getCurrentWindow } = await import("@tauri-apps/api/window");
    const currentWindow = getCurrentWindow();
    const shouldApplyAffinity =
      settings.enabled &&
      settings.anchor !== undefined &&
      settings.anchor !== "workspace";

    if (shouldApplyAffinity) {
      if (savedWorkspacePlacement === null) {
        const [outerSize, outerPosition] = await Promise.all([
          currentWindow.outerSize(),
          currentWindow.outerPosition(),
        ]);
        savedWorkspacePlacement = {
          width: outerSize.width,
          height: outerSize.height,
          x: outerPosition.x,
          y: outerPosition.y,
        };
      }

      const monitor = await currentMonitor();
      if (monitor !== null) {
        const workArea = monitor.workArea;
        const width = Math.min(PINNED_WIDTH, Math.max(360, workArea.size.width - PINNED_MARGIN * 2));
        const height = Math.min(
          PINNED_HEIGHT,
          Math.max(420, workArea.size.height - PINNED_MARGIN * 2),
        );
        const x =
          settings.anchor === "desktop-left"
            ? workArea.position.x + PINNED_MARGIN
            : workArea.position.x + workArea.size.width - width - PINNED_MARGIN;
        const y = workArea.position.y + Math.max(PINNED_MARGIN, workArea.size.height - height - PINNED_MARGIN);

        await currentWindow.setResizable(false);
        await currentWindow.setSize(new PhysicalSize(width, height));
        await currentWindow.setPosition(new PhysicalPosition(x, y));
        affinityWasApplied = true;
      }
    } else if (affinityWasApplied) {
      await currentWindow.setResizable(true);
      if (savedWorkspacePlacement !== null) {
        await currentWindow.setSize(
          new PhysicalSize(
            savedWorkspacePlacement.width,
            savedWorkspacePlacement.height,
          ),
        );
        await currentWindow.setPosition(
          new PhysicalPosition(savedWorkspacePlacement.x, savedWorkspacePlacement.y),
        );
      } else {
        await currentWindow.setSize(
          new PhysicalSize(DEFAULT_WORKSPACE_WIDTH, DEFAULT_WORKSPACE_HEIGHT),
        );
        await currentWindow.center();
      }
      savedWorkspacePlacement = null;
      affinityWasApplied = false;
    }

    await currentWindow.setAlwaysOnTop(settings.enabled);
    await currentWindow.setDecorations(!settings.enabled);
    await currentWindow.setShadow(!settings.enabled);
    await currentWindow.setIgnoreCursorEvents(
      settings.enabled && settings.clickThroughEnabled,
    );
  } catch {
    // Browser tests and non-Tauri runs should stay functional without native window control.
  }
}
