use super::*;

#[test]
fn new_scan_roots_store_default_inference_rules_for_child_folder_tags_only() {
    let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
    let catalog_path = temporary_folder.path().join("catalog.sqlite3");
    let catalog = Catalog::open(&catalog_path).expect("catalog opens");

    let movies_root = temporary_folder.path().join("Movies");
    std::fs::create_dir_all(&movies_root).expect("movies root exists");

    let scan_root = catalog
        .add_scan_root(&movies_root)
        .expect("scan root adds with inference rules");

    assert_eq!(
        scan_root.inference_rules,
        crate::catalog::ScanRootInferenceRules {
            suggest_tags_from_child_folders: true,
            suggest_performers_from_child_folders: false,
            ignored_folder_names: vec![
                "Misc".to_string(),
                "Unsorted".to_string(),
                "To Sort".to_string(),
                "To Review".to_string(),
                "New".to_string(),
                "Temp".to_string(),
                "Archive".to_string(),
                "Archives".to_string(),
                "Downloads".to_string(),
                "Videos".to_string(),
            ],
            ignored_exact_year_range: crate::catalog::ExactYearRange {
                start_year: 1900,
                end_year: 2099,
            },
        }
    );

    assert_eq!(
        catalog.list_scan_roots().expect("scan roots list"),
        vec![scan_root]
    );
}

#[test]
fn scan_root_inference_rules_can_be_changed_without_changing_accepted_local_metadata() {
    let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
    let catalog_path = temporary_folder.path().join("catalog.sqlite3");
    let catalog = Catalog::open(&catalog_path).expect("catalog opens");

    let movies_root = temporary_folder.path().join("Movies");
    std::fs::create_dir_all(&movies_root).expect("movies root exists");
    let scan_root = catalog
        .add_scan_root(&movies_root)
        .expect("scan root adds with inference rules");
    store_test_video(&catalog.database, "family-trip-fingerprint", "Family Trip");
    let video_id = catalog
        .database
        .query_row(
            "SELECT id FROM videos WHERE fingerprint = ?1",
            ["family-trip-fingerprint"],
            |row| row.get::<_, i64>(0),
        )
        .expect("video id loads");
    let tag = catalog.create_tag("Family").expect("tag creates");
    catalog
        .attach_tag_to_video(tag.id, video_id)
        .expect("tag attaches");
    let changed_inference_rules = crate::catalog::ScanRootInferenceRules {
        suggest_tags_from_child_folders: true,
        suggest_performers_from_child_folders: false,
        ignored_folder_names: vec!["Extras".to_string(), "Temp".to_string()],
        ignored_exact_year_range: crate::catalog::ExactYearRange {
            start_year: 1900,
            end_year: 2099,
        },
    };

    let changed_scan_root = catalog
        .update_scan_root_inference_rules(&scan_root.path, changed_inference_rules)
        .expect("scan root inference rules update");

    assert_eq!(
        changed_scan_root.inference_rules.ignored_folder_names,
        vec!["Extras".to_string(), "Temp".to_string()]
    );
    assert_eq!(
        catalog.tags_for_video(video_id).expect("video tags list"),
        vec![tag]
    );
}

#[test]
fn scan_root_refresh_generates_tag_suggestions_from_allowed_child_folder_segments_only() {
    let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
    let catalog_path = temporary_folder.path().join("catalog.sqlite3");
    let catalog = Catalog::open(&catalog_path).expect("catalog opens");
    let movies_root = temporary_folder.path().join("Movies");
    let video_folder = movies_root.join("Videos").join("2024").join("Family");
    std::fs::create_dir_all(&video_folder).expect("video folder exists");
    let family_trip_path = video_folder.join("family-trip.mp4");
    std::fs::write(&family_trip_path, "valid video bytes").expect("family video exists");
    let scan_root = catalog.add_scan_root(&movies_root).expect("scan root adds");

    catalog
        .refresh_scan_root(
            &scan_root.path,
            &FakeVideoFileProbe::with_duration(1_000),
            &crate::catalog::VideoExtensionAllowlist::default(),
        )
        .expect("scan root refreshes");

    assert_eq!(
        metadata_suggestions(&catalog.database),
        vec![("Family".to_string(), "tag".to_string())]
    );
}

