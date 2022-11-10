#[macro_use] extern crate rocket;
use std::path::{Path, PathBuf};
use rocket::{Rocket, Build, Request, Data};
use rocket::fs::{relative, NamedFile};
use rocket::serde::{Deserialize, json::Json};
use rocket::route::{Route, Handler, Outcome};
use rocket::http::Method;
use rocket::http::uri::Segments;
use rocket::http::ext::IntoOwned;
use rocket::response::Redirect;

// #[derive(Deserialize)]
// #[serde(crate = "rocket::serde")]
// struct Expense<'r> {
//     name: &'r str,
//     amount: f32,
//     tags: Vec<&'r str>
// }

#[derive(Deserialize)]
#[serde(crate = "rocket::serde")]
struct Task<'r> {
    description: &'r str,
    complete: bool
}

#[post("/", data = "<task>")]
fn todo(task: Json<Task<'_>>) -> String {
    format!("Task (complete = {}): {}", task.complete, task.description)
}

#[get("/<name>/<age>")]
fn greeting(name: String, age: u8) -> String {
    format!("Hello, {} year old named {}!", age, name)
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
                   .merge(("port", 7878)))
        .mount("/index.html", FileExtServer::new(
            relative!("index.html")).rank(1))
        .mount("/favicon.ico", FileExtServer::new(
            relative!("resources/images/ripple.png")).rank(1))
        .mount("/apps", FileExtServer::new(relative!("apps")))
        .mount("/slides", FileExtServer::new(relative!("slides")))
        .mount("/greeting", routes![greeting])
        .mount("/todo", routes![todo])
}

#[rocket::main]
async fn main() -> Result<(), rocket::Error>
{ let _rocket = create_server().launch().await?; Ok(()) }
