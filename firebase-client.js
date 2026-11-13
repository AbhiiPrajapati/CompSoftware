// Compatibility entry point: use the browser-only local adapter.
// This keeps the existing index.html script reference working while ensuring
// credentials and application data are handled only by local-storage.js.
import "./local-storage.js";
