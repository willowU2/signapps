use axum::{
    routing::{delete, get, put},
    Router,
};
use signapps_db::DatabasePool;

use crate::handlers::{create_hardware, delete_hardware, get_hardware, list_hardware, update_hardware};

pub fn api_routes() -> Router<DatabasePool> {
    Router::new()
        .route("/hardware", get(list_hardware).post(create_hardware))
        .route(
            "/hardware/:id",
            get(get_hardware).put(update_hardware).delete(delete_hardware),
        )
}
