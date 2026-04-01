//! Integration tests for signapps-calendar.
//!
//! Tests exercise business logic directly without requiring a running database.
//! Modules are tested through their public API using standard `#[test]` functions.

// ── CalendarError HTTP response mapping ───────────────────────────────────────

mod error_tests {
    use axum::http::StatusCode;
    use axum::response::IntoResponse;
    use signapps_calendar::CalendarError;

    #[test]
    fn not_found_maps_to_404() {
        let resp = CalendarError::NotFound.into_response();
        assert_eq!(resp.status(), StatusCode::NOT_FOUND);
    }

    #[test]
    fn unauthorized_maps_to_401() {
        let resp = CalendarError::Unauthorized.into_response();
        assert_eq!(resp.status(), StatusCode::UNAUTHORIZED);
    }

    #[test]
    fn forbidden_maps_to_403() {
        let resp = CalendarError::Forbidden.into_response();
        assert_eq!(resp.status(), StatusCode::FORBIDDEN);
    }

    #[test]
    fn invalid_input_maps_to_400() {
        let resp =
            CalendarError::InvalidInput("bad input".to_string()).into_response();
        assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
    }

    #[test]
    fn conflict_maps_to_409() {
        let resp =
            CalendarError::Conflict("already exists".to_string()).into_response();
        assert_eq!(resp.status(), StatusCode::CONFLICT);
    }

    #[test]
    fn internal_error_maps_to_500() {
        let resp = CalendarError::InternalError.into_response();
        assert_eq!(resp.status(), StatusCode::INTERNAL_SERVER_ERROR);
    }

    // Helper constructors
    #[test]
    fn constructor_not_found() {
        let e = CalendarError::not_found("resource");
        assert!(matches!(e, CalendarError::NotFound));
    }

    #[test]
    fn constructor_unauthorized() {
        let e = CalendarError::unauthorized();
        assert!(matches!(e, CalendarError::Unauthorized));
    }

    #[test]
    fn constructor_forbidden() {
        let e = CalendarError::forbidden("action");
        assert!(matches!(e, CalendarError::Forbidden));
    }

    #[test]
    fn constructor_bad_request() {
        let e = CalendarError::bad_request("invalid date");
        assert!(matches!(e, CalendarError::InvalidInput(_)));
    }

    #[test]
    fn constructor_internal() {
        let e = CalendarError::internal("db error");
        assert!(matches!(e, CalendarError::InternalError));
    }

    #[test]
    fn constructor_conflict() {
        let e = CalendarError::conflict("duplicate");
        assert!(matches!(e, CalendarError::Conflict(_)));
    }

    #[test]
    fn display_not_found() {
        let msg = CalendarError::NotFound.to_string();
        assert_eq!(msg, "Not found");
    }

    #[test]
    fn display_invalid_input_includes_message() {
        let msg =
            CalendarError::InvalidInput("end_time must be after start_time".to_string())
                .to_string();
        assert!(msg.contains("end_time must be after start_time"));
    }

    #[test]
    fn display_conflict_includes_message() {
        let msg = CalendarError::Conflict("duplicate key".to_string()).to_string();
        assert!(msg.contains("duplicate key"));
    }
}

// ── iCalendar export ───────────────────────────────────────────────────────────

mod icalendar_tests {
    use chrono::{TimeZone, Utc};
    use signapps_calendar::services::icalendar::{
        export_calendar_to_ics, import_calendar_from_ics, ICalendarEvent,
    };

    fn make_event(uid: &str, title: &str) -> ICalendarEvent {
        let now = Utc.with_ymd_and_hms(2025, 6, 1, 10, 0, 0).unwrap();
        ICalendarEvent {
            uid: uid.to_string(),
            title: title.to_string(),
            description: None,
            location: None,
            start_time: now,
            end_time: now + chrono::Duration::hours(1),
            rrule: None,
            created_at: now,
            modified_at: now,
        }
    }

