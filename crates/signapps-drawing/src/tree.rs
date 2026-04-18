//! Ordered display tree for z-indexed rendering.
//!
//! The display tree manages a collection of [`DisplayElement`]s, each containing
//! drawing primitives with z-ordering, visibility, and lock state. When flattened
//! for rendering, only visible elements are included, sorted by `z_index`.
//!
//! # Examples
//!
//! ```
//! use signapps_drawing::tree::{DisplayTree, DisplayElement};
//! use signapps_drawing::primitives::DrawPrimitive;
//! use signapps_drawing::styles::ShapeStyle;
//! use uuid::Uuid;
//!
//! let mut tree = DisplayTree::new();
//! tree.add(DisplayElement {
//!     id: Uuid::new_v4(),
//!     primitives: vec![DrawPrimitive::Rect {
//!         x: 0.0, y: 0.0, width: 100.0, height: 50.0,
//!         style: ShapeStyle::new().with_fill("#3b82f6"),
//!         corner_radius: 0.0,
//!     }],
//!     z_index: 1,
//!     visible: true,
//!     locked: false,
//!     label: Some("Background".to_string()),
//! });
//!
//! let flat = tree.flatten();
//! assert_eq!(flat.len(), 1);
//! ```

use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::primitives::DrawPrimitive;

/// An element in the display tree with z-ordering and visibility.
///
/// Each element wraps one or more [`DrawPrimitive`]s and carries metadata
/// for layer management (z-index, visibility, locking, label).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DisplayElement {
    /// Unique identifier for this element.
    pub id: Uuid,
    /// Drawing primitives that compose this element.
    pub primitives: Vec<DrawPrimitive>,
    /// Z-index for rendering order (higher = in front).
    pub z_index: i32,
    /// Whether this element is visible (invisible elements are skipped during flatten).
    pub visible: bool,
    /// Whether this element is locked against editing.
    pub locked: bool,
    /// Optional human-readable label for the element.
    pub label: Option<String>,
}

/// Ordered display tree -- renders elements sorted by z_index.
///
/// The display tree is the top-level container for all drawable elements.
/// It provides add/remove/find operations and a `flatten()` method that
/// produces a z-ordered sequence of primitives ready for rendering.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct DisplayTree {
    /// All elements in the tree (not necessarily sorted).
    pub elements: Vec<DisplayElement>,
}

impl DisplayTree {
    /// Create a new empty display tree.
    ///
    /// # Examples
    ///
    /// ```
    /// use signapps_drawing::tree::DisplayTree;
    ///
    /// let tree = DisplayTree::new();
    /// assert!(tree.elements.is_empty());
    /// ```
    pub fn new() -> Self {
        Self {
            elements: Vec::new(),
        }
    }

    /// Add an element to the display tree.
    ///
    /// # Examples
    ///
    /// ```
    /// use signapps_drawing::tree::{DisplayTree, DisplayElement};
    /// use uuid::Uuid;
    ///
    /// let mut tree = DisplayTree::new();
    /// tree.add(DisplayElement {
    ///     id: Uuid::new_v4(),
    ///     primitives: vec![],
    ///     z_index: 0,
    ///     visible: true,
    ///     locked: false,
    ///     label: None,
    /// });
    /// assert_eq!(tree.elements.len(), 1);
    /// ```
    pub fn add(&mut self, element: DisplayElement) {
        self.elements.push(element);
    }

    /// Remove an element by its ID.
    ///
    /// Does nothing if the ID is not found.
    ///
    /// # Examples
    ///
    /// ```
    /// use signapps_drawing::tree::{DisplayTree, DisplayElement};
    /// use uuid::Uuid;
    ///
    /// let mut tree = DisplayTree::new();
    /// let id = Uuid::new_v4();
    /// tree.add(DisplayElement {
    ///     id,
    ///     primitives: vec![],
    ///     z_index: 0,
    ///     visible: true,
    ///     locked: false,
    ///     label: None,
    /// });
    /// tree.remove(id);
    /// assert!(tree.elements.is_empty());
    /// ```
    pub fn remove(&mut self, id: Uuid) {
        self.elements.retain(|e| e.id != id);
    }

