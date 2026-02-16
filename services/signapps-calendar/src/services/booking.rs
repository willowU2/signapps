//! Resource booking and conflict detection service

use chrono::{DateTime, Utc};
use uuid::Uuid;

/// Conflict information for a resource
#[derive(Debug, Clone)]
pub struct Conflict {
    pub resource_id: Uuid,
    pub conflicting_event_id: Uuid,
    pub conflicting_event_title: String,
    pub conflicting_start: DateTime<Utc>,
    pub conflicting_end: DateTime<Utc>,
}

/// Check if time ranges overlap
fn times_overlap(
    start1: DateTime<Utc>,
    end1: DateTime<Utc>,
    start2: DateTime<Utc>,
    end2: DateTime<Utc>,
) -> bool {
    start1 < end2 && start2 < end1
}

/// Check for resource conflicts
///
/// # Arguments
/// * `resource_id` - Resource to check
/// * `start_time` - Event start time
/// * `end_time` - Event end time
/// * `existing_bookings` - List of (event_id, title, start, end) for the resource
///
/// # Returns
/// Vec of conflicts found
pub fn check_conflicts(
    resource_id: Uuid,
    start_time: DateTime<Utc>,
    end_time: DateTime<Utc>,
    existing_bookings: &[(Uuid, String, DateTime<Utc>, DateTime<Utc>)],
) -> Vec<Conflict> {
    existing_bookings
        .iter()
        .filter(|(_, _, booking_start, booking_end)| {
            times_overlap(start_time, end_time, *booking_start, *booking_end)
        })
        .map(|(event_id, title, booking_start, booking_end)| Conflict {
            resource_id,
            conflicting_event_id: *event_id,
            conflicting_event_title: title.clone(),
            conflicting_start: *booking_start,
            conflicting_end: *booking_end,
        })
        .collect()
}

/// Check for all resources conflicts
pub fn check_all_conflicts(
    resources: &[(Uuid, String)],
    start_time: DateTime<Utc>,
    end_time: DateTime<Utc>,
    all_bookings: &[(Uuid, Uuid, String, DateTime<Utc>, DateTime<Utc>)], // (resource_id, event_id, title, start, end)
) -> Vec<Conflict> {
    resources
        .iter()
        .flat_map(|(resource_id, _)| {
            let resource_bookings: Vec<_> = all_bookings
                .iter()
                .filter(|(rid, _, _, _, _)| rid == resource_id)
                .map(|(_, eid, title, start, end)| (*eid, title.clone(), *start, *end))
                .collect();

            check_conflicts(*resource_id, start_time, end_time, &resource_bookings)
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_times_overlap_true() {
        let start1 = Utc::now();
        let end1 = start1 + chrono::Duration::hours(2);
        let start2 = start1 + chrono::Duration::hours(1);
        let end2 = start2 + chrono::Duration::hours(2);

        assert!(times_overlap(start1, end1, start2, end2));
    }

    #[test]
    fn test_times_overlap_false() {
        let start1 = Utc::now();
        let end1 = start1 + chrono::Duration::hours(1);
        let start2 = start1 + chrono::Duration::hours(2);
        let end2 = start2 + chrono::Duration::hours(1);

        assert!(!times_overlap(start1, end1, start2, end2));
    }

    #[test]
    fn test_check_conflicts() {
        let resource_id = Uuid::new_v4();
        let event_id = Uuid::new_v4();
        let now = Utc::now();

        let booking = (event_id, "Existing Event".to_string(), now, now + chrono::Duration::hours(1));

        // Overlapping time
        let conflicts = check_conflicts(resource_id, now + chrono::Duration::minutes(30), now + chrono::Duration::hours(2), &[booking.clone()]);
        assert_eq!(conflicts.len(), 1);

        // Non-overlapping time
        let conflicts = check_conflicts(resource_id, now + chrono::Duration::hours(2), now + chrono::Duration::hours(3), &[booking]);
        assert_eq!(conflicts.len(), 0);
    }
}
