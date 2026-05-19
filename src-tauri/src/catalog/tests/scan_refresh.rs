use super::*;

#[test]
fn catalog_persists_scan_roots_and_rejects_overlapping_paths() {
    let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
    let catalog_path = temporary_folder.path().join("catalog.sqlite3");
    let catalog = Catalog::open(&catalog_path).expect("catalog opens");

    let movies_root = temporary_folder.path().join("Movies");
    let documentaries_root = temporary_folder.path().join("Documentaries");
    std::fs::create_dir_all(&movies_root).expect("movies root exists");
    std::fs::create_dir_all(&documentaries_root).expect("documentaries root exists");

    catalog
        .add_scan_root(&movies_root)
        .expect("movies scan root adds");
    catalog
        .add_scan_root(&documentaries_root)
        .expect("documentaries scan root adds");

    assert_eq!(
        catalog.list_scan_roots().expect("scan roots list"),
        vec![
            crate::catalog::ScanRoot {
                inference_rules: crate::catalog::ScanRootInferenceRules::default(),
                is_available: true,
                path: documentaries_root
                    .canonicalize()
                    .expect("documentaries path canonicalizes")
                    .to_string_lossy()
                    .into_owned(),
            },
            crate::catalog::ScanRoot {
                inference_rules: crate::catalog::ScanRootInferenceRules::default(),
                is_available: true,
                path: movies_root
                    .canonicalize()
                    .expect("movies path canonicalizes")
                    .to_string_lossy()
                    .into_owned(),
            },
        ]
    );

    let nested_movies_root = movies_root.join("Family");
    std::fs::create_dir_all(&nested_movies_root).expect("nested movies root exists");
    let add_nested_root_error = catalog
        .add_scan_root(&nested_movies_root)
        .expect_err("nested scan root is rejected");

    assert_eq!(
        add_nested_root_error,
        "Scan Root overlaps with an existing Scan Root"
    );
}

#[test]
fn listed_missing_videos_are_explicitly_unavailable() {
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
    let video_file_probe = FakeVideoFileProbe::with_duration(1_000);
    catalog
        .refresh_scan_root(
            &scan_root.path,
            &video_file_probe,
            &crate::catalog::VideoExtensionAllowlist::default(),
        )
        .expect("initial scan root refreshes");
    std::fs::remove_file(&family_trip_path).expect("video file is removed");
    catalog
        .refresh_scan_root(
            &scan_root.path,
            &video_file_probe,
            &crate::catalog::VideoExtensionAllowlist::default(),
        )
        .expect("second scan root refreshes");

    assert_eq!(
        catalog.listed_videos().expect("stored videos list"),
        vec![crate::catalog::CatalogVideo {
            id: 1,
            is_available: false,
            preview_strip: crate::catalog::PreviewStripStatus::Pending,
            title: "family-trip".to_string(),
            duration_milliseconds: 1_000,
            file_size_bytes: None,
            file_location_path: None,
            file_locations: Vec::new(),
            is_favorite: false,
            last_opened_at: None,
            open_count: 0,
        }]
    );
}

#[test]
fn unreachable_scan_root_refresh_can_complete_without_a_video_file_probe() {
    let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
    let catalog_path = temporary_folder.path().join("catalog.sqlite3");
    let catalog = Catalog::open(&catalog_path).expect("catalog opens");
    let movies_root = temporary_folder.path().join("Movies");
    std::fs::create_dir_all(&movies_root).expect("movies root exists");
    let scan_root = catalog
        .add_scan_root(&movies_root)
        .expect("movies scan root adds");
    std::fs::remove_dir_all(&movies_root).expect("scan root becomes unreachable");

    let refresh_summary = catalog
        .refresh_scan_root_if_unreachable(&scan_root.path)
        .expect("unreachable scan root refreshes without probe");

    assert_eq!(
        refresh_summary,
        Some(crate::catalog::ScanRootRefreshSummary {
            scanned_video_count: 0,
            unprocessable_candidate_count: 0,
        })
    );
    assert_eq!(
        catalog.list_scan_roots().expect("scan roots list"),
        vec![crate::catalog::ScanRoot {
            inference_rules: crate::catalog::ScanRootInferenceRules::default(),
            is_available: false,
            path: scan_root.path,
        }]
    );
}