#[test]
fn metadata_suggestions_normalize_display_text_while_preserving_original_source_segment() {
    let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
    let catalog_path = temporary_folder.path().join("catalog.sqlite3");
    let catalog = Catalog::open(&catalog_path).expect("catalog opens");
    let movies_root = temporary_folder.path().join("Movies");
    let video_folder = movies_root.join("  Family Trip  ");
    std::fs::create_dir_all(&video_folder).expect("video folder exists");
    let family_trip_path = video_folder.join("family-trip.mp4");
    std::fs::write(&family_trip_path, "valid video bytes").expect("family video exists");
    let scan_root = catalog.add_scan_root(&movies_root).expect("scan root adds");

    catalog
        .refresh_scan_root(
            &scan_root.path,
            &FakeVideoFileProbe::with_duration(1_000),
            &crate::catalog::VideoExtensionAllowlist::default(),
        )
        .expect("scan root refreshes");

    assert_eq!(
        metadata_suggestion_sources(&catalog.database),
        vec![(
            "  Family Trip  ".to_string(),
            "Family Trip".to_string(),
            "tag".to_string()
        )]
    );
}

#[test]
fn metadata_suggestion_display_normalization_controls_ignored_segments() {
    let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
    let catalog_path = temporary_folder.path().join("catalog.sqlite3");
    let catalog = Catalog::open(&catalog_path).expect("catalog opens");
    let movies_root = temporary_folder.path().join("Movies");
    let family_folder = movies_root.join("Family");
    let ignored_folder = movies_root.join("  Extras  ");
    let year_folder = movies_root.join("  2024  ");
    let blank_folder = movies_root.join("   ");
    std::fs::create_dir_all(&family_folder).expect("family folder exists");
    std::fs::create_dir_all(&ignored_folder).expect("ignored folder exists");
    std::fs::create_dir_all(&year_folder).expect("year folder exists");
    std::fs::create_dir_all(&blank_folder).expect("blank folder exists");
    std::fs::write(family_folder.join("family-trip.mp4"), "valid video bytes")
        .expect("family video exists");
    std::fs::write(ignored_folder.join("extras.mp4"), "valid video bytes")
        .expect("ignored video exists");
    std::fs::write(year_folder.join("year.mp4"), "valid video bytes").expect("year video exists");
    std::fs::write(blank_folder.join("blank.mp4"), "valid video bytes")
        .expect("blank video exists");
    let scan_root = catalog.add_scan_root(&movies_root).expect("scan root adds");
    catalog
        .update_scan_root_inference_rules(
            &scan_root.path,
            crate::catalog::ScanRootInferenceRules {
                suggest_tags_from_child_folders: true,
                suggest_performers_from_child_folders: false,
                ignored_folder_names: vec!["Extras".to_string()],
                ignored_exact_year_range: crate::catalog::ExactYearRange {
                    start_year: 1900,
                    end_year: 2099,
                },
            },
        )
        .expect("inference rules update");

    catalog
        .refresh_scan_root(
            &scan_root.path,
            &FakeVideoFileProbe::with_duration(1_000),
            &crate::catalog::VideoExtensionAllowlist::default(),
        )
        .expect("scan root refreshes");

    assert_eq!(
        metadata_suggestions(&catalog.database),
        vec![("Family".to_string(), "tag".to_string())]
    );
}

#[test]
fn changing_scan_root_inference_rules_regenerates_unaccepted_suggestions_only() {
    let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
    let catalog_path = temporary_folder.path().join("catalog.sqlite3");
    let catalog = Catalog::open(&catalog_path).expect("catalog opens");
    let movies_root = temporary_folder.path().join("Movies");
    let video_folder = movies_root.join("Travel").join("Family");
    std::fs::create_dir_all(&video_folder).expect("video folder exists");
    let family_trip_path = video_folder.join("family-trip.mp4");
    std::fs::write(&family_trip_path, "valid video bytes").expect("family video exists");
    let scan_root = catalog.add_scan_root(&movies_root).expect("scan root adds");
    catalog
        .refresh_scan_root(
            &scan_root.path,
            &FakeVideoFileProbe::with_duration(1_000),
            &crate::catalog::VideoExtensionAllowlist::default(),
        )
        .expect("scan root refreshes");
    catalog
        .database
        .execute(
            "UPDATE metadata_suggestions
                 SET accepted_at = CURRENT_TIMESTAMP
                 WHERE suggested_value = 'Travel'",
            [],
        )
        .expect("suggestion accepts");

    catalog
        .update_scan_root_inference_rules(
            &scan_root.path,
            crate::catalog::ScanRootInferenceRules {
                suggest_tags_from_child_folders: true,
                suggest_performers_from_child_folders: false,
                ignored_folder_names: vec![" Family ".to_string(), "family".to_string()],
                ignored_exact_year_range: crate::catalog::ExactYearRange {
                    start_year: 1900,
                    end_year: 2099,
                },
            },
        )
        .expect("inference rules update");

    assert_eq!(
        metadata_suggestions(&catalog.database),
        vec![("Travel".to_string(), "tag".to_string())]
    );
}

