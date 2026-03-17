# Visual Assets

This folder contains exported visual artifacts that are referenced by the main docs.

Current assets:

- [architecture-overview.svg](./architecture-overview.svg)
- [runtime-validation-contract.svg](./runtime-validation-contract.svg)
- [admin-login.png](./admin-login.png)
- [admin-dashboard.png](./admin-dashboard.png)
- [player-landing.png](./player-landing.png)
- [player-login.png](./player-login.png)
- [player-dashboard.png](./player-dashboard.png)
- [player-showcase.png](./player-showcase.png)
- [platform-demo.gif](./platform-demo.gif)
- [live-runtime-evidence.md](./live-runtime-evidence.md)
- [live-native-proof-matrix.md](./live-native-proof-matrix.md)
- [live-native-proof-matrix.json](./live-native-proof-matrix.json)
- [live-native-proof-wrapper-matrix.md](./live-native-proof-wrapper-matrix.md)
- [live-native-proof-wrapper-matrix.json](./live-native-proof-wrapper-matrix.json)
- [live-native-proof-enable-spawn-on-ground-matrix.md](./live-native-proof-enable-spawn-on-ground-matrix.md)
- [live-native-proof-enable-spawn-on-ground-matrix.json](./live-native-proof-enable-spawn-on-ground-matrix.json)
- [live-native-proof-enable-spawn-on-ground-retry.md](./live-native-proof-enable-spawn-on-ground-retry.md)
- [live-native-proof-enable-spawn-on-ground-retry.json](./live-native-proof-enable-spawn-on-ground-retry.json)
- [live-native-proof-rcon-attempt.md](./live-native-proof-rcon-attempt.md)
- [live-native-proof-rcon-attempt.json](./live-native-proof-rcon-attempt.json)
- [live-native-proof-environments.json](./live-native-proof-environments.json)
- [live-native-proof-coverage-summary.md](./live-native-proof-coverage-summary.md)
- [live-native-proof-coverage-summary.json](./live-native-proof-coverage-summary.json)
- [live-native-proof-cases.json](./live-native-proof-cases.json)
- [live-native-proof-experimental-cases.json](./live-native-proof-experimental-cases.json)
- [CAPTURE_CHECKLIST.md](./CAPTURE_CHECKLIST.md)

What is still missing:

- broader native delivery proof coverage across more server configurations and more than one workstation
- passing proof for experimental item IDs still tracked in `live-native-proof-experimental-cases.json`

Capture workflow:

- `npm run docs:capture-evidence`
- `npm run docs:build-demo-gif`
- current script captures local admin login, authenticated admin dashboard, player landing, player login, authenticated player dashboard, and player showcase surfaces
- current Windows capture flow also builds `platform-demo.gif`
- live runtime command/log evidence is documented in `live-runtime-evidence.md`
- live native-proof matrix artifacts are documented in `live-native-proof-matrix.md`, `live-native-proof-matrix.json`, `live-native-proof-wrapper-matrix.md`, and `live-native-proof-wrapper-matrix.json`
- alternate server-configuration captures are documented in `live-native-proof-enable-spawn-on-ground-matrix.*` and `live-native-proof-enable-spawn-on-ground-retry.*`
- blocked same-workstation runtime attempts are documented in `live-native-proof-rcon-attempt.md` and `live-native-proof-rcon-attempt.json`
- live native-proof environment coverage is tracked in `live-native-proof-environments.json`, `live-native-proof-coverage-summary.md`, and `live-native-proof-coverage-summary.json`
- delivery-class proof expectations are documented in `../DELIVERY_NATIVE_PROOF_COVERAGE.md`
