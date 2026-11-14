use tauri_plugin_sql::{Migration, MigrationKind};

/// Must match `DB_URL` in src/lib/db.ts.
const DB_URL: &str = "sqlite:weg.db";

/// Append only. Never edit a migration that has shipped; add the next version.
fn migrations() -> Vec<Migration> {
    vec![Migration {
        version: 1,
        description: "init",
        sql: include_str!("../migrations/0001_init.sql"),
        kind: MigrationKind::Up,
    }]
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(DB_URL, migrations())
                .build(),
        )
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn migration_versions_are_sequential_from_one() {
        let versions: Vec<i64> = migrations().iter().map(|m| m.version).collect();
        let expected: Vec<i64> = (1..=versions.len() as i64).collect();
        assert_eq!(versions, expected);
    }
}
