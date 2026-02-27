#[derive(Clone, Debug)]
pub enum BroadcastMessage {
    Binary(Vec<u8>),
    Text(String),
}
