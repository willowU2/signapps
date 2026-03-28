//! Tool executor: parses LLM output, executes tools, loops until done.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::sync::Arc;

use crate::llm::{ChatMessage, ProviderRegistry};

use super::errors::ToolError;
use super::registry::ToolRegistry;
use super::service_clients::ServiceClients;

/// Maximum tool-calling iterations before forcing a final answer.
const MAX_ITERATIONS: usize = 5;
/// Maximum characters in a single tool result.
const MAX_RESULT_LEN: usize = 4000;
/// Maximum array items returned from a tool.
const MAX_ARRAY_ITEMS: usize = 10;

/// A tool call parsed from LLM output.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCall {
    pub tool: String,
    #[serde(default)]
    pub parameters: Value,
}

/// Result of a tool execution, sent as SSE event.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolResult {
    pub tool: String,
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// SSE event for tool calling.
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type")]
pub enum ToolCallEvent {
    #[serde(rename = "tool_call")]
    ToolCall { tool: String, parameters: Value },
    #[serde(rename = "tool_result")]
    ToolResult {
        tool: String,
        success: bool,
        #[serde(skip_serializing_if = "Option::is_none")]
        result: Option<Value>,
        #[serde(skip_serializing_if = "Option::is_none")]
        error: Option<String>,
    },
}

/// Orchestrates tool calling between LLM and services.
#[derive(Clone)]
pub struct ToolExecutor {
    pub registry: ToolRegistry,
    pub clients: ServiceClients,
}

impl ToolExecutor {
    pub fn new(registry: ToolRegistry, clients: ServiceClients) -> Self {
        Self { registry, clients }
    }

    /// Build the system prompt that describes available tools.
    pub fn build_system_prompt(
        &self,
        role: i16,
        base_prompt: &str,
        language: Option<&str>,
    ) -> String {
        let tools = self.registry.tools_for_role(role);
        if tools.is_empty() {
            return base_prompt.to_string();
        }

        let mut tool_list = String::new();
        for t in &tools {
            tool_list.push_str(&format!(
                "- **{}**: {} [{}{}]\n",
                t.name,
                t.description,
                if t.is_write { "WRITE " } else { "READ " },
                t.service,
            ));
        }

        let lang_instruction = if let Some(lang) = language {
            format!("IMPORTANT: You MUST reply in {}.\n\n", lang)
        } else {
            String::new()
        };

        format!(
            "{lang_instruction}{base_prompt}\n\n\
             ## Tools\n\n\
             You have access to the following tools to interact with the \
             SignApps platform services. To call a tool, output a JSON block \
             in your response:\n\n\
             ```json\n\
             {{\"tool_calls\": [\n  \
               {{\"tool\": \"tool_name\", \"parameters\": {{...}}}}\n\
             ]}}\n\
             ```\n\n\
             After receiving tool results, analyze them and provide a \
             helpful answer to the user. You can call multiple tools at \
             once. Only call tools when the user's request requires data \
             from the platform.\n\n\
             ### Available tools\n\n\
             {tool_list}"
        )
    }

    /// Parse tool calls from LLM text output.
    pub fn parse_tool_calls(&self, text: &str) -> Vec<ToolCall> {
        // Try ```json blocks first
        let mut calls = Vec::new();

        for block in extract_json_blocks(text) {
            if let Ok(parsed) = serde_json::from_str::<Value>(&block) {
                if let Some(arr) = parsed.get("tool_calls").and_then(|v| v.as_array()) {
                    for item in arr {
                        if let Ok(tc) = serde_json::from_value::<ToolCall>(item.clone()) {
                            calls.push(tc);
                        }
                    }
                }
                // Single tool call without wrapper
                else if parsed.get("tool").is_some() {
                    if let Ok(tc) = serde_json::from_value::<ToolCall>(parsed) {
                        calls.push(tc);
                    }
                }
            }
        }

        // If no ```json blocks found, try raw JSON in text
        if calls.is_empty() {
            if let Some(start) = text.find("{\"tool_calls\"") {
                if let Some(json_str) = extract_balanced_json(text, start) {
                    if let Ok(parsed) = serde_json::from_str::<Value>(&json_str) {
                        if let Some(arr) = parsed.get("tool_calls").and_then(|v| v.as_array()) {
                            for item in arr {
                                if let Ok(tc) = serde_json::from_value::<ToolCall>(item.clone()) {
                                    calls.push(tc);
                                }
                            }
                        }
                    }
                }
            }
        }

        calls
    }

