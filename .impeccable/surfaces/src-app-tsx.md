---
version: 1
slug: "src-app-tsx"
primary_target: "src/App.tsx"
related_targets: ["src/styles.css", "src/ChessBoard.tsx", "src/cardInteractions.ts", "src/BoardEffects.tsx", "src/debugGame.ts"]
---

# Minimal DEBUG table — current phase

User replaced the earlier playing-screen design with a minimal table. Build incrementally: the centered fixed-orientation chessboard, visible upper/lower hands, matching Prší fan and hover, and opacity reflecting the current turn. White starts below; both sides are controllable; refresh resets all state. No persistence, navigation, move history, or card library. The reference is the supplied screenshot and the hand implementation in `../blafovaci-prsi`.

The user accepted that phase, then requested outside coordinates, a neutral dark-gray background, a light/brown board, and a large right-side card preview. Idle preview uses a simple temporary card back because the repository has only card fronts; hovering either hand shows that card face. Preserve the minimal table and original fan behavior.

Current increment: Hidden Passage, Disintegration, Forced March, Resurrection, Fireball, Mystic Shield, Curse, Fortification, Peace Talks, and Fog of War are playable through engine-supplied choices and physical-card validation. Selection narrows valid options one choice at a time, with Back / Cancel / Play card controls and a separate End turn action. Both hands use engine state. Curse and Shield badges, wall marks, and an active-effects tray expose continuing effects. A native practice dropdown launches deterministic real-engine setups; refresh resets the table.

Preserve the approved dark-gray table, light/brown board, original fan and hover behavior, exterior coordinates, and right-side preview. On mobile, hide the pinned preview during selection and place controls beneath the exterior coordinates. This is an extension of the existing surface; DESIGN.md and its sidecar remain unchanged.
