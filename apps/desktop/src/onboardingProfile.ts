export type CompanionPrivacyMode = "always-listening" | "push-to-talk";

export type CompanionContactChannel =
  | "desktop-overlay"
  | "discord"
  | "telegram"
  | "browser";

export type OnboardingProfile = {
  completed: boolean;
  user_name: string;
  companion_name: string;
  preferred_channels: CompanionContactChannel[];
  privacy_mode: CompanionPrivacyMode;
  microphone_label: string;
  memory_summary: string;
};

const STORAGE_KEY = "nexacore.onboarding-profile";

function isValidChannel(value: string): value is CompanionContactChannel {
  return ["desktop-overlay", "discord", "telegram", "browser"].includes(value);
}

function isValidPrivacyMode(value: string): value is CompanionPrivacyMode {
  return value === "always-listening" || value === "push-to-talk";
}

export function loadOnboardingProfile(): OnboardingProfile | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<OnboardingProfile>;
    return {
      completed: parsed.completed === true,
      user_name:
        typeof parsed.user_name === "string" ? parsed.user_name : "",
      companion_name:
        typeof parsed.companion_name === "string" ? parsed.companion_name : "",
      preferred_channels: Array.isArray(parsed.preferred_channels)
        ? parsed.preferred_channels.filter(
            (value): value is CompanionContactChannel =>
              typeof value === "string" && isValidChannel(value),
          )
        : ["desktop-overlay"],
      privacy_mode:
        typeof parsed.privacy_mode === "string" &&
        isValidPrivacyMode(parsed.privacy_mode)
          ? parsed.privacy_mode
          : "push-to-talk",
      microphone_label:
        typeof parsed.microphone_label === "string"
          ? parsed.microphone_label
          : "Default microphone",
      memory_summary:
        typeof parsed.memory_summary === "string" ? parsed.memory_summary : "",
    };
  } catch {
    return null;
  }
}

export function persistOnboardingProfile(profile: OnboardingProfile): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
}

export function clearOnboardingProfile(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(STORAGE_KEY);
}
