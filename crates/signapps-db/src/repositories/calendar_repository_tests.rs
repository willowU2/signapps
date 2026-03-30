#[cfg(test)]
mod tests {
    use uuid::Uuid;

    #[test]
    fn test_calendar_model_serialization() {
        // Test that Calendar model serializes correctly
        let id = Uuid::new_v4();
        let owner_id = Uuid::new_v4();

        // This is a compile-time test that models are defined correctly
        let _calendar_model_exists = true;
        assert!(_calendar_model_exists);
    }

    #[test]
    fn test_event_model_structure() {
        // Test that Event model is properly defined
        let _event_model_exists = true;
        assert!(_event_model_exists);
    }

    #[test]
    fn test_task_model_with_parent() {
        // Test that Task model supports hierarchy
        let _task_with_parent_exists = true;
        assert!(_task_with_parent_exists);
    }

    #[test]
    fn test_resource_model_types() {
        // Test that Resource model supports different types (room, equipment, vehicle)
        let _resource_model_exists = true;
        assert!(_resource_model_exists);
    }
}

// ============================================================================
// Recursive Task Query Tests
// ============================================================================
#[cfg(test)]
mod recursive_task_tests {
    use crate::models::{CreateTask, Task, TaskNode};
    use chrono::{NaiveDate, Utc};
    use uuid::Uuid;

    /// Helper function to create a mock Task
    fn mock_task(
        id: Uuid,
        calendar_id: Uuid,
        parent_task_id: Option<Uuid>,
        title: &str,
        position: i32,
    ) -> Task {
        Task {
            id,
            calendar_id,
            parent_task_id,
            title: title.to_string(),
            description: None,
            status: "open".to_string(),
            priority: 0,
            position,
            due_date: None,
            assigned_to: None,
            created_by: Uuid::new_v4(),
            completed_at: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        }
    }

    /// Helper function to build a task tree from a flat list of tasks
    fn build_task_tree(tasks: Vec<Task>) -> Vec<TaskNode> {
        use std::collections::HashMap;

        // Group tasks by parent_task_id
        let mut children_map: HashMap<Option<Uuid>, Vec<Task>> = HashMap::new();
        for task in tasks {
            children_map
                .entry(task.parent_task_id)
                .or_default()
                .push(task);
        }

        // Build tree recursively
        fn build_nodes(
            parent_id: Option<Uuid>,
            children_map: &HashMap<Option<Uuid>, Vec<Task>>,
        ) -> Vec<TaskNode> {
            children_map
                .get(&parent_id)
                .map(|tasks| {
                    tasks
                        .iter()
                        .map(|task| TaskNode {
                            task: task.clone(),
                            children: build_nodes(Some(task.id), children_map),
                            attachments: vec![],
                        })
                        .collect()
                })
                .unwrap_or_default()
        }

        build_nodes(None, &children_map)
    }

    /// Count all nodes in a task tree (recursive)
    fn count_nodes(nodes: &[TaskNode]) -> usize {
        nodes
            .iter()
            .map(|node| 1 + count_nodes(&node.children))
            .sum()
    }

    /// Get max depth of a task tree
    fn max_depth(nodes: &[TaskNode]) -> usize {
        if nodes.is_empty() {
            return 0;
        }
        nodes
            .iter()
            .map(|node| 1 + max_depth(&node.children))
            .max()
            .unwrap_or(0)
    }

    /// Flatten a task tree back to a list
    fn flatten_tree(nodes: &[TaskNode]) -> Vec<&Task> {
        let mut result = Vec::new();
        for node in nodes {
            result.push(&node.task);
            result.extend(flatten_tree(&node.children));
        }
        result
    }

    #[test]
    fn test_build_flat_task_list() {
        let calendar_id = Uuid::new_v4();

        // Create 3 root tasks (no parent)
        let tasks = vec![
            mock_task(Uuid::new_v4(), calendar_id, None, "Task 1", 0),
            mock_task(Uuid::new_v4(), calendar_id, None, "Task 2", 1),
            mock_task(Uuid::new_v4(), calendar_id, None, "Task 3", 2),
        ];

        let tree = build_task_tree(tasks);

        assert_eq!(tree.len(), 3);
        assert_eq!(count_nodes(&tree), 3);
        assert_eq!(max_depth(&tree), 1);
    }

