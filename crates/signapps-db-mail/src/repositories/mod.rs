//! Mail domain repositories.

pub mod mailserver_repo;

pub use mailserver_repo::{
    AccountRepository, DomainRepository, MailboxRepository, MessageRepository,
};
