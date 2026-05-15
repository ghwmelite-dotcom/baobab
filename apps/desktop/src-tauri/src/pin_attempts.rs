use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{Duration, Instant};

/// Cumulative wrong-count milestones and the lockout duration each triggers.
/// Reading: `(count, seconds)` — when wrong_count reaches `count`, lock for `seconds`.
const LOCKOUT_LADDER: &[(u32, u64)] = &[
    (3, 30),
    (6, 5 * 60),
    (9, 30 * 60),
];

#[derive(Debug, Clone, Copy)]
struct AttemptState {
    wrong_count: u32,
    locked_until: Option<Instant>,
}

#[derive(Default)]
pub struct PinAttempts {
    inner: Mutex<HashMap<String, AttemptState>>,
}

#[derive(Debug, PartialEq, Eq)]
pub enum AttemptResult {
    Allowed,
    Locked { remaining_seconds: u64 },
}

impl PinAttempts {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn check(&self, profile_id: &str) -> AttemptResult {
        self.check_at(profile_id, Instant::now())
    }

    fn check_at(&self, profile_id: &str, now: Instant) -> AttemptResult {
        let guard = self.inner.lock().expect("PinAttempts mutex poisoned");
        match guard.get(profile_id) {
            None => AttemptResult::Allowed,
            Some(state) => match state.locked_until {
                Some(until) if until > now => AttemptResult::Locked {
                    remaining_seconds: (until - now).as_secs().max(1),
                },
                _ => AttemptResult::Allowed,
            },
        }
    }

    /// Returns Some(seconds) if this attempt triggered a new lockout, else None.
    pub fn record_wrong(&self, profile_id: &str) -> Option<u64> {
        self.record_wrong_at(profile_id, Instant::now())
    }

    fn record_wrong_at(&self, profile_id: &str, now: Instant) -> Option<u64> {
        let mut guard = self.inner.lock().expect("PinAttempts mutex poisoned");
        let state = guard.entry(profile_id.to_string()).or_insert(AttemptState {
            wrong_count: 0,
            locked_until: None,
        });
        // While locked, ignore further attempts (defence-in-depth — the UI shouldn't be calling).
        if let Some(until) = state.locked_until {
            if until > now {
                return None;
            }
        }
        state.wrong_count += 1;
        for (threshold, secs) in LOCKOUT_LADDER {
            if state.wrong_count == *threshold {
                state.locked_until = Some(now + Duration::from_secs(*secs));
                return Some(*secs);
            }
        }
        None
    }

    pub fn record_correct(&self, profile_id: &str) {
        let mut guard = self.inner.lock().expect("PinAttempts mutex poisoned");
        guard.remove(profile_id);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fresh_id_is_allowed() {
        let pa = PinAttempts::new();
        assert_eq!(pa.check("p1"), AttemptResult::Allowed);
    }

    #[test]
    fn three_wrong_locks_for_30s() {
        let pa = PinAttempts::new();
        let now = Instant::now();
        assert_eq!(pa.record_wrong_at("p1", now), None);
        assert_eq!(pa.record_wrong_at("p1", now), None);
        assert_eq!(pa.record_wrong_at("p1", now), Some(30));
        let r = pa.check_at("p1", now + Duration::from_secs(1));
        match r {
            AttemptResult::Locked { remaining_seconds } => {
                assert!(remaining_seconds <= 30 && remaining_seconds >= 28);
            }
            _ => panic!("expected Locked, got {:?}", r),
        }
    }

    #[test]
    fn lockout_expires() {
        let pa = PinAttempts::new();
        let now = Instant::now();
        pa.record_wrong_at("p1", now);
        pa.record_wrong_at("p1", now);
        pa.record_wrong_at("p1", now);
        let later = now + Duration::from_secs(31);
        assert_eq!(pa.check_at("p1", later), AttemptResult::Allowed);
    }

    #[test]
    fn correct_resets_count() {
        let pa = PinAttempts::new();
        let now = Instant::now();
        pa.record_wrong_at("p1", now);
        pa.record_wrong_at("p1", now);
        pa.record_correct("p1");
        // Two more wrongs should NOT trigger lockout — count was reset.
        assert_eq!(pa.record_wrong_at("p1", now), None);
        assert_eq!(pa.record_wrong_at("p1", now), None);
        assert_eq!(pa.check_at("p1", now), AttemptResult::Allowed);
    }

    #[test]
    fn second_threshold_triggers_5min() {
        let pa = PinAttempts::new();
        let now = Instant::now();
        // First three wrongs → 30s lockout.
        pa.record_wrong_at("p1", now);
        pa.record_wrong_at("p1", now);
        pa.record_wrong_at("p1", now);
        // After lockout expires, three more wrongs → 5 minute lockout.
        let after = now + Duration::from_secs(31);
        assert_eq!(pa.record_wrong_at("p1", after), None);
        assert_eq!(pa.record_wrong_at("p1", after), None);
        assert_eq!(pa.record_wrong_at("p1", after), Some(300));
    }

    #[test]
    fn record_wrong_during_lockout_is_noop() {
        let pa = PinAttempts::new();
        let now = Instant::now();
        pa.record_wrong_at("p1", now);
        pa.record_wrong_at("p1", now);
        pa.record_wrong_at("p1", now); // triggers 30s lock
        // During lockout, further wrongs do nothing — count stays at 3.
        assert_eq!(pa.record_wrong_at("p1", now + Duration::from_secs(5)), None);
        // After lockout expires, the NEXT wrong is the 4th overall, then 5th, then 6th = 5min.
        let after = now + Duration::from_secs(31);
        assert_eq!(pa.record_wrong_at("p1", after), None);
        assert_eq!(pa.record_wrong_at("p1", after), None);
        assert_eq!(pa.record_wrong_at("p1", after), Some(300));
    }

    #[test]
    fn ids_are_independent() {
        let pa = PinAttempts::new();
        let now = Instant::now();
        pa.record_wrong_at("p1", now);
        pa.record_wrong_at("p1", now);
        pa.record_wrong_at("p1", now);
        // p2 is untouched.
        assert_eq!(pa.check_at("p2", now), AttemptResult::Allowed);
    }
}