#[test]
fn refreshing_all_scan_roots_updates_each_root_and_marks_missing_videos() {
    let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
    let catalog_path = temporary_folder.path().join("catalog.sqlite3");
    let catalog = Catalog::open(&catalog_path).expect("catalog opens");
    let available_root = temporary_folder.path().join("Available Movies");
    let unavailable_root = temporary_folder.path().join("Missing Movies");
    std::fs::create_dir_all(&available_root).expect("available root exists");
    std::fs::create_dir_all(&unavailable_root).expect("unavailable root exists");
    let available_scan_root = catalog
        .add_scan_root(&available_root)
        .expect("available scan root adds");
    let unavailable_scan_root = catalog
        .add_scan_root(&unavailable_root)
        .expect("unavailable scan root adds");
    let family_trip_path = available_root.join("family-trip.mp4");
    let archived_trip_path = unavailable_root.join("archived-trip.mp4");
    std::fs::write(&family_trip_path, "valid video bytes").expect("family video exists");
    std::fs::write(&archived_trip_path, "archived video bytes").expect("archived video exists");
    let video_file_probe = FakeVideoFileProbe::with_duration(1_000);
    catalog
        .refresh_all_scan_roots(
            &video_file_probe,
            &crate::catalog::VideoExtensionAllowlist::default(),
        )
        .expect("initial all scan roots refresh");
    std::fs::remove_dir_all(&unavailable_root).expect("one root becomes unavailable");

    let refresh_summary = catalog
        .refresh_all_scan_roots(
            &video_file_probe,
            &crate::catalog::VideoExtensionAllowlist::default(),
        )
        .expect("all scan roots refresh");

    assert_eq!(
        refresh_summary,
        crate::catalog::ScanRootRefreshSummary {
            scanned_video_count: 1,
            unprocessable_candidate_count: 0,
        }
    );
    assert_eq!(
        catalog.list_scan_roots().expect("scan roots list"),
        vec![
            crate::catalog::ScanRoot {
                inference_rules: crate::catalog::ScanRootInferenceRules::default(),
                is_available: true,
                path: available_scan_root.path,
            },
            crate::catalog::ScanRoot {
                inference_rules: crate::catalog::ScanRootInferenceRules::default(),
                is_available: false,
                path: unavailable_scan_root.path,
            },
        ]
    );
    assert_eq!(
        catalog.listed_videos().expect("stored videos list"),
        vec![
            crate::catalog::CatalogVideo {
                id: 2,
                is_available: false,
                preview_strip: crate::catalog::PreviewStripStatus::Pending,
                title: "archived-trip".to_string(),
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
                is_available: true,
                preview_strip: crate::catalog::PreviewStripStatus::Pending,
                title: "family-trip".to_string(),
                duration_milliseconds: 1_000,
                file_size_bytes: Some(17),
                file_location_path: Some(
                    family_trip_path
                        .canonicalize()
                        .expect("family trip path canonicalizes")
                        .to_string_lossy()
                        .into_owned()
                ),
                file_locations: vec![crate::catalog::CatalogVideoFileLocation {
                    path: family_trip_path
                        .canonicalize()
                        .expect("family trip path canonicalizes")
                        .to_string_lossy()
                        .into_owned(),
                    file_size_bytes: 17,
                    is_preferred: true,
                }],
                is_favorite: false,
                last_opened_at: None,
                open_count: 0,
            },
        ]
    );
}

#[test]
fn removing_scan_root_can_preserve_affected_videos_as_missing() {
    let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
    let catalog_path = temporary_folder.path().join("catalog.sqlite3");
    let catalog = Catalog::open(&catalog_path).expect("catalog opens");
    let movies_root = temporary_folder.path().join("Movies");
    std::fs::create_dir_all(&movies_root).expect("movies root exists");
    let scan_root = catalog
        .add_scan_root(&movies_root)
        .expect("movies scan root adds");

    catalog_test_database(&catalog_path)
        .execute(
            "INSERT INTO videos (fingerprint, fingerprint_version, title, duration_milliseconds)
                 VALUES (?1, ?2, ?3, ?4)",
            ("fingerprint-one", 1_i64, "Family Trip", 3723000_i64),
        )
        .expect("video persists");
    catalog_test_database(&catalog_path)
            .execute(
                "INSERT INTO file_locations (video_id, scan_root_id, path, file_size_bytes, last_seen_at)
                 VALUES (?1, ?2, ?3, ?4, ?5)",
                (
                    1_i64,
                    1_i64,
                    movies_root.join("family-trip.mp4").to_string_lossy().into_owned(),
                    80740352_i64,
                    "2026-05-14T16:35:48Z",
                ),
            )
            .expect("file location persists");

    catalog
        .remove_scan_root_preserving_missing_videos(&scan_root.path)
        .expect("scan root removes");

    let database = catalog_test_database(&catalog_path);
    assert_eq!(count_rows(&database, "scan_roots"), 0);
    assert_eq!(count_rows(&database, "file_locations"), 0);
    assert_eq!(count_rows(&database, "videos"), 1);
    assert_eq!(
        catalog.listed_videos().expect("stored videos list"),
        vec![crate::catalog::CatalogVideo {
            id: 1,
            is_available: false,
            preview_strip: crate::catalog::PreviewStripStatus::Pending,
            title: "Family Trip".to_string(),
            duration_milliseconds: 3723000,
            file_size_bytes: None,
            file_location_path: None,
            file_locations: Vec::new(),
            is_favorite: false,
            last_opened_at: None,
            open_count: 0,
        }]
    );
}