    /// Get all primitives sorted by z_index for rendering.
    ///
    /// Only visible elements are included. Elements are sorted in ascending
    /// z_index order (lowest z_index rendered first, i.e. behind higher ones).
    ///
    /// # Examples
    ///
    /// ```
    /// use signapps_drawing::tree::{DisplayTree, DisplayElement};
    /// use signapps_drawing::primitives::DrawPrimitive;
    /// use signapps_drawing::styles::ShapeStyle;
    /// use uuid::Uuid;
    ///
    /// let mut tree = DisplayTree::new();
    /// tree.add(DisplayElement {
    ///     id: Uuid::new_v4(),
    ///     primitives: vec![DrawPrimitive::Rect {
    ///         x: 0.0, y: 0.0, width: 10.0, height: 10.0,
    ///         style: ShapeStyle::new(), corner_radius: 0.0,
    ///     }],
    ///     z_index: 2,
    ///     visible: true,
    ///     locked: false,
    ///     label: None,
    /// });
    /// tree.add(DisplayElement {
    ///     id: Uuid::new_v4(),
    ///     primitives: vec![DrawPrimitive::Rect {
    ///         x: 5.0, y: 5.0, width: 10.0, height: 10.0,
    ///         style: ShapeStyle::new(), corner_radius: 0.0,
    ///     }],
    ///     z_index: 1,
    ///     visible: true,
    ///     locked: false,
    ///     label: None,
    /// });
    /// let flat = tree.flatten();
    /// assert_eq!(flat.len(), 2);
    /// ```
    pub fn flatten(&self) -> Vec<&DrawPrimitive> {
        let mut sorted: Vec<&DisplayElement> = self.elements.iter().filter(|e| e.visible).collect();
        sorted.sort_by_key(|e| e.z_index);
        sorted.iter().flat_map(|e| e.primitives.iter()).collect()
    }

    /// Find an element by its ID (immutable reference).
    ///
    /// Returns `None` if no element matches the given ID.
    ///
    /// # Examples
    ///
    /// ```
    /// use signapps_drawing::tree::{DisplayTree, DisplayElement};
    /// use uuid::Uuid;
    ///
    /// let mut tree = DisplayTree::new();
    /// let id = Uuid::new_v4();
    /// tree.add(DisplayElement {
    ///     id,
    ///     primitives: vec![],
    ///     z_index: 0,
    ///     visible: true,
    ///     locked: false,
    ///     label: Some("test".to_string()),
    /// });
    /// assert!(tree.find(id).is_some());
    /// assert!(tree.find(Uuid::new_v4()).is_none());
    /// ```
    pub fn find(&self, id: Uuid) -> Option<&DisplayElement> {
        self.elements.iter().find(|e| e.id == id)
    }

