// :TODO: SQL query to create expenses table at startup
// :TODO: read location of server.db file from environment or config
// :TODO: support TLS if certficates are available
// :TODO: request optional TLS client certificates
use std::path::{Path, PathBuf};

#[macro_use] extern crate rocket;
use rocket::{route, fs::relative};
use rocket::serde::{Serialize, Deserialize, json::Json};
use rocket::http::uri::Segments;
use rocket::http::ext::IntoOwned;
use rocket::response::Redirect;
use rocket_db_pools::{self, sqlx::{self, Row}, Database, Connection};

#[derive(rocket_db_pools::Database)]
#[database("serverdb")]
struct ServerDB(sqlx::SqlitePool);

#[derive(Serialize, Deserialize)]
#[serde(crate = "rocket::serde")]
struct Expense {
    id:     i32,
    amount: f32,
    reason: String,
    date:   String,
    tags:   Vec<String>
}

#[derive(Serialize, Deserialize)]
#[serde(crate = "rocket::serde")]
struct ExpenseList {
    expenses: Vec<Expense>
}

#[get("/list", format="json")]
async fn expense_list(mut db: Connection<ServerDB>) ->
    Result<Json<ExpenseList>, String>
{
    let mut list = ExpenseList { expenses: Vec::new() };
    match sqlx::query(concat!(
        "SELECT id, amount, reason, date ",
        "  FROM expenses",
        " ORDER BY date;"))
        .fetch_all(&mut *db).await {
            Ok(cursor) => {
                for row in cursor {
                    list.expenses.push(Expense {
                        id:     row.get(0),
                        amount: row.get(1),
                        reason: row.get(2),
                        date:   row.get(3),
                        tags:   Vec::new()
                    });
                }
                Ok(Json(list))
            },
            Err(e) => { Err(e.to_string()) }
        }
}

#[post("/add", format="json", data="<expense>")]
async fn expense_add(mut db: Connection<ServerDB>,
                     expense: Json<Expense>) -> String
{
    println!("Date: {}", &expense.date);
    match sqlx::query(concat!(
        "INSERT INTO expenses (reason, amount, date) ",
        "VALUES ($1, $2, $3);"))
        .bind(&expense.reason)
        .bind(expense.amount)
        .bind(&expense.date)
        .execute(&mut *db).await {
            Ok(_) => "Success".to_string(),
            Err(err) => err.to_string()
        }
}

/**
 * A modified version of Rocket FileServer that accepts root URIs and
 * attempts to append file extensions to find existing files.  At the
 * moment only the "html" extension is used, but others may be added
 * in the future. */
#[derive(Debug, Clone)]
pub struct FileExtServer {
    root: PathBuf,
    rank: isize
}

impl FileExtServer {
    const DEFAULT_RANK: isize = 10;

    pub fn new<P: AsRef<Path>>(path: P) -> Self {
        FileExtServer {
            root: path.as_ref().into(),
            rank: Self::DEFAULT_RANK }
    }

    pub fn rank(mut self, rank: isize) -> Self
    { self.rank = rank; self }
}

impl From<FileExtServer> for Vec<route::Route> {
    fn from(server: FileExtServer) -> Self {
        let mut route = route::Route::ranked(
            server.rank, rocket::http::Method::Get,
            if server.root.as_path().is_dir()
            { "/<path..>" } else { "/" }, server);
        route.name = Some(format!("FileExtServer").into());
        vec![route]
    }
}

#[rocket::async_trait]
impl route::Handler for FileExtServer {
    async fn handle<'r>(&self, req: &'r rocket::Request<'_>,
                        data: rocket::Data<'r>) -> route::Outcome<'r> {
        // Our root should either be a file or a directory.
        // If it's a file then that is the only file this handler
        // can serve up.  Otherwise we start from that directory
        // and look for a matching path.
        let possible = self.root.as_path();
        let path: Option<PathBuf> =
            if possible.exists() && !possible.is_dir() {
                Some(self.root.clone())
            } else {
                req.segments::<Segments<
                        '_, rocket::http::uri::fmt::Path>>(0..).ok()
                    .and_then(|segments| segments
                              .to_path_buf(false).ok())
                    .map(|path| self.root.join(path))
            };

        match path {
            Some(p) if p.is_dir() => {
                if !req.uri().path().ends_with('/') {
                    route::Outcome::from_or_forward(
                        req, data, Redirect::permanent(
                            req.uri().map_path(|p| format!("{}/", p))
                                .expect("adding a trailing slash")
                                .into_owned()))
                } else {
                    route::Outcome::from_or_forward(
                        req, data, rocket::fs::NamedFile::open(
                            p.join("index.html")).await.ok())
                }
            },
            Some(p) if !p.exists() && p.extension().is_none() => {
                let mut p = p;
                p.set_extension("html");
                if p.exists() {
                    route::Outcome::from_or_forward(
                        req, data,
                        rocket::fs::NamedFile::open(p).await.ok())
                } else { route::Outcome::forward(data) }
            },
            Some(p) => route::Outcome::from_or_forward(
                req, data, rocket::fs::NamedFile::open(p).await.ok()),
            None => route::Outcome::forward(data),
        }
    }
}

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
    rocket::custom(rocket::Config::figment()
                   .merge(("address", "0.0.0.0"))
                   .merge(("port", 7878))
                   .merge(("databases.serverdb.url",
                           "./server.db")))
        .attach(ServerDB::init())
        .mount("/", FileExtServer::new(relative!("index.html")))
        .mount("/favicon.ico", FileExtServer::new(
            relative!("resources/images/ripple.png")).rank(1))
        .mount("/apps", FileExtServer::new(relative!("apps")))
        .mount("/slides", FileExtServer::new(relative!("slides")))
        .mount("/expense", FileExtServer::new(
            relative!("apps/expense.html")))
        .mount("/expense", routes![expense_add, expense_list])
}

#[rocket::main]
async fn main() -> Result<(), rocket::Error>
{ let _rocket = create_server().launch().await?; Ok(()) }
