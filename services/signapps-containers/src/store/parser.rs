use std::collections::HashMap;

use super::types::*;

/// Strip Cosmos template directives (`{if ...}`, `{/if}`, `{else}`) and fix
/// resulting JSON/YAML syntax (trailing/leading commas).
fn strip_cosmos_templates(text: &str) -> String {
    let mut lines: Vec<&str> = Vec::new();
    for line in text.lines() {
        let trimmed = line.trim();
        // Skip template conditionals
        if trimmed.starts_with("{if ") || trimmed.starts_with("{/if") || trimmed.starts_with("{else") {
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

/// Parse a compose file (JSON or YAML) into a `ParsedAppConfig`.
/// Strips Cosmos template directives first, then tries the format
/// indicated by the URL extension, with fallback to the other format.
pub fn parse_compose(text: &str, is_yaml: bool) -> Result<ParsedAppConfig, String> {
    let clean = strip_cosmos_templates(text);
    let text = &clean;

    let compose: CosmosCompose = if is_yaml {
        serde_yaml::from_str(text).or_else(|yaml_err| {
            serde_json::from_str(text)
                .map_err(|_| format!("YAML parse error: {yaml_err}"))
        })?
    } else {
        serde_json::from_str(text).or_else(|json_err| {
            serde_yaml::from_str(text)
                .map_err(|_| format!("JSON parse error: {json_err}"))
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

fn parse_service(name: &str, svc: &CosmosService) -> ParsedService {
    ParsedService {
        service_name: name.to_string(),
        image: svc.image.clone().unwrap_or_default(),
        container_name: svc.container_name.clone(),
        restart: svc.restart.clone().unwrap_or_else(|| "unless-stopped".into()),
        environment: parse_env(&svc.environment),
        ports: parse_ports(&svc.ports),
        volumes: parse_volumes(&svc.volumes),
        command: parse_command(&svc.command),
        labels: parse_labels(&svc.labels),
        hostname: svc.hostname.clone(),
    }
}

fn parse_env(env: &Option<CosmosEnv>) -> Vec<EnvVar> {
    match env {
        None => vec![],
        Some(CosmosEnv::List(list)) => list
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
        Some(CosmosEnv::Map(map)) => map
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
                }
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
                }
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

fn parse_labels(labels: &Option<CosmosLabels>) -> HashMap<String, String> {
    match labels {
        None => HashMap::new(),
        Some(CosmosLabels::Map(map)) => map
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
        Some(CosmosLabels::List(list)) => list
            .iter()
            .filter_map(|s| {
                let (k, v) = s.split_once('=')?;
                Some((k.to_string(), v.to_string()))
            })
            .collect(),
    }
}

fn parse_volumes(volumes: &Option<Vec<CosmosVolume>>) -> Vec<AppVolume> {
    let Some(volumes) = volumes else {
        return vec![];
    };

    volumes
        .iter()
        .filter_map(|v| match v {
            CosmosVolume::Short(s) => {
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
            }
            CosmosVolume::Long {
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

fn parse_command(cmd: &Option<CosmosCommand>) -> Option<Vec<String>> {
    match cmd {
        None => None,
        Some(CosmosCommand::String(s)) => {
            Some(s.split_whitespace().map(|w| w.to_string()).collect())
        }
        Some(CosmosCommand::List(l)) => Some(l.clone()),
    }
}

/// Detect if a URL points to YAML based on extension.
pub fn is_yaml_url(url: &str) -> bool {
    let lower = url.to_lowercase();
    lower.ends_with(".yml") || lower.ends_with(".yaml")
}
