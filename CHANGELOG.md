# undici-extra

## 1.2.1

### Patch Changes

- b3fb4b6: Fix TypeScript type resolution for CJS and ESM exports by adding conditional types to `package.json` exports and including `.d.cts` files.

## 1.2.0

### Minor Changes

- af021f4: Implemented built-in throttling support via `@se-oss/throttle` with intelligent rate-limit sharing across extended clients.

### Patch Changes

- af021f4: Refactored the core architecture to use closure-based state management and constructor injection, keeping options pure and serializable.

## 1.1.0

### Minor Changes

- d653b38: Add native support for Node.js streams via `.stream()` and `.pipe()` methods on the response promise. This includes automatic error propagation using `stream.pipeline` and utility for "Zero-Copy" data transfer.