#[test]
fn refreshing_a_scan_root_recursively_stores_probeable_videos() {
    let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
    let catalog_path = temporary_folder.path().join("catalog.sqlite3");
    let catalog = Catalog::open(&catalog_path).expect("catalog opens");
    let movies_root = temporary_folder.path().join("Movies");
    let family_folder = movies_root.join("Family");
    std::fs::create_dir_all(&family_folder).expect("family folder exists");
    let scan_root = catalog
        .add_scan_root(&movies_root)
        .expect("movies scan root adds");
    let family_trip_path = family_folder.join("Family Trip.FLV");
    std::fs::write(&family_trip_path, "video bytes").expect("video file exists");
    let video_file_probe = FakeVideoFileProbe::with_duration(3_723_000);

    let refresh_summary = catalog
        .refresh_scan_root(
            &scan_root.path,
            &video_file_probe,
            &crate::catalog::VideoExtensionAllowlist::default(),
        )
        .expect("scan root refreshes");

    assert_eq!(
        refresh_summary,
        crate::catalog::ScanRootRefreshSummary {
            scanned_video_count: 1,
            unprocessable_candidate_count: 0,
        }
    );
    let expected_family_trip_path = family_trip_path
        .canonicalize()
        .expect("family trip path canonicalizes");
    assert_eq!(
        catalog.listed_videos().expect("stored videos list"),
        vec![crate::catalog::CatalogVideo {
            id: 1,
            is_available: true,
            preview_strip: crate::catalog::PreviewStripStatus::Pending,
            title: "Family Trip".to_string(),
            duration_milliseconds: 3_723_000,
            file_size_bytes: Some(11),
            file_location_path: Some(expected_family_trip_path.to_string_lossy().into_owned()),
            file_locations: vec![crate::catalog::CatalogVideoFileLocation {
                path: expected_family_trip_path.to_string_lossy().into_owned(),
                file_size_bytes: 11,
                is_preferred: true,
            }],
            is_favorite: false,
            last_opened_at: None,
            open_count: 0,
        }]
    );
}

#[test]
fn refreshing_a_scan_root_derives_new_video_titles_from_cleaned_filename_stems() {
    let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
    let catalog_path = temporary_folder.path().join("catalog.sqlite3");
    let catalog = Catalog::open(&catalog_path).expect("catalog opens");
    let movies_root = temporary_folder.path().join("Movies");
    std::fs::create_dir_all(&movies_root).expect("movies root exists");
    let scan_root = catalog
        .add_scan_root(&movies_root)
        .expect("movies scan root adds");
    let filename_examples = [
        (
            "Advanced [Tag - 1080p] Training (Part 1) - Pornhub.com.mp4",
            "Advanced Training (Part 1)",
            "advanced bytes",
        ),
        (
            "4K Extreme Training - 1920x1080.mkv",
            "4K Extreme Training",
            "extreme bytes",
        ),
        (
            "720p - City Walk - Google Chrome 2026-05-17 21-30-45.mov",
            "City Walk",
            "city bytes",
        ),
        ("[HD] [1080p].mp4", "[HD] [1080p]", "fallback bytes"),
        (
            "Title - [Metadata] - - Scene - Pornhubcom.mp4",
            "Title - Scene",
            "scene bytes",
        ),
    ];

    for (filename, _expected_title, file_bytes) in filename_examples {
        std::fs::write(movies_root.join(filename), file_bytes).expect("video file exists");
    }
    let video_file_probe = FakeVideoFileProbe::with_duration(1_000);

    catalog
        .refresh_scan_root(
            &scan_root.path,
            &video_file_probe,
            &crate::catalog::VideoExtensionAllowlist::default(),
        )
        .expect("scan root refreshes");

    let mut actual_titles = listed_video_titles(&catalog);
    actual_titles.sort();
    let mut expected_titles = filename_examples
        .into_iter()
        .map(|(_filename, expected_title, _file_bytes)| expected_title.to_string())
        .collect::<Vec<_>>();
    expected_titles.sort();
    assert_eq!(actual_titles, expected_titles);
}

