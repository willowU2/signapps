use axum::{
    routing::{get, post},
    Router,
};
use signapps_db::DbPool;

use crate::handlers::{create_hardware, get_hardware, list_hardware};

pub fn api_routes() -> Router<DbPool> {
    Router::new()
        .route("/hardware", get(list_hardware).post(create_hardware))
        .route("/hardware/:id", get(get_hardware))
}
