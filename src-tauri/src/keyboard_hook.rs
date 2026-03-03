use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, OnceLock, RwLock};
use tauri::{AppHandle, Emitter};

#[cfg(windows)]
use windows::Win32::Foundation::{LPARAM, LRESULT, WPARAM};
#[cfg(windows)]
use windows::Win32::UI::Input::KeyboardAndMouse::{
    GetKeyState, VK_CONTROL, VK_LCONTROL, VK_LMENU, VK_LSHIFT, VK_MENU, VK_RCONTROL, VK_RMENU,
    VK_RSHIFT, VK_SHIFT,
};
#[cfg(windows)]
use windows::Win32::UI::WindowsAndMessaging::{
    CallNextHookEx, GetMessageW, SetWindowsHookExW, UnhookWindowsHookEx,
    KBDLLHOOKSTRUCT, MSG, WH_KEYBOARD_LL, WM_KEYDOWN, WM_SYSKEYDOWN,
};

/// A single hotkey binding: modifier flags + virtual key code + action name.
#[derive(Debug, Clone)]
pub struct HotkeyBinding {
    pub ctrl: bool,
    pub shift: bool,
    pub alt: bool,
    pub vk_code: u16,
    pub action: String,
}

/// Global state shared between the hook callback and the manager.
struct HookState {
    enabled: AtomicBool,
    bindings: RwLock<Vec<HotkeyBinding>>,
    app_handle: AppHandle,
}

static HOOK_STATE: OnceLock<Arc<HookState>> = OnceLock::new();

/// Manager for the low-level keyboard hook. Stored as Tauri managed state.
pub struct KeyboardHookManager;

impl KeyboardHookManager {
    /// Start the keyboard hook on a dedicated background thread.
    /// This must be called from the main/setup thread.
    pub fn start(app_handle: AppHandle, bindings: Vec<HotkeyBinding>) -> Self {
        let state = Arc::new(HookState {
            enabled: AtomicBool::new(true),
            bindings: RwLock::new(bindings),
            app_handle,
        });

        // Store globally so the hook proc can access it
        let _ = HOOK_STATE.set(state);

        // Spawn a dedicated OS thread (not a tokio task) for the message loop.
        // The LL keyboard hook requires a thread with a Windows message pump.
        #[cfg(windows)]
        std::thread::Builder::new()
            .name("keyboard-hook".into())
            .spawn(move || unsafe {
                let hook = SetWindowsHookExW(WH_KEYBOARD_LL, Some(keyboard_hook_proc), None, 0);

                match hook {
                    Ok(hook) => {
                        eprintln!("[keyboard_hook] Low-level keyboard hook installed");

                        // Run the message loop — required for LL hooks to work.
                        let mut msg = MSG::default();
                        while GetMessageW(&mut msg, None, 0, 0).as_bool() {
                            // We don't dispatch; the hook callback is invoked directly by the OS.
                        }

                        // Cleanup when the message loop exits (app shutdown)
                        let _ = UnhookWindowsHookEx(hook);
                        eprintln!("[keyboard_hook] Hook uninstalled");
                    }
                    Err(e) => {
                        eprintln!("[keyboard_hook] Failed to install hook: {:?}", e);
                    }
                }
            })
            .expect("Failed to spawn keyboard hook thread");

        KeyboardHookManager
    }

    /// Temporarily disable hotkey detection (e.g., while capturing a new binding).
    pub fn suspend(&self) {
        if let Some(state) = HOOK_STATE.get() {
            state.enabled.store(false, Ordering::SeqCst);
            eprintln!("[keyboard_hook] Hotkeys suspended");
        }
    }

    /// Re-enable hotkey detection.
    pub fn resume(&self) {
        if let Some(state) = HOOK_STATE.get() {
            state.enabled.store(true, Ordering::SeqCst);
            eprintln!("[keyboard_hook] Hotkeys resumed");
        }
    }

    /// Replace the current hotkey bindings with a new set.
    pub fn update_bindings(&self, bindings: Vec<HotkeyBinding>) {
        if let Some(state) = HOOK_STATE.get() {
            if let Ok(mut guard) = state.bindings.write() {
                *guard = bindings;
                eprintln!("[keyboard_hook] Bindings updated");
            }
        }
    }
}

/// The low-level keyboard hook callback.
/// Called by Windows for every keyboard event system-wide.
/// Always calls `CallNextHookEx` to pass the event through (non-consuming).
#[cfg(windows)]
unsafe extern "system" fn keyboard_hook_proc(
    n_code: i32,
    w_param: WPARAM,
    l_param: LPARAM,
) -> LRESULT {
    if n_code >= 0 {
        let msg_type = w_param.0 as u32;
        if msg_type == WM_KEYDOWN || msg_type == WM_SYSKEYDOWN {
            if let Some(state) = HOOK_STATE.get() {
                if state.enabled.load(Ordering::SeqCst) {
                    let kb_struct = &*(l_param.0 as *const KBDLLHOOKSTRUCT);
                    let vk = kb_struct.vkCode as u16;

                    // Check modifier states
                    let ctrl_down = is_key_down(VK_CONTROL.0)
                        || is_key_down(VK_LCONTROL.0)
                        || is_key_down(VK_RCONTROL.0);
                    let shift_down = is_key_down(VK_SHIFT.0)
                        || is_key_down(VK_LSHIFT.0)
                        || is_key_down(VK_RSHIFT.0);
                    let alt_down = is_key_down(VK_MENU.0)
                        || is_key_down(VK_LMENU.0)
                        || is_key_down(VK_RMENU.0);

                    // Match against configured bindings
                    if let Ok(bindings) = state.bindings.read() {
                        for binding in bindings.iter() {
                            if binding.vk_code == vk
                                && binding.ctrl == ctrl_down
                                && binding.shift == shift_down
                                && binding.alt == alt_down
                            {
                                let _ =
                                    state.app_handle.emit("global-shortcut", &binding.action);
                                break;
                            }
                        }
                    }
                }
            }
        }
    }

    // Always pass the event through — this is the key difference from RegisterHotKey
    CallNextHookEx(None, n_code, w_param, l_param)
}

