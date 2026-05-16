use super::*;

#[test]
fn listed_videos_include_preview_strip_status() {
    let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
    let catalog_path = temporary_folder.path().join("catalog.sqlite3");
    let catalog = Catalog::open(&catalog_path).expect("catalog opens");
    let database = catalog_test_database(&catalog_path);

    database
        .execute(
            "INSERT INTO videos (fingerprint, fingerprint_version, title, duration_milliseconds)
                 VALUES (?1, ?2, ?3, ?4)",
            ("generated-fingerprint", 1_i64, "Generated Trip", 1_000_i64),
        )
        .expect("generated video persists");
    database
        .execute(
            "INSERT INTO videos (fingerprint, fingerprint_version, title, duration_milliseconds)
                 VALUES (?1, ?2, ?3, ?4)",
            ("failed-fingerprint", 1_i64, "Failed Trip", 1_000_i64),
        )
        .expect("failed video persists");
    database
        .execute(
            "INSERT INTO preview_strips (video_id, path, frame_count, column_count, row_count)
                 VALUES (?1, ?2, ?3, ?4, ?5)",
            (
                1_i64,
                "/Users/michel/Library/Caches/preview-strips/video-1-preview-strip.jpg",
                40_i64,
                5_i64,
                8_i64,
            ),
        )
        .expect("preview strip persists");
    database
        .execute(
            "INSERT INTO failed_preview_strips (video_id, reason)
                 VALUES (?1, ?2)",
            (2_i64, "ffmpeg failed"),
        )
        .expect("failed preview strip persists");

    assert_eq!(
        catalog.listed_videos().expect("stored videos list"),
        vec![
            crate::catalog::CatalogVideo {
                id: 2,
                is_available: false,
                preview_strip: crate::catalog::PreviewStripStatus::Failed {
                    failure_reason: "ffmpeg failed".to_string(),
                },
                title: "Failed Trip".to_string(),
                duration_milliseconds: 1_000,
                file_size_bytes: None,
                file_location_path: None,
                file_locations: Vec::new(),
                is_favorite: false,
                last_opened_at: None,
                open_count: 0,
            },
            crate::catalog::CatalogVideo {
                id: 1,
                is_available: false,
                preview_strip: crate::catalog::PreviewStripStatus::Generated {
                    path: "/Users/michel/Library/Caches/preview-strips/video-1-preview-strip.jpg"
                        .to_string(),
                    frame_count: 40,
                    column_count: 5,
                    row_count: 8,
                },
                title: "Generated Trip".to_string(),
                duration_milliseconds: 1_000,
                file_size_bytes: None,
                file_location_path: None,
                file_locations: Vec::new(),
                is_favorite: false,
                last_opened_at: None,
                open_count: 0,
            },
        ]
    );
}

#[test]
fn preview_strip_generation_stores_one_cache_file_for_each_video_without_a_preview_strip() {
    let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
    let catalog_path = temporary_folder.path().join("catalog.sqlite3");
    let preview_cache_path = temporary_folder.path().join("Preview Cache");
    let catalog = Catalog::open(&catalog_path).expect("catalog opens");
    let movies_root = temporary_folder.path().join("Movies");
    std::fs::create_dir_all(&movies_root).expect("movies root exists");
    let scan_root = catalog
        .add_scan_root(&movies_root)
        .expect("movies scan root adds");
    let family_trip_path = movies_root.join("family-trip.mp4");
    std::fs::write(&family_trip_path, "valid video bytes").expect("video file exists");
    let video_file_probe = FakeVideoFileProbe::with_duration(21_000);
    catalog
        .refresh_scan_root(
            &scan_root.path,
            &video_file_probe,
            &crate::catalog::VideoExtensionAllowlist::default(),
        )
        .expect("scan root refreshes");
    let preview_strip_generator = FakePreviewStripGenerator::default();

    let generation_summary = crate::preview_generation::PreviewGenerationWork::new(
        &catalog,
        &preview_cache_path,
        &preview_strip_generator,
    )
    .process_missing_preview_strips()
    .expect("preview strips generate");

    assert_eq!(
        generation_summary,
        crate::catalog::PreviewStripGenerationSummary {
            generated_preview_strip_count: 1,
            failed_preview_strip_count: 0,
        }
    );
    let stored_preview_strips = stored_preview_strips(&catalog_path);
    assert_eq!(stored_preview_strips.len(), 1);
    assert_eq!(stored_preview_strips[0].video_id, 1);
    assert_eq!(stored_preview_strips[0].frame_count, 40);
    assert_eq!(stored_preview_strips[0].column_count, 5);
    assert_eq!(stored_preview_strips[0].row_count, 8);
    assert!(stored_preview_strips[0].path.ends_with(".jpg"));
    assert!(Path::new(&stored_preview_strips[0].path).exists());
}

