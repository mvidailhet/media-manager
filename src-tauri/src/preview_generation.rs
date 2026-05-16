#[cfg(test)]
use std::path::Path;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex,
};

use serde::Serialize;

use crate::catalog::{
    Catalog, PreviewStripGenerationSummary, PreviewStripGenerator, PreviewStripQueueCounts,
    PreviewStripRequest, PREVIEW_STRIP_GENERATION_CANCELLED_REASON,
};

#[derive(Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewGenerationStatus {
    pub pending_count: i64,
    pub running_count: i64,
    pub running_video_id: Option<i64>,
    pub failed_count: i64,
    pub is_paused: bool,
}

pub struct PreviewGenerationRuntime {
    is_paused: Mutex<bool>,
    running_count: Mutex<i64>,
    running_video_id: Mutex<Option<i64>>,
    stop_requested: Arc<AtomicBool>,
}

impl PreviewGenerationRuntime {
    pub fn paused() -> Self {
        Self {
            is_paused: Mutex::new(true),
            running_count: Mutex::new(0),
            running_video_id: Mutex::new(None),
            stop_requested: Arc::new(AtomicBool::new(false)),
        }
    }

    pub fn stop_requested(&self) -> Arc<AtomicBool> {
        Arc::clone(&self.stop_requested)
    }

    pub fn request_stop(&self) {
        self.stop_requested.store(true, Ordering::SeqCst);
    }

    pub fn status(
        &self,
        preview_strip_queue_counts: PreviewStripQueueCounts,
    ) -> Result<PreviewGenerationStatus, String> {
        Ok(PreviewGenerationStatus {
            pending_count: preview_strip_queue_counts.pending_count,
            running_count: *self
                .running_count
                .lock()
                .map_err(|error| error.to_string())?,
            running_video_id: *self
                .running_video_id
                .lock()
                .map_err(|error| error.to_string())?,
            failed_count: preview_strip_queue_counts.failed_count,
            is_paused: *self.is_paused.lock().map_err(|error| error.to_string())?,
        })
    }

    pub fn pause(&self) -> Result<(), String> {
        *self.is_paused.lock().map_err(|error| error.to_string())? = true;
        self.stop_requested.store(true, Ordering::SeqCst);

        Ok(())
    }

    pub fn resume(&self) -> Result<(), String> {
        *self.is_paused.lock().map_err(|error| error.to_string())? = false;

        Ok(())
    }

    pub fn try_start(&self) -> Result<PreviewGenerationStart, String> {
        if *self.is_paused.lock().map_err(|error| error.to_string())? {
            return Ok(PreviewGenerationStart::Paused);
        }

        let mut running_count = self
            .running_count
            .lock()
            .map_err(|error| error.to_string())?;
        if *running_count > 0 {
            Ok(PreviewGenerationStart::AlreadyRunning)
        } else {
            *running_count = 1;
            Ok(PreviewGenerationStart::Started)
        }
    }

    pub fn mark_running_video(&self, video_id: i64) -> Result<(), String> {
        self.stop_requested.store(false, Ordering::SeqCst);
        *self
            .running_video_id
            .lock()
            .map_err(|error| error.to_string())? = Some(video_id);

        Ok(())
    }

    pub fn finish_running_video(&self) {
        if let Ok(mut running_count) = self.running_count.lock() {
            *running_count = 0;
        }
        if let Ok(mut running_video_id) = self.running_video_id.lock() {
            *running_video_id = None;
        }
    }
}

pub enum PreviewGenerationStart {
    Paused,
    AlreadyRunning,
    Started,
}

pub fn process_preview_strip_request<G: PreviewStripGenerator>(
    catalog: &Catalog,
    preview_strip_generator: &G,
    request: &PreviewStripRequest,
) -> Result<PreviewStripGenerationSummary, String> {
    match preview_strip_generator.generate_preview_strip(request) {
        Ok(generated_preview_strip) => {
            catalog.store_generated_preview_strip(request.video_id, &generated_preview_strip)?;
            Ok(PreviewStripGenerationSummary {
                generated_preview_strip_count: 1,
                failed_preview_strip_count: 0,
            })
        }
        Err(reason) => {
            if reason == PREVIEW_STRIP_GENERATION_CANCELLED_REASON {
                Ok(PreviewStripGenerationSummary {
                    generated_preview_strip_count: 0,
                    failed_preview_strip_count: 0,
                })
            } else {
                catalog.store_failed_preview_strip(request.video_id, &reason)?;
                Ok(PreviewStripGenerationSummary {
                    generated_preview_strip_count: 0,
                    failed_preview_strip_count: 1,
                })
            }
        }
    }
}

