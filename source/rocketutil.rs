use std::path::{Path, PathBuf};

fn asn1_push_len(bytes: &mut Vec<u8>, len: usize) {
    let slice = len.to_be_bytes();
    if len < 0x1f {
        bytes.push(slice[slice.len() - 1]);
    } else if len < (1 << 8) {
        bytes.push(0x81);
        bytes.push(slice[slice.len() - 1]);
    } else if len < (1 << 16) {
        bytes.push(0x82);
        bytes.push(slice[slice.len() - 2]);
        bytes.push(slice[slice.len() - 1]);
    } else if len < (1 << 24) {
        bytes.push(0x83);
        bytes.push(slice[slice.len() - 3]);
        bytes.push(slice[slice.len() - 2]);
        bytes.push(slice[slice.len() - 1]);
    } else if len < (1 << 32) {
        bytes.push(0x84);
        bytes.push(slice[slice.len() - 4]);
        bytes.push(slice[slice.len() - 3]);
        bytes.push(slice[slice.len() - 2]);
        bytes.push(slice[slice.len() - 1]);
    } else { panic!("Too much stuff!"); }
}

trait ASN1Object {
    fn get_len(&self) -> usize;
    fn get_bytes(&self) -> Vec<u8>;
}

struct ASN1Primitive<'r> {
    tag: u8,
    contents: &'r [u8]
}

impl<'r> ASN1Primitive<'r> {
    fn new(tag: u8, contents: &'r [u8]) -> Self
    { Self { tag, contents } }
}

impl<'r> ASN1Object for ASN1Primitive<'r> {
    fn get_len(&self) -> usize {
        match self.tag {
            0x03 => {
                self.contents.len() + 1
            },
            _ => { self.contents.len() }
        }
    }
    fn get_bytes(&self) -> Vec<u8> {
        let mut result = Vec::new();
        result.push(self.tag);
        asn1_push_len(&mut result, self.get_len());
        if self.tag == 0x03 {
            result.push(0x00);
        }
        result.append(&mut self.contents.to_owned());
        result
    }
}

struct ASN1Constructed {
    tag: u8,
    children: Vec<Vec<u8>>
}

impl ASN1Object for ASN1Constructed {
    fn get_len(&self) -> usize
    { self.children.iter().map(|child| child.len()).sum() }

    fn get_bytes(&self) -> Vec<u8> {
        let mut result = Vec::new();
        result.push(self.tag);
        asn1_push_len(&mut result, self.get_len());
        for child in &self.children {
            result.append(&mut child.clone());
        }
        result
    }
}

impl ASN1Constructed {
    fn new(tag: u8) -> Self
    { Self { tag, children: Vec::new() } }

    fn new_validity(weeks: u32) -> Self {
        let start = chrono::Utc::now();
        let expire = start + chrono::Duration::weeks(weeks.into());
        Self::new(0x30)
            .add_bytes(0x17, start.format("%y%m%d%H%M%SZ")
                       .to_string().as_bytes())
            .add_bytes(0x17, expire.format("%y%m%d%H%M%SZ")
                       .to_string().as_bytes())
    }

    fn new_cn(name: &str) -> Self {
        let names = Self::new(0x30)
            .add_bytes(0x06, &[0x55, 0x04, 0x03])
            .add_bytes(0x0c, &name.as_bytes());
        let cn = Self::new(0x31).add_object(&names);
        Self::new(0x30).add_object(&cn)
    }

    fn new_subject_key_rsa(key: &rsa::RsaPublicKey) -> Self {
        use rsa::PublicKeyParts;
        let inner_key = Self::new(0x30)
            .add_bytes(0x02, &key.n().to_bytes_be())
            .add_bytes(0x02, &key.e().to_bytes_be());
        Self::new(0x30)
            .add_bytes(0x30, &[
                0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7,
                0x0d, 0x01, 0x01, 0x01, 0x05, 0x00])
            .add_bytes(0x03, &inner_key.get_bytes())
    }

    fn add_object<A: ASN1Object>(
        mut self, object: &A
    ) -> Self {
        self.children.push(object.get_bytes());
        self
    }