#[test]
fn preview_strip_frames_are_generated_for_high_density_display() {
    assert_eq!(crate::catalog::PREVIEW_STRIP_FRAME_WIDTH_PIXELS, 640);
}

#[test]
fn preview_strip_queue_processes_one_pending_video_per_step() {
    let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
    let catalog_path = temporary_folder.path().join("catalog.sqlite3");
    let preview_cache_path = temporary_folder.path().join("Preview Cache");
    let catalog = Catalog::open(&catalog_path).expect("catalog opens");
    let movies_root = temporary_folder.path().join("Movies");
    std::fs::create_dir_all(&movies_root).expect("movies root exists");
    catalog
        .add_scan_root(&movies_root)
        .expect("movies scan root adds");
    let database = catalog_test_database(&catalog_path);
    for video_number in 1..=2 {
        database
                .execute(
                    "INSERT INTO videos (fingerprint, fingerprint_version, title, duration_milliseconds)
                     VALUES (?1, ?2, ?3, ?4)",
                    (
                        format!("fingerprint-{video_number}"),
                        1_i64,
                        format!("Trip {video_number}"),
                        21_000_i64,
                    ),
                )
                .expect("video persists");
        database
                .execute(
                    "INSERT INTO file_locations (video_id, scan_root_id, path, file_size_bytes, last_seen_at)
                     VALUES (?1, ?2, ?3, ?4, ?5)",
                    (
                        video_number,
                        1_i64,
                        movies_root
                            .join(format!("trip-{video_number}.mp4"))
                            .to_string_lossy()
                            .into_owned(),
                        17_i64,
                        "2026-05-14T16:35:48Z",
                    ),
                )
                .expect("file location persists");
    }
    let preview_strip_generator = FakePreviewStripGenerator::default();

    let first_generation_summary = crate::preview_generation::PreviewGenerationWork::new(
        &catalog,
        &preview_cache_path,
        &preview_strip_generator,
    )
    .process_next_preview_strip()
    .expect("first preview strip step completes");

    assert_eq!(
        first_generation_summary,
        crate::catalog::PreviewStripGenerationSummary {
            generated_preview_strip_count: 1,
            failed_preview_strip_count: 0,
        }
    );
    assert_eq!(count_rows(&database, "preview_strips"), 1);
    assert_eq!(
        catalog
            .preview_strip_queue_counts()
            .expect("preview queue status loads")
            .pending_count,
        1
    );
}

#[test]
fn preview_strip_generation_uses_one_file_location_for_duplicate_locations_of_the_same_video() {
    let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
    let catalog_path = temporary_folder.path().join("catalog.sqlite3");
    let preview_cache_path = temporary_folder.path().join("Preview Cache");
    let catalog = Catalog::open(&catalog_path).expect("catalog opens");
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
    let database = catalog_test_database(&catalog_path);
    database
        .execute(
            "INSERT INTO videos (fingerprint, fingerprint_version, title, duration_milliseconds)
                 VALUES (?1, ?2, ?3, ?4)",
            ("fingerprint-one", 1_i64, "Family Trip", 21_000_i64),
        )
        .expect("video persists");
    database
            .execute(
                "INSERT INTO file_locations (video_id, scan_root_id, path, file_size_bytes, last_seen_at)
                 VALUES (?1, ?2, ?3, ?4, ?5)",
                (
                    1_i64,
                    1_i64,
                    movies_root.join("family-trip.mp4").to_string_lossy().into_owned(),
                    17_i64,
                    "2026-05-14T16:35:48Z",
                ),
            )
            .expect("movies file location persists");
    database
            .execute(
                "INSERT INTO file_locations (video_id, scan_root_id, path, file_size_bytes, last_seen_at)
                 VALUES (?1, ?2, ?3, ?4, ?5)",
                (
                    1_i64,
                    2_i64,
                    backup_root.join("family-trip.mp4").to_string_lossy().into_owned(),
                    17_i64,
                    "2026-05-14T16:35:48Z",
                ),
            )
            .expect("backup file location persists");
    let preview_strip_generator = FakePreviewStripGenerator::default();

    crate::preview_generation::PreviewGenerationWork::new(
        &catalog,
        &preview_cache_path,
        &preview_strip_generator,
    )
    .process_missing_preview_strips()
    .expect("preview strips generate");
    crate::preview_generation::PreviewGenerationWork::new(
        &catalog,
        &preview_cache_path,
        &preview_strip_generator,
    )
    .process_missing_preview_strips()
    .expect("second preview strip pass is idempotent");

    assert_eq!(count_rows(&database, "preview_strips"), 1);
}