    /// Execute a single tool call.
    pub async fn execute_tool(&self, call: &ToolCall, jwt: &str, role: i16) -> ToolResult {
        let tool = match self.registry.get(&call.tool) {
            Some(t) => t,
            None => {
                return ToolResult {
                    tool: call.tool.clone(),
                    success: false,
                    result: None,
                    error: Some(format!("Unknown tool: {}", call.tool)),
                };
            },
        };

        // Permission check
        if role < tool.min_role {
            return ToolResult {
                tool: call.tool.clone(),
                success: false,
                result: None,
                error: Some("Permission denied: admin role required".to_string()),
            };
        }

        // Resolve path template
        let path = resolve_path(&tool.path_template, &call.parameters);

        // Build body for write operations
        let body = if tool.method != "GET" && tool.method != "DELETE" {
            // Pass parameters as body, excluding path params
            let body = filter_path_params(&call.parameters, &tool.path_template);
            if body.as_object().map(|o| o.is_empty()).unwrap_or(true) {
                None
            } else {
                Some(body)
            }
        } else {
            None
        };

        match self
            .clients
            .call(&tool.service, &tool.method, &path, body.as_ref(), jwt)
            .await
        {
            Ok(value) => {
                let truncated = truncate_result(value);
                ToolResult {
                    tool: call.tool.clone(),
                    success: true,
                    result: Some(truncated),
                    error: None,
                }
            },
            Err(e) => ToolResult {
                tool: call.tool.clone(),
                success: false,
                result: None,
                error: Some(e.to_string()),
            },
        }
    }

    /// Run the full tool-calling loop.
    ///
    /// Returns `(events, final_messages)` where events are the tool
    /// call/result SSE events and final_messages are the complete
    /// conversation to send for the final streaming response.
    pub async fn run_with_tools(
        &self,
        providers: &Arc<ProviderRegistry>,
        mut messages: Vec<ChatMessage>,
        jwt: &str,
        role: i16,
        provider_id: Option<&str>,
        model: Option<&str>,
    ) -> Result<(Vec<ToolCallEvent>, Vec<ChatMessage>), ToolError> {
        let mut events = Vec::new();

        for iteration in 0..MAX_ITERATIONS {
            // Call LLM (non-streaming to parse tool calls)
            let provider = providers
                .resolve(provider_id)
                .map_err(|e| ToolError::HttpError(e.to_string()))?;

            let response = provider
                .chat(messages.clone(), model, Some(2048), Some(0.3))
                .await
                .map_err(|e| ToolError::HttpError(e.to_string()))?;

            let assistant_text = response
                .choices
                .first()
                .map(|c| c.message.content.clone())
                .unwrap_or_default();

            // Parse tool calls
            let tool_calls = self.parse_tool_calls(&assistant_text);

            if tool_calls.is_empty() {
                // No tool calls — LLM gave a direct answer.
                // Add the assistant message and return for final streaming.
                messages.push(ChatMessage::assistant(&assistant_text));
                break;
            }

            tracing::info!(
                iteration = iteration,
                tools = tool_calls.len(),
                "Executing tool calls"
            );

            // Add assistant message with tool calls
            messages.push(ChatMessage::assistant(&assistant_text));

            // Execute each tool call
            let mut results_text = String::new();
            for tc in &tool_calls {
                // Emit tool_call event
                events.push(ToolCallEvent::ToolCall {
                    tool: tc.tool.clone(),
                    parameters: tc.parameters.clone(),
                });

                let result = self.execute_tool(tc, jwt, role).await;

                // Emit tool_result event
                events.push(ToolCallEvent::ToolResult {
                    tool: result.tool.clone(),
                    success: result.success,
                    result: result.result.clone(),
                    error: result.error.clone(),
                });

                // Build result text to inject into conversation
                if result.success {
                    let data = result
                        .result
                        .as_ref()
                        .map(|v| serde_json::to_string_pretty(v).unwrap_or_else(|_| v.to_string()))
                        .unwrap_or_else(|| "ok".to_string());
                    results_text.push_str(&format!("[Tool {} result]:\n{}\n\n", tc.tool, data));
                } else {
                    results_text.push_str(&format!(
                        "[Tool {} error]: {}\n\n",
                        tc.tool,
                        result.error.as_deref().unwrap_or("unknown error")
                    ));
                }
            }

            // Add tool results as user message for next iteration
            messages.push(ChatMessage::user(format!(
                "Here are the tool results:\n\n{}\n\
                 Now provide a helpful answer to the user based on \
                 these results. Do NOT output any more tool_calls.",
                results_text
            )));
        }

        Ok((events, messages))
    }
}

