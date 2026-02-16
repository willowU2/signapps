/// Generate an Argon2 hash for a password
use argon2::{Argon2, PasswordHasher};
use argon2::password_hash::SaltString;
use rand::rngs::OsRng;

fn main() {
    let password = "admin123";

    // Generate a random salt
    let salt = SaltString::generate(&mut OsRng);

    // Create Argon2 hasher
    let argon2 = Argon2::default();

    // Hash the password
    let hashed = match argon2.hash_password(password.as_bytes(), &salt) {
        Ok(h) => h.to_string(),
        Err(e) => {
            eprintln!("Error generating hash: {}", e);
            return;
        }
    };

    println!("Password: {}", password);
    println!("Hash: {}", hashed);
    println!("");
    println!("Use this hash in the database:");
    println!("UPDATE identity.users SET password_hash = '{}' WHERE username = 'admin';", hashed);
}
