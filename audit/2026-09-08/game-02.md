# Game 02: Earthquake, transformed pawns, en passant and promotion

Scope: one independently initialized self-play game through public engine APIs. No engine or test edits.

Initial predictions: board rotation must preserve valid piece identities and turn ownership; transformed pawn direction and promotion must follow authoritative card rules; rejected actions must leave the state unchanged. Exact scenario and observations follow after reading the applicable rules.


## Executed result

`SCAFFOLD_OK`: shared validated fixture passed invariant and rejected-action immutability checks before the independent game.

`GAME_02_DONE`: exactly one game initialized; 30 accepted actions (11 board moves, 8 card plays, 11 turn completions), 10 rejected zero-length move probes; inline game runtime 89 ms. No confirmed findings in this bounded game. No temporary harness created. The overall agent setup exceeded the 45-second aspiration because the first heredoc execution was blocked by sandbox temporary-file creation; the retry used inline `node -e` and initialized the sole game.

Independent adversarial group: stack two clockwise Earthquakes, neutralize both opposing pawns, move the same neutral black pawn on consecutive players' turns while preserving its original-owner forward direction at orientation 180, stack Crab on a neutral pawn, remove both Earthquakes separately with Peace Talks, and move that neutral Crab on alternating turns. Every accepted state passed identity/occupancy/FEN/royal invariants. Every rejected action retained the identical state digest. All completed moves kept the actor's royal piece safe.

Limitations: the game reached neither an actual promotion nor en-passant capture. Rotation-cancellation promotion remains untested here; an independent fresh-game agent should deliberately put a pawn on the restored last rank. This game cannot establish exhaustive correctness.

## Exact initial options, actions, predictions and observed evidence

