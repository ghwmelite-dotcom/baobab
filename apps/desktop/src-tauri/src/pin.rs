use base64::{engine::general_purpose::STANDARD_NO_PAD as B64, Engine as _};
use pbkdf2::pbkdf2_hmac;
use rand::RngCore;
use sha2::Sha256;
use subtle::ConstantTimeEq;

pub const HASH_ALGO: &str = "pbkdf2-sha256";
pub const ITERATIONS: u32 = 100_000;
pub const SALT_BYTES: usize = 16;
pub const HASH_BYTES: usize = 32;

/// Validates that `pin` is exactly 4 ASCII digits.
pub fn validate_pin_format(pin: &str) -> Result<(), String> {
    if pin.len() != 4 {
        return Err("pin must be exactly 4 digits".into());
    }
    if !pin.chars().all(|c| c.is_ascii_digit()) {
        return Err("pin must contain only digits".into());
    }
    Ok(())
}

/// Hash a PIN with a fresh random salt. Returns the encoded "algo$iter$salt$hash" string.
pub fn hash_pin(pin: &str) -> Result<String, String> {
    validate_pin_format(pin)?;
    let mut salt = [0u8; SALT_BYTES];
    rand::thread_rng().fill_bytes(&mut salt);
    let mut hash = [0u8; HASH_BYTES];
    pbkdf2_hmac::<Sha256>(pin.as_bytes(), &salt, ITERATIONS, &mut hash);
    Ok(format!(
        "{}${}${}${}",
        HASH_ALGO,
        ITERATIONS,
        B64.encode(salt),
        B64.encode(hash),
    ))
}

/// Verify a PIN against the encoded stored string. Constant-time on the hash compare.
pub fn verify_pin(stored: &str, pin: &str) -> Result<bool, String> {
    validate_pin_format(pin)?;
    let parts: Vec<&str> = stored.split('$').collect();
    if parts.len() != 4 || parts[0] != HASH_ALGO {
        return Err("malformed_hash".into());
    }
    let iter: u32 = parts[1].parse().map_err(|_| "malformed_hash".to_string())?;
    let salt = B64.decode(parts[2]).map_err(|_| "malformed_hash".to_string())?;
    let expected = B64.decode(parts[3]).map_err(|_| "malformed_hash".to_string())?;
    if expected.len() != HASH_BYTES {
        return Err("malformed_hash".into());
    }
    let mut got = [0u8; HASH_BYTES];
    pbkdf2_hmac::<Sha256>(pin.as_bytes(), &salt, iter, &mut got);
    Ok(got.ct_eq(&expected).into())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validate_pin_format_accepts_four_digits() {
        assert!(validate_pin_format("1234").is_ok());
        assert!(validate_pin_format("0000").is_ok());
    }

    #[test]
    fn validate_pin_format_rejects_wrong_length() {
        assert!(validate_pin_format("").is_err());
        assert!(validate_pin_format("123").is_err());
        assert!(validate_pin_format("12345").is_err());
    }

    #[test]
    fn validate_pin_format_rejects_non_digits() {
        assert!(validate_pin_format("12a4").is_err());
        assert!(validate_pin_format("12 4").is_err());
        assert!(validate_pin_format("1234\n").is_err());
    }

    #[test]
    fn hash_pin_produces_different_strings_for_same_pin() {
        let a = hash_pin("1234").unwrap();
        let b = hash_pin("1234").unwrap();
        assert_ne!(a, b, "two hashes of the same PIN must differ (random salt)");
    }

    #[test]
    fn hash_pin_format_matches_spec() {
        let s = hash_pin("1234").unwrap();
        let parts: Vec<&str> = s.split('$').collect();
        assert_eq!(parts.len(), 4);
        assert_eq!(parts[0], "pbkdf2-sha256");
        assert_eq!(parts[1], "100000");
    }

    #[test]
    fn verify_pin_accepts_original() {
        let s = hash_pin("1234").unwrap();
        assert_eq!(verify_pin(&s, "1234").unwrap(), true);
    }

    #[test]
    fn verify_pin_rejects_wrong() {
        let s = hash_pin("1234").unwrap();
        assert_eq!(verify_pin(&s, "0000").unwrap(), false);
        assert_eq!(verify_pin(&s, "1235").unwrap(), false);
    }

    #[test]
    fn verify_pin_rejects_malformed_stored() {
        assert!(verify_pin("garbage", "1234").is_err());
        assert!(verify_pin("a$b$c", "1234").is_err());
    }
}
