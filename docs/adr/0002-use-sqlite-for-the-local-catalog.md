# Use SQLite for the local catalog

We will store the **Catalog** in SQLite because the app is local-first, offline, and relational: **Videos**, **File Locations**, **Tags**, **Performers**, **Metadata Suggestions**, **Open History**, and review state need durable transactional storage without running a separate database service. JSON files would be simpler initially but weak for filtering, migrations, and many-to-many metadata relationships; Postgres is unnecessary operational weight for a single-user desktop app.