#[test]
fn pending_metadata_suggestions_are_grouped_by_value_source_and_affected_videos() {
    let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
    let catalog_path = temporary_folder.path().join("catalog.sqlite3");
    let catalog = Catalog::open(&catalog_path).expect("catalog opens");
    let movies_root = temporary_folder.path().join("Movies");
    let family_folder = movies_root.join("  Family  ");
    let travel_folder = movies_root.join("Travel");
    std::fs::create_dir_all(&family_folder).expect("family folder exists");
    std::fs::create_dir_all(&travel_folder).expect("travel folder exists");
    let family_trip_bytes = "valid family trip bytes";
    std::fs::write(family_folder.join("family-trip.mp4"), family_trip_bytes)
        .expect("family trip video exists");
    std::fs::write(family_folder.join("birthday.mp4"), "valid birthday bytes")
        .expect("birthday video exists");
    std::fs::write(
        travel_folder.join("family-trip-copy.mp4"),
        family_trip_bytes,
    )
    .expect("duplicate travel video location exists");
    let scan_root = catalog.add_scan_root(&movies_root).expect("scan root adds");
    catalog
        .refresh_scan_root(
            &scan_root.path,
            &FakeVideoFileProbe::with_duration(1_000),
            &crate::catalog::VideoExtensionAllowlist::default(),
        )
        .expect("scan root refreshes");
    catalog
        .database
        .execute(
            "UPDATE metadata_suggestions
                 SET accepted_at = CURRENT_TIMESTAMP
                 WHERE suggested_value = 'Travel'",
            [],
        )
        .expect("travel suggestion accepts");
    catalog
        .database
        .execute(
            "UPDATE metadata_suggestions
                 SET suggested_value = 'family'
                 WHERE suggested_value = 'Family'
                   AND video_id = (
                     SELECT id FROM videos WHERE title = 'birthday'
                   )",
            [],
        )
        .expect("case variant suggestion stores");

    let suggestion_groups = catalog
        .list_metadata_suggestion_groups()
        .expect("metadata suggestion groups list");

    assert_eq!(suggestion_groups.len(), 1);
    assert_eq!(suggestion_groups[0].suggested_value, "Family");
    assert_eq!(suggestion_groups[0].suggestion_kind, "tag");
    assert_eq!(suggestion_groups[0].sources.len(), 1);
    assert_eq!(
        suggestion_groups[0].sources[0].source_path_segment,
        "  Family  "
    );
    assert_eq!(suggestion_groups[0].sources[0].videos.len(), 2);
    assert_eq!(
        suggestion_groups[0].sources[0]
            .videos
            .iter()
            .map(|video| video.title.as_str())
            .collect::<Vec<_>>(),
        vec!["birthday", "family-trip"]
    );
    assert_eq!(
        suggestion_groups[0].sources[0]
            .videos
            .iter()
            .map(|video| video.file_location_path.contains("Travel"))
            .collect::<Vec<_>>(),
        vec![false, false]
    );
}