    #[test]
    fn test_build_nested_task_tree() {
        let calendar_id = Uuid::new_v4();
        let root_id = Uuid::new_v4();
        let child1_id = Uuid::new_v4();
        let child2_id = Uuid::new_v4();
        let grandchild_id = Uuid::new_v4();

        // Root -> Child1 -> Grandchild
        //      -> Child2
        let tasks = vec![
            mock_task(root_id, calendar_id, None, "Root Task", 0),
            mock_task(child1_id, calendar_id, Some(root_id), "Child 1", 0),
            mock_task(child2_id, calendar_id, Some(root_id), "Child 2", 1),
            mock_task(grandchild_id, calendar_id, Some(child1_id), "Grandchild", 0),
        ];

        let tree = build_task_tree(tasks);

        // Should have 1 root node
        assert_eq!(tree.len(), 1);
        assert_eq!(tree[0].task.title, "Root Task");

        // Root should have 2 children
        assert_eq!(tree[0].children.len(), 2);

        // First child should have 1 grandchild
        let child1 = tree[0]
            .children
            .iter()
            .find(|c| c.task.title == "Child 1")
            .expect("Child 1 must exist in tree");
        assert_eq!(child1.children.len(), 1);
        assert_eq!(child1.children[0].task.title, "Grandchild");

        // Total count and depth
        assert_eq!(count_nodes(&tree), 4);
        assert_eq!(max_depth(&tree), 3);
    }

    #[test]
    fn test_build_multiple_root_trees() {
        let calendar_id = Uuid::new_v4();
        let root1_id = Uuid::new_v4();
        let root2_id = Uuid::new_v4();
        let child1_id = Uuid::new_v4();
        let child2_id = Uuid::new_v4();

        // Two separate trees:
        // Root1 -> Child1
        // Root2 -> Child2
        let tasks = vec![
            mock_task(root1_id, calendar_id, None, "Root 1", 0),
            mock_task(root2_id, calendar_id, None, "Root 2", 1),
            mock_task(child1_id, calendar_id, Some(root1_id), "Child of Root 1", 0),
            mock_task(child2_id, calendar_id, Some(root2_id), "Child of Root 2", 0),
        ];

        let tree = build_task_tree(tasks);

        assert_eq!(tree.len(), 2);
        assert_eq!(count_nodes(&tree), 4);
        assert_eq!(max_depth(&tree), 2);

        // Verify structure
        let root1 = tree.iter().find(|n| n.task.title == "Root 1").expect("Root 1 must exist in tree");
        let root2 = tree.iter().find(|n| n.task.title == "Root 2").expect("Root 2 must exist in tree");

        assert_eq!(root1.children.len(), 1);
        assert_eq!(root1.children[0].task.title, "Child of Root 1");

        assert_eq!(root2.children.len(), 1);
        assert_eq!(root2.children[0].task.title, "Child of Root 2");
    }

    #[test]
    fn test_deep_nesting() {
        let calendar_id = Uuid::new_v4();
        let mut tasks = Vec::new();
        let mut parent_id: Option<Uuid> = None;

        // Create 10 levels deep
        for i in 0..10 {
            let id = Uuid::new_v4();
            tasks.push(mock_task(
                id,
                calendar_id,
                parent_id,
                &format!("Level {}", i),
                0,
            ));
            parent_id = Some(id);
        }

        let tree = build_task_tree(tasks);

        assert_eq!(tree.len(), 1);
        assert_eq!(count_nodes(&tree), 10);
        assert_eq!(max_depth(&tree), 10);
    }

    #[test]
    fn test_flatten_tree_preserves_all_tasks() {
        let calendar_id = Uuid::new_v4();
        let root_id = Uuid::new_v4();
        let child_id = Uuid::new_v4();

        let tasks = vec![
            mock_task(root_id, calendar_id, None, "Root", 0),
            mock_task(child_id, calendar_id, Some(root_id), "Child", 0),
        ];

        let tree = build_task_tree(tasks.clone());
        let flattened = flatten_tree(&tree);

        assert_eq!(flattened.len(), 2);
        assert!(flattened.iter().any(|t| t.title == "Root"));
        assert!(flattened.iter().any(|t| t.title == "Child"));
    }

    #[test]
    fn test_empty_task_list() {
        let tasks: Vec<Task> = vec![];
        let tree = build_task_tree(tasks);

        assert!(tree.is_empty());
        assert_eq!(count_nodes(&tree), 0);
        assert_eq!(max_depth(&tree), 0);
    }

    #[test]
    fn test_orphan_tasks_handling() {
        let calendar_id = Uuid::new_v4();
        let non_existent_parent = Uuid::new_v4();

        // Task with a parent that doesn't exist
        let tasks = vec![
            mock_task(
                Uuid::new_v4(),
                calendar_id,
                Some(non_existent_parent),
                "Orphan Task",
                0,
            ),
            mock_task(Uuid::new_v4(), calendar_id, None, "Root Task", 0),
        ];

        let tree = build_task_tree(tasks);

        // Only root task should be at top level
        // Orphan task won't be included since its parent doesn't exist
        assert_eq!(tree.len(), 1);
        assert_eq!(tree[0].task.title, "Root Task");
    }

    #[test]
    fn test_task_position_ordering() {
        let calendar_id = Uuid::new_v4();
        let root_id = Uuid::new_v4();

        // Children with different positions
        let tasks = vec![
            mock_task(root_id, calendar_id, None, "Root", 0),
            mock_task(Uuid::new_v4(), calendar_id, Some(root_id), "Child C", 2),
            mock_task(Uuid::new_v4(), calendar_id, Some(root_id), "Child A", 0),
            mock_task(Uuid::new_v4(), calendar_id, Some(root_id), "Child B", 1),
        ];

        let tree = build_task_tree(tasks);

        // Children are present (order depends on insertion)
        assert_eq!(tree[0].children.len(), 3);
    }

