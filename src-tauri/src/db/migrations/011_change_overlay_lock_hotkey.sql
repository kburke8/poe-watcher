-- Change default overlay lock hotkey from Ctrl+Shift+O to Ctrl+Shift+L
-- to avoid conflicts with other applications that commonly register Ctrl+Shift+O
UPDATE settings SET hotkey_toggle_overlay_lock = 'Ctrl+Shift+L' WHERE hotkey_toggle_overlay_lock = 'Ctrl+Shift+O';

-- Change default overlay scale from medium to small
UPDATE settings SET overlay_scale = 'small' WHERE overlay_scale = 'medium';