#[test]
fn accepting_metadata_suggestion_for_many_videos_excludes_selected_videos_without_touching_files() {
    let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
    let catalog_path = temporary_folder.path().join("catalog.sqlite3");
    let catalog = Catalog::open(&catalog_path).expect("catalog opens");
    let movies_root = temporary_folder.path().join("Movies");
    let family_folder = movies_root.join("Family");
    std::fs::create_dir_all(&family_folder).expect("family folder exists");
    let accepted_video_path = family_folder.join("accepted.mp4");
    let excluded_video_path = family_folder.join("excluded.mp4");
    std::fs::write(&accepted_video_path, "accepted video bytes").expect("accepted video exists");
    std::fs::write(&excluded_video_path, "excluded video bytes").expect("excluded video exists");
    let scan_root = catalog.add_scan_root(&movies_root).expect("scan root adds");
    catalog
        .refresh_scan_root(
            &scan_root.path,
            &FakeVideoFileProbe::with_duration(1_000),
            &crate::catalog::VideoExtensionAllowlist::default(),
        )
        .expect("scan root refreshes");
    let accepted_video_id = video_id_for_title(&catalog.database, "accepted");
    let excluded_video_id = video_id_for_title(&catalog.database, "excluded");

    catalog
        .accept_metadata_suggestion_for_videos(
            &scan_root.path,
            "Family",
            "Family",
            "tag",
            None,
            None,
            &[accepted_video_id],
        )
        .expect("metadata suggestion accepts");

    assert_eq!(
        catalog
            .tags_for_video(accepted_video_id)
            .expect("accepted video tags list"),
        vec![crate::catalog::CatalogTag {
            id: 1,
            name: "Family".to_string()
        }]
    );
    assert_eq!(
        catalog
            .tags_for_video(excluded_video_id)
            .expect("excluded video tags list"),
        Vec::<crate::catalog::CatalogTag>::new()
    );
    assert_eq!(
        catalog
            .list_metadata_suggestion_groups()
            .expect("metadata suggestions list")[0]
            .sources[0]
            .videos
            .iter()
            .map(|video| video.video_id)
            .collect::<Vec<_>>(),
        vec![excluded_video_id]
    );
    assert!(accepted_video_path.exists());
    assert!(excluded_video_path.exists());
}

#[test]
fn accepting_metadata_suggestion_can_create_a_performer_instead_of_a_tag() {
    let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
    let catalog_path = temporary_folder.path().join("catalog.sqlite3");
    let catalog = Catalog::open(&catalog_path).expect("catalog opens");
    let movies_root = temporary_folder.path().join("Movies");
    let family_folder = movies_root.join("Family");
    std::fs::create_dir_all(&family_folder).expect("family folder exists");
    std::fs::write(family_folder.join("family-trip.mp4"), "valid video bytes")
        .expect("family video exists");
    let scan_root = catalog.add_scan_root(&movies_root).expect("scan root adds");
    catalog
        .refresh_scan_root(
            &scan_root.path,
            &FakeVideoFileProbe::with_duration(1_000),
            &crate::catalog::VideoExtensionAllowlist::default(),
        )
        .expect("scan root refreshes");
    let video_id = video_id_for_title(&catalog.database, "family-trip");

    catalog
        .accept_metadata_suggestion_for_videos(
            &scan_root.path,
            "Family",
            "Family",
            "tag",
            Some("performer"),
            Some("The Family"),
            &[video_id],
        )
        .expect("metadata suggestion accepts as performer");

    assert_eq!(
        catalog
            .performers_for_video(video_id)
            .expect("video performers list"),
        vec![crate::catalog::CatalogPerformer {
            id: 1,
            name: "The Family".to_string()
        }]
    );
    assert_eq!(
        catalog.tags_for_video(video_id).expect("video tags list"),
        Vec::<crate::catalog::CatalogTag>::new()
    );
    assert_eq!(
        catalog
            .list_metadata_suggestion_groups()
            .expect("metadata suggestions list"),
        Vec::<crate::catalog::MetadataSuggestionGroup>::new()
    );
}

#[test]
fn accepting_metadata_suggestion_can_map_to_an_existing_tag_with_a_different_name() {
    let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
    let catalog_path = temporary_folder.path().join("catalog.sqlite3");
    let catalog = Catalog::open(&catalog_path).expect("catalog opens");
    let existing_tag = catalog.create_tag("Home Movies").expect("tag creates");
    let movies_root = temporary_folder.path().join("Movies");
    let family_folder = movies_root.join("Family");
    std::fs::create_dir_all(&family_folder).expect("family folder exists");
    std::fs::write(family_folder.join("family-trip.mp4"), "valid video bytes")
        .expect("family video exists");
    let scan_root = catalog.add_scan_root(&movies_root).expect("scan root adds");
    catalog
        .refresh_scan_root(
            &scan_root.path,
            &FakeVideoFileProbe::with_duration(1_000),
            &crate::catalog::VideoExtensionAllowlist::default(),
        )
        .expect("scan root refreshes");
    let video_id = video_id_for_title(&catalog.database, "family-trip");

    catalog
        .accept_metadata_suggestion_for_videos(
            &scan_root.path,
            "Family",
            "Family",
            "tag",
            None,
            Some("home movies"),
            &[video_id],
        )
        .expect("metadata suggestion accepts as existing tag");

    assert_eq!(
        catalog.tags_for_video(video_id).expect("video tags list"),
        vec![existing_tag]
    );
    assert_eq!(
        catalog
            .list_tags()
            .expect("tags list")
            .into_iter()
            .map(|tag| tag.name)
            .collect::<Vec<_>>(),
        vec!["Home Movies".to_string()]
    );
}

