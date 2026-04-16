import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CompanionOnboarding } from "./CompanionOnboarding";

const mockUpdateSpeechInputSettings = vi.fn(async (payload?: unknown) => {
  void payload;
  return {
    enabled: false,
    transcription_enabled: true,
    available: true,
    state: "ready",
    provider: "native",
    locale: "en-AU",
    display_name: "System microphone",
    message: "Ready",
  };
});

const mockListPacks = vi.fn(async () => ({
  active_pack_id: "sunrise-card",
  schema_version: "1.0.0",
  packs: [
    {
      id: "sunrise-card",
      name: "Sunrise Card",
      version: "1.0.0",
      display_name: "Sunrise",
      author_name: "NexaCore",
      license_name: "Local",
      content_rating: { minimum_age: 13, maximum_age: null, tags: [] },
      required_capabilities: [],
      optional_capabilities: [],
      active: true,
      icon_data_url: null,
      installed_at: null,
      character_profile: {
        summary: "Bright and practical.",
        opening_message: "Morning. I kept the thread warm for you.",
        scenario: "Waiting on the desk.",
        style_notes: ["steady"],
      },
      avatar: {
        presentation_mode: "shell",
      },
    },
    {
      id: "noir-vrm",
      name: "Noir VRM",
      version: "1.0.0",
      display_name: "Noir",
      author_name: "NexaCore",
      license_name: "Local",
      content_rating: { minimum_age: 13, maximum_age: null, tags: [] },
      required_capabilities: [],
      optional_capabilities: [],
      active: false,
      icon_data_url: null,
      installed_at: null,
      model: {
        renderer: "vrm",
        asset_path: "models/avatar.vrm",
      },
      avatar: {
        presentation_mode: "model",
      },
      character_profile: {
        summary: "Live model ready.",
      },
    },
  ],
}));

const mockCreateCharacterPack = vi.fn(async (payload: unknown) => ({
  active_pack_id: "sunrise-final",
  pack: {
    id: "sunrise-final",
    name: "Sunrise Final",
    version: "1.0.0",
    display_name: (payload as { display_name: string }).display_name,
    author_name: "NexaCore",
    license_name: "Local",
    content_rating: { minimum_age: 13, maximum_age: null, tags: [] },
    required_capabilities: [],
    optional_capabilities: [],
    active: true,
    icon_data_url: null,
    installed_at: null,
  },
}));

const mockSelectActivePack = vi.fn(async () => ({
  active_pack_id: "sunrise-final",
  pack: {
    id: "sunrise-final",
    name: "Sunrise Final",
    version: "1.0.0",
    display_name: "Momo",
    author_name: "NexaCore",
    license_name: "Local",
    content_rating: { minimum_age: 13, maximum_age: null, tags: [] },
    required_capabilities: [],
    optional_capabilities: [],
    active: true,
    icon_data_url: null,
    installed_at: null,
  },
}));

vi.mock("../speechInputApi", () => ({
  speechInputApi: {
    updateSettings: (payload: unknown) => mockUpdateSpeechInputSettings(payload),
  },
}));

vi.mock("../packApi", () => ({
  packApi: {
    listPacks: () => mockListPacks(),
    importTavernCard: vi.fn(),
    importVrmModel: vi.fn(),
    createCharacterPack: (payload: unknown) => mockCreateCharacterPack(payload),
    selectActivePack: () => mockSelectActivePack(),
  },
}));

vi.mock("./InstallOpenClaw", () => ({
  InstallOpenClaw: ({ onComplete }: { onComplete: () => void }) => (
    <div>
      <p>Install OpenClaw mock</p>
      <button type="button" onClick={onComplete}>
        Complete install
      </button>
    </div>
  ),
}));

describe("CompanionOnboarding", () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockUpdateSpeechInputSettings.mockClear();
    mockListPacks.mockClear();
    mockCreateCharacterPack.mockClear();
    mockSelectActivePack.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("guides the user from intro to live handoff", async () => {
    vi.useFakeTimers();
    const onComplete = vi.fn();

    render(
      <CompanionOnboarding initialConnectionReady={false} onComplete={onComplete} />,
    );

    await vi.advanceTimersByTimeAsync(5000);
    expect(screen.getByText("Install OpenClaw mock")).toBeInTheDocument();
    vi.useRealTimers();

    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Complete install" }));

    expect(
      await screen.findByRole("heading", { name: "Choose the personality." }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(
      await screen.findByRole("heading", { name: "Choose the look." }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(
      await screen.findByRole("heading", { name: "Choose the voice." }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(
      await screen.findByRole("heading", {
        name: "Choose your names and privacy.",
      }),
    ).toBeInTheDocument();

    await user.type(screen.getByLabelText("Your name"), "Grand");
    await user.clear(screen.getByLabelText("Companion name"));
    await user.type(screen.getByLabelText("Companion name"), "Momo");

    await user.click(screen.getByRole("button", { name: "Finish setup" }));

    await waitFor(() => {
      expect(mockUpdateSpeechInputSettings).toHaveBeenCalledWith({
        enabled: false,
      });
    });

    await waitFor(() => {
      expect(mockCreateCharacterPack).toHaveBeenCalledWith(
        expect.objectContaining({
          display_name: "Momo",
          source_pack_id: "noir-vrm",
        }),
      );
    });

    expect(
      await screen.findByRole("heading", { name: "Momo is ready." }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Wake Momo" }));

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem("nexacore.onboarding-profile")).toContain(
      "\"completed\":true",
    );
  });
});
