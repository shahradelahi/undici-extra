---
"undici-extra": minor
---

Add native support for Node.js streams via `.stream()` and `.pipe()` methods on the response promise. This includes automatic error propagation using `stream.pipeline` and utility for "Zero-Copy" data transfer.