#[test]
fn accepting_metadata_suggestion_only_maps_the_accepted_source_segment() {
    let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
    let catalog_path = temporary_folder.path().join("catalog.sqlite3");
    let catalog = Catalog::open(&catalog_path).expect("catalog opens");
    let movies_root = temporary_folder.path().join("Movies");
    let family_folder = movies_root.join("Family");
    let spaced_family_folder = family_folder.join("  Family  ");
    std::fs::create_dir_all(&spaced_family_folder).expect("nested family folder exists");
    std::fs::write(
        spaced_family_folder.join("family-trip.mp4"),
        "valid family trip bytes",
    )
    .expect("family video exists");
    let scan_root = catalog.add_scan_root(&movies_root).expect("scan root adds");
    catalog
        .refresh_scan_root(
            &scan_root.path,
            &FakeVideoFileProbe::with_duration(1_000),
            &crate::catalog::VideoExtensionAllowlist::default(),
        )
        .expect("scan root refreshes");
    let video_id = video_id_for_title(&catalog.database, "family-trip");

    catalog
        .accept_metadata_suggestion_for_videos(
            &scan_root.path,
            "Family",
            "Family",
            "tag",
            None,
            None,
            &[video_id],
        )
        .expect("metadata suggestion accepts");

    assert_eq!(
        metadata_suggestion_sources(&catalog.database),
        vec![(
            "  Family  ".to_string(),
            "Family".to_string(),
            "tag".to_string()
        )]
    );
    assert_eq!(
        metadata_suggestion_mappings(&catalog.database),
        vec![(
            "Family".to_string(),
            "family".to_string(),
            "tag".to_string()
        )]
    );
}

#[test]
fn accepting_metadata_suggestion_remembers_mapping_for_future_suggestions_from_the_same_source() {
    let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
    let catalog_path = temporary_folder.path().join("catalog.sqlite3");
    let catalog = Catalog::open(&catalog_path).expect("catalog opens");
    let movies_root = temporary_folder.path().join("Movies");
    let family_folder = movies_root.join("Family");
    std::fs::create_dir_all(&family_folder).expect("family folder exists");
    std::fs::write(
        family_folder.join("family-trip.mp4"),
        "valid family trip bytes",
    )
    .expect("family video exists");
    let scan_root = catalog.add_scan_root(&movies_root).expect("scan root adds");
    catalog
        .refresh_scan_root(
            &scan_root.path,
            &FakeVideoFileProbe::with_duration(1_000),
            &crate::catalog::VideoExtensionAllowlist::default(),
        )
        .expect("scan root refreshes");
    let first_video_id = video_id_for_title(&catalog.database, "family-trip");

    catalog
        .accept_metadata_suggestion_for_videos(
            &scan_root.path,
            "Family",
            "Family",
            "tag",
            Some("performer"),
            Some("The Family"),
            &[first_video_id],
        )
        .expect("metadata suggestion accepts");
    std::fs::write(family_folder.join("birthday.mp4"), "valid birthday bytes")
        .expect("new family video exists");

    catalog
        .refresh_scan_root(
            &scan_root.path,
            &FakeVideoFileProbe::with_duration(1_000),
            &crate::catalog::VideoExtensionAllowlist::default(),
        )
        .expect("scan root refreshes again");

    let new_video_id = video_id_for_title(&catalog.database, "birthday");
    assert_eq!(
        catalog
            .performers_for_video(new_video_id)
            .expect("new video performers list"),
        vec![crate::catalog::CatalogPerformer {
            id: 1,
            name: "The Family".to_string()
        }]
    );
    assert_eq!(
        catalog
            .tags_for_video(new_video_id)
            .expect("new video tags list"),
        Vec::<crate::catalog::CatalogTag>::new()
    );
    assert_eq!(
        catalog
            .list_metadata_suggestion_groups()
            .expect("metadata suggestions list"),
        Vec::<crate::catalog::MetadataSuggestionGroup>::new()
    );
    assert_eq!(
        auto_accepted_metadata_suggestions(&catalog.database),
        vec![
            (
                "birthday".to_string(),
                "Family".to_string(),
                "Family".to_string(),
                "tag".to_string()
            ),
            (
                "family-trip".to_string(),
                "Family".to_string(),
                "Family".to_string(),
                "tag".to_string()
            )
        ]
    );
}