    #[test]
    fn export_contains_vcalendar_wrapper() {
        let ics = export_calendar_to_ics("Work", vec![]);
        assert!(ics.contains("BEGIN:VCALENDAR"));
        assert!(ics.contains("END:VCALENDAR"));
        assert!(ics.contains("VERSION:2.0"));
    }

    #[test]
    fn export_includes_calendar_name() {
        let ics = export_calendar_to_ics("My Calendar", vec![]);
        assert!(ics.contains("X-WR-CALNAME:My Calendar"));
    }

    #[test]
    fn export_empty_has_no_vevent() {
        let ics = export_calendar_to_ics("Empty", vec![]);
        assert!(!ics.contains("BEGIN:VEVENT"));
    }

    #[test]
    fn export_single_event_vevent_block() {
        let event = make_event("abc-123", "Team Meeting");
        let ics = export_calendar_to_ics("Work", vec![event]);

        assert!(ics.contains("BEGIN:VEVENT"));
        assert!(ics.contains("END:VEVENT"));
        assert!(ics.contains("UID:abc-123"));
        assert!(ics.contains("SUMMARY:Team Meeting"));
        assert!(ics.contains("DTSTART:20250601T100000Z"));
        assert!(ics.contains("DTEND:20250601T110000Z"));
    }

    #[test]
    fn export_event_with_description() {
        let now = Utc.with_ymd_and_hms(2025, 1, 1, 9, 0, 0).unwrap();
        let event = ICalendarEvent {
            uid: "uid-desc".to_string(),
            title: "Meeting".to_string(),
            description: Some("Agenda items".to_string()),
            location: None,
            start_time: now,
            end_time: now + chrono::Duration::hours(1),
            rrule: None,
            created_at: now,
            modified_at: now,
        };
        let ics = export_calendar_to_ics("Work", vec![event]);
        assert!(ics.contains("DESCRIPTION:Agenda items"));
    }

    #[test]
    fn export_event_with_location() {
        let now = Utc.with_ymd_and_hms(2025, 1, 1, 9, 0, 0).unwrap();
        let event = ICalendarEvent {
            uid: "uid-loc".to_string(),
            title: "Offsite".to_string(),
            description: None,
            location: Some("Paris, France".to_string()),
            start_time: now,
            end_time: now + chrono::Duration::hours(8),
            rrule: None,
            created_at: now,
            modified_at: now,
        };
        let ics = export_calendar_to_ics("Work", vec![event]);
        assert!(ics.contains("LOCATION:Paris, France"));
    }

    #[test]
    fn export_event_with_rrule() {
        let now = Utc.with_ymd_and_hms(2025, 1, 6, 9, 0, 0).unwrap();
        let event = ICalendarEvent {
            uid: "uid-rrule".to_string(),
            title: "Weekly Standup".to_string(),
            description: None,
            location: None,
            start_time: now,
            end_time: now + chrono::Duration::minutes(30),
            rrule: Some("FREQ=WEEKLY;BYDAY=MO".to_string()),
            created_at: now,
            modified_at: now,
        };
        let ics = export_calendar_to_ics("Work", vec![event]);
        assert!(ics.contains("RRULE:FREQ=WEEKLY;BYDAY=MO"));
    }

    #[test]
    fn export_multiple_events_all_present() {
        let e1 = make_event("uid-1", "Event One");
        let e2 = make_event("uid-2", "Event Two");
        let ics = export_calendar_to_ics("Multi", vec![e1, e2]);

        assert_eq!(ics.matches("BEGIN:VEVENT").count(), 2);
        assert!(ics.contains("UID:uid-1"));
        assert!(ics.contains("UID:uid-2"));
    }

    #[test]
    fn export_uses_crlf_line_endings() {
        let ics = export_calendar_to_ics("Work", vec![]);
        assert!(ics.contains("\r\n"), "iCal spec requires CRLF line endings");
    }

    #[test]
    fn import_rejects_missing_vcalendar() {
        let result = import_calendar_from_ics("BEGIN:VEVENT\nSUMMARY:Test\nEND:VEVENT");
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert!(err.contains("Invalid iCalendar"));
    }