#[test]
fn refreshing_a_scan_root_keeps_existing_video_titles_on_rescan() {
    let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
    let catalog_path = temporary_folder.path().join("catalog.sqlite3");
    let catalog = Catalog::open(&catalog_path).expect("catalog opens");
    let movies_root = temporary_folder.path().join("Movies");
    std::fs::create_dir_all(&movies_root).expect("movies root exists");
    let scan_root = catalog
        .add_scan_root(&movies_root)
        .expect("movies scan root adds");
    let family_trip_path = movies_root.join("Family Trip [HD].mp4");
    std::fs::write(&family_trip_path, "valid video bytes").expect("video file exists");
    let video_file_probe = FakeVideoFileProbe::with_duration(1_000);
    catalog
        .refresh_scan_root(
            &scan_root.path,
            &video_file_probe,
            &crate::catalog::VideoExtensionAllowlist::default(),
        )
        .expect("initial scan root refreshes");
    catalog
        .update_video_title(1, "Manual Family Title")
        .expect("title updates");

    catalog
        .refresh_scan_root(
            &scan_root.path,
            &video_file_probe,
            &crate::catalog::VideoExtensionAllowlist::default(),
        )
        .expect("second scan root refreshes");

    assert_eq!(listed_video_titles(&catalog), vec!["Manual Family Title"]);
}

#[test]
fn refreshing_a_scan_root_ignores_hidden_video_candidates() {
    let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
    let catalog_path = temporary_folder.path().join("catalog.sqlite3");
    let catalog = Catalog::open(&catalog_path).expect("catalog opens");
    let movies_root = temporary_folder.path().join("Movies");
    let hidden_folder = movies_root.join(".Hidden");
    std::fs::create_dir_all(&hidden_folder).expect("hidden folder exists");
    let scan_root = catalog
        .add_scan_root(&movies_root)
        .expect("movies scan root adds");
    let visible_trip_path = movies_root.join("family-trip.mp4");
    let hidden_trip_path = movies_root.join(".hidden-trip.mp4");
    let hidden_folder_trip_path = hidden_folder.join("folder-trip.mp4");
    std::fs::write(&visible_trip_path, "visible video bytes").expect("visible video exists");
    std::fs::write(&hidden_trip_path, "hidden video bytes").expect("hidden video exists");
    std::fs::write(&hidden_folder_trip_path, "folder video bytes")
        .expect("hidden folder video exists");
    let video_file_probe = FakeVideoFileProbe::with_duration(1_000);

    let refresh_summary = catalog
        .refresh_scan_root(
            &scan_root.path,
            &video_file_probe,
            &crate::catalog::VideoExtensionAllowlist::default(),
        )
        .expect("scan root refreshes");

    assert_eq!(
        refresh_summary,
        crate::catalog::ScanRootRefreshSummary {
            scanned_video_count: 1,
            unprocessable_candidate_count: 0,
        }
    );
    let listed_videos = catalog.listed_videos().expect("stored videos list");
    assert_eq!(listed_videos.len(), 1);
    assert_eq!(listed_videos[0].title, "family-trip");
}

