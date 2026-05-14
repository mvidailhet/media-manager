# Rust owns catalog access

React will not access SQLite directly. The Tauri Rust layer owns all **Catalog** reads, writes, migrations, scan reconciliation, metadata updates, and review state changes, while the UI calls typed commands. This keeps filesystem behavior, fingerprint matching, transactions, and local data rules in one backend boundary instead of spreading app logic across the frontend.
