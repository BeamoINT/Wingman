# iOS Warning Policy (Critical-First)

This project follows a stability-first warning policy for iOS native builds.

## Scope
- Fix build blockers and app-owned warnings immediately.
- Fix third-party warnings only when they indicate potential runtime correctness risk.
- Suppress third-party warning classes that are known upstream noise and do not impact runtime correctness.

## Rules
1. Do not edit generated CocoaPods files directly under `ios/Pods/*`.
2. All native warning controls must be reproducible through:
   - `ios/Podfile` `post_install` hooks
   - versioned patch files under `patches/*.patch` (if required)
3. Keep Wingman app target strict; do not apply blanket warning suppression to app-owned code.
4. Suppressions must be scoped by pod target and warning class.
5. Any new warning class not listed in the allowlist is considered unsanctioned and fails `ios:verify-warnings`.

Current RN-specific sanctioned classes include:
- `-Wgnu-folding-constant`
- `-Wobjc-designated-initializers`

## Canonical Audit Command
```bash
npm run ios:verify-warnings
```

This command builds iOS with:
- workspace: `ios/Wingman.xcworkspace`
- scheme: `Wingman`
- destination: `generic/platform=iOS Simulator`
- code signing disabled
- pod install mode:
  - CI default: `deployment` (deterministic, no spec refresh)
  - local default: `repo-update`

Optional overrides:
```bash
IOS_WARNING_AUDIT_POD_MODE=deployment IOS_WARNING_AUDIT_POD_RETRIES=2 npm run ios:verify-warnings
```

Artifacts are written to:
- `artifacts/ios-warning-audit/build.log`
- `artifacts/ios-warning-audit/warnings.log`
- `artifacts/ios-warning-audit/unmatched-warnings.log`
- `artifacts/ios-warning-audit/report.md`
- `artifacts/ios-warning-audit/pod-install.log`
- `artifacts/ios-warning-audit/pod-install-summary.txt`

Failure interpretation:
- `Failing audit: pod install failed...` => dependency install issue (inspect `pod-install.log`).
- `Failing audit: xcodebuild failed...` => compile/build error (inspect `build.log`).
- `Failing audit: app-owned warnings detected.` => warning in app target files, must be fixed.
- `Failing audit: unsanctioned third-party warnings detected.` => update suppression/allowlist policy or dependencies.

## Maintenance
- Remove allowlist entries as dependencies are upgraded/fixed upstream.
- Keep the warning matrix updated in `docs/ios-warning-matrix.md`.
- Re-run `npm run ios:verify-warnings` after any changes to:
  - `ios/Podfile`
  - native dependencies in `package.json`
  - iOS native source modules