#[test]
fn refreshing_a_scan_root_stores_unprocessable_candidates_without_discarding_progress() {
    let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
    let catalog_path = temporary_folder.path().join("catalog.sqlite3");
    let catalog = Catalog::open(&catalog_path).expect("catalog opens");
    let movies_root = temporary_folder.path().join("Movies");
    std::fs::create_dir_all(&movies_root).expect("movies root exists");
    let scan_root = catalog
        .add_scan_root(&movies_root)
        .expect("movies scan root adds");
    let family_trip_path = movies_root.join("family-trip.mp4");
    let broken_video_path = movies_root.join("broken-video.mkv");
    let ignored_document_path = movies_root.join("notes.txt");
    std::fs::write(&family_trip_path, "valid video bytes").expect("valid video exists");
    std::fs::write(&broken_video_path, "broken").expect("broken video exists");
    std::fs::write(&ignored_document_path, "not video").expect("document exists");
    let canonical_broken_video_path = broken_video_path
        .canonicalize()
        .expect("broken video path canonicalizes");
    let video_file_probe = FakeVideoFileProbe::failing_for(
        canonical_broken_video_path.to_string_lossy().into_owned(),
        "missing moov atom",
    );

    let refresh_summary = catalog
        .refresh_scan_root(
            &scan_root.path,
            &video_file_probe,
            &crate::catalog::VideoExtensionAllowlist::default(),
        )
        .expect("scan root refreshes");

    assert_eq!(
        refresh_summary,
        crate::catalog::ScanRootRefreshSummary {
            scanned_video_count: 1,
            unprocessable_candidate_count: 1,
        }
    );
    let expected_family_trip_path = family_trip_path
        .canonicalize()
        .expect("family trip path canonicalizes");
    assert_eq!(
        catalog.listed_videos().expect("stored videos list"),
        vec![crate::catalog::CatalogVideo {
            id: 1,
            is_available: true,
            preview_strip: crate::catalog::PreviewStripStatus::Pending,
            title: "family-trip".to_string(),
            duration_milliseconds: 1_000,
            file_size_bytes: Some(17),
            file_location_path: Some(expected_family_trip_path.to_string_lossy().into_owned()),
            file_locations: vec![crate::catalog::CatalogVideoFileLocation {
                path: expected_family_trip_path.to_string_lossy().into_owned(),
                file_size_bytes: 17,
                is_preferred: true,
            }],
            is_favorite: false,
            last_opened_at: None,
            open_count: 0,
        }]
    );
    assert_eq!(
        catalog
            .list_unprocessable_video_candidates_by_scan_root()
            .expect("unprocessable candidates grouped by Scan Root"),
        vec![crate::catalog::UnprocessableVideoCandidateGroup {
            scan_root_path: scan_root.path,
            candidate_count: 1,
            candidates: vec![crate::catalog::UnprocessableVideoCandidate {
                path: canonical_broken_video_path.to_string_lossy().into_owned(),
                reason: "missing moov atom".to_string(),
                file_size_bytes: 6,
            }],
        }]
    );
}

#[test]
fn listing_unprocessable_candidates_by_scan_root_returns_all_candidate_details() {
    let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
    let catalog_path = temporary_folder.path().join("catalog.sqlite3");
    let catalog = Catalog::open(&catalog_path).expect("catalog opens");
    let movies_root = temporary_folder.path().join("Movies");
    std::fs::create_dir_all(&movies_root).expect("movies root exists");
    let scan_root = catalog
        .add_scan_root(&movies_root)
        .expect("movies scan root adds");
    for candidate_number in 1..=21 {
        let broken_video_path = movies_root.join(format!("broken-{candidate_number:02}.mkv"));
        std::fs::write(&broken_video_path, "broken").expect("broken video exists");
    }

    catalog
        .refresh_scan_root(
            &scan_root.path,
            &AlwaysFailingVideoFileProbe,
            &crate::catalog::VideoExtensionAllowlist::default(),
        )
        .expect("scan root refreshes");

    let candidate_groups = catalog
        .list_unprocessable_video_candidates_by_scan_root()
        .expect("unprocessable candidates grouped by Scan Root");

    assert_eq!(candidate_groups.len(), 1);
    assert_eq!(candidate_groups[0].scan_root_path, scan_root.path);
    assert_eq!(candidate_groups[0].candidate_count, 21);
    assert_eq!(candidate_groups[0].candidates.len(), 21);
    assert!(candidate_groups[0]
        .candidates
        .iter()
        .all(|candidate| candidate.reason == "ffprobe failed"));
}

