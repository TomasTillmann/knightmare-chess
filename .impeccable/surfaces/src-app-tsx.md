---
version: 1
slug: "src-app-tsx"
primary_target: "src/App.tsx"
related_targets: ["src/styles.css", "src/ChessBoard.tsx"]
---

# Minimal DEBUG table — current phase

User replaced the earlier playing-screen design with a minimal table. Build incrementally: only the centered fixed-orientation chessboard, visible upper/lower hands, matching Prší fan and hover, and opacity reflecting the current turn. White starts below; both sides are controllable; refresh resets all state. No persistence, navigation, move history, or card library. Card play is deferred to a later phase. The reference is the supplied screenshot and the hand implementation in `../blafovaci-prsi`.

The user accepted that phase, then requested outside coordinates, a neutral dark-gray background, a light/brown board, and a large right-side card preview. Idle preview uses a simple temporary card back because the repository has only card fronts; hovering either hand shows that card face. Preserve the minimal table and original fan behavior.