```json
{
  "sentinel": "GAME_02_DONE",
  "initial": {
    "fen": "7k/8/8/8/8/1Pp5/8/K7 w - - 0 1",
    "hands": {
      "white": [
        "earthquake",
        "neutrality",
        "crab",
        "peace-talks"
      ],
      "black": [
        "earthquake",
        "neutrality",
        "crab",
        "peace-talks"
      ]
    }
  },
  "accepted": 30,
  "rejected": 10,
  "findings": [],
  "steps": [
    {
      "a": {
        "type": "move",
        "from": "a1",
        "to": "a2"
      },
      "prediction": "King a1 goes to a2; pawns remain b3,c3.",
      "ok": true,
      "fen": "7k/8/8/8/8/1Pp5/K7/8 b - - 1 1",
      "orientation": 0,
      "ep": [],
      "neutral": [],
      "lastHistory": [
        {
          "type": "move",
          "from": "a1",
          "to": "a2"
        }
      ]
    },
    {
      "earthquakeTargets": [
        {
          "direction": "clockwise",
          "promotions": []
        },
        {
          "direction": "counterclockwise",
          "promotions": []
        }
      ]
    },
    {
      "a": {
        "type": "playCard",
        "cardId": "earthquake",
        "target": {
          "direction": "clockwise",
          "promotions": []
        }
      },
      "prediction": "Pawn direction rotates 90 degrees; no new edge pawn promotion.",
      "ok": true,
      "fen": "7k/8/8/8/8/1Pp5/K7/8 b - - 1 1",
      "orientation": 90,
      "ep": [],
      "neutral": [],
      "lastHistory": [
        {
          "type": "cardPlayed",
          "cardId": "earthquake",
          "target": {
            "direction": "clockwise",
            "promotions": []
          },
          "movement": [],
          "preservePreviousMove": true
        }
      ]
    },
    {
      "a": {
        "type": "endTurn"
      },
      "prediction": "Black begins next turn.",
      "ok": true,
      "fen": "7k/8/8/8/8/1Pp5/K7/8 b - - 1 1",
      "orientation": 90,
      "ep": [],
      "neutral": [],
      "lastHistory": [
        {
          "type": "cardPlayed",
          "cardId": "earthquake",
          "target": {
            "direction": "clockwise",
            "promotions": []
          },
          "movement": [],
          "preservePreviousMove": true
        }
      ]
    },
    {
      "legalAfterRotation": [
        [
          "h8",
          [
            "g7",
            "h7",
            "g8"
          ]
        ]
      ]
    },
    {
      "a": {
        "type": "move",
        "from": "h8",
        "to": "h8"
      },
      "prediction": "Reject zero-length move with exact unchanged state.",
      "ok": false,
      "error": {
        "code": "ILLEGAL_MOVE",
        "message": "That is not a legal chess move."
      },
      "fen": "7k/8/8/8/8/1Pp5/K7/8 b - - 1 1",
      "orientation": 90,
      "ep": [],
      "neutral": [],
      "lastHistory": [
        {
          "type": "cardPlayed",
          "cardId": "earthquake",
          "target": {
            "direction": "clockwise",
            "promotions": []
          },
          "movement": [],
          "preservePreviousMove": true
        }
      ]
    },
    {
      "a": {
        "type": "move",
        "from": "h8",
        "to": "h7"
      },
      "prediction": "One physical piece moves from h8 to h7; own king remains safe, identity persists.",
      "ok": true,
      "fen": "8/7k/8/8/8/1Pp5/K7/8 w - - 2 2",
      "orientation": 90,
      "ep": [],
      "neutral": [],
      "lastHistory": [
        {
          "type": "move",
          "from": "h8",
          "to": "h7"
        }
      ]
    },
    {
      "a": {
        "type": "playCard",
        "cardId": "earthquake",
        "target": {
          "direction": "clockwise",
          "promotions": []
        }
      },
      "prediction": "Rotation changes pawn direction and explicitly promotes newly eligible edge pawns.",
      "ok": true,
      "fen": "8/7k/8/8/8/1Pp5/K7/8 w - - 2 2",
      "orientation": 180,
      "ep": [],
      "neutral": [],
      "lastHistory": [
        {
          "type": "cardPlayed",
          "cardId": "earthquake",
          "target": {
            "direction": "clockwise",
            "promotions": []
          },
          "movement": [],
          "preservePreviousMove": true
        }
      ]
    },
    {
      "a": {
        "type": "endTurn"
      },
      "prediction": "Completed move hands turn to opponent.",
      "ok": true,
      "fen": "8/7k/8/8/8/1Pp5/K7/8 w - - 2 2",
      "orientation": 180,
      "ep": [],
      "neutral": [],
      "lastHistory": [
        {
          "type": "cardPlayed",
          "cardId": "earthquake",
          "target": {
            "direction": "clockwise",
            "promotions": []
          },
          "movement": [],
          "preservePreviousMove": true
        }
      ]
    },
    {
      "a": {
        "type": "move",
        "from": "b3",
        "to": "b3"
      },
      "prediction": "Reject zero-length move with exact unchanged state.",
      "ok": false,
      "error": {
        "code": "ILLEGAL_MOVE",
        "message": "That is not a legal chess move."
      },
      "fen": "8/7k/8/8/8/1Pp5/K7/8 w - - 2 2",
      "orientation": 180,
      "ep": [],
      "neutral": [],
      "lastHistory": [
        {
          "type": "cardPlayed",
          "cardId": "earthquake",
          "target": {
            "direction": "clockwise",
            "promotions": []
          },
          "movement": [],
          "preservePreviousMove": true
        }
      ]
    },
    {
      "a": {
        "type": "move",
        "from": "b3",
        "to": "b2"
      },
      "prediction": "One physical piece moves from b3 to b2; own king remains safe, identity persists.",
      "ok": true,
      "fen": "8/7k/8/8/8/2p5/KP6/8 b - - 0 2",
      "orientation": 180,
      "ep": [],
      "neutral": [],
      "lastHistory": [
        {
          "type": "move",
          "from": "b3",
          "to": "b2"
        }
      ]
    },
    {
      "a": {
        "type": "playCard",
        "cardId": "neutrality",
        "target": "c3"
      },
      "prediction": "Neutralized pawn keeps owner and forward direction.",
      "ok": true,
      "fen": "8/7k/8/8/8/2p5/KP6/8 b - - 0 2",
      "orientation": 180,
      "ep": [],
      "neutral": [
        {
          "id": "black-pawn-c3",
          "square": "c3"
        }
      ],
      "lastHistory": [
        {
          "type": "cardPlayed",
          "cardId": "neutrality",
          "target": "c3",
          "movement": [],
          "preservePreviousMove": true
        }
      ]
    },
    {
      "a": {
        "type": "endTurn"
      },
      "prediction": "Completed move hands turn to opponent.",
      "ok": true,
      "fen": "8/7k/8/8/8/2p5/KP6/8 b - - 0 2",
      "orientation": 180,
      "ep": [],
      "neutral": [
        {
          "id": "black-pawn-c3",
          "square": "c3"
        }
      ],
      "lastHistory": [
        {
          "type": "cardPlayed",
          "cardId": "neutrality",
          "target": "c3",
          "movement": [],
          "preservePreviousMove": true
        }
      ]
    },
    {
      "a": {
        "type": "move",
        "from": "c3",
        "to": "c3"
      },
      "prediction": "Reject zero-length move with exact unchanged state.",
      "ok": false,
      "error": {
        "code": "ILLEGAL_MOVE",
        "message": "That is not a legal chess move."
      },
      "fen": "8/7k/8/8/8/2p5/KP6/8 b - - 0 2",
      "orientation": 180,
      "ep": [],
      "neutral": [
        {
          "id": "black-pawn-c3",
          "square": "c3"
        }
      ],
      "lastHistory": [
        {
          "type": "cardPlayed",
          "cardId": "neutrality",
          "target": "c3",
          "movement": [],
          "preservePreviousMove": true
        }
      ]
    },
    {
      "a": {
        "type": "move",
        "from": "c3",
        "to": "c4"
      },
      "prediction": "One physical piece moves from c3 to c4; own king remains safe, identity persists.",
      "ok": true,
      "fen": "8/7k/8/8/2p5/8/KP6/8 w - - 0 3",
      "orientation": 180,
      "ep": [],
      "neutral": [
        {
          "id": "black-pawn-c3",
          "square": "c4"
        }
      ],
      "lastHistory": [
        {
          "type": "move",
          "from": "c3",
          "to": "c4"
        }
      ]
    },
    {
      "a": {
        "type": "playCard",
        "cardId": "neutrality",
        "target": "b2"
      },
      "prediction": "Neutralized pawn keeps owner and forward direction.",
      "ok": true,
      "fen": "8/7k/8/8/2p5/8/KP6/8 w - - 0 3",
      "orientation": 180,
      "ep": [],
      "neutral": [
        {
          "id": "white-pawn-b3",
          "square": "b2"
        },
        {
          "id": "black-pawn-c3",
          "square": "c4"
        }
      ],
      "lastHistory": [
        {
          "type": "cardPlayed",
          "cardId": "neutrality",
          "target": "b2",
          "movement": [],
          "preservePreviousMove": true
        }
      ]
    },
    {
      "a": {
        "type": "endTurn"
      },
      "prediction": "Completed move hands turn to opponent.",
      "ok": true,
      "fen": "8/7k/8/8/2p5/8/KP6/8 w - - 0 3",
      "orientation": 180,
      "ep": [],
      "neutral": [
        {
          "id": "white-pawn-b3",
          "square": "b2"
        },
        {
          "id": "black-pawn-c3",
          "square": "c4"
        }
      ],
      "lastHistory": [
        {
          "type": "cardPlayed",
          "cardId": "neutrality",
          "target": "b2",
          "movement": [],
          "preservePreviousMove": true
        }
      ]
    },
    {
      "a": {
        "type": "move",
        "from": "c4",
        "to": "c4"
      },
      "prediction": "Reject zero-length move with exact unchanged state.",
      "ok": false,
      "error": {
        "code": "ILLEGAL_MOVE",
        "message": "That is not a legal chess move."
      },
      "fen": "8/7k/8/8/2p5/8/KP6/8 w - - 0 3",
      "orientation": 180,
      "ep": [],
      "neutral": [
        {
          "id": "white-pawn-b3",
          "square": "b2"
        },
        {
          "id": "black-pawn-c3",
          "square": "c4"
        }
      ],
      "lastHistory": [
        {
          "type": "cardPlayed",
          "cardId": "neutrality",
          "target": "b2",
          "movement": [],
          "preservePreviousMove": true
        }
      ]
    },
    {
      "a": {
        "type": "move",
        "from": "c4",
        "to": "c5"
      },
      "prediction": "One physical piece moves from c4 to c5; own king remains safe, identity persists.",
      "ok": true,
      "fen": "8/7k/8/2p5/8/8/KP6/8 b - - 0 3",
      "orientation": 180,
      "ep": [],
      "neutral": [
        {
          "id": "white-pawn-b3",
          "square": "b2"
        },
        {
          "id": "black-pawn-c3",
          "square": "c5"
        }
      ],
      "lastHistory": [
        {
          "type": "move",
          "from": "c4",
          "to": "c5"
        }
      ]
    },
    {
      "a": {
        "type": "playCard",
        "cardId": "crab",
        "target": "b2"
      },
      "prediction": "Transformation preserves original pawn identity.",
      "ok": true,
      "fen": "8/7k/8/2p5/8/8/KP6/8 b - - 0 3",
      "orientation": 180,
      "ep": [],
      "neutral": [
        {
          "id": "white-pawn-b3",
          "square": "b2"
        },
        {
          "id": "black-pawn-c3",
          "square": "c5"
        }
      ],
      "lastHistory": [
        {
          "type": "cardPlayed",
          "cardId": "crab",
          "target": "b2",
          "movement": [],
          "preservePreviousMove": true
        }
      ]
    },
    {
      "a": {
        "type": "endTurn"
      },
      "prediction": "Completed move hands turn to opponent.",
      "ok": true,
      "fen": "8/7k/8/2p5/8/8/KP6/8 b - - 0 3",
      "orientation": 180,
      "ep": [],
      "neutral": [
        {
          "id": "white-pawn-b3",
          "square": "b2"
        },
        {
          "id": "black-pawn-c3",
          "square": "c5"
        }
      ],
      "lastHistory": [
        {
          "type": "cardPlayed",
          "cardId": "crab",
          "target": "b2",
          "movement": [],
          "preservePreviousMove": true
        }
      ]
    },
    {
      "a": {
        "type": "move",
        "from": "c5",
        "to": "c5"
      },
      "prediction": "Reject zero-length move with exact unchanged state.",
      "ok": false,
      "error": {
        "code": "ILLEGAL_MOVE",
        "message": "That is not a legal chess move."
      },
      "fen": "8/7k/8/2p5/8/8/KP6/8 b - - 0 3",
      "orientation": 180,
      "ep": [],
      "neutral": [
        {
          "id": "white-pawn-b3",
          "square": "b2"
        },
        {
          "id": "black-pawn-c3",
          "square": "c5"
        }
      ],
      "lastHistory": [
        {
          "type": "cardPlayed",
          "cardId": "crab",
          "target": "b2",
          "movement": [],
          "preservePreviousMove": true
        }
      ]
    },
    {
      "a": {
        "type": "move",
        "from": "c5",
        "to": "c6"
      },
      "prediction": "One physical piece moves from c5 to c6; own king remains safe, identity persists.",
      "ok": true,
      "fen": "8/7k/2p5/8/8/8/KP6/8 w - - 0 4",
      "orientation": 180,
      "ep": [],
      "neutral": [
        {
          "id": "white-pawn-b3",
          "square": "b2"
        },
        {
          "id": "black-pawn-c3",
          "square": "c6"
        }
      ],
      "lastHistory": [
        {
          "type": "move",
          "from": "c5",
          "to": "c6"
        }
      ]
    },
    {
      "a": {
        "type": "playCard",
        "cardId": "crab",
        "target": "b2"
      },
      "prediction": "Transformation preserves original pawn identity.",
      "ok": true,
      "fen": "8/7k/2p5/8/8/8/KP6/8 w - - 0 4",
      "orientation": 180,
      "ep": [],
      "neutral": [
        {
          "id": "white-pawn-b3",
          "square": "b2"
        },
        {
          "id": "black-pawn-c3",
          "square": "c6"
        }
      ],
      "lastHistory": [
        {
          "type": "cardPlayed",
          "cardId": "crab",
          "target": "b2",
          "movement": [],
          "preservePreviousMove": true
        }
      ]
    },
    {
      "a": {
        "type": "endTurn"
      },
      "prediction": "Completed move hands turn to opponent.",
      "ok": true,
      "fen": "8/7k/2p5/8/8/8/KP6/8 w - - 0 4",
      "orientation": 180,
      "ep": [],
      "neutral": [
        {
          "id": "white-pawn-b3",
          "square": "b2"
        },
        {
          "id": "black-pawn-c3",
          "square": "c6"
        }
      ],
      "lastHistory": [
        {
          "type": "cardPlayed",
          "cardId": "crab",
          "target": "b2",
          "movement": [],
          "preservePreviousMove": true
        }
      ]
    },
    {
      "a": {
        "type": "move",
        "from": "c6",
        "to": "c6"
      },
      "prediction": "Reject zero-length move with exact unchanged state.",
      "ok": false,
      "error": {
        "code": "ILLEGAL_MOVE",
        "message": "That is not a legal chess move."
      },
      "fen": "8/7k/2p5/8/8/8/KP6/8 w - - 0 4",
      "orientation": 180,
      "ep": [],
      "neutral": [
        {
          "id": "white-pawn-b3",
          "square": "b2"
        },
        {
          "id": "black-pawn-c3",
          "square": "c6"
        }
      ],
      "lastHistory": [
        {
          "type": "cardPlayed",
          "cardId": "crab",
          "target": "b2",
          "movement": [],
          "preservePreviousMove": true
        }
      ]
    },
    {
      "a": {
        "type": "move",
        "from": "c6",
        "to": "c7"
      },
      "prediction": "One physical piece moves from c6 to c7; own king remains safe, identity persists.",
      "ok": true,
      "fen": "8/2p4k/8/8/8/8/KP6/8 b - - 0 4",
      "orientation": 180,
      "ep": [],
      "neutral": [
        {
          "id": "white-pawn-b3",
          "square": "b2"
        },
        {
          "id": "black-pawn-c3",
          "square": "c7"
        }
      ],
      "lastHistory": [
        {
          "type": "move",
          "from": "c6",
          "to": "c7"
        }
      ]
    },
    {
      "a": {
        "type": "playCard",
        "cardId": "peace-talks",
        "target": "white-hand-0-earthquake"
      },
      "prediction": "Undo rotation must apply same promotion rules.",
      "ok": true,
      "fen": "8/2p4k/8/8/8/8/KP6/8 b - - 0 4",
      "orientation": 90,
      "ep": [],
      "neutral": [
        {
          "id": "white-pawn-b3",
          "square": "b2"
        },
        {
          "id": "black-pawn-c3",
          "square": "c7"
        }
      ],
      "lastHistory": [
        {
          "type": "cardPlayed",
          "cardId": "peace-talks",
          "movement": [],
          "preservePreviousMove": true
        }
      ]
    },
    {
      "a": {
        "type": "endTurn"
      },
      "prediction": "Completed move hands turn to opponent.",
      "ok": true,
      "fen": "8/2p4k/8/8/8/8/KP6/8 b - - 0 4",
      "orientation": 90,
      "ep": [],
      "neutral": [
        {
          "id": "white-pawn-b3",
          "square": "b2"
        },
        {
          "id": "black-pawn-c3",
          "square": "c7"
        }
      ],
      "lastHistory": [
        {
          "type": "cardPlayed",
          "cardId": "peace-talks",
          "movement": [],
          "preservePreviousMove": true
        }
      ]
    },
    {
      "a": {
        "type": "move",
        "from": "b2",
        "to": "b2"
      },
      "prediction": "Reject zero-length move with exact unchanged state.",
      "ok": false,
      "error": {
        "code": "ILLEGAL_MOVE",
        "message": "That is not a legal Crab move."
      },
      "fen": "8/2p4k/8/8/8/8/KP6/8 b - - 0 4",
      "orientation": 90,
      "ep": [],
      "neutral": [
        {
          "id": "white-pawn-b3",
          "square": "b2"
        },
        {
          "id": "black-pawn-c3",
          "square": "c7"
        }
      ],
      "lastHistory": [
        {
          "type": "cardPlayed",
          "cardId": "peace-talks",
          "movement": [],
          "preservePreviousMove": true
        }
      ]
    },
    {
      "a": {
        "type": "move",
        "from": "b2",
        "to": "c3"
      },
      "prediction": "One physical piece moves from b2 to c3; own king remains safe, identity persists.",
      "ok": true,
      "fen": "8/2p4k/8/8/8/2P5/K7/8 w - - 0 5",
      "orientation": 90,
      "ep": [],
      "neutral": [
        {
          "id": "white-pawn-b3",
          "square": "c3"
        },
        {
          "id": "black-pawn-c3",
          "square": "c7"
        }
      ],
      "lastHistory": [
        {
          "type": "move",
          "from": "b2",
          "to": "c3"
        }
      ]
    },
    {
      "a": {
        "type": "playCard",
        "cardId": "peace-talks",
        "target": "black-hand-0-earthquake"
      },
      "prediction": "Undo rotation must apply same promotion rules.",
      "ok": true,
      "fen": "8/2p4k/8/8/8/2P5/K7/8 w - - 0 5",
      "orientation": 0,
      "ep": [],
      "neutral": [
        {
          "id": "white-pawn-b3",
          "square": "c3"
        },
        {
          "id": "black-pawn-c3",
          "square": "c7"
        }
      ],
      "lastHistory": [
        {
          "type": "cardPlayed",
          "cardId": "peace-talks",
          "movement": [],
          "preservePreviousMove": true
        }
      ]
    },
    {
      "a": {
        "type": "endTurn"
      },
      "prediction": "Completed move hands turn to opponent.",
      "ok": true,
      "fen": "8/2p4k/8/8/8/2P5/K7/8 w - - 0 5",
      "orientation": 0,
      "ep": [],
      "neutral": [
        {
          "id": "white-pawn-b3",
          "square": "c3"
        },
        {
          "id": "black-pawn-c3",
          "square": "c7"
        }
      ],
      "lastHistory": [
        {
          "type": "cardPlayed",
          "cardId": "peace-talks",
          "movement": [],
          "preservePreviousMove": true
        }
      ]
    },
    {
      "a": {
        "type": "move",
        "from": "c3",
        "to": "c3"
      },
      "prediction": "Reject zero-length move with exact unchanged state.",
      "ok": false,
      "error": {
        "code": "ILLEGAL_MOVE",
        "message": "That is not a legal Crab move."
      },
      "fen": "8/2p4k/8/8/8/2P5/K7/8 w - - 0 5",
      "orientation": 0,
      "ep": [],
      "neutral": [
        {
          "id": "white-pawn-b3",
          "square": "c3"
        },
        {
          "id": "black-pawn-c3",
          "square": "c7"
        }
      ],
      "lastHistory": [
        {
          "type": "cardPlayed",
          "cardId": "peace-talks",
          "movement": [],
          "preservePreviousMove": true
        }
      ]
    },
    {
      "a": {
        "type": "move",
        "from": "c3",
        "to": "d4"
      },
      "prediction": "One physical piece moves from c3 to d4; own king remains safe, identity persists.",
      "ok": true,
      "fen": "8/2p4k/8/8/3P4/8/K7/8 b - - 0 5",
      "orientation": 0,
      "ep": [],
      "neutral": [
        {
          "id": "white-pawn-b3",
          "square": "d4"
        },
        {
          "id": "black-pawn-c3",
          "square": "c7"
        }
      ],
      "lastHistory": [
        {
          "type": "move",
          "from": "c3",
          "to": "d4"
        }
      ]
    },
    {
      "a": {
        "type": "endTurn"
      },
      "prediction": "Completed move hands turn to opponent.",
      "ok": true,
      "fen": "8/2p4k/8/8/3P4/8/K7/8 b - - 0 5",
      "orientation": 0,
      "ep": [],
      "neutral": [
        {
          "id": "white-pawn-b3",
          "square": "d4"
        },
        {
          "id": "black-pawn-c3",
          "square": "c7"
        }
      ],
      "lastHistory": [
        {
          "type": "move",
          "from": "c3",
          "to": "d4"
        }
      ]
    },
    {
      "a": {
        "type": "move",
        "from": "d4",
        "to": "d4"
      },
      "prediction": "Reject zero-length move with exact unchanged state.",
      "ok": false,
      "error": {
        "code": "ILLEGAL_MOVE",
        "message": "That is not a legal Crab move."
      },
      "fen": "8/2p4k/8/8/3P4/8/K7/8 b - - 0 5",
      "orientation": 0,
      "ep": [],
      "neutral": [
        {
          "id": "white-pawn-b3",
          "square": "d4"
        },
        {
          "id": "black-pawn-c3",
          "square": "c7"
        }
      ],
      "lastHistory": [
        {
          "type": "move",
          "from": "c3",
          "to": "d4"
        }
      ]
    },
    {
      "a": {
        "type": "move",
        "from": "d4",
        "to": "e5"
      },
      "prediction": "One physical piece moves from d4 to e5; own king remains safe, identity persists.",
      "ok": true,
      "fen": "8/2p4k/8/4P3/8/8/K7/8 w - - 0 6",
      "orientation": 0,
      "ep": [],
      "neutral": [
        {
          "id": "white-pawn-b3",
          "square": "e5"
        },
        {
          "id": "black-pawn-c3",
          "square": "c7"
        }
      ],
      "lastHistory": [
        {
          "type": "move",
          "from": "d4",
          "to": "e5"
        }
      ]
    },
    {
      "a": {
        "type": "endTurn"
      },
      "prediction": "Completed move hands turn to opponent.",
      "ok": true,
      "fen": "8/2p4k/8/4P3/8/8/K7/8 w - - 0 6",
      "orientation": 0,
      "ep": [],
      "neutral": [
        {
          "id": "white-pawn-b3",
          "square": "e5"
        },
        {
          "id": "black-pawn-c3",
          "square": "c7"
        }
      ],
      "lastHistory": [
        {
          "type": "move",
          "from": "d4",
          "to": "e5"
        }
      ]
    },
    {
      "a": {
        "type": "move",
        "from": "e5",
        "to": "e5"
      },
      "prediction": "Reject zero-length move with exact unchanged state.",
      "ok": false,
      "error": {
        "code": "ILLEGAL_MOVE",
        "message": "That is not a legal Crab move."
      },
      "fen": "8/2p4k/8/4P3/8/8/K7/8 w - - 0 6",
      "orientation": 0,
      "ep": [],
      "neutral": [
        {
          "id": "white-pawn-b3",
          "square": "e5"
        },
        {
          "id": "black-pawn-c3",
          "square": "c7"
        }
      ],
      "lastHistory": [
        {
          "type": "move",
          "from": "d4",
          "to": "e5"
        }
      ]
    },
    {
      "a": {
        "type": "move",
        "from": "e5",
        "to": "f6"
      },
      "prediction": "One physical piece moves from e5 to f6; own king remains safe, identity persists.",
      "ok": true,
      "fen": "8/2p4k/5P2/8/8/8/K7/8 b - - 0 6",
      "orientation": 0,
      "ep": [],
      "neutral": [
        {
          "id": "white-pawn-b3",
          "square": "f6"
        },
        {
          "id": "black-pawn-c3",
          "square": "c7"
        }
      ],
      "lastHistory": [
        {
          "type": "move",
          "from": "e5",
          "to": "f6"
        }
      ]
    },
    {
      "a": {
        "type": "endTurn"
      },
      "prediction": "Completed move hands turn to opponent.",
      "ok": true,
      "fen": "8/2p4k/5P2/8/8/8/K7/8 b - - 0 6",
      "orientation": 0,
      "ep": [],
      "neutral": [
        {
          "id": "white-pawn-b3",
          "square": "f6"
        },
        {
          "id": "black-pawn-c3",
          "square": "c7"
        }
      ],
      "lastHistory": [
        {
          "type": "move",
          "from": "e5",
          "to": "f6"
        }
      ]
    }
  ],
  "wallMs": 89
}
```
