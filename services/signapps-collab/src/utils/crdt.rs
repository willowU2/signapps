use yrs::{Doc, ReadTxn, TextRef, Transact};

pub fn create_shared_text(doc: &Doc, name: &str) -> TextRef {
    let txn = doc.transact_mut();
    // TODO: creation fails on yrs 0.17?
    txn.get_text(name).expect("Text failed to load or create")
}

/// Helper to get shared text from document
pub fn get_shared_text(doc: &Doc, name: &str) -> Option<TextRef> {
    let txn = doc.transact();
    txn.get_text(name)
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