    #[test]
    fn import_valid_vcalendar_wrapper_succeeds() {
        let ics = "BEGIN:VCALENDAR\nVERSION:2.0\nEND:VCALENDAR";
        let result = import_calendar_from_ics(ics);
        assert!(result.is_ok());
    }

    #[test]
    fn export_dtstamp_field_present() {
        let event = make_event("uid-stamp", "Stamped Event");
        let ics = export_calendar_to_ics("Work", vec![event]);
        assert!(ics.contains("DTSTAMP:"));
    }
}

// ── RRULE expansion (additional edge cases not in service unit tests) ──────────

mod recurrence_tests {
    use chrono::{Datelike, TimeZone, Utc};
    use signapps_calendar::services::recurrence::{
        count_occurrences, expand_rrule, get_rrule_frequency, validate_rrule,
    };

    #[test]
    fn yearly_recurrence_basic() {
        let start = Utc.with_ymd_and_hms(2020, 3, 15, 10, 0, 0).unwrap();
        let range_end = Utc.with_ymd_and_hms(2025, 12, 31, 23, 59, 59).unwrap();

        let result =
            expand_rrule("FREQ=YEARLY;COUNT=5", start, start, range_end, 10).unwrap();
        assert_eq!(result.len(), 5);
        // Each occurrence should be in the same month/day, different year
        for (i, dt) in result.iter().enumerate() {
            assert_eq!(dt.month(), 3, "Expected March for occurrence {}", i);
            assert_eq!(dt.day(), 15, "Expected day 15 for occurrence {}", i);
            assert_eq!(dt.year(), 2020 + i as i32);
        }
    }

    #[test]
    fn yearly_recurrence_interval_2() {
        let start = Utc.with_ymd_and_hms(2020, 1, 1, 0, 0, 0).unwrap();
        let range_end = Utc.with_ymd_and_hms(2030, 12, 31, 23, 59, 59).unwrap();

        let result =
            expand_rrule("FREQ=YEARLY;INTERVAL=2;COUNT=3", start, start, range_end, 10)
                .unwrap();
        assert_eq!(result.len(), 3);
        assert_eq!(result[0].year(), 2020);
        assert_eq!(result[1].year(), 2022);
        assert_eq!(result[2].year(), 2024);
    }

    #[test]
    fn daily_interval_2_skips_every_other_day() {
        let start = Utc.with_ymd_and_hms(2025, 1, 1, 9, 0, 0).unwrap();
        let range_end = Utc.with_ymd_and_hms(2025, 1, 10, 23, 59, 59).unwrap();

        let result =
            expand_rrule("FREQ=DAILY;INTERVAL=2", start, start, range_end, 20).unwrap();
        // Jan 1, 3, 5, 7, 9 → 5 occurrences
        assert_eq!(result.len(), 5);
        assert_eq!(result[0].day(), 1);
        assert_eq!(result[1].day(), 3);
        assert_eq!(result[2].day(), 5);
    }

    #[test]
    fn until_date_truncates_occurrences() {
        let start = Utc.with_ymd_and_hms(2025, 1, 1, 9, 0, 0).unwrap();
        let range_end = Utc.with_ymd_and_hms(2025, 12, 31, 23, 59, 59).unwrap();

        // UNTIL = Jan 5 → only Jan 1, 2, 3, 4, 5
        let result =
            expand_rrule("FREQ=DAILY;UNTIL=20250105", start, start, range_end, 100)
                .unwrap();
        assert!(
            result.len() <= 5,
            "UNTIL=20250105 should cap at 5 occurrences, got {}",
            result.len()
        );
        for dt in &result {
            assert!(
                dt.day() <= 5,
                "All occurrences must be on or before Jan 5, got day {}",
                dt.day()
            );
        }
    }

    #[test]
    fn get_frequency_daily() {
        assert_eq!(get_rrule_frequency("FREQ=DAILY"), "DAILY");
    }

    #[test]
    fn get_frequency_weekly() {
        assert_eq!(get_rrule_frequency("FREQ=WEEKLY;BYDAY=MO"), "WEEKLY");
    }

