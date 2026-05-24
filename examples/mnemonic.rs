use passworder_core::generate_mnemonic;

fn main() {
    let phrase = generate_mnemonic(24).expect("secure random source should be available");
    println!("{phrase}");
}
