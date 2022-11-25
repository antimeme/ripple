use std::path::{Path, PathBuf};
use rocket::route;
use rocket::http::uri::Segments;
use rocket::http::ext::IntoOwned;
use rocket::response::Redirect;
use figment::Figment;
use figment::value::Value;

/**
 * ASN.1 Object Implementation
 * Because mutability is so strict in Rust, this implementation
 * is eager about encoding.  Each time an object is added to another
 * the complete encoding is calculated. */
#[derive (Clone)]
pub struct ASN1Object {
    tag: u32,
    contents: Vec<u8>,
    bytes: Vec<u8>
}

impl ASN1Object {
    /**
     * Create a new ASN.1 object.  This is used to start an object
     * which will have one or more other objects added to it later */
    pub fn new(tag: u32) -> Self {
        let contents = Vec::new();
        let bytes = Self::make_bytes(tag, &contents);
        Self { tag, contents, bytes  }
    }

    /**
     * Create an ASN.1 object from a byte array */
    pub fn from_bytes(tag: u32, contents: &[u8]) -> Self {
        let bytes = Self::make_bytes(tag, &contents);
        Self { tag, contents: contents.to_vec(), bytes }        
    }

    pub fn add_object(mut self, child: &ASN1Object) -> Self {
        self.contents.append(&mut Vec::from(child.bytes.as_slice()));
        self.bytes = Self::make_bytes(self.tag, &self.contents);
        self
    }

    pub fn add_bytes(mut self, tag: u32, contents: &[u8]) -> Self {
        self.contents.append(
            &mut ASN1Object::from_bytes(tag, contents).bytes);
        self.bytes = Self::make_bytes(self.tag, &self.contents);
        self
    }

    pub fn as_bytes(&self) -> &[u8] { &self.bytes }

    fn make_bytes(tag: u32, contents: &[u8]) -> Vec<u8> {
        let mut result = Vec::new();
        result.append(&mut Vec::from(tag.to_be_bytes()));
        result.append(&mut Vec::from(contents.len().to_be_bytes()));
        result.append(&mut Vec::from(contents));
        result
    }
}

/**
 * Create a server key with a self-signed certificate */
fn create_key(key_file: &str, certs_file: &str) -> Result<(), String> {
    use rsa::RsaPrivateKey;
    use rsa::pkcs8::{EncodePrivateKey, LineEnding};
    use rsa::pss::BlindedSigningKey;
    use rsa::signature::{RandomizedSigner, Signature};
    use sha2::Sha256;

    let kprv = RsaPrivateKey::new(
        &mut rand::thread_rng(), 2048)
        .map_err(|err| err.to_string())?;
    let zstr = kprv.to_pkcs8_pem(LineEnding::CRLF)
        .map_err(|err| err.to_string())?;

    let tbs = ASN1Object::new(0x30)
        .add_bytes(0xa0, &[0x02, 0x01, 0x02]) // version
        .add_bytes(0x02, &[0x01, 0x01, 0x01, 0x01]) // serial ???
        .add_bytes(0x30, &[0x01, 0x01, 0x01, 0x01]) // sigalg ???
        .add_bytes(0x30, &[0x01, 0x01, 0x01, 0x01]) // issuer ???
        .add_bytes(0x30, &[0x01, 0x01, 0x01, 0x01]) // validity ???
        .add_bytes(0x30, &[0x01, 0x01, 0x01, 0x01]) // subject ???
        .add_bytes(0x30, &[0x01, 0x01, 0x01, 0x01]) // pubkey ???
        .add_bytes(0xa3, &[0x30, 0x00]) // extensions
        ;
    let signing_key = BlindedSigningKey::<Sha256>::new(kprv);
    let signature = signing_key.sign_with_rng(
        &mut rand::thread_rng(), tbs.as_bytes());
    assert_ne!(signature.as_bytes(), tbs.as_bytes());
    // :TODO: pack up X.509 DER
    // :TODO: convert to Base64
    // :TODO: add certificate header and footer
    // :TODO: write certificate to file    

    use std::fs;
    fs::write(key_file, &zstr).map_err(|err| err.to_string())?;
    fs::write(certs_file, &zstr).map_err(|err| err.to_string())?;
    Ok(())
}

pub fn bootstrap_tls(fig: &Figment) {
    if let Ok(key) = fig.find_value("tls.key") {
        if let Value::String(_, key_file) = key {
            if !Path::new(&key_file).exists() {
                let certs_file = "server-certs.pem";
                match create_key(&key_file, &certs_file) {
                    Ok(_) => panic!("Critical success!"),
                    Err(_) => panic!("Critical failure!")
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use figment::Figment;

    #[test]
    fn bootstrap() {
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
