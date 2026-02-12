use super::types::*;

/// Parse a compose file (JSON or YAML) into a `ParsedAppConfig`.
pub fn parse_compose(text: &str, is_yaml: bool) -> Result<ParsedAppConfig, String> {
    let compose: CosmosCompose = if is_yaml {
        serde_yaml::from_str(text).map_err(|e| format!("YAML parse error: {e}"))?
    } else {
        serde_json::from_str(text).map_err(|e| format!("JSON parse error: {e}"))?
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
        labels: svc.labels.clone().unwrap_or_default(),
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

fn parse_ports(ports: &Option<Vec<String>>) -> Vec<AppPort> {
    let Some(ports) = ports else {
        return vec![];
    };

    ports
        .iter()
        .filter_map(|p| {
            // Format: "host:container" or "host:container/proto"
            let (port_part, protocol) = if let Some((pp, proto)) = p.split_once('/') {
                (pp, proto.to_string())
            } else {
                (p.as_str(), "tcp".to_string())
            };

            // Handle "ip:host:container" by taking last two parts
            let parts: Vec<&str> = port_part.split(':').collect();
            let (host_str, container_str) = match parts.len() {
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
        })
        .collect()
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
