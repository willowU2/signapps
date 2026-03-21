use axum::{
    extract::State,
    response::sse::{Event, Sse},
};
use futures::stream::Stream;
use signapps_common::middleware::UserContext;
use std::convert::Infallible;
use tokio_stream::{wrappers::BroadcastStream, StreamExt};

use crate::AppState;

pub async fn sse_handler(
    State(state): State<AppState>,
    user_context: UserContext,
) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    // We subscribe to the global broadcast channel
    let receiver = state.tx_notifications.subscribe();

    // Convert the receiver into a Stream
    let stream = BroadcastStream::new(receiver)
        // Filter out errors (like RecvError::Lagged)
        .filter_map(|res| res.ok())
        // Only keep notifications meant for this user
        .filter(move |msg| msg.user_id == user_context.user_id)
        // Convert to SSE Event
        .map(|msg| {
            let json = serde_json::to_string(&msg).unwrap_or_default();
            let event = Event::default()
                .event("notification")
                .data(json);
            Ok(event)
        });

    Sse::new(stream).keep_alive(
        axum::response::sse::KeepAlive::new()
            .interval(std::time::Duration::from_secs(15))
            .text("keep-alive-text"),
    )
}
