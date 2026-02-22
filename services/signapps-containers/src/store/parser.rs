use std::collections::HashMap;

use super::types::*;
use rand::Rng;

/// Strip store template directives (`{if ...}`, `{/if}`, `{else}`) and fix
/// resulting JSON/YAML syntax (trailing/leading commas).
fn strip_store_templates(text: &str) -> String {
    let mut lines: Vec<&str> = Vec::new();
    for line in text.lines() {
        let trimmed = line.trim();
        // Skip template conditionals
        if trimmed.starts_with("{if ")
            || trimmed.starts_with("{/if")
            || trimmed.starts_with("{else")
        {
            continue;
        }
        lines.push(line);
    }
    let joined = lines.join("\n");

    // Fix commas: remove leading commas after [ or { and trailing commas before ] or }
    // e.g. "[\n," → "[\n" and ",\n]" → "\n]"
    let re_leading = regex::Regex::new(r"([\[\{])\s*,").unwrap();
    let cleaned = re_leading.replace_all(&joined, "$1");
    let re_trailing = regex::Regex::new(r",(\s*[\]\}])").unwrap();
    let cleaned = re_trailing.replace_all(&cleaned, "$1");
    // Also fix double commas
    let re_double = regex::Regex::new(r",\s*,").unwrap();
    re_double.replace_all(&cleaned, ",").to_string()
}

/// Resolve store template variables in a string value.
///
/// Supported patterns:
/// - `{Passwords.*.SEED}` → random 16-char alphanumeric password
/// - `{Passwords.*.LENGTH.SEED}` → random password of LENGTH chars
/// - `{ServiceName}` → replaced with the given service name
/// - `{Context.*}` → removed (not applicable in this context)
pub fn resolve_store_templates(value: &str, service_name: &str) -> String {
    if !value.contains('{') {
        return value.to_string();
    }

    let mut result = value.to_string();

    // Replace {Passwords.*} patterns with random passwords
    let password_re =
        regex::Regex::new(r"\{Passwords\.(SignAppsString|CosmosString)\.[^}]+\}").unwrap();
    result = password_re
        .replace_all(&result, |_caps: &regex::Captures| generate_password(16))
        .to_string();

    // Replace {ServiceName}
    result = result.replace("{ServiceName}", service_name);

    // Remove any remaining {Context.*} references
    let context_re = regex::Regex::new(r"\{Context\.[^}]+\}").unwrap();
    result = context_re.replace_all(&result, "").to_string();

    result
}

/// Resolve store templates for display (used by the parser).
///
/// Resolves `{Passwords.*}` and removes `{Context.*}`, but keeps
/// `{ServiceName}` as a placeholder so the frontend can replace it with
/// the user-chosen container name.
fn resolve_for_display(value: &str) -> String {
    if !value.contains('{') {
        return value.to_string();
    }

    let mut result = value.to_string();

    // Replace {Passwords.*} patterns with random passwords (external format)
    let password_re =
        regex::Regex::new(r"\{Passwords\.(SignAppsString|CosmosString)\.[^}]+\}").unwrap();
    result = password_re
        .replace_all(&result, |_caps: &regex::Captures| generate_password(16))
        .to_string();

    // Remove any {Context.*} references (not applicable locally)
    let context_re = regex::Regex::new(r"\{Context\.[^}]+\}").unwrap();
    result = context_re.replace_all(&result, "").to_string();

    result
}

/// Resolve volume source templates for display.
///
/// Like `resolve_for_display` but maps `{Context.*}` to named volume
/// placeholders (`{ServiceName}-data`, etc.) instead of removing them,
/// since an empty volume source would be invalid.
fn resolve_volume_for_display(source: &str) -> String {
    if !source.contains('{') {
        return source.to_string();
    }

    let mut result = source.to_string();

    // Replace {Passwords.*} patterns with random passwords (external format)
    let password_re =
        regex::Regex::new(r"\{Passwords\.(SignAppsString|CosmosString)\.[^}]+\}").unwrap();
    result = password_re
        .replace_all(&result, |_caps: &regex::Captures| generate_password(16))
        .to_string();

    // Replace {Context.*} with {ServiceName}-based named volumes
    let context_re = regex::Regex::new(r"\{Context\.([^}]+)\}").unwrap();
    result = context_re
        .replace_all(&result, |caps: &regex::Captures| {
            let key = caps.get(1).map(|m| m.as_str()).unwrap_or("data");
            let suffix = match key {
                "downloadsPath" => "downloads",
                "dataPath" | "storePath" => "data",
                "configPath" => "config",
                "mediaPath" => "media",
                "logsPath" => "logs",
                "cachePath" => "cache",
                _ => "data",
            };
            format!("{{ServiceName}}-{suffix}")
        })
        .to_string();

    result
}