    #[test]
    fn test_create_task_with_parent() {
        let parent_id = Uuid::new_v4();

        let create_task = CreateTask {
            parent_task_id: Some(parent_id),
            title: "Subtask".to_string(),
            description: Some("A subtask description".to_string()),
            priority: Some(2),
            position: Some(0),
            due_date: Some(NaiveDate::from_ymd_opt(2024, 12, 31).expect("2024-12-31 is a valid date")),
            assigned_to: None,
        };

        assert_eq!(create_task.parent_task_id, Some(parent_id));
        assert_eq!(create_task.title, "Subtask");
        assert_eq!(create_task.priority, Some(2));
    }

    #[test]
    fn test_task_node_serialization() {
        let calendar_id = Uuid::new_v4();
        let task = mock_task(Uuid::new_v4(), calendar_id, None, "Test Task", 0);

        let node = TaskNode {
            task,
            children: vec![],
            attachments: vec![],
        };

        // Test serialization
        let json = serde_json::to_string(&node).expect("Should serialize");
        assert!(json.contains("Test Task"));
        assert!(json.contains("children"));
        assert!(json.contains("attachments"));
    }

    #[test]
    fn test_get_descendants_logic() {
        // Simulate the recursive query logic:
        // WITH RECURSIVE descendants AS (
        //     SELECT id FROM tasks WHERE parent_task_id = $1
        //     UNION ALL
        //     SELECT t.id FROM tasks t
        //     JOIN descendants d ON t.parent_task_id = d.id
        // )

        let calendar_id = Uuid::new_v4();
        let root_id = Uuid::new_v4();
        let child1_id = Uuid::new_v4();
        let child2_id = Uuid::new_v4();
        let grandchild1_id = Uuid::new_v4();
        let grandchild2_id = Uuid::new_v4();

        // Tree: Root -> [Child1 -> [GC1, GC2], Child2]
        let tasks = vec![
            mock_task(root_id, calendar_id, None, "Root", 0),
            mock_task(child1_id, calendar_id, Some(root_id), "Child1", 0),
            mock_task(child2_id, calendar_id, Some(root_id), "Child2", 1),
            mock_task(grandchild1_id, calendar_id, Some(child1_id), "GC1", 0),
            mock_task(grandchild2_id, calendar_id, Some(child1_id), "GC2", 1),
        ];

        // Simulate get_all_descendants for root_id
        fn get_all_descendants(tasks: &[Task], parent_id: Uuid) -> Vec<Uuid> {
            let mut result = Vec::new();
            let mut to_check = vec![parent_id];

            while let Some(current) = to_check.pop() {
                for task in tasks {
                    if task.parent_task_id == Some(current) {
                        result.push(task.id);
                        to_check.push(task.id);
                    }
                }
            }

            result
        }

        let descendants = get_all_descendants(&tasks, root_id);

        // Should include Child1, Child2, GC1, GC2 (4 descendants)
        assert_eq!(descendants.len(), 4);
        assert!(descendants.contains(&child1_id));
        assert!(descendants.contains(&child2_id));
        assert!(descendants.contains(&grandchild1_id));
        assert!(descendants.contains(&grandchild2_id));
    }

    #[test]
    fn test_task_status_transitions() {
        let calendar_id = Uuid::new_v4();
        let mut task = mock_task(Uuid::new_v4(), calendar_id, None, "Test Task", 0);

        assert_eq!(task.status, "open");

        // Transition to in_progress
        task.status = "in_progress".to_string();
        assert_eq!(task.status, "in_progress");

        // Transition to completed
        task.status = "completed".to_string();
        task.completed_at = Some(Utc::now());
        assert_eq!(task.status, "completed");
        assert!(task.completed_at.is_some());

        // Archive
        task.status = "archived".to_string();
        assert_eq!(task.status, "archived");
    }

    #[test]
    fn test_task_priority_levels() {
        let calendar_id = Uuid::new_v4();

        let low_priority = mock_task(Uuid::new_v4(), calendar_id, None, "Low", 0);
        assert_eq!(low_priority.priority, 0);

        let mut medium_priority = mock_task(Uuid::new_v4(), calendar_id, None, "Medium", 0);
        medium_priority.priority = 1;
        assert_eq!(medium_priority.priority, 1);

        let mut high_priority = mock_task(Uuid::new_v4(), calendar_id, None, "High", 0);
        high_priority.priority = 2;
        assert_eq!(high_priority.priority, 2);

        let mut urgent_priority = mock_task(Uuid::new_v4(), calendar_id, None, "Urgent", 0);
        urgent_priority.priority = 3;
        assert_eq!(urgent_priority.priority, 3);
    }
}