#[test]
fn preview_strip_generation_recreates_cache_files_that_were_removed() {
    let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
    let catalog_path = temporary_folder.path().join("catalog.sqlite3");
    let preview_cache_path = temporary_folder.path().join("Preview Cache");
    let catalog = Catalog::open(&catalog_path).expect("catalog opens");
    let movies_root = temporary_folder.path().join("Movies");
    std::fs::create_dir_all(&movies_root).expect("movies root exists");
    let scan_root = catalog
        .add_scan_root(&movies_root)
        .expect("movies scan root adds");
    let family_trip_path = movies_root.join("family-trip.mp4");
    std::fs::write(&family_trip_path, "valid video bytes").expect("video file exists");
    let video_file_probe = FakeVideoFileProbe::with_duration(21_000);
    catalog
        .refresh_scan_root(
            &scan_root.path,
            &video_file_probe,
            &crate::catalog::VideoExtensionAllowlist::default(),
        )
        .expect("scan root refreshes");
    let preview_strip_generator = FakePreviewStripGenerator::default();
    crate::preview_generation::PreviewGenerationWork::new(
        &catalog,
        &preview_cache_path,
        &preview_strip_generator,
    )
    .process_missing_preview_strips()
    .expect("preview strips generate");
    let first_preview_strip_path = stored_preview_strips(&catalog_path)[0].path.clone();
    std::fs::remove_file(&first_preview_strip_path).expect("preview cache file is removed");

    let generation_summary = crate::preview_generation::PreviewGenerationWork::new(
        &catalog,
        &preview_cache_path,
        &preview_strip_generator,
    )
    .process_missing_preview_strips()
    .expect("preview strips regenerate");

    assert_eq!(
        generation_summary,
        crate::catalog::PreviewStripGenerationSummary {
            generated_preview_strip_count: 1,
            failed_preview_strip_count: 0,
        }
    );
    assert!(Path::new(&first_preview_strip_path).exists());
}

#[test]
fn preview_strip_generation_continues_after_one_video_fails() {
    let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
    let catalog_path = temporary_folder.path().join("catalog.sqlite3");
    let preview_cache_path = temporary_folder.path().join("Preview Cache");
    let catalog = Catalog::open(&catalog_path).expect("catalog opens");
    let movies_root = temporary_folder.path().join("Movies");
    std::fs::create_dir_all(&movies_root).expect("movies root exists");
    catalog
        .add_scan_root(&movies_root)
        .expect("movies scan root adds");
    let database = catalog_test_database(&catalog_path);
    database
        .execute(
            "INSERT INTO videos (fingerprint, fingerprint_version, title, duration_milliseconds)
                 VALUES (?1, ?2, ?3, ?4)",
            ("fingerprint-one", 1_i64, "Broken Trip", 21_000_i64),
        )
        .expect("first video persists");
    database
        .execute(
            "INSERT INTO videos (fingerprint, fingerprint_version, title, duration_milliseconds)
                 VALUES (?1, ?2, ?3, ?4)",
            ("fingerprint-two", 1_i64, "Family Trip", 21_000_i64),
        )
        .expect("second video persists");
    database
            .execute(
                "INSERT INTO file_locations (video_id, scan_root_id, path, file_size_bytes, last_seen_at)
                 VALUES (?1, ?2, ?3, ?4, ?5)",
                (
                    1_i64,
                    1_i64,
                    movies_root.join("broken-trip.mp4").to_string_lossy().into_owned(),
                    17_i64,
                    "2026-05-14T16:35:48Z",
                ),
            )
            .expect("first file location persists");
    database
            .execute(
                "INSERT INTO file_locations (video_id, scan_root_id, path, file_size_bytes, last_seen_at)
                 VALUES (?1, ?2, ?3, ?4, ?5)",
                (
                    2_i64,
                    1_i64,
                    movies_root.join("family-trip.mp4").to_string_lossy().into_owned(),
                    17_i64,
                    "2026-05-14T16:35:48Z",
                ),
            )
            .expect("second file location persists");
    let preview_strip_generator = FakePreviewStripGenerator::failing_for_video(1, "ffmpeg failed");

    let generation_summary = crate::preview_generation::PreviewGenerationWork::new(
        &catalog,
        &preview_cache_path,
        &preview_strip_generator,
    )
    .process_missing_preview_strips()
    .expect("preview strip batch completes");

    assert_eq!(
        generation_summary,
        crate::catalog::PreviewStripGenerationSummary {
            generated_preview_strip_count: 1,
            failed_preview_strip_count: 1,
        }
    );
    assert_eq!(count_rows(&database, "preview_strips"), 1);
    assert_eq!(count_rows(&database, "failed_preview_strips"), 1);
}

