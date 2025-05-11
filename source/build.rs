fn main() {
    println!("cargo:rustc-env=ASSET_PATH=../apps");
    println!("cargo:rerun-if-changed=../apps/fonts/brass-mono.ttf");
}
