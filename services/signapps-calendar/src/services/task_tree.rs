//! Task tree operations and validation

use uuid::Uuid;

const MAX_NESTING_DEPTH: usize = 10;

/// Validate task hierarchy for cycles and depth limits
///
/// # Arguments
/// * `task_id` - Task ID to validate
/// * `new_parent_id` - New parent ID (or None for root)
/// * `existing_parents` - Map of task_id -> parent_id from database
///
/// # Returns
/// Err if cycle would be created or depth limit exceeded
pub fn validate_parent_change(
    task_id: Uuid,
    new_parent_id: Option<Uuid>,
    existing_parents: &std::collections::HashMap<Uuid, Option<Uuid>>,
) -> Result<(), String> {
    // If new_parent_id is None, it's a root task - always valid
    if new_parent_id.is_none() {
        return Ok(());
    }

    let new_parent = new_parent_id.unwrap();

    // Check if moving to self
    if task_id == new_parent {
        return Err("A task cannot be its own parent".to_string());
    }

    // Check for cycles by tracing up the chain
    let mut current = new_parent;
    let mut depth = 0;

    loop {
        depth += 1;

        // Check depth limit
        if depth > MAX_NESTING_DEPTH {
            return Err(format!(
                "Nesting depth exceeds maximum ({} levels)",
                MAX_NESTING_DEPTH
            ));
        }

        // Check for cycle (moving task would become its own ancestor)
        if current == task_id {
            return Err("Moving task would create a cycle".to_string());
        }

        // Move to parent
        match existing_parents.get(&current) {
            Some(Some(parent_id)) => {
                current = *parent_id;
            },
            Some(None) => {
                // Reached root - no cycle
                break;
            },
            None => {
                // Parent not in map - should not happen in production
                tracing::warn!("Parent {} not found in task hierarchy map", current);
                break;
            },
        }
    }

    Ok(())
}

/// Get maximum depth of task hierarchy
///
/// Returns depth count starting from 1 for root tasks
pub fn get_tree_depth(
    task_id: Option<Uuid>,
    existing_parents: &std::collections::HashMap<Uuid, Option<Uuid>>,
) -> usize {
    let mut depth = 1;
    let mut current = task_id;

    loop {
        match current.and_then(|id| existing_parents.get(&id).cloned().flatten()) {
            Some(parent_id) => {
                depth += 1;
                current = Some(parent_id);

                // Safety limit
                if depth > MAX_NESTING_DEPTH * 2 {
                    break;
                }
            },
            None => break,
        }
    }

    depth
}

/// Get all ancestors of a task
#[allow(dead_code)]
pub fn get_ancestors(
    task_id: Uuid,
    existing_parents: &std::collections::HashMap<Uuid, Option<Uuid>>,
) -> Vec<Uuid> {
    let mut ancestors = Vec::new();
    let mut current = Some(task_id);
    let mut iterations = 0;
    const MAX_ITERATIONS: usize = 50;

    loop {
        if iterations > MAX_ITERATIONS {
            tracing::warn!("Potential infinite loop in ancestor chain");
            break;
        }

        match current.and_then(|id| existing_parents.get(&id).cloned().flatten()) {
            Some(parent_id) => {
                ancestors.push(parent_id);
                current = Some(parent_id);
                iterations += 1;
            },
            None => break,
        }
    }

    ancestors
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    #[test]
    fn test_validate_parent_change_none_is_valid() {
        let parents = HashMap::new();
        assert!(validate_parent_change(Uuid::new_v4(), None, &parents).is_ok());
    }

    #[test]
    fn test_validate_parent_change_self_is_invalid() {
        let task_id = Uuid::new_v4();
        let parents = HashMap::new();
        assert!(validate_parent_change(task_id, Some(task_id), &parents).is_err());
    }

    #[test]
    fn test_validate_parent_change_detects_cycle() {
        let task_a = Uuid::new_v4();
        let task_b = Uuid::new_v4();
        let task_c = Uuid::new_v4();

        // A -> B -> C (C's parent is B, B's parent is A)
        let mut parents = HashMap::new();
        parents.insert(task_b, Some(task_a));
        parents.insert(task_c, Some(task_b));

        // Try to make A's parent C - would create cycle: A -> B -> C -> A
        assert!(validate_parent_change(task_a, Some(task_c), &parents).is_err());

        // Making A's parent B directly should also fail (already B's parent)
        assert!(validate_parent_change(task_a, Some(task_b), &parents).is_err());
    }

    #[test]
    fn test_get_ancestors() {
        let task_a = Uuid::new_v4();
        let task_b = Uuid::new_v4();
        let task_c = Uuid::new_v4();

        let mut parents = HashMap::new();
        parents.insert(task_b, Some(task_a));
        parents.insert(task_c, Some(task_b));

        let ancestors = get_ancestors(task_c, &parents);
        assert_eq!(ancestors.len(), 2);
        assert_eq!(ancestors[0], task_b);
        assert_eq!(ancestors[1], task_a);
    }
}
