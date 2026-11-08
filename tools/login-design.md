# Premium login — design 2 + personal pass A

Implemented locally after release 5.2.0; no release/deployment in this change.

## Behavior
- Existing password login and registration remain available. Team selection appears only when registering.
- First login can remember a 30-day server session. The next launch shows the saved employee badge and waits for an explicit Continue action.
- GET /api/auth/session checks current account state, current role and session expiry. A timeout/503 preserves the badge; 401/403 removes it and returns to the password form.
- Logout revokes only the presented bearer session and clears the local vault. Password reset invalidates the user's saved sessions.
- Native login-session.bin uses Electron safeStorage (Windows encryption). No password is stored. Legacy sh_auth plaintext is removed on startup; users sign in once again.
- Native IPC is restricted to the main application window's main frame. Only profile name/expiry are exposed for the initial badge.
- No 3D engine, render loop, remote fonts or continuous background effects on the login screen. Static background PNG is 2.4 MB.
- Existing application color theme does not override this selected cream/forest-green login design.

## Checks
- 9 server tests: session identity/role, expiry, blocked/offboarded account, service failure, exact revocation, existing call sessions.
- 3 native vault unit tests plus real Electron Windows encryption and trusted IPC check.
- Real application renderer: initial/password/registration/badge flows, Enter, duplicate submit, role refresh, network failure/retry, invalidation, account switch, 1440/900/530 px.
- TERRA work-flow regression passed after authentication, including admin/employee permissions and lazy game loading.
- Screenshot artifacts: outputs/login-premium in the Codex workspace.

## Illustration provenance
Asset: assets/login/premium-office.png
Tool: built-in imagegen, editing the selected concept 2.
Reference: exec-6e76cff0-a085-4e32-9a16-26878a6c0b63.png in the conversation's generated-images directory.
Final generation prompt:

Create the standalone background illustration asset for the LEFT HALF of the attached Support Hub login concept. Preserve the exact premium warm atmosphere, composition and objects of the workspace on the left: forest-green plaster wall, sunlight from a tall left window, brass/copper desk lamp lower-left, elegant cream stone desk, landscape on monitor at center-bottom, terracotta pottery, olive branch at right, woven cream chair foreground lower-left. Fill the entire output with that left workspace scene only; absolutely REMOVE all text, logo, headings, all login UI, right form and borders. Do not reproduce any lettering or graphic overlays. Reconstruct clean empty forest-green wall in the top 40 percent for live HTML text to be placed later. Refined photorealistic handcrafted illustration with soft material texture as reference, subtle grain, warm soft sunlight. Portrait 4:5 composition, sufficiently wide desk scene; straight-on view, original asset suitable for CSS cover without a device frame. No people, no watermark, no text anywhere.

## Release sequencing
The server auth-session endpoint must ship with/before the client. Against the older server, normal password login still works and the saved-pass action offers password login when the endpoint returns 404.
Include login.js, login.css, login-vault.js and assets/login/premium-office.png in the packaged-file validation for the next release.
