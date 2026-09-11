# Crab movement source review

## Initial source-grounded conclusion

Crab's inability to use Dark Mirror is **an inference, not an express ruling in the supplied pages**. Official FAQ PDF page 21 expressly denies Crab an opening double diagonal move and en-passant capture; it says promotion is the only retained Pawn special movement ability. It does not mention Dark Mirror. Official rulebook PDF page 1, “Transformed Pieces,” expressly permits cards naming the original piece to affect its transformed form unless the creating card says otherwise. PDF page 2, “Conflicts,” gives continuing effects precedence when cards conflict. Those provisions require interpretation of whether Dark Mirror conflicts with Crab's movement definition.

Official FAQ PDF page 18 expressly confines a transformation into a named piece (specifically Crab) to that portion of a Confabulation. This establishes that Crab's transformation does not replace the ordinary Pawn component. It does not expressly name that component's en-passant or Dark Mirror powers; their preservation follows from combining the component-scoping ruling with Confabulation's movement-power rule and each underlying Pawn/card rule.

## Source distinctions

| Source | Express text or effect | What it does not expressly decide |
| --- | --- | --- |
| `cards.md`, Crab | The Pawn becomes a Crab; movement and capture are one square diagonally forward; promotion survives. | Dark Mirror is not mentioned. |
| `cards.md`, Dark Mirror | One Pawn may capture diagonally backward instead of forward on this move. | Crab and merged components are not mentioned. |
| `cards.md`, Confabulation | A merged piece can move, capture, and be affected by cards like either component. Confabulated Pawns cannot promote. | En-passant and Dark Mirror are not individually named. |
| `rules.md`, transformed-piece paragraphs at lines 217–224 | Original-type cards remain applicable unless the transformation says otherwise; Crab is explicitly an example of remaining Pawn-targetable. | Targetability alone does not settle which conflicting movement instruction wins. |
| Official rulebook PDF page 1, “Transformed Pieces” | Cards naming the original type can affect the transformed piece unless its creating card specifies otherwise. | No express Crab/Dark Mirror ruling. |
| Official rulebook PDF page 2, “Conflicts” | A continuing effect takes precedence over a conflicting regular card. | Whether a particular card combination conflicts still requires interpretation. |
| Official FAQ PDF page 21, Crab question | Crab cannot take an opening double diagonal move or capture en passant; only promotion is retained among Pawn special movement abilities. | A newly granted, temporary Dark Mirror power is not expressly discussed. Treating this as a blanket prohibition on future Pawn-card powers overstates the answer. |
| Official FAQ PDF page 22, Dark Mirror questions | New Tactics and Phalanx do not rewrite Dark Mirror's instructions; its backward diagonal capture remains the stated direction. | Neither answer names Crab or Confabulation. |
| Official FAQ PDF page 18, continuing effects on Confabulation | A prior named transformation, notably Crab, applies only to its own merged portion; ordinary continuing effects otherwise apply to the whole merger. | No separate express enumeration of ordinary Pawn en-passant or Dark Mirror. |

## Answers

1. **Crab/Dark Mirror: inferred conflict outcome, not expressly settled.** A defensible reading blocks the backward capture because Crab's continuing forward-only restriction prevails over the regular card (rulebook PDF page 2). Nevertheless, original-Pawn targetability is expressly preserved (page 1), and FAQ page 21 concerns retained Pawn abilities. The supplied sources do not explicitly resolve the tension between target eligibility and applying Dark Mirror's temporary movement instruction. Record any implementation choice as an interpretation rather than an explicit FAQ ruling.
2. **Crab plus ordinary Pawn: yes, preserve the ordinary Pawn component independently, as a combined-rule inference.** FAQ page 18 expressly limits Crab's transformation to its own component. Confabulation expressly inherits either component's move, capture, and card-affection powers. Consequently, the ordinary Pawn component retains normal en-passant capture when its ordinary conditions hold and can supply Dark Mirror's backward capture. The Crab component's own en-passant prohibition does not erase that separate Pawn power. Even under the reading that blocks a lone Crab's Dark Mirror capture, the untouched Pawn component supplies it in this merger. This specific result is derived from express general rules, not quoted verbatim from FAQ page 18. The express Confabulation promotion exception still applies, and normal independent legality restrictions remain applicable.

SOURCE_REVIEW_COMPLETE — source validation only; no engine or test sources inspected, and no probes executed.