#[test]
fn failed_preview_strips_are_listed_for_review_until_ignored() {
    let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
    let catalog_path = temporary_folder.path().join("catalog.sqlite3");
    let catalog = Catalog::open(&catalog_path).expect("catalog opens");
    let database = catalog_test_database(&catalog_path);
    database
        .execute(
            "INSERT INTO videos (fingerprint, fingerprint_version, title, duration_milliseconds)
                 VALUES (?1, ?2, ?3, ?4)",
            ("fingerprint-one", 1_i64, "Broken Trip", 21_000_i64),
        )
        .expect("video persists");
    database
        .execute(
            "INSERT INTO failed_preview_strips (video_id, reason)
                 VALUES (?1, ?2)",
            (1_i64, "ffmpeg failed"),
        )
        .expect("failed preview strip persists");

    assert_eq!(
        catalog
            .list_failed_preview_strips()
            .expect("failed preview strips list"),
        vec![FailedPreviewStrip {
            video_id: 1,
            title: "Broken Trip".to_string(),
            failure_reason: "ffmpeg failed".to_string(),
        }]
    );

    catalog
        .ignore_failed_preview_strip(1)
        .expect("failed preview strip ignores");

    assert_eq!(
        catalog
            .list_failed_preview_strips()
            .expect("ignored failed preview strips are hidden"),
        Vec::<FailedPreviewStrip>::new()
    );
}

#[test]
fn failed_preview_strips_can_be_manually_retried_after_failure_or_ignore() {
    let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
    let catalog_path = temporary_folder.path().join("catalog.sqlite3");
    let preview_cache_path = temporary_folder.path().join("Preview Cache");
    let catalog = Catalog::open(&catalog_path).expect("catalog opens");
    let movies_root = temporary_folder.path().join("Movies");
    std::fs::create_dir_all(&movies_root).expect("movies root exists");
    catalog
        .add_scan_root(&movies_root)
        .expect("movies scan root adds");
    let database = catalog_test_database(&catalog_path);
    database
        .execute(
            "INSERT INTO videos (fingerprint, fingerprint_version, title, duration_milliseconds)
                 VALUES (?1, ?2, ?3, ?4)",
            ("fingerprint-one", 1_i64, "Broken Trip", 21_000_i64),
        )
        .expect("video persists");
    database
            .execute(
                "INSERT INTO file_locations (video_id, scan_root_id, path, file_size_bytes, last_seen_at)
                 VALUES (?1, ?2, ?3, ?4, ?5)",
                (
                    1_i64,
                    1_i64,
                    movies_root.join("broken-trip.mp4").to_string_lossy().into_owned(),
                    17_i64,
                    "2026-05-14T16:35:48Z",
                ),
            )
            .expect("file location persists");
    database
        .execute(
            "INSERT INTO failed_preview_strips (video_id, reason, ignored_at)
                 VALUES (?1, ?2, CURRENT_TIMESTAMP)",
            (1_i64, "ffmpeg failed"),
        )
        .expect("ignored failed preview strip persists");
    let preview_strip_generator = FakePreviewStripGenerator::default();

    catalog
        .retry_failed_preview_strip(1, PreviewStripRetryReason::Manual)
        .expect("failed preview strip retries");
    let generation_summary = crate::preview_generation::PreviewGenerationWork::new(
        &catalog,
        &preview_cache_path,
        &preview_strip_generator,
    )
    .process_missing_preview_strips()
    .expect("retry generates preview strip");

    assert_eq!(
        generation_summary,
        crate::catalog::PreviewStripGenerationSummary {
            generated_preview_strip_count: 1,
            failed_preview_strip_count: 0,
        }
    );
    assert_eq!(count_rows(&database, "failed_preview_strips"), 0);
    assert_eq!(count_rows(&database, "preview_strips"), 1);
}