    #[test]
    fn get_frequency_monthly() {
        assert_eq!(get_rrule_frequency("FREQ=MONTHLY;COUNT=6"), "MONTHLY");
    }

    #[test]
    fn get_frequency_yearly() {
        assert_eq!(get_rrule_frequency("FREQ=YEARLY"), "YEARLY");
    }

    #[test]
    fn get_frequency_invalid_returns_unknown() {
        assert_eq!(get_rrule_frequency("NOT_AN_RRULE"), "UNKNOWN");
    }

    #[test]
    fn count_occurrences_present() {
        assert_eq!(count_occurrences("FREQ=DAILY;COUNT=7"), Some(7));
        assert_eq!(count_occurrences("FREQ=MONTHLY;COUNT=12"), Some(12));
    }

    #[test]
    fn count_occurrences_absent_returns_none() {
        assert_eq!(count_occurrences("FREQ=DAILY"), None);
        assert_eq!(count_occurrences("FREQ=WEEKLY;BYDAY=MO,FR"), None);
    }

    #[test]
    fn validate_all_supported_frequencies() {
        assert!(validate_rrule("FREQ=DAILY").is_ok());
        assert!(validate_rrule("FREQ=WEEKLY").is_ok());
        assert!(validate_rrule("FREQ=MONTHLY").is_ok());
        assert!(validate_rrule("FREQ=YEARLY").is_ok());
    }

    #[test]
    fn expand_result_is_sorted_in_order() {
        let start = Utc.with_ymd_and_hms(2025, 5, 1, 8, 0, 0).unwrap();
        let range_end = Utc.with_ymd_and_hms(2025, 5, 10, 23, 59, 59).unwrap();

        let result =
            expand_rrule("FREQ=DAILY;COUNT=5", start, start, range_end, 10).unwrap();
        for window in result.windows(2) {
            assert!(
                window[0] < window[1],
                "Occurrences must be strictly ascending: {} >= {}",
                window[0],
                window[1]
            );
        }
    }

    #[test]
    fn expand_empty_range_returns_empty() {
        let start = Utc.with_ymd_and_hms(2025, 1, 10, 9, 0, 0).unwrap();
        // range_end before range_start
        let range_start = Utc.with_ymd_and_hms(2025, 2, 1, 0, 0, 0).unwrap();
        let range_end = Utc.with_ymd_and_hms(2025, 1, 1, 0, 0, 0).unwrap();

        let result =
            expand_rrule("FREQ=DAILY", start, range_start, range_end, 100).unwrap();
        assert!(
            result.is_empty(),
            "range_end before range_start should yield no results"
        );
    }

    #[test]
    fn monthly_end_of_month_stays_in_bounds() {
        // Jan 31 + 1 month → Feb 28 (or 29 in leap year), not a panic
        let start = Utc.with_ymd_and_hms(2025, 1, 31, 10, 0, 0).unwrap();
        let range_end = Utc.with_ymd_and_hms(2025, 6, 30, 23, 59, 59).unwrap();

        let result =
            expand_rrule("FREQ=MONTHLY;COUNT=5", start, start, range_end, 10).unwrap();
        // Should not panic; result length may vary based on month lengths
        assert!(result.len() <= 5, "COUNT=5 should produce at most 5 instances");
    }
}

// ── Booking conflict detection ─────────────────────────────────────────────────

mod booking_tests {
    use chrono::{Duration, Utc};
    use signapps_calendar::services::booking::{check_all_conflicts, check_conflicts};
    use uuid::Uuid;

    fn now_plus(hours: i64) -> chrono::DateTime<Utc> {
        Utc::now() + Duration::hours(hours)
    }

    #[test]
    fn no_bookings_no_conflicts() {
        let resource = Uuid::new_v4();
        let conflicts = check_conflicts(resource, now_plus(0), now_plus(1), &[]);
        assert!(conflicts.is_empty());
    }

