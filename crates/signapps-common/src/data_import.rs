//! Universal Data Import Module.
//!
//! Parsers for CSV, JSON, vCard, and iCal formats.

use serde::Deserialize;
use std::collections::HashMap;

/// A generic imported record (key-value pairs).
pub type ImportedRecord = HashMap<String, String>;

/// Parse CSV content into records.
pub fn parse_csv(content: &str) -> Result<Vec<ImportedRecord>, String> {
    let mut lines = content.lines();
    let headers: Vec<&str> = lines
        .next()
        .ok_or("Empty CSV")?
        .split(',')
        .map(|h| h.trim().trim_matches('"'))
        .collect();

    let mut records = Vec::new();
    for line in lines {
        if line.trim().is_empty() {
            continue;
        }
        let values: Vec<&str> = line.split(',').map(|v| v.trim().trim_matches('"')).collect();
        let mut record = ImportedRecord::new();
        for (i, header) in headers.iter().enumerate() {
            record.insert(
                header.to_string(),
                values.get(i).unwrap_or(&"").to_string(),
            );
        }
        records.push(record);
    }
    Ok(records)
}

/// Parse a vCard string into contact records.
pub fn parse_vcard(content: &str) -> Result<Vec<ImportedRecord>, String> {
    let mut contacts = Vec::new();
    let mut current: Option<ImportedRecord> = None;

    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed == "BEGIN:VCARD" {
            current = Some(ImportedRecord::new());
        } else if trimmed == "END:VCARD" {
            if let Some(record) = current.take() {
                contacts.push(record);
            }
        } else if let Some(ref mut record) = current {
            if let Some((key, value)) = trimmed.split_once(':') {
                let key = key.split(';').next().unwrap_or(key);
                match key {
                    "FN" => { record.insert("name".into(), value.into()); }
                    "EMAIL" => { record.insert("email".into(), value.into()); }
                    "TEL" => { record.insert("phone".into(), value.into()); }
                    "ORG" => { record.insert("company".into(), value.into()); }
                    "TITLE" => { record.insert("title".into(), value.into()); }
                    _ => {}
                }
            }
        }
    }
    Ok(contacts)
}

/// Parse an iCalendar string into event records.
pub fn parse_ical(content: &str) -> Result<Vec<ImportedRecord>, String> {
    let mut events = Vec::new();
    let mut current: Option<ImportedRecord> = None;

    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed == "BEGIN:VEVENT" {
            current = Some(ImportedRecord::new());
        } else if trimmed == "END:VEVENT" {
            if let Some(record) = current.take() {
                events.push(record);
            }
        } else if let Some(ref mut record) = current {
            if let Some((key, value)) = trimmed.split_once(':') {
                let key = key.split(';').next().unwrap_or(key);
                match key {
                    "SUMMARY" => { record.insert("title".into(), value.into()); }
                    "DESCRIPTION" => { record.insert("description".into(), value.into()); }
                    "LOCATION" => { record.insert("location".into(), value.into()); }
                    "DTSTART" => { record.insert("start_time".into(), value.into()); }
                    "DTEND" => { record.insert("end_time".into(), value.into()); }
                    "RRULE" => { record.insert("rrule".into(), value.into()); }
                    _ => {}
                }
            }
        }
    }
    Ok(events)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_csv() {
        let csv = "name,email\nAlice,alice@test.com\nBob,bob@test.com";
        let records = parse_csv(csv).unwrap();
        assert_eq!(records.len(), 2);
        assert_eq!(records[0]["name"], "Alice");
    }

    #[test]
    fn test_vcard() {
        let vcard = "BEGIN:VCARD\nFN:Alice\nEMAIL:alice@test.com\nEND:VCARD";
        let contacts = parse_vcard(vcard).unwrap();
        assert_eq!(contacts.len(), 1);
        assert_eq!(contacts[0]["name"], "Alice");
    }
}