    /// Find an element by its ID (mutable reference).
    ///
    /// Returns `None` if no element matches the given ID.
    ///
    /// # Examples
    ///
    /// ```
    /// use signapps_drawing::tree::{DisplayTree, DisplayElement};
    /// use uuid::Uuid;
    ///
    /// let mut tree = DisplayTree::new();
    /// let id = Uuid::new_v4();
    /// tree.add(DisplayElement {
    ///     id,
    ///     primitives: vec![],
    ///     z_index: 0,
    ///     visible: true,
    ///     locked: false,
    ///     label: None,
    /// });
    /// if let Some(elem) = tree.find_mut(id) {
    ///     elem.z_index = 10;
    /// }
    /// assert_eq!(tree.find(id).map(|e| e.z_index), Some(10));
    /// ```
    pub fn find_mut(&mut self, id: Uuid) -> Option<&mut DisplayElement> {
        self.elements.iter_mut().find(|e| e.id == id)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::styles::ShapeStyle;

    fn make_element(z_index: i32, visible: bool) -> DisplayElement {
        DisplayElement {
            id: Uuid::new_v4(),
            primitives: vec![DrawPrimitive::Rect {
                x: 0.0,
                y: 0.0,
                width: 10.0,
                height: 10.0,
                style: ShapeStyle::new().with_fill("#000"),
                corner_radius: 0.0,
            }],
            z_index,
            visible,
            locked: false,
            label: None,
        }
    }

    #[test]
    fn new_tree_is_empty() {
        let tree = DisplayTree::new();
        assert!(tree.elements.is_empty());
        assert!(tree.flatten().is_empty());
    }

    #[test]
    fn add_and_find() {
        let mut tree = DisplayTree::new();
        let elem = make_element(1, true);
        let id = elem.id;
        tree.add(elem);

        assert_eq!(tree.elements.len(), 1);
        assert!(tree.find(id).is_some());
        assert_eq!(tree.find(id).map(|e| e.z_index), Some(1));
    }

    #[test]
    fn remove_element() {
        let mut tree = DisplayTree::new();
        let elem = make_element(1, true);
        let id = elem.id;
        tree.add(elem);
        tree.add(make_element(2, true));

        assert_eq!(tree.elements.len(), 2);
        tree.remove(id);
        assert_eq!(tree.elements.len(), 1);
        assert!(tree.find(id).is_none());
    }

    #[test]
    fn remove_nonexistent_id_is_noop() {
        let mut tree = DisplayTree::new();
        tree.add(make_element(1, true));
        tree.remove(Uuid::new_v4());
        assert_eq!(tree.elements.len(), 1);
    }

    #[test]
    fn flatten_sorts_by_z_index() {
        let mut tree = DisplayTree::new();
        tree.add(make_element(3, true));
        tree.add(make_element(1, true));
        tree.add(make_element(2, true));

        let flat = tree.flatten();
        assert_eq!(flat.len(), 3);
        // All primitives from the z_index=1 element should come first
    }

    #[test]
    fn flatten_excludes_invisible() {
        let mut tree = DisplayTree::new();
        tree.add(make_element(1, true));
        tree.add(make_element(2, false)); // invisible
        tree.add(make_element(3, true));

        let flat = tree.flatten();
        assert_eq!(flat.len(), 2); // only 2 visible elements, each with 1 primitive
    }

    #[test]
    fn find_mut_modifies_element() {
        let mut tree = DisplayTree::new();
        let elem = make_element(1, true);
        let id = elem.id;
        tree.add(elem);

        if let Some(e) = tree.find_mut(id) {
            e.z_index = 99;
            e.visible = false;
            e.label = Some("modified".to_string());
        }

        let found = tree.find(id).expect("element should exist");
        assert_eq!(found.z_index, 99);
        assert!(!found.visible);
        assert_eq!(found.label.as_deref(), Some("modified"));
    }

    #[test]
    fn flatten_with_multiple_primitives_per_element() {
        let mut tree = DisplayTree::new();
        tree.add(DisplayElement {
            id: Uuid::new_v4(),
            primitives: vec![
                DrawPrimitive::Rect {
                    x: 0.0,
                    y: 0.0,
                    width: 10.0,
                    height: 10.0,
                    style: ShapeStyle::new(),
                    corner_radius: 0.0,
                },
                DrawPrimitive::Rect {
                    x: 20.0,
                    y: 20.0,
                    width: 10.0,
                    height: 10.0,
                    style: ShapeStyle::new(),
                    corner_radius: 0.0,
                },
            ],
            z_index: 1,
            visible: true,
            locked: false,
            label: None,
        });

        let flat = tree.flatten();
        assert_eq!(flat.len(), 2);
    }

    #[test]
    fn serialization_roundtrip() {
        let mut tree = DisplayTree::new();
        tree.add(make_element(5, true));

        let json = serde_json::to_string(&tree).expect("serialize");
        let deserialized: DisplayTree = serde_json::from_str(&json).expect("deserialize");
        assert_eq!(deserialized.elements.len(), 1);
        assert_eq!(deserialized.elements[0].z_index, 5);
    }
}
