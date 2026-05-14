# Use rusqlite for SQLite access

We will use `rusqlite` for SQLite access in the Tauri Rust layer. The app is a single-user local desktop app, so direct synchronous SQLite access behind backend commands and background workers is simpler than introducing an async ORM. Keeping SQL explicit also makes **Catalog** queries, migrations, and many-to-many metadata relationships easier to reason about.
