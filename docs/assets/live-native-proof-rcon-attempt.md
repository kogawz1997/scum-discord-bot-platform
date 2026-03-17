# Live Native Proof RCON Attempt

Captured on: `2026-03-17`

- workstation: current Windows workstation
- execution mode: `rcon`
- target: `127.0.0.1:27015`
- command: `#ListPlayers`
- result: `blocked`
- error: `connect ECONNREFUSED 127.0.0.1:27015`

This was an attempt to capture a second runtime path on the same workstation.

It does not count as verified native-proof coverage because no RCON listener was reachable at the configured endpoint.
