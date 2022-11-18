// :TODO: store and filter by tags
// :TODO: read location of server.db file from environment or config
// :TODO: support TLS if certficates are available
// :TODO: request optional TLS client certificates
use rocket::fs::relative;

use ripple::rocketutil::FileExtServer;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn it_works() {
        let result = 2 + 2;
        assert_eq!(result, 4);
    }
}

fn create_server() -> rocket::Rocket<rocket::Build> {
    ripple::expense::expense_server(
        rocket::custom(rocket::Config::figment()
                       .merge(("address", "0.0.0.0"))
                       .merge(("port", 7878))
                       .merge(("databases.serverdb.url",
                           "./server.db"))))
        .mount("/", FileExtServer::new(relative!("index.html")))
        .mount("/favicon.ico", FileExtServer::new(
            relative!("resources/images/ripple.png")).rank(1))
        .mount("/apps", FileExtServer::new(relative!("apps")))
        .mount("/slides", FileExtServer::new(relative!("slides")))
}

#[rocket::main]
async fn main() -> Result<(), rocket::Error>
{ let _rocket = create_server().launch().await?; Ok(()) }