    fn add_bytes(mut self, tag: u8, contents: &[u8]) -> Self {
        self.children.push(
            ASN1Primitive::new(tag, contents).get_bytes());
        self
    }
}

fn create_x509_tbs(issuer: &str, subject: &str,
                   duration: u32, pubkey: &rsa::RsaPublicKey,
                   sigalg: &[u8]) -> ASN1Constructed {
    use rand::RngCore;

    let mut serial: [u8; 9] = [0; 9];
    rand::thread_rng().fill_bytes(&mut serial);
    if serial[0] == 0x00 {
        // Leading zeros are not allowed in ASN.1 integers
        serial[0] = 0x01;
    }

    ASN1Constructed::new(0x30)
        .add_bytes(0xa0, &[0x02, 0x01, 0x02]) // version
        .add_bytes(0x02, &serial)
        .add_bytes(0x30, &sigalg)
        .add_object(&ASN1Constructed::new_cn(issuer))
        .add_object(&ASN1Constructed::new_validity(duration))
        .add_object(&ASN1Constructed::new_cn(subject))
        .add_object(&ASN1Constructed::new_subject_key_rsa(&pubkey))
        .add_bytes(0xa3, &[0x30, 0x00]) // extensions
}

/**
 * Create a server key with a self-signed certificate */
fn create_key(key_file: &str, certs_file: &str) -> Result<(), String> {
    use rsa::pkcs8::{EncodePrivateKey, LineEnding};

    let kprv = rsa::RsaPrivateKey::new(
        &mut rand::thread_rng(), 2048)
        .map_err(|err| err.to_string())?;
    let zstr = kprv.to_pkcs8_pem(LineEnding::CRLF)
        .map_err(|err| err.to_string())?;

    let sigalg_rsapss = [0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7,
                         0x0d, 0x01, 0x01, 0x0b, 0x05, 0x00];
    let tbs = create_x509_tbs
        ("issuer", "subject", 10 * 52 /* weeks */,
         &kprv.to_public_key(), &sigalg_rsapss);

    // :TODO: support elliptic curve keys
    use rsa::pss::BlindedSigningKey;
    use rsa::signature::{RandomizedSigner};
    use sha2::Sha256;
    let signing_key = BlindedSigningKey::<Sha256>::new(kprv);
    let signature = signing_key.sign_with_rng(
        &mut rand::thread_rng(), &tbs.get_bytes());

    let certdata = ASN1Constructed::new(0x30)
        .add_object(&tbs)
        .add_bytes(0x30, &sigalg_rsapss)
        .add_bytes(0x03, &signature)
        .get_bytes();

    let mut certificate = String::new();
    certificate.push_str("-----BEGIN CERTIFICATE-----\n");
    for (ii, cc) in base64::encode(&certdata).chars().enumerate() {
        if (ii != 0) && ((ii % 64) == 0) {
            certificate.push_str("\n");
        }
        certificate.push(cc);
    }
    match certificate.chars().last() {
        Some(cc) if cc != '\n' => { certificate.push_str("\n") },
        _ => { }
    }
    certificate.push_str("-----END CERTIFICATE-----\n");

    use std::fs;
    fs::write(key_file, &zstr).map_err(|err| err.to_string())?;
    fs::write(certs_file, &certificate).map_err(|err| err.to_string())?;
    Ok(())
}

use figment::Figment;
use figment::value::Value;

pub fn bootstrap_tls(fig: &Figment) {
    if let (Ok(key), Ok(certs)) = (
        fig.find_value("tls.key"), fig.find_value("tls.certs")) {
        if let (Value::String(_, key_file),
                Value::String(_, certs_file)) = (key, certs) {
            if !Path::new(&key_file).exists() {
                match create_key(&key_file, &certs_file) {
                    Ok(_) => {},
                    Err(estr) =>
                        panic!("Failed to create certificate: {}", estr)
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bootstrap() {
    }
}

use rocket::route;
use rocket::http::uri::Segments;
use rocket::http::ext::IntoOwned;
use rocket::response::Redirect;

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
