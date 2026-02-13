package tables

import (
	"database/sql"
	"fmt"
)

func init() {
	MigrationClient.AddMigration(Up_20260212000000, Down_20260212000000)
}

func Up_20260212000000(tx *sql.Tx) error {
	_, err := tx.Exec(`CREATE TABLE IF NOT EXISTS host_app_usage (
    id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    host_id         INT UNSIGNED NOT NULL,
    bundle_identifier VARCHAR(255) NOT NULL,
    app_name        VARCHAR(255) NOT NULL DEFAULT '',
    active_seconds  BIGINT UNSIGNED NOT NULL DEFAULT 0,
    usage_date      DATE NOT NULL,
    created_at      TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at      TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    UNIQUE KEY idx_host_bundle_date (host_id, bundle_identifier, usage_date),
    KEY idx_usage_date (usage_date),
    KEY idx_bundle (bundle_identifier)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)
	if err != nil {
		return fmt.Errorf("failed to create host_app_usage table: %w", err)
	}
	return nil
}

func Down_20260212000000(tx *sql.Tx) error {
	return nil
}
