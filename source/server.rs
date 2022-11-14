use std::path::{Path, PathBuf};

#[macro_use] extern crate rocket;
use rocket::{Rocket, Build, Request, Data};
use rocket::fs::{relative, NamedFile};
use rocket::serde::{Deserialize, json::Json};
use rocket::route::{Route, Handler, Outcome};
use rocket::http::{Method, ContentType};
use rocket::http::uri::Segments;
use rocket::http::ext::IntoOwned;
use rocket::response::Redirect;
use rocket_db_pools::{Database, Connection};
use rocket_db_pools::sqlx;

#[derive(Database)]
#[database("serverdb")]
struct ServerDB(sqlx::SqlitePool);

#[derive(Deserialize)]
#[serde(crate = "rocket::serde")]
struct Expense {
    reason: String,
    amount: f32,
    tags: Vec<String>
}

#[get("/")]
fn expense_index() -> (ContentType, String) {
    (ContentType::HTML, String::from(r#"<!DOCTYPE html>
<meta charset=\"utf-8\" />
<style>
  input:invalid { border: red solid 3px; }
</style>
<title>Expenses</title>
<h1>Expenses</h1>
<fieldset>
  <legend>Add</legend>
  <form id="addForm" method="POST" action="/add">
    <label>
        Reason:
        <input id="addReason" type="text"
               placeholder="Electric Bill"/>
    </label>
    <label>
        Amount:
        <input id="addAmount" type="text"
               placeholder="$95.00" pattern="\$?[0-9]*.?[0-9]*"
               title="Monetary amount with optional dollar sign"/>
    </label>
    <label>
        Tags:
        <input id="addTags" type="text"
               placeholder="utility home"/>
    </label>
    <button id="addSubmit" type="submit">Submit</button>
    <button id="addClear" type="button">Clear</button>
  </form>
</fieldset>
<textarea id="response" disabled></textarea>
<script>//<![CDATA[
    var addForm   = document.getElementById("addForm");
    var addClear  = document.getElementById("addClear");
    var addSubmit = document.getElementById("addSubmit");
    var addReason = document.getElementById("addReason");
    var addAmount = document.getElementById("addAmount");
    var addTags   = document.getElementById("addTags");
    addClear.addEventListener("click", function(event) {
        addReason.value   = "";
        addAmount.value = "";
        addTags.value   = "";
        event.preventDefault();
    });
    addForm.addEventListener("submit", function(event) {
        var base = window.location.href;
        var xhr = new XMLHttpRequest();
        xhr.addEventListener('load', function() {
            response.value = this.responseText;
        })
        xhr.open("POST", base + (base.endsWith('/') ?
                                 "" : "/") + "add");
        xhr.setRequestHeader('content-type', 'application/json');
        xhr.send(JSON.stringify({
            reason: addReason.value,
            amount: parseFloat(addAmount.value.replace("$", "") || 0.0),
            tags: addTags.value.split(/\s/).filter(function(w) {
                return w.trim().length > 0; })}));
        response.value = "Waiting for response...";
        event.preventDefault();
    })
//]]></script>"#))
}

#[post("/add", format="json", data="<expense>")]
async fn expense_add(mut db: Connection<ServerDB>,
                     expense: Json<Expense>) ->
    Option<String>
{    
    match sqlx::query(
        "INSERT INTO expenses (reason, amount) VALUES ($1, $2);")
        .bind(&expense.reason)
        .bind(expense.amount).execute(&mut *db).await {
            Ok(_) => Some("Success".to_string()),
            Err(err) => Some(err.to_string())
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
        let path = path.as_ref();
        FileExtServer {
            root: path.into(),
            rank: Self::DEFAULT_RANK }
    }

    pub fn rank(mut self, rank: isize) -> Self {
        self.rank = rank;
        self
    }
}

impl From<FileExtServer> for Vec<Route> {
    fn from(server: FileExtServer) -> Self {
        let mut route = Route::ranked(
            server.rank, Method::Get, "/<path..>", server);
        route.name = Some(format!("FileExtServer").into());
        vec![route]
    }
}

#[rocket::async_trait]
impl Handler for FileExtServer {
    async fn handle<'r>(&self, req: &'r Request<'_>,
                        data: Data<'r>) -> Outcome<'r> {
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
                    Outcome::from_or_forward(
                        req, data, Redirect::permanent(
                            req.uri().map_path(|p| format!("{}/", p))
                                .expect("adding a trailing slash")
                                .into_owned()))
                } else {
                    Outcome::from_or_forward(req, data, NamedFile::open(
                        p.join("index.html")).await.ok())
                }
            },
            Some(p) if !p.exists() && p.extension().is_none() => {
                let mut p = p;
                p.set_extension("html");
                if p.exists() {
                    Outcome::from_or_forward(
                        req, data, NamedFile::open(p).await.ok())
                } else { Outcome::forward(data) }
            },
            Some(p) => Outcome::from_or_forward(
                req, data, NamedFile::open(p).await.ok()),
            None => Outcome::forward(data),
        }
    }
}

fn create_server() -> Rocket<Build> {
    rocket::custom(rocket::Config::figment()
                   .merge(("address", "0.0.0.0"))
                   .merge(("port", 7878))
                   .merge(("databases.serverdb.url",
                           "./server.db")))
        .attach(ServerDB::init())
        .mount("/index.html", FileExtServer::new(
            relative!("index.html")).rank(1))
        .mount("/favicon.ico", FileExtServer::new(
            relative!("resources/images/ripple.png")).rank(1))
        .mount("/apps", FileExtServer::new(relative!("apps")))
        .mount("/slides", FileExtServer::new(relative!("slides")))
        .mount("/expense", routes![expense_index, expense_add])
}

#[rocket::main]
async fn main() -> Result<(), rocket::Error>
{ let _rocket = create_server().launch().await?; Ok(()) }
