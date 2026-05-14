# Store preview strips as cache files

Generated **Preview Strips** will be stored as contact sheet image files in the **Preview Cache**, with SQLite storing the catalog relationship and any needed metadata. Storing image blobs in SQLite would make the durable **Catalog** heavier and harder to back up, while many separate frame files would be noisier for the UI and filesystem than one generated strip per **Video**.
