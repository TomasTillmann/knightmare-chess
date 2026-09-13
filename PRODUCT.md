# Knightmare Chess

## Current phase

A minimal local DEBUG table: chessboard in the center, five visible Knightmare cards above and below. White starts at the bottom; the board never flips and one person can move both sides. State lives only in React memory; refreshing starts over.

This phase covers the hand layout, hover/focus, and active-player opacity. The displayed hands are fixed visual fixtures. Card play and any additional controls belong to later phases.

The next accepted increment adds coordinates outside the board and a large card preview to its right: show a card back when idle and the hovered card face while inspecting a hand.