#[test]
fn cancelled_scan_root_refresh_keeps_processed_results_without_cleanup_or_suggestions() {
    let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
    let catalog_path = temporary_folder.path().join("catalog.sqlite3");
    let catalog = Catalog::open(&catalog_path).expect("catalog opens");
    let movies_root = temporary_folder.path().join("Movies");
    let family_folder = movies_root.join("Family");
    std::fs::create_dir_all(&family_folder).expect("family folder exists");
    let scan_root = catalog
        .add_scan_root(&movies_root)
        .expect("movies scan root adds");
    let family_trip_path = family_folder.join("family-trip.mp4");
    let city_walk_path = family_folder.join("city-walk.mp4");
    std::fs::write(&family_trip_path, "valid video bytes").expect("valid video exists");
    std::fs::write(&city_walk_path, "more valid video bytes").expect("second video exists");
    let video_file_probe = FakeVideoFileProbe::with_duration(1_000);

    let refresh_summary = catalog
        .refresh_scan_root_until_cancelled(
            &scan_root.path,
            &video_file_probe,
            &crate::catalog::VideoExtensionAllowlist::default(),
            1,
        )
        .expect("scan root refresh cancels cleanly");

    assert_eq!(
        refresh_summary,
        crate::catalog::ScanRootRefreshSummary {
            scanned_video_count: 1,
            unprocessable_candidate_count: 0,
        }
    );
    assert_eq!(
        catalog.listed_videos().expect("stored videos list").len(),
        1
    );
    assert_eq!(
        metadata_suggestions(&catalog.database),
        Vec::<(String, String)>::new()
    );
}

struct AlwaysFailingVideoFileProbe;

impl VideoFileProbe for AlwaysFailingVideoFileProbe {
    fn probe_video_file(&self, _video_path: &std::path::Path) -> Result<VideoProbe, String> {
        Err("ffprobe failed".to_string())
    }
}

#[test]
fn cancelling_after_all_candidates_still_skips_stale_cleanup_and_suggestions() {
    let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
    let catalog_path = temporary_folder.path().join("catalog.sqlite3");
    let catalog = Catalog::open(&catalog_path).expect("catalog opens");
    let movies_root = temporary_folder.path().join("Movies");
    let family_folder = movies_root.join("Family");
    std::fs::create_dir_all(&family_folder).expect("family folder exists");
    let scan_root = catalog
        .add_scan_root(&movies_root)
        .expect("movies scan root adds");
    let family_trip_path = family_folder.join("family-trip.mp4");
    let city_walk_path = family_folder.join("city-walk.mp4");
    std::fs::write(&family_trip_path, "valid video bytes").expect("valid video exists");
    std::fs::write(&city_walk_path, "more valid video bytes").expect("second video exists");
    let video_file_probe = FakeVideoFileProbe::with_duration(1_000);

    catalog
        .refresh_scan_root(
            &scan_root.path,
            &video_file_probe,
            &crate::catalog::VideoExtensionAllowlist::default(),
        )
        .expect("initial scan root refreshes");
    std::fs::remove_file(&city_walk_path).expect("second video disappears");

    let refresh_summary = catalog
        .refresh_scan_root_until_cancelled(
            &scan_root.path,
            &video_file_probe,
            &crate::catalog::VideoExtensionAllowlist::default(),
            1,
        )
        .expect("scan root refresh cancels after processing all visible candidates");

    assert_eq!(
        refresh_summary,
        crate::catalog::ScanRootRefreshSummary {
            scanned_video_count: 1,
            unprocessable_candidate_count: 0,
        }
    );
    assert_eq!(
        catalog.listed_videos().expect("stored videos list").len(),
        2
    );
    assert_eq!(
        metadata_suggestions(&catalog.database),
        vec![
            ("Family".to_string(), "tag".to_string()),
            ("Family".to_string(), "tag".to_string()),
        ]
    );
}

#[test]
fn refreshing_a_scan_root_removes_file_locations_that_are_no_longer_present() {
    let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
    let catalog_path = temporary_folder.path().join("catalog.sqlite3");
    let catalog = Catalog::open(&catalog_path).expect("catalog opens");
    let movies_root = temporary_folder.path().join("Movies");
    std::fs::create_dir_all(&movies_root).expect("movies root exists");
    let scan_root = catalog
        .add_scan_root(&movies_root)
        .expect("movies scan root adds");
    let family_trip_path = movies_root.join("family-trip.mp4");
    std::fs::write(&family_trip_path, "valid video bytes").expect("valid video exists");
    let video_file_probe = FakeVideoFileProbe::with_duration(1_000);
    catalog
        .refresh_scan_root(
            &scan_root.path,
            &video_file_probe,
            &crate::catalog::VideoExtensionAllowlist::default(),
        )
        .expect("initial scan root refreshes");
    std::fs::remove_file(&family_trip_path).expect("video file is removed");

    let refresh_summary = catalog
        .refresh_scan_root(
            &scan_root.path,
            &video_file_probe,
            &crate::catalog::VideoExtensionAllowlist::default(),
        )
        .expect("second scan root refreshes");

    assert_eq!(
        refresh_summary,
        crate::catalog::ScanRootRefreshSummary {
            scanned_video_count: 0,
            unprocessable_candidate_count: 0,
        }
    );
    assert_eq!(
        catalog.listed_videos().expect("stored videos list"),
        vec![crate::catalog::CatalogVideo {
            id: 1,
            is_available: false,
            preview_strip: crate::catalog::PreviewStripStatus::Pending,
            title: "family-trip".to_string(),
            duration_milliseconds: 1_000,
            file_size_bytes: None,
            file_location_path: None,
            file_locations: Vec::new(),
            is_favorite: false,
            last_opened_at: None,
            open_count: 0,
        }]
    );
}