#[test]
fn metadata_suggestion_mappings_are_scoped_to_scan_root_source_and_value() {
    let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
    let catalog_path = temporary_folder.path().join("catalog.sqlite3");
    let catalog = Catalog::open(&catalog_path).expect("catalog opens");
    let movies_root = temporary_folder.path().join("Movies");
    let backup_root = temporary_folder.path().join("Backup");
    let movies_family_folder = movies_root.join("Family");
    let movies_travel_folder = movies_root.join("Travel");
    let backup_family_folder = backup_root.join("Family");
    std::fs::create_dir_all(&movies_family_folder).expect("movies family folder exists");
    std::fs::create_dir_all(&movies_travel_folder).expect("movies travel folder exists");
    std::fs::create_dir_all(&backup_family_folder).expect("backup family folder exists");
    std::fs::write(
        movies_family_folder.join("family-trip.mp4"),
        "valid family trip bytes",
    )
    .expect("family video exists");
    std::fs::write(
        movies_travel_folder.join("travel-family.mp4"),
        "valid travel family bytes",
    )
    .expect("travel video exists");
    std::fs::write(
        backup_family_folder.join("backup-family.mp4"),
        "valid backup family bytes",
    )
    .expect("backup video exists");
    let movies_scan_root = catalog
        .add_scan_root(&movies_root)
        .expect("movies root adds");
    let backup_scan_root = catalog
        .add_scan_root(&backup_root)
        .expect("backup root adds");
    catalog
        .refresh_scan_root(
            &movies_scan_root.path,
            &FakeVideoFileProbe::with_duration(1_000),
            &crate::catalog::VideoExtensionAllowlist::default(),
        )
        .expect("movies root refreshes");
    catalog
        .refresh_scan_root(
            &backup_scan_root.path,
            &FakeVideoFileProbe::with_duration(1_000),
            &crate::catalog::VideoExtensionAllowlist::default(),
        )
        .expect("backup root refreshes");
    let first_video_id = video_id_for_title(&catalog.database, "family-trip");

    catalog
        .accept_metadata_suggestion_for_videos(
            &movies_scan_root.path,
            "Family",
            "Family",
            "tag",
            None,
            Some("Home Movies"),
            &[first_video_id],
        )
        .expect("metadata suggestion accepts");
    std::fs::write(
        movies_family_folder.join("birthday.mp4"),
        "valid birthday bytes",
    )
    .expect("new family video exists");

    catalog
        .refresh_scan_root(
            &movies_scan_root.path,
            &FakeVideoFileProbe::with_duration(1_000),
            &crate::catalog::VideoExtensionAllowlist::default(),
        )
        .expect("movies root refreshes again");
    catalog
        .refresh_scan_root(
            &backup_scan_root.path,
            &FakeVideoFileProbe::with_duration(1_000),
            &crate::catalog::VideoExtensionAllowlist::default(),
        )
        .expect("backup root refreshes again");

    let mapped_video_id = video_id_for_title(&catalog.database, "birthday");
    let different_source_video_id = video_id_for_title(&catalog.database, "travel-family");
    let different_scan_root_video_id = video_id_for_title(&catalog.database, "backup-family");
    assert_eq!(
        catalog
            .tags_for_video(mapped_video_id)
            .expect("mapped video tags list"),
        vec![crate::catalog::CatalogTag {
            id: 1,
            name: "Home Movies".to_string()
        }]
    );
    assert_eq!(
        catalog
            .tags_for_video(different_source_video_id)
            .expect("different source video tags list"),
        Vec::<crate::catalog::CatalogTag>::new()
    );
    assert_eq!(
        catalog
            .tags_for_video(different_scan_root_video_id)
            .expect("different scan root video tags list"),
        Vec::<crate::catalog::CatalogTag>::new()
    );
    assert_eq!(
        metadata_suggestion_sources(&catalog.database),
        vec![
            (
                "Family".to_string(),
                "Family".to_string(),
                "tag".to_string()
            ),
            (
                "Travel".to_string(),
                "Travel".to_string(),
                "tag".to_string()
            )
        ]
    );
}

