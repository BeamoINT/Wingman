# iOS Warning Matrix

Status legend:
- `fix`: actively remediated now.
- `suppress`: allowed temporarily via scoped Podfile suppression.
- `monitor`: tracked for upstream update; not currently actionable without risky patch churn.

| Warning Family | Primary Source Targets | Status | Rationale |
|---|---|---|---|
| Missing header (`folly/lang/UncaughtExceptions.h`) | RNWorklets / RNGestureHandler / React dependencies | `fix` | Build-blocking error; remediated by source-built RN core path. |
| Deployment target 11.0 in pod targets | `Sentry-Sentry`, `react-native-maps-ReactNativeMapsPrivacy` | `fix` | Safe pod build-setting normalization to iOS 12+ for simulator compatibility. |
| Hermes script “runs every build” metadata warning | `hermes-engine` | `fix` | Non-functional warning removed by explicit script phase behavior. |
| Nullability completeness in legacy Objective-C headers | Expo modules, Sentry, Reanimated headers | `suppress` | Third-party legacy headers; no runtime risk in current integration. |
| Deprecated iOS API usage warnings | Expo modules, maps, netinfo, screens, purchases | `suppress` | Upstream deprecation noise; functional behavior retained. |
| Documentation-only warnings | React Fabric / renderer CSS / shadow mutation docs | `suppress` | Non-runtime warning category. |
| Swift warning noise in third-party pods | `react-native-compressor`, `RevenueCat` | `suppress` | Third-party Swift packages emit non-runtime warnings on the current Swift toolchain; scoped target suppression applied. |
| Expo SDK Swift/ObjC warning noise | Expo iOS modules (`expo-*`, `expo-modules-core`) | `suppress` | Upstream SDK warnings under current Xcode/Swift mode; tracked via module-scoped allowlist patterns. |
| Integer precision conversion warnings | Reanimated, Worklets, Screens | `suppress` | Third-party warning noise; no active crash evidence in current flow. |
| Implicit retain self / unused function warnings | Gesture Handler, Sentry, others | `suppress` | Localized third-party style warnings without correctness impact. |
| Strict prototype warnings (`-Wstrict-prototypes`) | `react-native-purchases` | `suppress` | Third-party Objective-C warning noise; scoped to pod target only to keep app target strict. |
| React Native clang warning drift (`-Wgnu-folding-constant`, `-Wobjc-designated-initializers`) | React Native core (`React/Base`, `Libraries/AppDelegate`) | `suppress` | Upstream RN warning noise under current Xcode toolchain; no app-owned runtime behavior change. |
| Protocol conformance and switch exhaustiveness warnings | React Native Screens | `monitor` | Requires upstream-native code changes; avoid invasive local patching in critical-first pass. |
| Pointer incompatibility warnings in maps/file-task delegates | react-native-maps / expo-file-system legacy | `monitor` | Potentially actionable but patch risk is high; revisit if runtime issues are observed. |
