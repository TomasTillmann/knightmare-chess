# Abduction and Doomsayer: source contract

**Conclusion:** pronouncing the actual non-King piece name while answering Abduction triggers an existing Doomsayer. However, the opponent may deliberately identify the piece indirectly without saying its name, avoiding Doomsayer. Abduction does not force a Doomsayer trigger on every guess.

## Explicit publisher ruling

The preserved Steve Jackson Games *Knightmare Chess: Official Rulings*, printed/PDF page 9 of 66, repeats the same answer on page 23 of 66. It directly discusses Abduction with Doomsayer already active:

- The opponent may use an indirect description instead of pronouncing the piece name.
- If the opponent names the piece and identifies its former square correctly, Abduction returns it simultaneously with the Doomsayer trigger; that returned piece is eligible to be lost to Doomsayer.
- If the opponent names the piece but identifies the square incorrectly, Abduction captures the removed piece and Doomsayer removes another piece of that named type if the opponent has one.

Thus, removal/concealment alone is not the trigger. The relevant event is actual speech during recall. A correct answer must expose the restored piece to Doomsayer selection. An incorrect answer must exclude the already abducted piece from that selection. This is an explicit interaction ruling, not an inference from independent card descriptions.

Source: [SJ Games official rulings](https://www.sjgames.com/knightmare/KnightmareChess_FAQ.pdf), preserved locally as `official-faq.pdf`, pages 9 and 23.

## Local contract

- `cards.md:237–239` describes ten seconds of concealment followed by ten seconds to identify the piece and square, with restoration on success and capture otherwise.
- `rules.md:616` gives the two software timer boundaries and an `answerAbduction` payload containing role, owner, square, and optionally physical identity. It makes the caller responsible for elapsed time.
- `rules.md:618–620` prescribes restoration/capture, defers final safety until recall resolves, and preserves the normal response window.
- `cards.md:9–11` and `rules.md:626` make pronunciation of a non-King piece name trigger Doomsayer; if the player owns none, the effect remains. They also permit the opponent to name a piece immediately when **Doomsayer itself is played**. That optional activation-time opportunity is distinct from the later Abduction answer.
- `rules.md:628` recommends that only intentional game communication count and that the affected player choose the lost piece. The local guide does not repeat the publisher's circumlocution exception in its Abduction API paragraph.
- `rules.md:929` states that the official rulebook and FAQ control over local interpretations.

## Unresolved software action ordering

These sources determine the resulting eligible pieces but do not mandate a reducer action order. A structured `role: 'rook'` field does not establish that the human actually pronounced “Rook”; it could equally encode a permitted indirect identification. Consequently, the published rule does **not** justify treating every typed Abduction role as automatically spoken, nor does it justify making Doomsayer impossible during an Abduction answer. The software needs an explicit speech/adjudication convention or an action capable of distinguishing the two cases. The available source contract does not specify whether pronunciation is submitted within the answer, separately after recall resolution, or in another atomic response.

A timeout without pronunciation does not itself satisfy Doomsayer's trigger; this follows from the speech trigger rather than an explicit timeout example in the FAQ. Wrong-role and multi-Doomsayer ordering details are not resolved by this narrow publisher example.

## Example

White has an active Doomsayer and abducts Black's Rook from a8. Black correctly says “Rook, a8”: the Rook returns and Black may lose that same Rook to Doomsayer. If Black says “Rook, h8,” the abducted Rook is captured and a different Black Rook is lost if available. A correct indirect description can restore the Rook without triggering Doomsayer.

Reviewed: two card bodies, local sections 19.2 and 19.3 plus source-precedence line, and the two explicit publisher FAQ occurrences. No production, tests, or harness files read or changed.

ABDUCTION_DOOMSAYER_SOURCE_DONE