#[test]
fn accepting_one_metadata_suggestion_kind_keeps_other_pending_kinds_with_the_same_value() {
    let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
    let catalog_path = temporary_folder.path().join("catalog.sqlite3");
    let catalog = Catalog::open(&catalog_path).expect("catalog opens");
    let movies_root = temporary_folder.path().join("Movies");
    let family_folder = movies_root.join("Family");
    std::fs::create_dir_all(&family_folder).expect("family folder exists");
    std::fs::write(family_folder.join("family-trip.mp4"), "valid video bytes")
        .expect("family video exists");
    let scan_root = catalog.add_scan_root(&movies_root).expect("scan root adds");
    catalog
        .refresh_scan_root(
            &scan_root.path,
            &FakeVideoFileProbe::with_duration(1_000),
            &crate::catalog::VideoExtensionAllowlist::default(),
        )
        .expect("scan root refreshes");
    let scan_root_id = catalog
        .scan_root_id(&scan_root.path)
        .expect("scan root id exists");
    let video_id = video_id_for_title(&catalog.database, "family-trip");
    catalog
        .database
        .execute(
            "INSERT INTO metadata_suggestions (
                    scan_root_id,
                    video_id,
                    source_path_segment,
                    suggested_value,
                    suggestion_kind
                 )
                 VALUES (?1, ?2, 'Family', 'Family', 'performer')",
            params![scan_root_id, video_id],
        )
        .expect("performer suggestion inserts");

    catalog
        .accept_metadata_suggestion_for_videos(
            &scan_root.path,
            "Family",
            "Family",
            "tag",
            None,
            None,
            &[video_id],
        )
        .expect("tag suggestion accepts");

    let remaining_suggestion_groups = catalog
        .list_metadata_suggestion_groups()
        .expect("metadata suggestions list");
    assert_eq!(remaining_suggestion_groups.len(), 1);
    assert_eq!(remaining_suggestion_groups[0].suggestion_kind, "performer");
    assert_eq!(remaining_suggestion_groups[0].suggested_value, "Family");
}

#[test]
fn rejecting_metadata_suggestion_source_suppresses_repeated_suggestions_for_the_same_source_value()
{
    let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
    let catalog_path = temporary_folder.path().join("catalog.sqlite3");
    let catalog = Catalog::open(&catalog_path).expect("catalog opens");
    let movies_root = temporary_folder.path().join("Movies");
    let family_folder = movies_root.join("Family");
    std::fs::create_dir_all(&family_folder).expect("family folder exists");
    std::fs::write(family_folder.join("family-trip.mp4"), "valid video bytes")
        .expect("family video exists");
    let scan_root = catalog.add_scan_root(&movies_root).expect("scan root adds");
    catalog
        .refresh_scan_root(
            &scan_root.path,
            &FakeVideoFileProbe::with_duration(1_000),
            &crate::catalog::VideoExtensionAllowlist::default(),
        )
        .expect("scan root refreshes");

    catalog
        .reject_metadata_suggestion_source(&scan_root.path, "Family", "Family", "tag")
        .expect("metadata suggestion rejects");
    catalog
        .refresh_scan_root(
            &scan_root.path,
            &FakeVideoFileProbe::with_duration(1_000),
            &crate::catalog::VideoExtensionAllowlist::default(),
        )
        .expect("scan root refreshes again");

    assert_eq!(
        catalog
            .list_metadata_suggestion_groups()
            .expect("metadata suggestions list"),
        Vec::<crate::catalog::MetadataSuggestionGroup>::new()
    );
    assert!(family_folder.join("family-trip.mp4").exists());
}