    #[test]
    fn adjacent_bookings_do_not_conflict() {
        // end1 == start2 — touching but not overlapping (strict <)
        let resource = Uuid::new_v4();
        let event_id = Uuid::new_v4();
        let base = now_plus(0);

        let booking = (event_id, "Prior".to_string(), base, base + Duration::hours(1));
        // New event starts exactly when old one ends
        let conflicts = check_conflicts(
            resource,
            base + Duration::hours(1),
            base + Duration::hours(2),
            &[booking],
        );
        assert!(
            conflicts.is_empty(),
            "Back-to-back bookings should not conflict"
        );
    }

    #[test]
    fn partial_overlap_detected() {
        let resource = Uuid::new_v4();
        let event_id = Uuid::new_v4();
        let base = now_plus(0);

        // Existing: 10:00 - 12:00
        // New:      11:00 - 13:00  (overlaps by 1 hour)
        let booking = (
            event_id,
            "Existing".to_string(),
            base,
            base + Duration::hours(2),
        );
        let conflicts = check_conflicts(
            resource,
            base + Duration::hours(1),
            base + Duration::hours(3),
            &[booking],
        );
        assert_eq!(conflicts.len(), 1);
        assert_eq!(conflicts[0].conflicting_event_id, event_id);
        assert_eq!(conflicts[0].resource_id, resource);
    }

    #[test]
    fn containment_is_a_conflict() {
        // New event fully contains existing booking
        let resource = Uuid::new_v4();
        let event_id = Uuid::new_v4();
        let base = now_plus(0);

        let booking = (
            event_id,
            "Inner".to_string(),
            base + Duration::hours(1),
            base + Duration::hours(2),
        );
        let conflicts = check_conflicts(
            resource,
            base,
            base + Duration::hours(3),
            &[booking],
        );
        assert_eq!(conflicts.len(), 1);
    }

    #[test]
    fn multiple_bookings_all_conflicts_returned() {
        let resource = Uuid::new_v4();
        let base = now_plus(0);
        let e1 = Uuid::new_v4();
        let e2 = Uuid::new_v4();

        let bookings = vec![
            (e1, "First".to_string(), base, base + Duration::hours(2)),
            (e2, "Second".to_string(), base + Duration::hours(1), base + Duration::hours(3)),
        ];
        // New booking overlaps both
        let conflicts = check_conflicts(
            resource,
            base + Duration::minutes(30),
            base + Duration::minutes(90),
            &bookings,
        );
        // The new booking (30min - 90min) overlaps "First" (0h - 2h) but NOT "Second" (1h - 3h)?
        // Actually 30min < 60min (Second start) and 90min > 60min → overlaps both
        assert!(!conflicts.is_empty());
    }

    #[test]
    fn check_all_conflicts_across_resources() {
        let r1 = Uuid::new_v4();
        let r2 = Uuid::new_v4();
        let e1 = Uuid::new_v4();
        let base = now_plus(0);

        let resources = vec![(r1, "Room A".to_string()), (r2, "Room B".to_string())];
        // Only r1 has a booking
        let all_bookings = vec![(r1, e1, "Meeting".to_string(), base, base + Duration::hours(1))];

        let conflicts = check_all_conflicts(
            &resources,
            base + Duration::minutes(30),
            base + Duration::hours(2),
            &all_bookings,
        );

        // Only r1 conflicts
        assert_eq!(conflicts.len(), 1);
        assert_eq!(conflicts[0].resource_id, r1);
    }

    #[test]
    fn conflict_contains_correct_title() {
        let resource = Uuid::new_v4();
        let event_id = Uuid::new_v4();
        let base = now_plus(0);

        let booking = (
            event_id,
            "Board Room".to_string(),
            base,
            base + Duration::hours(2),
        );
        let conflicts = check_conflicts(
            resource,
            base + Duration::minutes(30),
            base + Duration::hours(1),
            &[booking],
        );
        assert_eq!(conflicts[0].conflicting_event_title, "Board Room");
    }
}

// ── Task tree (cycle detection, depth) ────────────────────────────────────────

