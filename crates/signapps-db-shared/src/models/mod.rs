//! Shared database models extracted from `signapps-db`.

pub mod activity;
pub mod automation;
pub mod brand_kit;
pub mod cell_format;
pub mod company;
pub mod entity_reference;
pub mod job;
pub mod presentation;
pub mod resource_booking;
pub mod style;
pub mod template_variable;
pub mod tenant;
pub mod validation_rule;
pub mod versioning;

pub use activity::*;
pub use automation::*;
pub use brand_kit::*;
pub use cell_format::*;
pub use company::*;
pub use entity_reference::*;
pub use job::*;
pub use presentation::*;
pub use resource_booking::*;
pub use style::*;
pub use template_variable::*;
pub use tenant::*;
pub use validation_rule::*;
pub use versioning::*;
