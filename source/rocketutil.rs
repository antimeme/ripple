use std::path::{Path, PathBuf};
use figment::{value::{Map, Dict, Value}};
use figment::{Error, Profile, Provider, Metadata};
use rocket::route;
use rocket::http::uri::Segments;
use rocket::http::ext::IntoOwned;
use rocket::response::Redirect;

/**
 * BootstrapTLS is a configuration provider that automatically
 * generates a server key and certificate if one is not available.
 * This should make it reasonably certain that a server will
 * start even if it has never been configured. */
pub struct BootstrapTLS {
    key: String,
    certs: String,
    cacerts: Option<String>,
    mandatory: bool,
    secure: bool,
}

impl BootstrapTLS {
    pub fn new(secure: bool) -> Self {
        let key   = "server-key.pem".to_string();
        let certs = "server-chain.pem".to_string();

        // :TODO: find or generate RSA key pair
        // :TODO: find or generate X.509 certificate

        Self {
            key,
            certs,
            cacerts: None,
            mandatory: false,
            secure
        }
    }
}

impl Provider for BootstrapTLS {
    fn metadata(&self) -> Metadata { Metadata::named("BootstrapTLS") }

    fn data(&self) -> Result<Map<Profile, Dict>, Error> {
        let mut map: Map<Profile, Dict> = Map::new();
        let mut dict: Dict = Dict::from([
            ("key".to_string(), Value::from(self.key.to_string())),
            ("certs".to_string(), Value::from(self.certs.to_string()))
        ]);
        map.insert(Profile::new("default"), dict);
        Ok(map)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use figment::Figment;

    #[test]
    fn bootstrap() {
        let figment = Figment::new()
            .merge(BootstrapTLS::new(true));

        let key: String = figment.extract_inner("key").unwrap();
        assert_eq!(key, "server-key.pem");
        let certs: String = figment.extract_inner("certs").unwrap();
        assert_eq!(certs, "server-chain.pem");
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
    async fn handle<'r>(
        &self, req: &'r rocket::Request<'_>,
        data: rocket::Data<'r>
    ) -> route::Outcome<'r> {
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