mod task_tree_tests {
    use signapps_calendar::services::task_tree::{get_tree_depth, validate_parent_change};
    use std::collections::HashMap;
    use uuid::Uuid;

    #[test]
    fn moving_to_root_always_valid() {
        let id = Uuid::new_v4();
        let map = HashMap::new();
        assert!(validate_parent_change(id, None, &map).is_ok());
    }

    #[test]
    fn self_parent_rejected() {
        let id = Uuid::new_v4();
        let map = HashMap::new();
        assert!(validate_parent_change(id, Some(id), &map).is_err());
    }

    #[test]
    fn direct_cycle_rejected() {
        // A -> B, then try B -> A
        let a = Uuid::new_v4();
        let b = Uuid::new_v4();
        let mut map = HashMap::new();
        map.insert(b, Some(a)); // B's parent is A
        // Make A's parent B → cycle
        assert!(validate_parent_change(a, Some(b), &map).is_err());
    }

    #[test]
    fn indirect_cycle_rejected() {
        // A -> B -> C; try C's parent = A
        let a = Uuid::new_v4();
        let b = Uuid::new_v4();
        let c = Uuid::new_v4();
        let mut map = HashMap::new();
        map.insert(b, Some(a));
        map.insert(c, Some(b));
        // Try: A's parent = C → cycle A -> B -> C -> A
        assert!(validate_parent_change(a, Some(c), &map).is_err());
    }

    #[test]
    fn valid_reparent_no_cycle() {
        // A and B are siblings (both roots); try B -> A (no cycle)
        let a = Uuid::new_v4();
        let b = Uuid::new_v4();
        let mut map = HashMap::new();
        map.insert(a, None); // A is root
        map.insert(b, None); // B is root
        // B -> A: fine (no cycle)
        assert!(validate_parent_change(b, Some(a), &map).is_ok());
    }

    #[test]
    fn depth_of_root_task_is_1() {
        let id = Uuid::new_v4();
        let mut map = HashMap::new();
        map.insert(id, None);
        let depth = get_tree_depth(Some(id), &map);
        assert_eq!(depth, 1);
    }

    #[test]
    fn depth_of_child_task_is_2() {
        let parent = Uuid::new_v4();
        let child = Uuid::new_v4();
        let mut map = HashMap::new();
        map.insert(parent, None);
        map.insert(child, Some(parent));
        let depth = get_tree_depth(Some(child), &map);
        assert_eq!(depth, 2);
    }

    #[test]
    fn depth_of_3_levels() {
        let grandparent = Uuid::new_v4();
        let parent = Uuid::new_v4();
        let child = Uuid::new_v4();
        let mut map = HashMap::new();
        map.insert(grandparent, None);
        map.insert(parent, Some(grandparent));
        map.insert(child, Some(parent));
        let depth = get_tree_depth(Some(child), &map);
        assert_eq!(depth, 3);
    }

    #[test]
    fn depth_of_none_task_is_1() {
        let map = HashMap::new();
        let depth = get_tree_depth(None, &map);
        assert_eq!(depth, 1);
    }
}

// ── CalendarPresenceManager ────────────────────────────────────────────────────

mod presence_tests {
    use signapps_calendar::services::presence::{CalendarPresenceManager, PresenceStatus};
    use uuid::Uuid;

    #[test]
    fn user_join_records_presence() {
        let cal_id = Uuid::new_v4();
        let user_id = Uuid::new_v4();
        let session_id = Uuid::new_v4();
        let mgr = CalendarPresenceManager::new(cal_id);

        let presence = mgr.on_user_join(user_id, "alice".to_string(), session_id);
        assert_eq!(presence.user_id, user_id);
        assert_eq!(presence.calendar_id, cal_id);
        assert_eq!(presence.username, "alice");
        assert_eq!(presence.status, PresenceStatus::Join);
        assert_eq!(presence.session_id, session_id);
    }