/// Extract JSON blocks from markdown fenced code blocks.
fn extract_json_blocks(text: &str) -> Vec<String> {
    let mut blocks = Vec::new();
    let mut remaining = text;

    while let Some(start) = remaining.find("```json") {
        let after_marker = &remaining[start + 7..];
        if let Some(end) = after_marker.find("```") {
            let json_str = after_marker[..end].trim();
            blocks.push(json_str.to_string());
            remaining = &after_marker[end + 3..];
        } else {
            break;
        }
    }

    blocks
}

/// Extract balanced JSON starting from a position.
fn extract_balanced_json(text: &str, start: usize) -> Option<String> {
    let bytes = text.as_bytes();
    let mut depth = 0i32;
    let mut in_string = false;
    let mut escape = false;

    for i in start..bytes.len() {
        if escape {
            escape = false;
            continue;
        }
        match bytes[i] {
            b'\\' if in_string => escape = true,
            b'"' => in_string = !in_string,
            b'{' if !in_string => depth += 1,
            b'}' if !in_string => {
                depth -= 1;
                if depth == 0 {
                    return Some(text[start..=i].to_string());
                }
            },
            _ => {},
        }
    }

    None
}

/// Resolve path template by replacing {param} placeholders.
fn resolve_path(template: &str, params: &Value) -> String {
    let mut path = template.to_string();
    if let Some(obj) = params.as_object() {
        for (key, value) in obj {
            let placeholder = format!("{{{}}}", key);
            if path.contains(&placeholder) {
                let val_str = match value {
                    Value::String(s) => s.clone(),
                    other => other.to_string().trim_matches('"').to_string(),
                };
                path = path.replace(&placeholder, &val_str);
            }
        }
    }
    path
}

/// Filter out parameters that were used in path template.
fn filter_path_params(params: &Value, template: &str) -> Value {
    if let Some(obj) = params.as_object() {
        let filtered: serde_json::Map<String, Value> = obj
            .iter()
            .filter(|(key, _)| !template.contains(&format!("{{{}}}", key)))
            .map(|(k, v)| (k.clone(), v.clone()))
            .collect();
        Value::Object(filtered)
    } else {
        params.clone()
    }
}

/// Truncate tool results to prevent token overflow.
fn truncate_result(value: Value) -> Value {
    match value {
        Value::Array(arr) => {
            let truncated: Vec<Value> = arr
                .into_iter()
                .take(MAX_ARRAY_ITEMS)
                .map(truncate_result)
                .collect();
            Value::Array(truncated)
        },
        Value::String(s) => {
            if s.len() > MAX_RESULT_LEN {
                // Find a valid UTF-8 boundary to avoid panic on multi-byte characters
                let mut end = MAX_RESULT_LEN;
                while end > 0 && !s.is_char_boundary(end) {
                    end -= 1;
                }
                Value::String(format!("{}... (truncated)", &s[..end]))
            } else {
                Value::String(s)
            }
        },
        Value::Object(obj) => {
            let truncated: serde_json::Map<String, Value> = obj
                .into_iter()
                .map(|(k, v)| (k, truncate_result(v)))
                .collect();
            Value::Object(truncated)
        },
        other => other,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_json_blocks() {
        let text = r#"I'll check the containers.
```json
{"tool_calls": [{"tool": "list_containers", "parameters": {}}]}
```
"#;
        let blocks = extract_json_blocks(text);
        assert_eq!(blocks.len(), 1);
        let parsed: Value = serde_json::from_str(&blocks[0]).unwrap();
        assert!(parsed.get("tool_calls").is_some());
    }

    #[test]
    fn test_resolve_path() {
        let params = serde_json::json!({"id": "abc123", "extra": "val"});
        let result = resolve_path("/containers/{id}/logs", &params);
        assert_eq!(result, "/containers/abc123/logs");
    }

    #[test]
    fn test_filter_path_params() {
        let params = serde_json::json!({"id": "abc", "name": "test"});
        let filtered = filter_path_params(&params, "/containers/{id}");
        assert!(filtered.get("id").is_none());
        assert!(filtered.get("name").is_some());
    }

    #[test]
    fn test_truncate_array() {
        let arr: Vec<Value> = (0..20).map(|i| Value::from(i)).collect();
        let result = truncate_result(Value::Array(arr));
        assert_eq!(result.as_array().unwrap().len(), MAX_ARRAY_ITEMS);
    }
}
