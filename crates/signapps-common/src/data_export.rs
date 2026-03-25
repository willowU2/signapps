//! Universal Data Export Module.
//!
//! Export functions for CSV, JSON, vCard, and iCal formats.

use std::collections::HashMap;

pub type ExportRecord = HashMap<String, String>;

/// Export records to CSV format.
pub fn to_csv(headers: &[&str], records: &[ExportRecord]) -> String {
    let mut out = headers.join(",");
    out.push('\n');
    for record in records {
        let row: Vec<String> = headers
            .iter()
            .map(|h| {
                let val = record.get(*h).map(|v| v.as_str()).unwrap_or("");
                if val.contains(',') || val.contains('"') || val.contains('\n') {
                    format!("\"{}\"", val.replace('"', "\"\""))
                } else {
                    val.to_string()
                }
            })
            .collect();
        out.push_str(&row.join(","));
        out.push('\n');
    }
    out
}

/// Export contacts to vCard 3.0 format.
pub fn to_vcard(contacts: &[ExportRecord]) -> String {
    let mut out = String::new();
    for c in contacts {
        out.push_str("BEGIN:VCARD\nVERSION:3.0\n");
        if let Some(name) = c.get("name") {
            out.push_str(&format!("FN:{name}\n"));
        }
        if let Some(email) = c.get("email") {
            out.push_str(&format!("EMAIL:{email}\n"));
        }
        if let Some(phone) = c.get("phone") {
            out.push_str(&format!("TEL:{phone}\n"));
        }
        if let Some(company) = c.get("company") {
            out.push_str(&format!("ORG:{company}\n"));
        }
        out.push_str("END:VCARD\n");
    }
    out
}

/// Export events to iCalendar format.
pub fn to_ical(events: &[ExportRecord]) -> String {
    let mut out = String::from("BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//SignApps//EN\n");
    for e in events {
        out.push_str("BEGIN:VEVENT\n");
        if let Some(title) = e.get("title") {
            out.push_str(&format!("SUMMARY:{title}\n"));
        }
        if let Some(desc) = e.get("description") {
            out.push_str(&format!("DESCRIPTION:{desc}\n"));
        }
        if let Some(loc) = e.get("location") {
            out.push_str(&format!("LOCATION:{loc}\n"));
        }
        if let Some(start) = e.get("start_time") {
            out.push_str(&format!("DTSTART:{start}\n"));
        }
        if let Some(end) = e.get("end_time") {
            out.push_str(&format!("DTEND:{end}\n"));
        }
        if let Some(rrule) = e.get("rrule") {
            out.push_str(&format!("RRULE:{rrule}\n"));
        }
        out.push_str("END:VEVENT\n");
    }
    out.push_str("END:VCALENDAR\n");
    out
}

/// Export records to pretty JSON.
pub fn to_json(records: &[ExportRecord]) -> Result<String, serde_json::Error> {
    serde_json::to_string_pretty(records)
}
