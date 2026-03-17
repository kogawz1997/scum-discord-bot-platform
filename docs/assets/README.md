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
- [live-native-proof-cases.json](./live-native-proof-cases.json)
- [live-native-proof-experimental-cases.json](./live-native-proof-experimental-cases.json)
- [CAPTURE_CHECKLIST.md](./CAPTURE_CHECKLIST.md)

What is still missing:

- broader native delivery proof coverage across more delivery classes, more server configurations, and more than one workstation

Capture workflow:

- `npm run docs:capture-evidence`
- `npm run docs:build-demo-gif`
- current script captures local admin login, authenticated admin dashboard, player landing, player login, authenticated player dashboard, and player showcase surfaces
- current Windows capture flow also builds `platform-demo.gif`
- live runtime command/log evidence is documented in `live-runtime-evidence.md`
- live native-proof matrix artifacts are documented in `live-native-proof-matrix.md` and `live-native-proof-matrix.json`
