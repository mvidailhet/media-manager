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

#[test]
fn moving_one_file_location_to_trash_keeps_video_when_another_location_remains() {
    let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
    let catalog_path = temporary_folder.path().join("catalog.sqlite3");
    let catalog = Catalog::open(&catalog_path).expect("catalog opens");
    let database = catalog_test_database(&catalog_path);
    let movies_root = temporary_folder.path().join("Movies");
    let backup_root = temporary_folder.path().join("Backup");
    std::fs::create_dir_all(&movies_root).expect("movies root exists");
    std::fs::create_dir_all(&backup_root).expect("backup root exists");
    catalog
        .add_scan_root(&movies_root)
        .expect("movies scan root adds");
    catalog
        .add_scan_root(&backup_root)
        .expect("backup scan root adds");
    store_test_video(&database, "fingerprint-one", "Family Trip");
    let movies_location_path = movies_root.join("family-trip.mp4");
    let backup_location_path = backup_root.join("family-trip.mp4");
    std::fs::write(&movies_location_path, "valid video bytes").expect("movies file exists");
    std::fs::write(&backup_location_path, "valid video bytes").expect("backup file exists");
    store_file_location(&database, 1, 1, &movies_location_path, 17);
    store_file_location(&database, 1, 2, &backup_location_path, 17);

    catalog
        .remove_trashed_file_location(1, &movies_location_path)
        .expect("trashed location removes");

    let listed_videos = catalog.listed_videos().expect("videos list");
    assert_eq!(listed_videos.len(), 1);
    assert_eq!(listed_videos[0].title, "Family Trip");
    assert_eq!(listed_videos[0].file_locations.len(), 1);
    assert_eq!(
        listed_videos[0].file_locations[0].path,
        backup_location_path.to_string_lossy()
    );
}

#[test]
fn moving_the_last_file_location_to_trash_forgets_video_from_catalog_results() {
    let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
    let catalog_path = temporary_folder.path().join("catalog.sqlite3");
    let catalog = Catalog::open(&catalog_path).expect("catalog opens");
    let database = catalog_test_database(&catalog_path);
    let movies_root = temporary_folder.path().join("Movies");
    std::fs::create_dir_all(&movies_root).expect("movies root exists");
    catalog
        .add_scan_root(&movies_root)
        .expect("movies scan root adds");
    store_test_video(&database, "fingerprint-one", "Family Trip");
    let movies_location_path = movies_root.join("family-trip.mp4");
    std::fs::write(&movies_location_path, "valid video bytes").expect("movies file exists");
    store_file_location(&database, 1, 1, &movies_location_path, 17);

    catalog
        .remove_trashed_file_location(1, &movies_location_path)
        .expect("trashed location removes");

    assert!(catalog.listed_videos().expect("videos list").is_empty());
    assert_eq!(count_rows(&database, "file_locations"), 0);
    assert_eq!(count_rows(&database, "videos"), 0);
}

#[test]
fn moving_the_last_reachable_file_location_to_trash_forgets_video_with_unreachable_locations() {
    let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
    let catalog_path = temporary_folder.path().join("catalog.sqlite3");
    let catalog = Catalog::open(&catalog_path).expect("catalog opens");
    let database = catalog_test_database(&catalog_path);
    let movies_root = temporary_folder.path().join("Movies");
    let backup_root = temporary_folder.path().join("Backup");
    std::fs::create_dir_all(&movies_root).expect("movies root exists");
    std::fs::create_dir_all(&backup_root).expect("backup root exists");
    catalog
        .add_scan_root(&movies_root)
        .expect("movies scan root adds");
    catalog
        .add_scan_root(&backup_root)
        .expect("backup scan root adds");
    let backup_scan_root_path = backup_root
        .canonicalize()
        .expect("backup root canonicalizes")
        .to_string_lossy()
        .into_owned();
    catalog
        .check_scan_root_availability(&backup_scan_root_path)
        .expect("backup scan root availability updates");
    std::fs::remove_dir_all(&backup_root).expect("backup root becomes unreachable");
    catalog
        .check_scan_root_availability(&backup_scan_root_path)
        .expect("backup scan root unavailability updates");
    store_test_video(&database, "fingerprint-one", "Family Trip");
    let movies_location_path = movies_root.join("family-trip.mp4");
    let backup_location_path = backup_root.join("family-trip.mp4");
    std::fs::write(&movies_location_path, "valid video bytes").expect("movies file exists");
    store_file_location(&database, 1, 1, &movies_location_path, 17);
    store_file_location(&database, 1, 2, &backup_location_path, 17);

    catalog
        .remove_trashed_file_location(1, &movies_location_path)
        .expect("last reachable location removes");

    assert!(catalog.listed_videos().expect("videos list").is_empty());
    assert_eq!(count_rows(&database, "file_locations"), 0);
    assert_eq!(count_rows(&database, "videos"), 0);
}

fn store_file_location(
    database: &Connection,
    video_id: i64,
    scan_root_id: i64,
    path: &Path,
    file_size_bytes: i64,
) {
    database
        .execute(
            "INSERT INTO file_locations (video_id, scan_root_id, path, file_size_bytes, last_seen_at)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            (
                video_id,
                scan_root_id,
                path.to_string_lossy().into_owned(),
                file_size_bytes,
                "2026-05-14T16:35:48Z",
            ),
        )
        .expect("file location persists");
}
