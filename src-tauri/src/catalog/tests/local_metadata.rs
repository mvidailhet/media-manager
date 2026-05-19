use super::*;

#[test]
fn refreshing_an_unreachable_scan_root_marks_it_unavailable_without_discarding_catalog_metadata() {
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
    std::fs::remove_dir_all(&movies_root).expect("scan root becomes unreachable");

    let refresh_summary = catalog
        .refresh_scan_root(
            &scan_root.path,
            &video_file_probe,
            &crate::catalog::VideoExtensionAllowlist::default(),
        )
        .expect("unreachable scan root refresh completes");

    assert_eq!(
        refresh_summary,
        crate::catalog::ScanRootRefreshSummary {
            scanned_video_count: 0,
            unprocessable_candidate_count: 0,
        }
    );
    let scan_roots = catalog.list_scan_roots().expect("scan roots list");
    assert_eq!(scan_roots.len(), 1);
    assert_eq!(scan_roots[0].path, scan_root.path);
    assert!(!scan_roots[0].is_available);
    assert!(scan_roots[0].last_scan_completed_at.is_some());
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
fn listed_videos_include_editable_metadata_and_all_file_locations() {
    let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
    let catalog_path = temporary_folder.path().join("catalog.sqlite3");
    let catalog = Catalog::open(&catalog_path).expect("catalog opens");
    let database = Connection::open(catalog_path).expect("catalog database opens");
    let primary_location = "/Volumes/Archive/Videos/family-trip.mp4";
    let secondary_location = "/Volumes/Backup/Videos/family-trip.mp4";

    database
        .execute(
            "INSERT INTO scan_roots (id, path, drive_identity)
                 VALUES (1, '/Volumes/Archive/Videos', NULL),
                        (2, '/Volumes/Backup/Videos', NULL)",
            [],
        )
        .expect("scan roots persist");
    database
            .execute(
                "INSERT INTO videos (id, fingerprint, fingerprint_version, title, duration_milliseconds)
                 VALUES (1, 'fingerprint', 1, 'Family Trip', 3723000)",
                [],
            )
            .expect("video persists");
    database
            .execute(
                "INSERT INTO file_locations (video_id, scan_root_id, path, file_size_bytes, last_seen_at)
                 VALUES (1, 1, ?1, 80740352, CURRENT_TIMESTAMP),
                        (1, 2, ?2, 80740352, CURRENT_TIMESTAMP)",
                rusqlite::params![primary_location, secondary_location],
            )
            .expect("file locations persist");

    catalog
        .update_video_title(1, "Family Archive")
        .expect("title updates");
    catalog
        .set_video_favorite(1, true)
        .expect("favorite updates");

    assert_eq!(
        catalog.listed_videos().expect("stored videos list"),
        vec![crate::catalog::CatalogVideo {
            id: 1,
            is_available: true,
            preview_strip: crate::catalog::PreviewStripStatus::Pending,
            title: "Family Archive".to_string(),
            duration_milliseconds: 3723000,
            file_size_bytes: Some(80740352),
            file_location_path: Some(primary_location.to_string()),
            file_locations: vec![
                crate::catalog::CatalogVideoFileLocation {
                    path: primary_location.to_string(),
                    file_size_bytes: 80740352,
                    is_preferred: true,
                },
                crate::catalog::CatalogVideoFileLocation {
                    path: secondary_location.to_string(),
                    file_size_bytes: 80740352,
                    is_preferred: false,
                },
            ],
            is_favorite: true,
            last_opened_at: None,
            open_count: 0,
        }]
    );
}

#[test]
fn forgetting_one_missing_catalog_video_removes_metadata_without_touching_the_file() {
    let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
    let catalog_path = temporary_folder.path().join("catalog.sqlite3");
    let catalog = Catalog::open(&catalog_path).expect("catalog opens");
    let family_trip_path = temporary_folder.path().join("family-trip.mp4");
    std::fs::write(&family_trip_path, "valid video bytes").expect("video file exists");

    let database = catalog_test_database(&catalog_path);
    database
        .execute(
            "INSERT INTO videos (fingerprint, fingerprint_version, title, duration_milliseconds)
                 VALUES (?1, ?2, ?3, ?4)",
            ("fingerprint-one", 1_i64, "Family Trip", 3723000_i64),
        )
        .expect("video persists");

    catalog
        .forget_catalog_video(1)
        .expect("catalog video metadata is forgotten");

    assert!(family_trip_path.exists());
    assert_eq!(count_rows(&database, "file_locations"), 0);
    assert_eq!(count_rows(&database, "videos"), 0);
}

#[test]
fn tags_and_performers_are_unique_within_their_own_type_case_insensitively() {
    let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
    let catalog_path = temporary_folder.path().join("catalog.sqlite3");
    let catalog = Catalog::open(&catalog_path).expect("catalog opens");

    let travel_tag = catalog.create_tag("Travel").expect("travel tag creates");
    let travel_performer = catalog
        .create_performer("Travel")
        .expect("travel performer creates");

    assert_eq!(
        catalog
            .create_tag(" travel ")
            .expect_err("duplicate tag is rejected"),
        "Tag already exists"
    );
    assert_eq!(
        catalog
            .create_performer("TRAVEL")
            .expect_err("duplicate performer is rejected"),
        "Performer already exists"
    );
    assert_eq!(travel_tag.name, "Travel");
    assert_eq!(travel_performer.name, "Travel");
    assert_eq!(catalog.list_tags().expect("tags list"), vec![travel_tag]);
    assert_eq!(
        catalog.list_performers().expect("performers list"),
        vec![travel_performer]
    );
}

#[test]
fn tags_and_performers_match_non_ascii_names_case_insensitively() {
    let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
    let catalog_path = temporary_folder.path().join("catalog.sqlite3");
    let catalog = Catalog::open(&catalog_path).expect("catalog opens");

    catalog.create_tag("Élodie").expect("tag creates");
    catalog
        .create_performer("Élodie")
        .expect("performer creates");

    assert_eq!(
        catalog
            .create_tag("élodie")
            .expect_err("accented duplicate tag is rejected"),
        "Tag already exists"
    );
    assert_eq!(
        catalog
            .create_performer("élodie")
            .expect_err("accented duplicate performer is rejected"),
        "Performer already exists"
    );
}

#[test]
fn tags_and_performers_can_be_attached_to_many_videos() {
    let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
    let catalog_path = temporary_folder.path().join("catalog.sqlite3");
    let catalog = Catalog::open(&catalog_path).expect("catalog opens");
    let database = catalog_test_database(&catalog_path);
    store_test_video(&database, "fingerprint-one", "Family Trip");
    store_test_video(&database, "fingerprint-two", "Concert Night");
    let travel_tag = catalog.create_tag("Travel").expect("tag creates");
    let featured_performer = catalog
        .create_performer("Featured Person")
        .expect("performer creates");

    catalog
        .attach_tag_to_video(travel_tag.id, 1)
        .expect("tag attaches to first video");
    catalog
        .attach_tag_to_video(travel_tag.id, 2)
        .expect("tag attaches to second video");
    catalog
        .attach_performer_to_video(featured_performer.id, 1)
        .expect("performer attaches to first video");
    catalog
        .attach_performer_to_video(featured_performer.id, 2)
        .expect("performer attaches to second video");

    assert_eq!(
        catalog.tags_for_video(1).expect("video tags list"),
        vec![travel_tag]
    );
    assert_eq!(
        catalog
            .performers_for_video(2)
            .expect("video performers list"),
        vec![featured_performer]
    );
    assert_eq!(count_rows(&database, "tag_videos"), 2);
    assert_eq!(count_rows(&database, "performer_videos"), 2);
}

#[test]
fn metadata_primitives_support_update_delete_and_detach() {
    let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
    let catalog_path = temporary_folder.path().join("catalog.sqlite3");
    let catalog = Catalog::open(&catalog_path).expect("catalog opens");
    let database = catalog_test_database(&catalog_path);
    store_test_video(&database, "fingerprint-one", "Family Trip");
    let tag = catalog.create_tag("Travel").expect("tag creates");
    let performer = catalog.create_performer("Alex").expect("performer creates");
    catalog
        .attach_tag_to_video(tag.id, 1)
        .expect("tag attaches to video");
    catalog
        .attach_performer_to_video(performer.id, 1)
        .expect("performer attaches to video");

    let updated_tag = catalog.update_tag(tag.id, "Archive").expect("tag updates");
    let updated_performer = catalog
        .update_performer(performer.id, "Blair")
        .expect("performer updates");
    catalog
        .detach_tag_from_video(updated_tag.id, 1)
        .expect("tag detaches from video");
    catalog
        .detach_performer_from_video(updated_performer.id, 1)
        .expect("performer detaches from video");
    catalog.delete_tag(updated_tag.id).expect("tag deletes");
    catalog
        .delete_performer(updated_performer.id)
        .expect("performer deletes");

    assert_eq!(catalog.list_tags().expect("tags list"), Vec::new());
    assert_eq!(
        catalog.list_performers().expect("performers list"),
        Vec::new()
    );
    assert_eq!(count_rows(&database, "tag_videos"), 0);
    assert_eq!(count_rows(&database, "performer_videos"), 0);
}

#[test]
fn attached_tags_and_performers_must_be_detached_before_deletion() {
    let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
    let catalog_path = temporary_folder.path().join("catalog.sqlite3");
    let catalog = Catalog::open(&catalog_path).expect("catalog opens");
    let database = catalog_test_database(&catalog_path);
    store_test_video(&database, "fingerprint-one", "Family Trip");
    let tag = catalog.create_tag("Travel").expect("tag creates");
    let performer = catalog.create_performer("Alex").expect("performer creates");
    catalog
        .attach_tag_to_video(tag.id, 1)
        .expect("tag attaches to video");
    catalog
        .attach_performer_to_video(performer.id, 1)
        .expect("performer attaches to video");

    assert_eq!(
        catalog
            .delete_tag(tag.id)
            .expect_err("attached tag deletion is rejected"),
        "Attached Tags must be detached before deletion"
    );
    assert_eq!(
        catalog
            .delete_performer(performer.id)
            .expect_err("attached performer deletion is rejected"),
        "Attached Performers must be detached before deletion"
    );

    assert_eq!(catalog.list_tags().expect("tags list"), vec![tag]);
    assert_eq!(
        catalog.list_performers().expect("performers list"),
        vec![performer]
    );
}

#[test]
fn detaching_the_last_video_use_removes_unused_tags_and_performers() {
    let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
    let catalog_path = temporary_folder.path().join("catalog.sqlite3");
    let catalog = Catalog::open(&catalog_path).expect("catalog opens");
    let database = catalog_test_database(&catalog_path);
    store_test_video(&database, "fingerprint-one", "Family Trip");
    let tag = catalog.create_tag("Travel").expect("tag creates");
    let performer = catalog.create_performer("Alex").expect("performer creates");
    catalog
        .attach_tag_to_video(tag.id, 1)
        .expect("tag attaches to video");
    catalog
        .attach_performer_to_video(performer.id, 1)
        .expect("performer attaches to video");

    catalog
        .detach_tag_from_video(tag.id, 1)
        .expect("tag detaches from video");
    catalog
        .detach_performer_from_video(performer.id, 1)
        .expect("performer detaches from video");

    assert_eq!(catalog.list_tags().expect("tags list"), Vec::new());
    assert_eq!(
        catalog.list_performers().expect("performers list"),
        Vec::new()
    );
}

#[test]
fn detaching_one_video_use_keeps_metadata_attached_to_other_videos() {
    let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
    let catalog_path = temporary_folder.path().join("catalog.sqlite3");
    let catalog = Catalog::open(&catalog_path).expect("catalog opens");
    let database = catalog_test_database(&catalog_path);
    store_test_video(&database, "fingerprint-one", "Family Trip");
    store_test_video(&database, "fingerprint-two", "Concert Night");
    let tag = catalog.create_tag("Travel").expect("tag creates");
    let performer = catalog.create_performer("Alex").expect("performer creates");
    catalog
        .attach_tag_to_video(tag.id, 1)
        .expect("tag attaches to first video");
    catalog
        .attach_tag_to_video(tag.id, 2)
        .expect("tag attaches to second video");
    catalog
        .attach_performer_to_video(performer.id, 1)
        .expect("performer attaches to first video");
    catalog
        .attach_performer_to_video(performer.id, 2)
        .expect("performer attaches to second video");

    catalog
        .detach_tag_from_video(tag.id, 1)
        .expect("tag detaches from first video");
    catalog
        .detach_performer_from_video(performer.id, 1)
        .expect("performer detaches from first video");

    assert_eq!(catalog.list_tags().expect("tags list"), vec![tag]);
    assert_eq!(
        catalog.list_performers().expect("performers list"),
        vec![performer]
    );
}
