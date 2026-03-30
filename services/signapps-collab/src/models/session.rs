#[derive(Clone, Debug)]
/// Enum representing BroadcastMessage variants.
pub enum BroadcastMessage {
    Binary(Vec<u8>),
    Text(String),
}