#[test]
fn refreshing_a_scan_root_replaces_a_previous_file_location_with_an_unprocessable_candidate() {
    let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
    let catalog_path = temporary_folder.path().join("catalog.sqlite3");
    let catalog = Catalog::open(&catalog_path).expect("catalog opens");
    let movies_root = temporary_folder.path().join("Movies");
    std::fs::create_dir_all(&movies_root).expect("movies root exists");
    let scan_root = catalog
        .add_scan_root(&movies_root)
        .expect("movies scan root adds");
    let family_trip_path = movies_root.join("family-trip.mp4");
    std::fs::write(&family_trip_path, "valid video bytes").expect("valid video exists");
    let successful_video_file_probe = FakeVideoFileProbe::with_duration(1_000);
    catalog
        .refresh_scan_root(
            &scan_root.path,
            &successful_video_file_probe,
            &crate::catalog::VideoExtensionAllowlist::default(),
        )
        .expect("initial scan root refreshes");
    let canonical_family_trip_path = family_trip_path
        .canonicalize()
        .expect("family trip path canonicalizes");
    let failing_video_file_probe = FakeVideoFileProbe::failing_for(
        canonical_family_trip_path.to_string_lossy().into_owned(),
        "missing moov atom",
    );

    let refresh_summary = catalog
        .refresh_scan_root(
            &scan_root.path,
            &failing_video_file_probe,
            &crate::catalog::VideoExtensionAllowlist::default(),
        )
        .expect("second scan root refreshes");

    assert_eq!(
        refresh_summary,
        crate::catalog::ScanRootRefreshSummary {
            scanned_video_count: 0,
            unprocessable_candidate_count: 1,
        }
    );
    assert_eq!(
        catalog.listed_videos().expect("stored videos list"),
        vec![crate::catalog::CatalogVideo {
            id: 1,
            is_available: false,
            preview_strip: crate::catalog::PreviewStripStatus::Pending,
            title: "family-trip".to_string(),
            duration_milliseconds: 1_000,
            file_size_bytes: None,
            file_location_path: None,
            file_locations: Vec::new(),
            is_favorite: false,
            last_opened_at: None,
            open_count: 0,
        }]
    );
    assert_eq!(
        catalog
            .list_unprocessable_video_candidates_by_scan_root()
            .expect("unprocessable candidates grouped by Scan Root"),
        vec![crate::catalog::UnprocessableVideoCandidateGroup {
            scan_root_path: scan_root.path,
            candidate_count: 1,
            candidates: vec![crate::catalog::UnprocessableVideoCandidate {
                path: canonical_family_trip_path.to_string_lossy().into_owned(),
                reason: "missing moov atom".to_string(),
                file_size_bytes: 17,
            }],
        }]
    );
}

