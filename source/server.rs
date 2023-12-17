use std::net::SocketAddr;
use std::path::PathBuf;
use chrono;
use axum_server;
use axum;

mod expense;

fn log(message: &str) {
    println!("[{}] {message}",
             chrono::prelude::Utc::now().to_rfc3339_opts
             (chrono::SecondsFormat::Millis, true));
}

async fn logging(request: axum::http::Request<axum::body::Body>,
                 next: axum::middleware::Next<axum::body::Body>) ->
    axum::response::Response
{
    log(&format!("{} {}", request.method(), request.uri().path()));
    next.run(request).await
}

#[tokio::main]
async fn main() {
    let port = 7878; // TODO: make configurable
    let mut app = axum::Router::new();
    app = expense::setup(app).await;

    log(&format!("START http://localhost:{port}"));
    axum_server::bind_rustls(
        SocketAddr::from(([0, 0, 0, 0], port)),
        axum_server::tls_rustls::RustlsConfig::from_pem_file(
            PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .join("server-cert.pem"),
            PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .join("server-key.pem")).await.unwrap())
        .serve(app
               .route("/", axum::routing::get(
                   || async { "Hello, Rust!" }))
               .layer(axum::middleware::from_fn(logging))
               .into_make_service())
        .await.unwrap();
}
