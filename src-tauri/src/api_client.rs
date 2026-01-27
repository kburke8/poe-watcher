use anyhow::Result;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::Mutex;

const POE_API_BASE: &str = "https://www.pathofexile.com";
const USER_AGENT: &str = "POE-Watcher/0.1.0 (contact: poe-watcher@example.com)";

/// Rate limiter using token bucket algorithm
struct RateLimiter {
    tokens: f64,
    max_tokens: f64,
    refill_rate: f64, // tokens per second
    last_update: Instant,
}

impl RateLimiter {
    fn new(max_tokens: f64, refill_rate: f64) -> Self {
        RateLimiter {
            tokens: max_tokens,
            max_tokens,
            refill_rate,
            last_update: Instant::now(),
        }
    }

    fn try_acquire(&mut self) -> bool {
        self.refill();
        if self.tokens >= 1.0 {
            self.tokens -= 1.0;
            true
        } else {
            false
        }
    }

    fn refill(&mut self) {
        let now = Instant::now();
        let elapsed = now.duration_since(self.last_update).as_secs_f64();
        self.tokens = (self.tokens + elapsed * self.refill_rate).min(self.max_tokens);
        self.last_update = now;
    }

    fn time_until_available(&self) -> Duration {
        if self.tokens >= 1.0 {
            Duration::ZERO
        } else {
            let needed = 1.0 - self.tokens;
            Duration::from_secs_f64(needed / self.refill_rate)
        }
    }
}

/// Response cache entry
struct CacheEntry<T> {
    data: T,
    expires_at: Instant,
}

/// POE API client with rate limiting and caching
pub struct PoeApiClient {
    client: Client,
    rate_limiter: Arc<Mutex<RateLimiter>>,
    cache: Arc<Mutex<HashMap<String, CacheEntry<String>>>>,
}

