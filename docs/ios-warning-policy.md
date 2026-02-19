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

## Canonical Audit Command
```bash
npm run ios:verify-warnings
```

This command builds iOS with:
- workspace: `ios/Wingman.xcworkspace`
- scheme: `Wingman`
- destination: `generic/platform=iOS Simulator`
- code signing disabled

Artifacts are written to:
- `artifacts/ios-warning-audit/build.log`
- `artifacts/ios-warning-audit/warnings.log`
- `artifacts/ios-warning-audit/unmatched-warnings.log`
- `artifacts/ios-warning-audit/report.md`

## Maintenance
- Remove allowlist entries as dependencies are upgraded/fixed upstream.
- Keep the warning matrix updated in `docs/ios-warning-matrix.md`.
- Re-run `npm run ios:verify-warnings` after any changes to:
  - `ios/Podfile`
  - native dependencies in `package.json`
  - iOS native source modules
