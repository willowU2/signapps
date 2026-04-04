//! AD schema registry — objectClass definitions and attribute syntax.

pub mod attributes;
pub mod classes;
pub mod syntax;

pub use attributes::{find_attribute, AttributeDef, BUILTIN_ATTRIBUTES};
pub use classes::{class_hierarchy, find_class, ObjectClassDef, PgSource, BUILTIN_CLASSES};
pub use syntax::{AttributeSyntax, AttributeValue};