#[test]
fn removing_scan_root_can_forget_affected_videos_from_catalog() {
    let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
    let catalog_path = temporary_folder.path().join("catalog.sqlite3");
    let catalog = Catalog::open(&catalog_path).expect("catalog opens");
    let movies_root = temporary_folder.path().join("Movies");
    std::fs::create_dir_all(&movies_root).expect("movies root exists");
    let scan_root = catalog
        .add_scan_root(&movies_root)
        .expect("movies scan root adds");

    catalog_test_database(&catalog_path)
        .execute(
            "INSERT INTO videos (fingerprint, fingerprint_version, title, duration_milliseconds)
                 VALUES (?1, ?2, ?3, ?4)",
            ("fingerprint-one", 1_i64, "Family Trip", 3723000_i64),
        )
        .expect("video persists");
    catalog_test_database(&catalog_path)
            .execute(
                "INSERT INTO file_locations (video_id, scan_root_id, path, file_size_bytes, last_seen_at)
                 VALUES (?1, ?2, ?3, ?4, ?5)",
                (
                    1_i64,
                    1_i64,
                    movies_root.join("family-trip.mp4").to_string_lossy().into_owned(),
                    80740352_i64,
                    "2026-05-14T16:35:48Z",
                ),
            )
            .expect("file location persists");

    catalog
        .remove_scan_root_forgetting_catalog_videos(&scan_root.path)
        .expect("scan root removes");

    let database = catalog_test_database(&catalog_path);
    assert_eq!(count_rows(&database, "scan_roots"), 0);
    assert_eq!(count_rows(&database, "file_locations"), 0);
    assert_eq!(count_rows(&database, "videos"), 0);
}

#[test]
fn forgetting_scan_root_preserves_videos_with_locations_in_other_scan_roots() {
    let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
    let catalog_path = temporary_folder.path().join("catalog.sqlite3");
    let catalog = Catalog::open(&catalog_path).expect("catalog opens");
    let movies_root = temporary_folder.path().join("Movies");
    let backup_root = temporary_folder.path().join("Backup");
    std::fs::create_dir_all(&movies_root).expect("movies root exists");
    std::fs::create_dir_all(&backup_root).expect("backup root exists");
    let movies_scan_root = catalog
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
                    movies_root.join("family-trip.mp4").to_string_lossy().into_owned(),
                    80740352_i64,
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
                    80740352_i64,
                    "2026-05-14T16:35:48Z",
                ),
            )
            .expect("backup file location persists");

    catalog
        .remove_scan_root_forgetting_catalog_videos(&movies_scan_root.path)
        .expect("scan root removes");

    assert_eq!(count_rows(&database, "scan_roots"), 1);
    assert_eq!(count_rows(&database, "file_locations"), 1);
    assert_eq!(count_rows(&database, "videos"), 1);
    assert_eq!(
        catalog.listed_videos().expect("stored videos list"),
        vec![crate::catalog::CatalogVideo {
            id: 1,
            is_available: true,
            preview_strip: crate::catalog::PreviewStripStatus::Pending,
            title: "Family Trip".to_string(),
            duration_milliseconds: 3723000,
            file_size_bytes: Some(80740352),
            file_location_path: Some(
                backup_root
                    .join("family-trip.mp4")
                    .to_string_lossy()
                    .into_owned()
            ),
            file_locations: vec![crate::catalog::CatalogVideoFileLocation {
                path: backup_root
                    .join("family-trip.mp4")
                    .to_string_lossy()
                    .into_owned(),
                file_size_bytes: 80740352,
                is_preferred: true,
            }],
            is_favorite: false,
            last_opened_at: None,
            open_count: 0,
        }]
    );
}

#[test]
fn catalog_persists_scan_roots_videos_titles_durations_and_file_sizes() {
    let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
    let catalog_path = temporary_folder.path().join("catalog.sqlite3");

    let catalog = Catalog::open(&catalog_path).expect("catalog opens");

    let database = Connection::open(catalog_path).expect("catalog database opens");
    database
        .execute(
            "INSERT INTO scan_roots (path, drive_identity) VALUES (?1, ?2)",
            ("/Volumes/Archive/Videos", "drive-archive"),
        )
        .expect("scan root persists");
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
                    "/Volumes/Archive/Videos/family-trip.mp4",
                    80740352_i64,
                    "2026-05-14T16:35:48Z",
                ),
            )
            .expect("file location persists");

    let stored_videos = catalog.listed_videos().expect("stored videos list");

    assert_eq!(
        stored_videos,
        vec![crate::catalog::CatalogVideo {
            id: 1,
            is_available: true,
            preview_strip: crate::catalog::PreviewStripStatus::Pending,
            title: "Family Trip".to_string(),
            duration_milliseconds: 3723000,
            file_size_bytes: Some(80740352),
            file_location_path: Some("/Volumes/Archive/Videos/family-trip.mp4".to_string()),
            file_locations: vec![crate::catalog::CatalogVideoFileLocation {
                path: "/Volumes/Archive/Videos/family-trip.mp4".to_string(),
                file_size_bytes: 80740352,
                is_preferred: true,
            }],
            is_favorite: false,
            last_opened_at: None,
            open_count: 0,
        }]
    );
}