/// Generate a random alphanumeric password of the given length.
fn generate_password(len: usize) -> String {
    const CHARSET: &[u8] = b"abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let mut rng = rand::thread_rng();
    (0..len)
        .map(|_| {
            let idx = rng.gen_range(0..CHARSET.len());
            CHARSET[idx] as char
        })
        .collect()
}

/// Parse a compose file (JSON or YAML) into a `ParsedAppConfig`.
/// Strips store template directives first, then tries the format
/// indicated by the URL extension, with fallback to the other format.
pub fn parse_compose(text: &str, is_yaml: bool) -> Result<ParsedAppConfig, String> {
    let clean = strip_store_templates(text);
    let text = &clean;

    let compose: ComposeSpec = if is_yaml {
        serde_yaml::from_str(text).or_else(|yaml_err| {
            serde_json::from_str(text).map_err(|_| format!("YAML parse error: {yaml_err}"))
        })?
    } else {
        serde_json::from_str(text).or_else(|json_err| {
            serde_yaml::from_str(text).map_err(|_| format!("JSON parse error: {json_err}"))
        })?
    };

    let services = compose.services.unwrap_or_default();
    let mut parsed = Vec::new();

    for (name, svc) in services {
        parsed.push(parse_service(&name, &svc));
    }

    if parsed.is_empty() {
        return Err("No services found in compose file".to_string());
    }

    Ok(ParsedAppConfig { services: parsed })
}

fn parse_service(name: &str, svc: &ComposeService) -> ParsedService {
    let mut env = parse_env(&svc.environment);
    // Resolve passwords and remove {Context.*} in env defaults.
    // Keep {ServiceName} as template for the frontend to resolve with the
    // user-chosen container name.
    for ev in &mut env {
        if let Some(ref default) = ev.default {
            let resolved = resolve_for_display(default);
            if resolved != *default {
                ev.default = Some(resolved);
            }
        }
    }

    // Resolve volume sources for display: passwords and {Context.*} → named
    // volume placeholders, but keep {ServiceName} as template.
    let mut volumes = parse_volumes(&svc.volumes);
    for vol in &mut volumes {
        vol.source = resolve_volume_for_display(&vol.source);
    }

    // Keep {ServiceName} in container_name and hostname as templates
    let container_name = svc.container_name.clone();
    let hostname = svc.hostname.clone();

    ParsedService {
        service_name: name.to_string(),
        image: svc.image.clone().unwrap_or_default(),
        container_name,
        restart: svc
            .restart
            .clone()
            .unwrap_or_else(|| "unless-stopped".into()),
        environment: env,
        ports: parse_ports(&svc.ports),
        volumes,
        command: parse_command(&svc.command),
        labels: parse_labels(&svc.labels),
        hostname,
        depends_on: parse_depends_on(&svc.depends_on),
    }
}

/// Parse depends_on which can be an array of strings or an object with
/// service names as keys (docker-compose long form).
fn parse_depends_on(val: &Option<serde_json::Value>) -> Vec<String> {
    match val {
        None => vec![],
        Some(serde_json::Value::Array(arr)) => arr
            .iter()
            .filter_map(|v| v.as_str().map(String::from))
            .collect(),
        Some(serde_json::Value::Object(obj)) => obj.keys().cloned().collect(),
        _ => vec![],
    }
}

fn parse_env(env: &Option<ComposeEnv>) -> Vec<EnvVar> {
    match env {
        None => vec![],
        Some(ComposeEnv::List(list)) => list
            .iter()
            .map(|s| {
                if let Some((k, v)) = s.split_once('=') {
                    EnvVar {
                        key: k.to_string(),
                        default: Some(v.to_string()),
                    }
                } else {
                    EnvVar {
                        key: s.to_string(),
                        default: None,
                    }
                }
            })
            .collect(),
        Some(ComposeEnv::Map(map)) => map
            .iter()
            .map(|(k, v)| EnvVar {
                key: k.to_string(),
                default: match v {
                    serde_json::Value::String(s) => Some(s.clone()),
                    serde_json::Value::Null => None,
                    other => Some(other.to_string()),
                },
            })
            .collect(),
    }
}

