//! Build script — validates `catalog.json` at compile time.
//!
//! The actual validation logic is filled in Task 7. For now this
//! only declares the rebuild trigger so Cargo tracks the catalog file.

fn main() {
    // Once catalog.json exists (Task 5), this will be validated here.
    println!("cargo:rerun-if-changed=catalog.json");
}
