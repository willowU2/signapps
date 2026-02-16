use yrs::Doc;

/// Initialize shared types for different document types
///
/// Note: Y.js types (Text, Map, Array) are traits, not concrete types.
/// In production, use proper Y.js bindings or manage as dynamic types.

/// Initialize a text document structure
pub fn init_text_structure(doc: &Doc) {
    let mut txn = doc.transact_mut();
    let _text = txn.get_or_insert_text("content");
}

/// Initialize a spreadsheet structure
/// Creates Y.Map<Y.Array> where each row is an array of cells
pub fn init_sheet_structure(doc: &Doc) {
    let mut txn = doc.transact_mut();
    let _sheet = txn.get_or_insert_map("sheet");
    let _rows = txn.get_or_insert_array("rows");
}

/// Initialize a presentation structure
/// Creates Y.Array of slides, each slide is a Y.Map with title/content
pub fn init_presentation_structure(doc: &Doc) {
    let mut txn = doc.transact_mut();
    let _slides = txn.get_or_insert_array("slides");
    // Add default first slide
}

/// Initialize a board structure
/// Creates Y.Map<Y.Array> where each column is an array of cards
pub fn init_board_structure(doc: &Doc) {
    let mut txn = doc.transact_mut();
    let _board = txn.get_or_insert_map("board");
    let _columns = txn.get_or_insert_map("columns");

    // Create default columns: To Do, In Progress, Done
    let _todo_col = txn.get_or_insert_array("todo");
    let _in_progress_col = txn.get_or_insert_array("in_progress");
    let _done_col = txn.get_or_insert_array("done");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_init_text_structure() {
        let doc = Doc::new();
        init_text_structure(&doc);
        // Verify structure was initialized without panic
    }

    #[test]
    fn test_init_sheet_structure() {
        let doc = Doc::new();
        init_sheet_structure(&doc);
    }

    #[test]
    fn test_init_presentation_structure() {
        let doc = Doc::new();
        init_presentation_structure(&doc);
    }

    #[test]
    fn test_init_board_structure() {
        let doc = Doc::new();
        init_board_structure(&doc);
    }
}