#[cfg(test)]
pub struct PreviewGenerationWork<'a, G> {
    catalog: &'a Catalog,
    preview_cache_path: &'a Path,
    preview_strip_generator: &'a G,
}

#[cfg(test)]
impl<'a, G: PreviewStripGenerator> PreviewGenerationWork<'a, G> {
    pub fn new(
        catalog: &'a Catalog,
        preview_cache_path: &'a Path,
        preview_strip_generator: &'a G,
    ) -> Self {
        Self {
            catalog,
            preview_cache_path,
            preview_strip_generator,
        }
    }

    pub fn process_missing_preview_strips(&self) -> Result<PreviewStripGenerationSummary, String> {
        let mut generation_summary = PreviewStripGenerationSummary {
            generated_preview_strip_count: 0,
            failed_preview_strip_count: 0,
        };

        for request in self
            .catalog
            .pending_preview_strip_requests(self.preview_cache_path)?
        {
            let item_summary = process_preview_strip_request(
                self.catalog,
                self.preview_strip_generator,
                &request,
            )?;
            generation_summary.generated_preview_strip_count +=
                item_summary.generated_preview_strip_count;
            generation_summary.failed_preview_strip_count +=
                item_summary.failed_preview_strip_count;
        }

        Ok(generation_summary)
    }

    pub fn process_next_preview_strip(&self) -> Result<PreviewStripGenerationSummary, String> {
        let Some(request) = self
            .catalog
            .pending_preview_strip_requests(self.preview_cache_path)?
            .into_iter()
            .next()
        else {
            return Ok(PreviewStripGenerationSummary {
                generated_preview_strip_count: 0,
                failed_preview_strip_count: 0,
            });
        };

        process_preview_strip_request(self.catalog, self.preview_strip_generator, &request)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::catalog::{
        GeneratedPreviewStrip, PreviewStripRequest, PREVIEW_STRIP_GENERATION_CANCELLED_REASON,
    };
    use rusqlite::Connection;

    #[test]
    fn paused_runtime_requests_generation_stop() {
        let preview_generation_runtime = PreviewGenerationRuntime::paused();
        preview_generation_runtime
            .resume()
            .expect("runtime resumes");

        preview_generation_runtime.pause().expect("runtime pauses");

        assert!(preview_generation_runtime
            .stop_requested()
            .load(Ordering::SeqCst));
    }

    #[test]
    fn runtime_allows_one_active_preview_strip_generation() {
        let preview_generation_runtime = PreviewGenerationRuntime::paused();
        preview_generation_runtime
            .resume()
            .expect("runtime resumes");

        assert!(matches!(
            preview_generation_runtime
                .try_start()
                .expect("generation starts"),
            PreviewGenerationStart::Started
        ));
        assert!(matches!(
            preview_generation_runtime
                .try_start()
                .expect("second start is rejected"),
            PreviewGenerationStart::AlreadyRunning
        ));
        preview_generation_runtime.finish_running_video();

        assert!(matches!(
            preview_generation_runtime
                .try_start()
                .expect("generation restarts"),
            PreviewGenerationStart::Started
        ));
    }

    #[test]
    fn user_cancelled_generation_returns_video_to_pending_preview_strip() {
        let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
        let catalog_path = temporary_folder.path().join("catalog.sqlite3");
        let preview_cache_path = temporary_folder.path().join("Preview Cache");
        let catalog = Catalog::open(&catalog_path).expect("catalog opens");
        let movies_root = temporary_folder.path().join("Movies");
        std::fs::create_dir_all(&movies_root).expect("movies root exists");
        catalog
            .add_scan_root(&movies_root)
            .expect("movies scan root adds");
        let database = Connection::open(&catalog_path).expect("catalog database opens");
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
            .expect("file location persists");
        let preview_strip_generator = CancelledPreviewStripGenerator;

        let generation_summary =
            PreviewGenerationWork::new(&catalog, &preview_cache_path, &preview_strip_generator)
                .process_next_preview_strip()
                .expect("cancelled preview strip process completes");

        assert_eq!(
            generation_summary,
            PreviewStripGenerationSummary {
                generated_preview_strip_count: 0,
                failed_preview_strip_count: 0,
            }
        );
        assert_eq!(
            catalog
                .preview_strip_queue_counts()
                .expect("preview queue counts load"),
            PreviewStripQueueCounts {
                pending_count: 1,
                failed_count: 0,
            }
        );
    }

    struct CancelledPreviewStripGenerator;

    impl PreviewStripGenerator for CancelledPreviewStripGenerator {
        fn generate_preview_strip(
            &self,
            _request: &PreviewStripRequest,
        ) -> Result<GeneratedPreviewStrip, String> {
            Err(PREVIEW_STRIP_GENERATION_CANCELLED_REASON.to_string())
        }
    }
}
