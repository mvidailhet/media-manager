mod catalog;

use std::path::PathBuf;
use std::sync::Mutex;

use catalog::{Catalog, CatalogVideo};
use tauri::Manager;

const LOCAL_DESKTOP_APP_STATUS: &str = "Rust command online";
const CATALOG_DATABASE_FILENAME: &str = "catalog.sqlite3";

struct CatalogState {
    catalog: Mutex<Catalog>,
}

fn local_desktop_app_status() -> &'static str {
    LOCAL_DESKTOP_APP_STATUS
}

fn catalog_path(app: &tauri::App) -> Result<PathBuf, String> {
    let app_data_folder = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;
    std::fs::create_dir_all(&app_data_folder).map_err(|error| error.to_string())?;

    Ok(app_data_folder.join(CATALOG_DATABASE_FILENAME))
}

fn initialize_catalog(app: &tauri::App) -> Result<(), String> {
    let catalog_path = catalog_path(app)?;
    let catalog = Catalog::open(&catalog_path)?;
    let catalog_state = CatalogState {
        catalog: Mutex::new(catalog),
    };

    app.manage(catalog_state);

    Ok(())
}

#[tauri::command]
fn get_local_desktop_app_status() -> &'static str {
    local_desktop_app_status()
}

#[tauri::command]
fn list_catalog_videos(
    catalog_state: tauri::State<'_, CatalogState>,
) -> Result<Vec<CatalogVideo>, String> {
    let catalog = catalog_state
        .catalog
        .lock()
        .map_err(|error| error.to_string())?;

    catalog.listed_videos()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            initialize_catalog(app).map_err(|error| {
                Box::<dyn std::error::Error>::from(std::io::Error::new(
                    std::io::ErrorKind::Other,
                    error,
                ))
            })
        })
        .invoke_handler(tauri::generate_handler![
            get_local_desktop_app_status,
            list_catalog_videos
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::{local_desktop_app_status, CATALOG_DATABASE_FILENAME};

    #[test]
    fn local_desktop_app_status_describes_the_tauri_bridge() {
        assert_eq!(local_desktop_app_status(), "Rust command online");
    }

    #[test]
    fn catalog_database_filename_is_app_private_sqlite_storage() {
        assert_eq!(CATALOG_DATABASE_FILENAME, "catalog.sqlite3");
    }
}
