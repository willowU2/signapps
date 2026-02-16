use yrs::{Doc, Text};

/// Helper to create a collaborative text type
pub fn create_shared_text(doc: &Doc, name: &str) -> Text {
    let mut txn = doc.transact_mut();
    let text = txn.get_or_insert_text(name);
    text
}

/// Helper to get shared text from document
pub fn get_shared_text(doc: &Doc, name: &str) -> Option<Text> {
    let map = doc.get_type("root");
    map.get(name).and_then(|v| v.cast::<Text>())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_shared_text() {
        let doc = Doc::new();
        let _text = create_shared_text(&doc, "content");

        // Verify text was created
        assert!(get_shared_text(&doc, "content").is_some());
    }
}
