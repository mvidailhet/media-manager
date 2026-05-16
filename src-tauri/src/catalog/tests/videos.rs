use super::*;

#[test]
fn opening_a_video_records_open_history_without_playback_progress() {
    let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
    let catalog_path = temporary_folder.path().join("catalog.sqlite3");
    let catalog = Catalog::open(&catalog_path).expect("catalog opens");
    let database = Connection::open(&catalog_path).expect("catalog database opens");

    database
            .execute(
                "INSERT INTO videos (id, fingerprint, fingerprint_version, title, duration_milliseconds)
                 VALUES (1, 'fingerprint', 1, 'Family Trip', 3723000)",
                [],
            )
            .expect("video persists");

    catalog.record_video_opened(1).expect("first open records");
    catalog.record_video_opened(1).expect("second open records");

    let listed_video = catalog
        .listed_videos()
        .expect("stored videos list")
        .pop()
        .expect("video listed");
    assert_eq!(listed_video.open_count, 2);
    assert!(listed_video.last_opened_at.is_some());
    assert!(!crate::catalog::migrations::catalog_table_has_column(
        &database,
        "videos",
        "playback_progress"
    )
    .expect("column presence loads"));
}

#[test]
fn forgetting_one_available_catalog_video_is_rejected() {
    let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
    let catalog_path = temporary_folder.path().join("catalog.sqlite3");
    let catalog = Catalog::open(&catalog_path).expect("catalog opens");
    let movies_root = temporary_folder.path().join("Movies");
    std::fs::create_dir_all(&movies_root).expect("movies root exists");
    catalog
        .add_scan_root(&movies_root)
        .expect("movies scan root adds");
    let family_trip_path = movies_root.join("family-trip.mp4");
    std::fs::write(&family_trip_path, "valid video bytes").expect("video file exists");

    let database = catalog_test_database(&catalog_path);
    database
        .execute(
            "INSERT INTO videos (fingerprint, fingerprint_version, title, duration_milliseconds)
                 VALUES (?1, ?2, ?3, ?4)",
            ("fingerprint-one", 1_i64, "Family Trip", 3723000_i64),
        )
        .expect("video persists");
    database
            .execute(
                "INSERT INTO file_locations (video_id, scan_root_id, path, file_size_bytes, last_seen_at)
                 VALUES (?1, ?2, ?3, ?4, ?5)",
                (
                    1_i64,
                    1_i64,
                    family_trip_path.to_string_lossy().into_owned(),
                    17_i64,
                    "2026-05-14T16:35:48Z",
                ),
            )
            .expect("file location persists");

    let forget_error = catalog
        .forget_catalog_video(1)
        .expect_err("available catalog video is rejected");

    assert_eq!(
        forget_error,
        "Only Missing Videos can be forgotten from the Catalog"
    );
    assert_eq!(count_rows(&database, "file_locations"), 1);
    assert_eq!(count_rows(&database, "videos"), 1);
}
