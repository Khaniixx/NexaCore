# NexaCore Live Companion Handoff

This branch moves the desktop app toward the NexaCore first-run and live-companion direction. The important product rule remains unchanged: there is one persistent companion identity, not separate assistant modes.

## What Changed

- Added a NexaCore onboarding path that introduces setup, companion creation, relationship preferences, and the live handoff.
- Reworked the installer presentation around the required sequence: Download -> Install OpenClaw -> Configure AI -> Start & Connect.
- Reduced the live workspace toward a companion-first surface, with settings hidden unless opened.
- Added an immersive stage option so live companion rendering can hide debug/status chrome.
- Added a lightweight VRM canvas renderer path for imported `.vrm` bodies.
- Fixed Tauri dev runtime resolution so local development uses the repo Python runtime instead of a stale bundled runtime.
- Updated chat startup behavior so a present Ollama model can spin up on the first reply instead of blocking the conversation.

## Current Standard

The default live view should feel closer to Desktop Mate than a dashboard:

- companion visible first
- minimal controls
- settings available but not dominant
- no raw pack/system prompt text in the main view
- pack identity drives name, voice, body, and first hello

## Known Gaps

- The VRM renderer is a first integration path, not final production embodiment.
- The settings view still contains older desk surfaces that need a dedicated simplification pass.
- The current branch preserves a lot of onboarding and installer polish, but the next product priority is still the live companion surface.
- Voice-provider execution beyond browser fallback remains staged unless the local provider runtime is installed and configured.

## Next Priority

Finish the actual on-screen companion experience before adding more setup boards:

1. make the launched app default to the companion body with no dashboard chrome
2. verify a real imported VRM renders correctly in the Tauri window
3. keep only a small settings/composer affordance in the default live surface
4. test voice and personality against the active pack in the real app