/// Check whether a given virtual key is currently held down.
#[cfg(windows)]
#[inline]
unsafe fn is_key_down(vk: u16) -> bool {
    (GetKeyState(vk as i32) & 0x8000u16 as i16) != 0
}

/// Parse a shortcut string like "Ctrl+Shift+Space" into a `HotkeyBinding`.
/// Returns `None` if the key name is unrecognized.
pub fn parse_shortcut(shortcut_str: &str, action: &str) -> Option<HotkeyBinding> {
    let mut ctrl = false;
    let mut shift = false;
    let mut alt = false;
    let mut key_name: Option<&str> = None;

    for part in shortcut_str.split('+') {
        let part = part.trim();
        match part.to_lowercase().as_str() {
            "ctrl" | "control" => ctrl = true,
            "shift" => shift = true,
            "alt" => alt = true,
            _ => key_name = Some(part),
        }
    }

    let vk = key_name_to_vk(key_name?)?;
    Some(HotkeyBinding {
        ctrl,
        shift,
        alt,
        vk_code: vk,
        action: action.to_string(),
    })
}

/// Map a key name to a Windows virtual key code.
fn key_name_to_vk(name: &str) -> Option<u16> {
    // Handle single printable characters (letters, digits)
    if name.len() == 1 {
        let ch = name.chars().next()?;
        return match ch {
            'A'..='Z' | 'a'..='z' => Some(ch.to_ascii_uppercase() as u16),
            '0'..='9' => Some(ch as u16),
            _ => None,
        };
    }

    // Named keys
    match name.to_lowercase().as_str() {
        "space" => Some(0x20),       // VK_SPACE
        "enter" | "return" => Some(0x0D), // VK_RETURN
        "tab" => Some(0x09),         // VK_TAB
        "escape" | "esc" => Some(0x1B), // VK_ESCAPE
        "backspace" => Some(0x08),   // VK_BACK
        "delete" | "del" => Some(0x2E), // VK_DELETE
        "insert" | "ins" => Some(0x2D), // VK_INSERT
        "home" => Some(0x24),        // VK_HOME
        "end" => Some(0x23),         // VK_END
        "pageup" | "pgup" => Some(0x21), // VK_PRIOR
        "pagedown" | "pgdn" => Some(0x22), // VK_NEXT
        "up" | "arrowup" => Some(0x26), // VK_UP
        "down" | "arrowdown" => Some(0x28), // VK_DOWN
        "left" | "arrowleft" => Some(0x25), // VK_LEFT
        "right" | "arrowright" => Some(0x27), // VK_RIGHT
        "f1" => Some(0x70),
        "f2" => Some(0x71),
        "f3" => Some(0x72),
        "f4" => Some(0x73),
        "f5" => Some(0x74),
        "f6" => Some(0x75),
        "f7" => Some(0x76),
        "f8" => Some(0x77),
        "f9" => Some(0x78),
        "f10" => Some(0x79),
        "f11" => Some(0x7A),
        "f12" => Some(0x7B),
        "numpad0" | "num0" => Some(0x60),
        "numpad1" | "num1" => Some(0x61),
        "numpad2" | "num2" => Some(0x62),
        "numpad3" | "num3" => Some(0x63),
        "numpad4" | "num4" => Some(0x64),
        "numpad5" | "num5" => Some(0x65),
        "numpad6" | "num6" => Some(0x66),
        "numpad7" | "num7" => Some(0x67),
        "numpad8" | "num8" => Some(0x68),
        "numpad9" | "num9" => Some(0x69),
        "numpadadd" => Some(0x6B),
        "numpadsubtract" => Some(0x6D),
        "numpadmultiply" => Some(0x6A),
        "numpaddivide" => Some(0x6F),
        "numpaddecimal" => Some(0x6E),
        "semicolon" | ";" => Some(0xBA), // VK_OEM_1
        "equal" | "=" => Some(0xBB),     // VK_OEM_PLUS
        "comma" | "," => Some(0xBC),     // VK_OEM_COMMA
        "minus" | "-" => Some(0xBD),     // VK_OEM_MINUS
        "period" | "." => Some(0xBE),    // VK_OEM_PERIOD
        "slash" | "/" => Some(0xBF),     // VK_OEM_2
        "backquote" | "`" => Some(0xC0), // VK_OEM_3
        "bracketleft" | "[" => Some(0xDB), // VK_OEM_4
        "backslash" | "\\" => Some(0xDC), // VK_OEM_5
        "bracketright" | "]" => Some(0xDD), // VK_OEM_6
        "quote" | "'" => Some(0xDE),    // VK_OEM_7
        _ => None,
    }
}