fn parse_ports(ports: &Option<Vec<serde_json::Value>>) -> Vec<AppPort> {
    let Some(ports) = ports else {
        return vec![];
    };

    ports
        .iter()
        .filter_map(|p| {
            match p {
                // String format: "host:container" or "host:container/proto"
                serde_json::Value::String(s) => parse_port_string(s),
                // Number format: just a port number (use same for host and container)
                serde_json::Value::Number(n) => {
                    let port = n.as_u64()? as u16;
                    Some(AppPort {
                        host: port,
                        container: port,
                        protocol: "tcp".to_string(),
                    })
                },
                // Object format: {"published": 8080, "target": 80, "protocol": "tcp"}
                serde_json::Value::Object(obj) => {
                    let host = obj
                        .get("published")
                        .or_else(|| obj.get("host"))
                        .and_then(|v| v.as_u64())? as u16;
                    let container = obj
                        .get("target")
                        .or_else(|| obj.get("container"))
                        .and_then(|v| v.as_u64())? as u16;
                    let protocol = obj
                        .get("protocol")
                        .and_then(|v| v.as_str())
                        .unwrap_or("tcp")
                        .to_string();
                    Some(AppPort {
                        host,
                        container,
                        protocol,
                    })
                },
                _ => None,
            }
        })
        .collect()
}

fn parse_port_string(s: &str) -> Option<AppPort> {
    // Format: "host:container" or "host:container/proto" or "ip:host:container/proto"
    let (port_part, protocol) = if let Some((pp, proto)) = s.split_once('/') {
        (pp, proto.to_string())
    } else {
        (s, "tcp".to_string())
    };

    let parts: Vec<&str> = port_part.split(':').collect();
    let (host_str, container_str) = match parts.len() {
        1 => (parts[0], parts[0]),
        2 => (parts[0], parts[1]),
        3 => (parts[1], parts[2]),
        _ => return None,
    };

    let host = host_str.parse::<u16>().ok()?;
    let container = container_str.parse::<u16>().ok()?;

    Some(AppPort {
        host,
        container,
        protocol,
    })
}

fn parse_labels(labels: &Option<ComposeLabels>) -> HashMap<String, String> {
    match labels {
        None => HashMap::new(),
        Some(ComposeLabels::Map(map)) => map
            .iter()
            .map(|(k, v)| {
                let val = match v {
                    serde_json::Value::String(s) => s.clone(),
                    serde_json::Value::Bool(b) => b.to_string(),
                    serde_json::Value::Number(n) => n.to_string(),
                    other => other.to_string(),
                };
                (k.clone(), val)
            })
            .collect(),
        Some(ComposeLabels::List(list)) => list
            .iter()
            .filter_map(|s| {
                let (k, v) = s.split_once('=')?;
                Some((k.to_string(), v.to_string()))
            })
            .collect(),
    }
}

fn parse_volumes(volumes: &Option<Vec<ComposeVolume>>) -> Vec<AppVolume> {
    let Some(volumes) = volumes else {
        return vec![];
    };

    volumes
        .iter()
        .filter_map(|v| match v {
            ComposeVolume::Short(s) => {
                let parts: Vec<&str> = s.splitn(2, ':').collect();
                if parts.len() == 2 {
                    Some(AppVolume {
                        source: parts[0].to_string(),
                        target: parts[1].to_string(),
                        read_only: false,
                    })
                } else {
                    None
                }
            },
            ComposeVolume::Long {
                source,
                target,
                read_only,
                ..
            } => Some(AppVolume {
                source: source.clone().unwrap_or_default(),
                target: target.clone(),
                read_only: read_only.unwrap_or(false),
            }),
        })
        .collect()
}

fn parse_command(cmd: &Option<ComposeCommand>) -> Option<Vec<String>> {
    match cmd {
        None => None,
        Some(ComposeCommand::String(s)) => {
            Some(s.split_whitespace().map(|w| w.to_string()).collect())
        },
        Some(ComposeCommand::List(l)) => Some(l.clone()),
    }
}

/// Detect if a URL points to YAML based on extension.
pub fn is_yaml_url(url: &str) -> bool {
    let lower = url.to_lowercase();
    lower.ends_with(".yml") || lower.ends_with(".yaml")
}