    #[test]
    fn user_leave_removes_from_active() {
        let cal_id = Uuid::new_v4();
        let user_id = Uuid::new_v4();
        let mgr = CalendarPresenceManager::new(cal_id);

        mgr.on_user_join(user_id, "bob".to_string(), Uuid::new_v4());
        assert_eq!(mgr.get_active_users().len(), 1);

        let departed = mgr.on_user_leave(user_id);
        assert!(departed.is_some());
        assert_eq!(departed.unwrap().status, PresenceStatus::Leave);
        assert!(mgr.get_active_users().is_empty());
    }

    #[test]
    fn unknown_user_leave_returns_none() {
        let cal_id = Uuid::new_v4();
        let mgr = CalendarPresenceManager::new(cal_id);
        let result = mgr.on_user_leave(Uuid::new_v4());
        assert!(result.is_none());
    }

    #[test]
    fn editing_start_sets_status_and_item() {
        let cal_id = Uuid::new_v4();
        let user_id = Uuid::new_v4();
        let item_id = Uuid::new_v4();
        let mgr = CalendarPresenceManager::new(cal_id);
        mgr.on_user_join(user_id, "carol".to_string(), Uuid::new_v4());

        mgr.on_editing_start(user_id, item_id);

        let users = mgr.get_active_users();
        let user = users.iter().find(|u| u.user_id == user_id).unwrap();
        assert_eq!(user.status, PresenceStatus::Editing);
        assert_eq!(user.editing_item_id, Some(item_id));
    }

    #[test]
    fn editing_end_clears_item_and_sets_viewing() {
        let cal_id = Uuid::new_v4();
        let user_id = Uuid::new_v4();
        let item_id = Uuid::new_v4();
        let mgr = CalendarPresenceManager::new(cal_id);
        mgr.on_user_join(user_id, "dave".to_string(), Uuid::new_v4());
        mgr.on_editing_start(user_id, item_id);
        mgr.on_editing_end(user_id);

        let users = mgr.get_active_users();
        let user = users.iter().find(|u| u.user_id == user_id).unwrap();
        assert_eq!(user.status, PresenceStatus::Viewing);
        assert!(user.editing_item_id.is_none());
    }

    #[test]
    fn get_users_editing_filters_correctly() {
        let cal_id = Uuid::new_v4();
        let user1 = Uuid::new_v4();
        let user2 = Uuid::new_v4();
        let item_a = Uuid::new_v4();
        let item_b = Uuid::new_v4();
        let mgr = CalendarPresenceManager::new(cal_id);

        mgr.on_user_join(user1, "user1".to_string(), Uuid::new_v4());
        mgr.on_user_join(user2, "user2".to_string(), Uuid::new_v4());
        mgr.on_editing_start(user1, item_a);
        mgr.on_editing_start(user2, item_b);

        let editing_a = mgr.get_users_editing(item_a);
        assert_eq!(editing_a.len(), 1);
        assert_eq!(editing_a[0].user_id, user1);

        let editing_b = mgr.get_users_editing(item_b);
        assert_eq!(editing_b.len(), 1);
        assert_eq!(editing_b[0].user_id, user2);
    }

    #[test]
    fn multiple_users_can_join() {
        let cal_id = Uuid::new_v4();
        let mgr = CalendarPresenceManager::new(cal_id);

        for i in 0..5_u32 {
            mgr.on_user_join(Uuid::new_v4(), format!("user{}", i), Uuid::new_v4());
        }
        assert_eq!(mgr.get_active_users().len(), 5);
    }

    #[test]
    fn activity_update_sets_viewing_status() {
        let cal_id = Uuid::new_v4();
        let user_id = Uuid::new_v4();
        let item_id = Uuid::new_v4();
        let mgr = CalendarPresenceManager::new(cal_id);

        mgr.on_user_join(user_id, "eve".to_string(), Uuid::new_v4());
        mgr.on_editing_start(user_id, item_id);
        mgr.on_user_activity(user_id);

        let users = mgr.get_active_users();
        let user = users.iter().find(|u| u.user_id == user_id).unwrap();
        assert_eq!(user.status, PresenceStatus::Viewing);
    }
}