#[test]
fn ignored_failed_preview_strips_are_retried_when_ffmpeg_configuration_changes() {
    let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
    let catalog_path = temporary_folder.path().join("catalog.sqlite3");
    let preview_cache_path = temporary_folder.path().join("Preview Cache");
    let catalog = Catalog::open(&catalog_path).expect("catalog opens");
    let movies_root = temporary_folder.path().join("Movies");
    std::fs::create_dir_all(&movies_root).expect("movies root exists");
    catalog
        .add_scan_root(&movies_root)
        .expect("movies scan root adds");
    let database = catalog_test_database(&catalog_path);
    database
        .execute(
            "INSERT INTO videos (fingerprint, fingerprint_version, title, duration_milliseconds)
                 VALUES (?1, ?2, ?3, ?4)",
            ("fingerprint-one", 1_i64, "Broken Trip", 21_000_i64),
        )
        .expect("video persists");
    database
            .execute(
                "INSERT INTO file_locations (video_id, scan_root_id, path, file_size_bytes, last_seen_at)
                 VALUES (?1, ?2, ?3, ?4, ?5)",
                (
                    1_i64,
                    1_i64,
                    movies_root.join("broken-trip.mp4").to_string_lossy().into_owned(),
                    17_i64,
                    "2026-05-14T16:35:48Z",
                ),
            )
            .expect("file location persists");
    database
        .execute(
            "INSERT INTO failed_preview_strips (video_id, reason, ignored_at)
                 VALUES (?1, ?2, CURRENT_TIMESTAMP)",
            (1_i64, "ffmpeg failed"),
        )
        .expect("ignored failed preview strip persists");

    catalog
        .retry_ignored_failed_preview_strips(PreviewStripRetryReason::FfmpegConfigurationChanged)
        .expect("ignored failures retry");
    let preview_strip_generator = FakePreviewStripGenerator::default();
    let generation_summary = crate::preview_generation::PreviewGenerationWork::new(
        &catalog,
        &preview_cache_path,
        &preview_strip_generator,
    )
    .process_missing_preview_strips()
    .expect("ignored failure regenerates");

    assert_eq!(
        generation_summary,
        crate::catalog::PreviewStripGenerationSummary {
            generated_preview_strip_count: 1,
            failed_preview_strip_count: 0,
        }
    );
    assert_eq!(count_rows(&database, "failed_preview_strips"), 0);
}

#[test]
fn unchanged_scan_root_refresh_keeps_ignored_failed_preview_strips_ignored() {
    let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
    let catalog_path = temporary_folder.path().join("catalog.sqlite3");
    let catalog = Catalog::open(&catalog_path).expect("catalog opens");
    let movies_root = temporary_folder.path().join("Movies");
    std::fs::create_dir_all(&movies_root).expect("movies root exists");
    let scan_root = catalog
        .add_scan_root(&movies_root)
        .expect("movies scan root adds");
    let family_trip_path = movies_root.join("family-trip.mp4");
    std::fs::write(&family_trip_path, "valid video bytes").expect("video file exists");
    let video_file_probe = FakeVideoFileProbe::with_duration(21_000);
    catalog
        .refresh_scan_root(
            &scan_root.path,
            &video_file_probe,
            &crate::catalog::VideoExtensionAllowlist::default(),
        )
        .expect("scan root refreshes");
    catalog
        .store_failed_preview_strip(1, "ffmpeg failed")
        .expect("failed preview strip stores");
    catalog
        .ignore_failed_preview_strip(1)
        .expect("failed preview strip ignores");

    catalog
        .refresh_scan_root(
            &scan_root.path,
            &video_file_probe,
            &crate::catalog::VideoExtensionAllowlist::default(),
        )
        .expect("unchanged scan root refreshes");

    assert_eq!(
        catalog
            .list_failed_preview_strips()
            .expect("failed preview strips list"),
        Vec::<FailedPreviewStrip>::new()
    );
}