#[test]
fn rejected_metadata_suggestion_source_suppresses_new_videos_from_the_same_source_value() {
    let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
    let catalog_path = temporary_folder.path().join("catalog.sqlite3");
    let catalog = Catalog::open(&catalog_path).expect("catalog opens");
    let movies_root = temporary_folder.path().join("Movies");
    let family_folder = movies_root.join("Family");
    std::fs::create_dir_all(&family_folder).expect("family folder exists");
    std::fs::write(
        family_folder.join("family-trip.mp4"),
        "valid family trip bytes",
    )
    .expect("family video exists");
    let scan_root = catalog.add_scan_root(&movies_root).expect("scan root adds");
    catalog
        .refresh_scan_root(
            &scan_root.path,
            &FakeVideoFileProbe::with_duration(1_000),
            &crate::catalog::VideoExtensionAllowlist::default(),
        )
        .expect("scan root refreshes");
    catalog
        .reject_metadata_suggestion_source(&scan_root.path, "Family", "Family", "tag")
        .expect("metadata suggestion rejects");
    std::fs::write(family_folder.join("birthday.mp4"), "valid birthday bytes")
        .expect("new family video exists");

    catalog
        .refresh_scan_root(
            &scan_root.path,
            &FakeVideoFileProbe::with_duration(1_000),
            &crate::catalog::VideoExtensionAllowlist::default(),
        )
        .expect("scan root refreshes again");

    assert_eq!(
        catalog
            .list_metadata_suggestion_groups()
            .expect("metadata suggestions list"),
        Vec::<crate::catalog::MetadataSuggestionGroup>::new()
    );
}

#[test]
fn accepting_metadata_suggestion_rejects_videos_without_a_pending_matching_suggestion() {
    let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
    let catalog_path = temporary_folder.path().join("catalog.sqlite3");
    let catalog = Catalog::open(&catalog_path).expect("catalog opens");
    let movies_root = temporary_folder.path().join("Movies");
    let family_folder = movies_root.join("Family");
    let travel_folder = movies_root.join("Travel");
    std::fs::create_dir_all(&family_folder).expect("family folder exists");
    std::fs::create_dir_all(&travel_folder).expect("travel folder exists");
    std::fs::write(
        family_folder.join("family-trip.mp4"),
        "valid family trip bytes",
    )
    .expect("family video exists");
    std::fs::write(
        travel_folder.join("travel-trip.mp4"),
        "valid travel trip bytes",
    )
    .expect("travel video exists");
    let scan_root = catalog.add_scan_root(&movies_root).expect("scan root adds");
    catalog
        .refresh_scan_root(
            &scan_root.path,
            &FakeVideoFileProbe::with_duration(1_000),
            &crate::catalog::VideoExtensionAllowlist::default(),
        )
        .expect("scan root refreshes");
    let travel_video_id = video_id_for_title(&catalog.database, "travel-trip");

    let accept_error = catalog
        .accept_metadata_suggestion_for_videos(
            &scan_root.path,
            "Family",
            "Family",
            "tag",
            None,
            None,
            &[travel_video_id],
        )
        .expect_err("unmatched suggestion acceptance is rejected");

    assert_eq!(
        accept_error,
        "Selected Videos must have pending Metadata Suggestions"
    );
    assert_eq!(
        catalog
            .tags_for_video(travel_video_id)
            .expect("travel video tags list"),
        Vec::<crate::catalog::CatalogTag>::new()
    );
}

#[test]
fn invalid_scan_root_inference_rules_are_rejected() {
    let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
    let catalog_path = temporary_folder.path().join("catalog.sqlite3");
    let catalog = Catalog::open(&catalog_path).expect("catalog opens");
    let movies_root = temporary_folder.path().join("Movies");
    std::fs::create_dir_all(&movies_root).expect("movies root exists");
    let scan_root = catalog.add_scan_root(&movies_root).expect("scan root adds");

    let update_error = catalog
        .update_scan_root_inference_rules(
            &scan_root.path,
            crate::catalog::ScanRootInferenceRules {
                suggest_tags_from_child_folders: true,
                suggest_performers_from_child_folders: false,
                ignored_folder_names: vec![" ".to_string()],
                ignored_exact_year_range: crate::catalog::ExactYearRange {
                    start_year: 2100,
                    end_year: 1900,
                },
            },
        )
        .expect_err("invalid rules are rejected");

    assert_eq!(
        update_error,
        "Ignored exact year range start must be before or equal to end"
    );
}
