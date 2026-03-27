use yrs::{Doc, ReadTxn, Transact};

/// Initialize a text document by pre-creating the shared `content` Text
/// and `meta` Map types so the first Y.js client sync sees a well-formed
/// document structure instead of an empty root.
///
/// Schema:
/// - `content`  : YText  — the main rich-text body
/// - `meta`     : YMap   — title, created_at, author, etc.
/// - `comments` : YArray — threaded comment threads
pub fn init_text_structure(doc: &Doc) {
    // get_or_insert_* must be called without an open transaction.
    let _ = doc.get_or_insert_text("content");
    let _ = doc.get_or_insert_map("meta");
    let _ = doc.get_or_insert_array("comments");
}

/// Initialize a spreadsheet document by pre-creating the shared types.
///
/// Schema:
/// - `cells`   : YMap   — sparse map of "row:col" → cell value
/// - `meta`    : YMap   — sheet name, frozen rows/cols, etc.
/// - `columns` : YArray — column definitions (width, type, header)
pub fn init_sheet_structure(doc: &Doc) {
    let _ = doc.get_or_insert_map("cells");
    let _ = doc.get_or_insert_map("meta");
    let _ = doc.get_or_insert_array("columns");
}

/// Initialize a presentation document by pre-creating the shared types.
///
/// Schema:
/// - `slides`  : YArray — ordered list of slide objects (YMap each)
/// - `meta`    : YMap   — title, theme, created_at, etc.
pub fn init_presentation_structure(doc: &Doc) {
    let _ = doc.get_or_insert_array("slides");
    let _ = doc.get_or_insert_map("meta");
}

/// Initialize a kanban board document by pre-creating the shared types.
///
/// Schema:
/// - `columns` : YArray — ordered list of column objects (YMap each)
/// - `cards`   : YMap   — card_id → YMap of card data
/// - `meta`    : YMap   — board title, background, settings, etc.
pub fn init_board_structure(doc: &Doc) {
    let _ = doc.get_or_insert_array("columns");
    let _ = doc.get_or_insert_map("cards");
    let _ = doc.get_or_insert_map("meta");
}

/// Return the initial binary state (V1 update) for a newly created document
/// of the given type. This byte slice is stored in the database so the
/// first WebSocket client immediately receives a valid document structure.
pub fn initial_state_for_type(doc_type: &str) -> Vec<u8> {
    let doc = Doc::new();
    match doc_type {
        "text" | "note" => init_text_structure(&doc),
        "sheet" | "spreadsheet" => init_sheet_structure(&doc),
        "presentation" | "slide" => init_presentation_structure(&doc),
        "board" | "kanban" => init_board_structure(&doc),
        _ => {
            // Unknown type — leave the document empty; the client defines its structure.
        },
    }
    let txn = doc.transact();
    let bytes = txn.encode_state_as_update_v1(&yrs::StateVector::default());
    bytes
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_init_text_structure_creates_types() {
        let doc = Doc::new();
        init_text_structure(&doc);
        // Verify structure was initialized without panic
        let txn = doc.transact();
        // Keys should now exist in the root
        assert!(txn.get_text("content").is_some());
        assert!(txn.get_map("meta").is_some());
        assert!(txn.get_array("comments").is_some());
    }

    #[test]
    fn test_init_sheet_structure() {
        let doc = Doc::new();
        init_sheet_structure(&doc);
        let txn = doc.transact();
        assert!(txn.get_map("cells").is_some());
        assert!(txn.get_map("meta").is_some());
        assert!(txn.get_array("columns").is_some());
    }

    #[test]
    fn test_init_presentation_structure() {
        let doc = Doc::new();
        init_presentation_structure(&doc);
        let txn = doc.transact();
        assert!(txn.get_array("slides").is_some());
        assert!(txn.get_map("meta").is_some());
    }

    #[test]
    fn test_init_board_structure() {
        let doc = Doc::new();
        init_board_structure(&doc);
        let txn = doc.transact();
        assert!(txn.get_array("columns").is_some());
        assert!(txn.get_map("cards").is_some());
        assert!(txn.get_map("meta").is_some());
    }

    #[test]
    fn test_initial_state_for_type_is_non_empty() {
        for t in &["text", "sheet", "presentation", "board"] {
            let state = initial_state_for_type(t);
            assert!(
                !state.is_empty(),
                "initial state for '{}' should not be empty",
                t
            );
        }
    }

    #[test]
    fn test_idempotent_initialization() {
        let doc = Doc::new();
        init_text_structure(&doc);
        init_text_structure(&doc); // calling twice must not panic or duplicate
        let txn = doc.transact();
        assert!(txn.get_text("content").is_some());
    }
}
