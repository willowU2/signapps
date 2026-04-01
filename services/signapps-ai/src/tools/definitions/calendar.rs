//! Tool definitions for the calendar service (events, leave requests).

use serde_json::json;
use std::collections::HashMap;

use crate::tools::registry::ToolDefinition;

/// Register all calendar tools.
pub fn register(tools: &mut HashMap<String, ToolDefinition>) {
    let defs = [
        ToolDefinition {
            name: "list_calendars".into(),
            description: "List all calendars accessible to the current user".into(),
            service: "calendar".into(),
            method: "GET".into(),
            path_template: "/calendars".into(),
            parameters: json!({}),
            is_write: false,
            min_role: 0,
        },
        ToolDefinition {
            name: "list_events".into(),
            description: "List calendar events in a date range".into(),
            service: "calendar".into(),
            method: "GET".into(),
            path_template: "/calendars/{calendar_id}/events".into(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "calendar_id": {"type": "string", "description": "Calendar ID"},
                    "start": {"type": "string", "description": "Start date (ISO 8601)"},
                    "end": {"type": "string", "description": "End date (ISO 8601)"}
                },
                "required": ["calendar_id"]
            }),
            is_write: false,
            min_role: 0,
        },
        ToolDefinition {
            name: "create_event".into(),
            description: "Create a calendar event or meeting".into(),
            service: "calendar".into(),
            method: "POST".into(),
            path_template: "/calendars/{calendar_id}/events".into(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "calendar_id": {"type": "string", "description": "Calendar ID"},
                    "title": {"type": "string", "description": "Event title"},
                    "start_time": {"type": "string", "description": "Start datetime (ISO 8601)"},
                    "end_time": {"type": "string", "description": "End datetime (ISO 8601)"},
                    "description": {"type": "string", "description": "Event description"},
                    "location": {"type": "string", "description": "Event location"},
                    "attendees": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Attendee email addresses"
                    }
                },
                "required": ["calendar_id", "title", "start_time", "end_time"]
            }),
            is_write: true,
            min_role: 0,
        },
        ToolDefinition {
            name: "update_event".into(),
            description: "Update an existing calendar event".into(),
            service: "calendar".into(),
            method: "PUT".into(),
            path_template: "/events/{id}".into(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "id": {"type": "string", "description": "Event ID"},
                    "title": {"type": "string", "description": "New event title"},
                    "start_time": {"type": "string", "description": "New start datetime (ISO 8601)"},
                    "end_time": {"type": "string", "description": "New end datetime (ISO 8601)"},
                    "description": {"type": "string", "description": "New description"},
                    "location": {"type": "string", "description": "New location"}
                },
                "required": ["id"]
            }),
            is_write: true,
            min_role: 0,
        },
        ToolDefinition {
            name: "delete_event".into(),
            description: "Delete a calendar event".into(),
            service: "calendar".into(),
            method: "DELETE".into(),
            path_template: "/events/{id}".into(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "id": {"type": "string", "description": "Event ID"}
                },
                "required": ["id"]
            }),
            is_write: true,
            min_role: 0,
        },
        ToolDefinition {
            name: "find_free_slots".into(),
            description: "Find available meeting time slots for a group of participants".into(),
            service: "calendar".into(),
            method: "POST".into(),
            path_template: "/calendar/meeting-suggestions".into(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "participants": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "User IDs of participants"
                    },
                    "duration_minutes": {"type": "integer", "description": "Required meeting duration in minutes"},
                    "start_date": {"type": "string", "description": "Earliest date to consider (ISO 8601)"},
                    "end_date": {"type": "string", "description": "Latest date to consider (ISO 8601)"}
                },
                "required": ["participants", "duration_minutes"]
            }),
            is_write: false,
            min_role: 0,
        },
        ToolDefinition {
            name: "request_leave".into(),
            description: "Create a leave or absence request on the calendar".into(),
            service: "calendar".into(),
            method: "POST".into(),
            path_template: "/calendars/{calendar_id}/events".into(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "calendar_id": {"type": "string", "description": "Calendar ID"},
                    "title": {"type": "string", "description": "Leave request title"},
                    "start_time": {"type": "string", "description": "Leave start datetime (ISO 8601)"},
                    "end_time": {"type": "string", "description": "Leave end datetime (ISO 8601)"},
                    "leave_type": {"type": "string", "description": "Type: cp|rtt|sick|unpaid|other"}
                },
                "required": ["calendar_id", "title", "start_time", "end_time"]
            }),
            is_write: true,
            min_role: 0,
        },
        ToolDefinition {
            name: "get_leave_balances".into(),
            description: "Get leave balances for the current user".into(),
            service: "calendar".into(),
            method: "GET".into(),
            path_template: "/leave/balances".into(),
            parameters: json!({}),
            is_write: false,
            min_role: 0,
        },
    ];

    for def in defs {
        tools.insert(def.name.clone(), def);
    }
}
