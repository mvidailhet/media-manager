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
    let canonical_family_trip_path = family_trip_path
        .canonicalize()
        .expect("family trip path canonicalizes")
        .to_string_lossy()
        .into_owned();
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
            file_size_bytes: Some(17),
            file_location_path: Some(canonical_family_trip_path.clone()),
            file_locations: vec![crate::catalog::CatalogVideoFileLocation {
                path: canonical_family_trip_path,
                file_size_bytes: 17,
                is_preferred: true,
                is_reachable: false,
            }],
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
                    is_reachable: true,
                },
                crate::catalog::CatalogVideoFileLocation {
                    path: secondary_location.to_string(),
                    file_size_bytes: 80740352,
                    is_preferred: false,
                    is_reachable: true,
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

    let travel_tag = catalog
        .create_tag("Travel", false)
        .expect("travel tag creates");
    let travel_performer = catalog
        .create_performer("Travel", false)
        .expect("travel performer creates");

    assert_eq!(
        catalog
            .create_tag(" travel ", false)
            .expect_err("duplicate tag is rejected"),
        "Tag already exists"
    );
    assert_eq!(
        catalog
            .create_performer("TRAVEL", false)
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
fn tags_and_performers_store_secret_status_and_default_to_non_secret() {
    let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
    let catalog_path = temporary_folder.path().join("catalog.sqlite3");
    let catalog = Catalog::open(&catalog_path).expect("catalog opens");

    let public_tag = catalog
        .create_tag("Travel", false)
        .expect("public tag creates");
    let secret_tag = catalog
        .create_tag("Private", true)
        .expect("secret tag creates");
    let public_performer = catalog
        .create_performer("Blair", false)
        .expect("public performer creates");
    let secret_performer = catalog
        .create_performer("Alex", true)
        .expect("secret performer creates");

    assert!(!public_tag.is_secret);
    assert!(secret_tag.is_secret);
    assert!(!public_performer.is_secret);
    assert!(secret_performer.is_secret);
    assert_eq!(
        catalog.list_tags().expect("tags list"),
        vec![secret_tag, public_tag]
    );
    assert_eq!(
        catalog.list_performers().expect("performers list"),
        vec![secret_performer, public_performer]
    );
}

#[test]
fn renaming_tags_and_performers_preserves_secret_status() {
    let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
    let catalog_path = temporary_folder.path().join("catalog.sqlite3");
    let catalog = Catalog::open(&catalog_path).expect("catalog opens");
    let tag = catalog
        .create_tag("Private", true)
        .expect("secret tag creates");
    let performer = catalog
        .create_performer("Alex", true)
        .expect("secret performer creates");

    let updated_tag = catalog
        .update_tag(tag.id, "Archive", None)
        .expect("tag updates");
    let updated_performer = catalog
        .update_performer(performer.id, "Blair", None)
        .expect("performer updates");

    assert!(updated_tag.is_secret);
    assert!(updated_performer.is_secret);
}

#[test]
fn merging_tags_keeps_secret_status_when_any_source_tag_was_secret() {
    let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
    let catalog_path = temporary_folder.path().join("catalog.sqlite3");
    let catalog = Catalog::open(&catalog_path).expect("catalog opens");
    let database = catalog_test_database(&catalog_path);
    store_test_video(&database, "fingerprint-one", "Family Trip");
    store_test_video(&database, "fingerprint-two", "Concert Night");
    let public_tag = catalog.create_tag("Travel", false).expect("tag creates");
    let secret_tag = catalog.create_tag("Trips", true).expect("tag creates");
    catalog
        .attach_tag_to_video(public_tag.id, 1)
        .expect("public tag attaches");
    catalog
        .attach_tag_to_video(secret_tag.id, 2)
        .expect("secret tag attaches");

    let merged_tag = catalog
        .merge_tags(public_tag.id, secret_tag.id)
        .expect("tags merge");

    assert_eq!(merged_tag.id, public_tag.id);
    assert!(merged_tag.is_secret);
    assert_eq!(
        catalog.list_tags().expect("tags list"),
        vec![merged_tag.clone()]
    );
    assert_eq!(
        catalog.tags_for_video(1).expect("first video tags list"),
        vec![merged_tag.clone()]
    );
    assert_eq!(
        catalog.tags_for_video(2).expect("second video tags list"),
        vec![merged_tag]
    );
}

#[test]
fn merging_performers_keeps_secret_status_when_any_source_performer_was_secret() {
    let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
    let catalog_path = temporary_folder.path().join("catalog.sqlite3");
    let catalog = Catalog::open(&catalog_path).expect("catalog opens");
    let database = catalog_test_database(&catalog_path);
    store_test_video(&database, "fingerprint-one", "Family Trip");
    store_test_video(&database, "fingerprint-two", "Concert Night");
    let public_performer = catalog
        .create_performer("Alex", false)
        .expect("performer creates");
    let secret_performer = catalog
        .create_performer("Blair", true)
        .expect("performer creates");
    catalog
        .attach_performer_to_video(public_performer.id, 1)
        .expect("public performer attaches");
    catalog
        .attach_performer_to_video(secret_performer.id, 2)
        .expect("secret performer attaches");

    let merged_performer = catalog
        .merge_performers(public_performer.id, secret_performer.id)
        .expect("performers merge");

    assert_eq!(merged_performer.id, public_performer.id);
    assert!(merged_performer.is_secret);
    assert_eq!(
        catalog.list_performers().expect("performers list"),
        vec![merged_performer.clone()]
    );
    assert_eq!(
        catalog
            .performers_for_video(1)
            .expect("first video performers list"),
        vec![merged_performer.clone()]
    );
    assert_eq!(
        catalog
            .performers_for_video(2)
            .expect("second video performers list"),
        vec![merged_performer]
    );
}

#[test]
fn merging_metadata_keeps_secret_status_when_the_kept_value_was_secret() {
    let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
    let catalog_path = temporary_folder.path().join("catalog.sqlite3");
    let catalog = Catalog::open(&catalog_path).expect("catalog opens");
    let secret_tag = catalog.create_tag("Travel", true).expect("tag creates");
    let public_tag = catalog.create_tag("Trips", false).expect("tag creates");
    let secret_performer = catalog
        .create_performer("Alex", true)
        .expect("performer creates");
    let public_performer = catalog
        .create_performer("Blair", false)
        .expect("performer creates");

    let merged_tag = catalog
        .merge_tags(secret_tag.id, public_tag.id)
        .expect("tags merge");
    let merged_performer = catalog
        .merge_performers(secret_performer.id, public_performer.id)
        .expect("performers merge");

    assert!(merged_tag.is_secret);
    assert!(merged_performer.is_secret);
}

#[test]
fn merging_non_secret_tags_and_performers_keeps_result_non_secret() {
    let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
    let catalog_path = temporary_folder.path().join("catalog.sqlite3");
    let catalog = Catalog::open(&catalog_path).expect("catalog opens");
    let public_tag = catalog.create_tag("Travel", false).expect("tag creates");
    let other_public_tag = catalog.create_tag("Trips", false).expect("tag creates");
    let public_performer = catalog
        .create_performer("Alex", false)
        .expect("performer creates");
    let other_public_performer = catalog
        .create_performer("Blair", false)
        .expect("performer creates");

    let merged_tag = catalog
        .merge_tags(public_tag.id, other_public_tag.id)
        .expect("tags merge");
    let merged_performer = catalog
        .merge_performers(public_performer.id, other_public_performer.id)
        .expect("performers merge");

    assert!(!merged_tag.is_secret);
    assert!(!merged_performer.is_secret);
}

#[test]
fn tags_and_performers_can_change_secret_status() {
    let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
    let catalog_path = temporary_folder.path().join("catalog.sqlite3");
    let catalog = Catalog::open(&catalog_path).expect("catalog opens");
    let tag = catalog.create_tag("Travel", false).expect("tag creates");
    let performer = catalog
        .create_performer("Alex", true)
        .expect("performer creates");

    let updated_tag = catalog
        .update_tag(tag.id, "Travel", Some(true))
        .expect("tag updates");
    let updated_performer = catalog
        .update_performer(performer.id, "Alex", Some(false))
        .expect("performer updates");

    assert!(updated_tag.is_secret);
    assert!(!updated_performer.is_secret);
}

#[test]
fn tags_and_performers_match_non_ascii_names_case_insensitively() {
    let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
    let catalog_path = temporary_folder.path().join("catalog.sqlite3");
    let catalog = Catalog::open(&catalog_path).expect("catalog opens");

    catalog.create_tag("Élodie", false).expect("tag creates");
    catalog
        .create_performer("Élodie", false)
        .expect("performer creates");

    assert_eq!(
        catalog
            .create_tag("élodie", false)
            .expect_err("accented duplicate tag is rejected"),
        "Tag already exists"
    );
    assert_eq!(
        catalog
            .create_performer("élodie", false)
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
    let travel_tag = catalog.create_tag("Travel", false).expect("tag creates");
    let featured_performer = catalog
        .create_performer("Featured Person", false)
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
    let tag = catalog.create_tag("Travel", false).expect("tag creates");
    let performer = catalog
        .create_performer("Alex", false)
        .expect("performer creates");
    catalog
        .attach_tag_to_video(tag.id, 1)
        .expect("tag attaches to video");
    catalog
        .attach_performer_to_video(performer.id, 1)
        .expect("performer attaches to video");

    let updated_tag = catalog
        .update_tag(tag.id, "Archive", None)
        .expect("tag updates");
    let updated_performer = catalog
        .update_performer(performer.id, "Blair", None)
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
    let tag = catalog.create_tag("Travel", false).expect("tag creates");
    let performer = catalog
        .create_performer("Alex", false)
        .expect("performer creates");
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
    let tag = catalog.create_tag("Travel", false).expect("tag creates");
    let performer = catalog
        .create_performer("Alex", false)
        .expect("performer creates");
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
    let tag = catalog.create_tag("Travel", false).expect("tag creates");
    let performer = catalog
        .create_performer("Alex", false)
        .expect("performer creates");
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
