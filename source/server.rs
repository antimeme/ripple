// :TODO: request optional TLS client certificates
use rocket::fs::relative;
use ripple::rocketutil::FileExtServer;
use ripple::rocketutil::bootstrap_tls;

fn create_server() -> rocket::Rocket<rocket::Build> {
    use figment::providers::{Format, Json};

    let figment = rocket::Config::figment()
        .merge(Json::file("/etc/ripple/server.json"))
        .merge(Json::file("./server.json"))
        .join(("address", "0.0.0.0"))
        .join(("port", 7878))
        .join(("tls.key", "./server-key.pem"))
        .join(("tls.certs", "./server-chain.pem"))
        .join(("databases.expensedb.url", "./expense.db"));
    bootstrap_tls(&figment);

    let server = rocket::custom(figment);
    ripple::expense::expense_server(server)
        .mount("/", FileExtServer::new(relative!("index.html")))
        .mount("/favicon.ico", FileExtServer::new(
            relative!("resources/images/ripple.png")).rank(1))
        .mount("/apps", FileExtServer::new(relative!("apps")))
        .mount("/slides", FileExtServer::new(relative!("slides")))
}

#[rocket::main]
async fn main() -> Result<(), rocket::Error>
{ let _rocket = create_server().launch().await?; Ok(()) }
