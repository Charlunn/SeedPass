use passworder_core::{derive_password, DerivePasswordOptions};

fn main() {
    let result = derive_password(
        &DerivePasswordOptions::new("correct horse battery staple", "Example.com")
            .account("Alice")
            .iterations(10_000),
    )
    .expect("password derivation should succeed");

    println!("{}", result.password);
}
