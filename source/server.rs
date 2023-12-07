use std::net::SocketAddr;
use chrono::{prelude::Utc, SecondsFormat};
use axum;

fn log(message: &str) {
    println!("{} {message}", Utc::now().to_rfc3339_opts
             (SecondsFormat::Millis, true));
}

async fn logging(req: axum::http::Request<axum::body::Body>,
                 next: axum::middleware::Next<axum::body::Body>) ->
    axum::response::Response
{
    log(&format!("URI: {}", req.uri()));
    next.run(req).await
}

#[tokio::main]
async fn main() {
    let port = 7878;
    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    let app = axum::Router::new()
        .route("/", axum::routing::get(|| async { "Hello, Rust!" }))
        .layer(axum::middleware::from_fn(logging));

    log(&format!("starting server on http://localhost:{port}"));
    axum::Server::bind(&addr)
        .serve(app.into_make_service())
        .await.unwrap();
}