impl PoeApiClient {
    pub fn new() -> Self {
        let client = Client::builder()
            .user_agent(USER_AGENT)
            .timeout(Duration::from_secs(30))
            .build()
            .expect("Failed to create HTTP client");

        PoeApiClient {
            client,
            // 5 requests per second with burst of 10
            rate_limiter: Arc::new(Mutex::new(RateLimiter::new(10.0, 5.0))),
            cache: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Wait for rate limiter before making a request
    async fn wait_for_rate_limit(&self) {
        loop {
            let wait_time = {
                let mut limiter = self.rate_limiter.lock().await;
                if limiter.try_acquire() {
                    return;
                }
                limiter.time_until_available()
            };
            tokio::time::sleep(wait_time).await;
        }
    }

    /// Check cache for a URL
    async fn get_cached(&self, url: &str) -> Option<String> {
        let cache = self.cache.lock().await;
        if let Some(entry) = cache.get(url) {
            if entry.expires_at > Instant::now() {
                return Some(entry.data.clone());
            }
        }
        None
    }

    /// Add response to cache
    async fn cache_response(&self, url: &str, data: String, ttl: Duration) {
        let mut cache = self.cache.lock().await;
        cache.insert(
            url.to_string(),
            CacheEntry {
                data,
                expires_at: Instant::now() + ttl,
            },
        );
    }

    /// Get characters for an account (public API)
    pub async fn get_characters(&self, account_name: &str) -> Result<Vec<PoeCharacter>> {
        let url = format!(
            "{}/character-window/get-characters?accountName={}",
            POE_API_BASE,
            urlencoding::encode(account_name)
        );

        // Check cache first
        if let Some(cached) = self.get_cached(&url).await {
            return Ok(serde_json::from_str(&cached)?);
        }

        self.wait_for_rate_limit().await;

        let response = self.client.get(&url).send().await?;

        if response.status() == 403 {
            return Err(anyhow::anyhow!(
                "Profile is private. Please set your POE profile to public in account settings."
            ));
        }

        if response.status() == 429 {
            return Err(anyhow::anyhow!("Rate limited. Please try again later."));
        }

        let text = response.text().await?;
        self.cache_response(&url, text.clone(), Duration::from_secs(60)).await;

        Ok(serde_json::from_str(&text)?)
    }

    /// Get items for a character (public API)
    pub async fn get_items(
        &self,
        account_name: &str,
        character_name: &str,
    ) -> Result<CharacterItems> {
        let url = format!(
            "{}/character-window/get-items?accountName={}&character={}",
            POE_API_BASE,
            urlencoding::encode(account_name),
            urlencoding::encode(character_name)
        );

        if let Some(cached) = self.get_cached(&url).await {
            return Ok(serde_json::from_str(&cached)?);
        }

        self.wait_for_rate_limit().await;

        let response = self.client.get(&url).send().await?;

        if response.status() == 403 {
            return Err(anyhow::anyhow!(
                "Profile is private. Please set your POE profile to public in account settings."
            ));
        }

        if response.status() == 429 {
            return Err(anyhow::anyhow!("Rate limited. Please try again later."));
        }

        let text = response.text().await?;

        // Debug: log the character portion of the response
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&text) {
            if let Some(character) = json.get("character") {
                println!("[API get_items] Character data from API: {}", character);
            }
        }

        self.cache_response(&url, text.clone(), Duration::from_secs(30)).await;

        Ok(serde_json::from_str(&text)?)
    }

    /// Get passive skills for a character (public API)
    pub async fn get_passive_skills(
        &self,
        account_name: &str,
        character_name: &str,
    ) -> Result<PassiveSkills> {
        let url = format!(
            "{}/character-window/get-passive-skills?accountName={}&character={}",
            POE_API_BASE,
            urlencoding::encode(account_name),
            urlencoding::encode(character_name)
        );

        if let Some(cached) = self.get_cached(&url).await {
            return Ok(serde_json::from_str(&cached)?);
        }

        self.wait_for_rate_limit().await;

        let response = self.client.get(&url).send().await?;

        if response.status() == 403 {
            return Err(anyhow::anyhow!(
                "Profile is private. Please set your POE profile to public in account settings."
            ));
        }

        if response.status() == 429 {
            return Err(anyhow::anyhow!("Rate limited. Please try again later."));
        }

        let text = response.text().await?;
        self.cache_response(&url, text.clone(), Duration::from_secs(30)).await;

        Ok(serde_json::from_str(&text)?)
    }
}

// ============================================================================
// API Response Types
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PoeCharacter {
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub league: String,
    #[serde(rename = "classId", default)]
    pub class_id: u32,
    #[serde(rename = "ascendancyClass", default)]
    pub ascendancy_class: u32,
    #[serde(default)]
    pub class: String,
    #[serde(default)]
    pub level: u32,
    #[serde(default)]
    pub experience: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CharacterItems {
    pub items: Vec<PoeItem>,
    pub character: PoeCharacterInfo,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PoeCharacterInfo {
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub league: String,
    #[serde(rename = "classId", default)]
    pub class_id: u32,
    #[serde(rename = "ascendancyClass", default)]
    pub ascendancy_class: u32,
    #[serde(default)]
    pub class: String,
    #[serde(default)]
    pub level: u32,
    #[serde(default)]
    pub experience: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PoeItem {
    #[serde(default)]
    pub id: String,
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub type_line: String,
    #[serde(default)]
    pub icon: String,
    #[serde(default)]
    pub inventory_id: String,
    #[serde(default)]
    pub socketed_items: Vec<PoeItem>,
    #[serde(default)]
    pub sockets: Vec<PoeSocket>,
    #[serde(default)]
    pub explicit_mods: Vec<String>,
    #[serde(default)]
    pub implicit_mods: Vec<String>,
    #[serde(default)]
    pub frame_type: u32,
    pub x: Option<u32>,
    pub y: Option<u32>,
    #[serde(default)]
    pub w: u32,
    #[serde(default)]
    pub h: u32,
    #[serde(rename = "ilvl", default)]
    pub item_level: u32,
    #[serde(default)]
    pub properties: Vec<ItemProperty>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ItemProperty {
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub values: Vec<PropertyValue>,
}

// POE API returns values as [value, display_mode] where value can be string or number
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum PropertyValue {
    StringValue(String, u32),
    NumberValue(f64, u32),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PoeSocket {
    #[serde(default)]
    pub group: u32,
    #[serde(default)]
    pub attr: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PassiveSkills {
    pub hashes: Vec<u32>,
    #[serde(default)]
    pub hashes_ex: Vec<u32>,
    #[serde(default)]
    pub mastery_effects: HashMap<String, u32>,
}

impl Default for PoeApiClient {
    fn default() -> Self {
        Self::new()
    }
}
