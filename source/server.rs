// server.rs
// Copyright (C) 2023 by Jeff Gold.
//
// This program is free software: you can redistribute it and/or
// modify it under the terms of the GNU General Public License as
// published by the Free Software Foundation, either version 3 of the
// License, or (at your option) any later version.
//
// This program is distributed in the hope that it will be useful, but
// WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
// General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program.  If not, see
// <http://www.gnu.org/licenses/>.
//
// ---------------------------------------------------------------------
// An HTTPS server with optional client certificates.
//
// Links from nylonicious
// https://github.com/programatik29/axum-server/blob/master/examples/rustls_session.rs
// https://github.com/programatik29/axum-server/blob/e575e90d1fc796401d144f306648553909336700/examples/rustls_session.rs#L37
// https://docs.rs/rustls/latest/rustls/server/struct.ServerConfig.html#method.builder
// https://docs.rs/rustls/latest/rustls/server/struct.ClientCertVerifierBuilder.html
// https://github.com/seanmonstar/warp/blob/2c3581e8387e29bab2ac1aa5f9ae9602fe62339f/src/tls.rs#L226
// https://docs.rs/axum-server/latest/src/axum_server/tls_rustls/mod.rs.html#156
// https://docs.rs/axum-server/latest/axum_server/tls_rustls/struct.RustlsConfig.html#method.from_config
// https://github.com/programatik29/axum-server/blob/master/examples/rustls_session.rs
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
                .join("server-chain.pem"),
            PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .join("server-key.pem")).await.unwrap())
        .serve(app
               .route("/", axum::routing::get(
                   || async { "Hello, Rust!" }))
               .layer(axum::middleware::from_fn(logging))
               .into_make_service())
        .await.unwrap();
}
