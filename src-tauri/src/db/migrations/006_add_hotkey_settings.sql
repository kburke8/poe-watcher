ALTER TABLE settings ADD COLUMN hotkey_toggle_timer TEXT NOT NULL DEFAULT 'Ctrl+Space';
ALTER TABLE settings ADD COLUMN hotkey_reset_timer TEXT NOT NULL DEFAULT 'Ctrl+Shift+Space';
ALTER TABLE settings ADD COLUMN hotkey_manual_snapshot TEXT NOT NULL DEFAULT 'Ctrl+Alt+Space';
ALTER TABLE settings ADD COLUMN hotkey_toggle_overlay TEXT NOT NULL DEFAULT 'Ctrl+O';
ALTER TABLE settings ADD COLUMN hotkey_toggle_overlay_lock TEXT NOT NULL DEFAULT 'Ctrl+Shift+O';
