use std::future::Future;
use std::time::Duration;

pub async fn wait_for_startup(startup: impl Future<Output = bool>, timeout: Duration) -> bool {
    tokio::time::timeout(timeout, startup).await.unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn runtime() -> tokio::runtime::Runtime {
        tokio::runtime::Builder::new_current_thread()
            .enable_time()
            .build()
            .unwrap()
    }

    #[test]
    fn accepts_ready_backend() {
        assert!(runtime().block_on(wait_for_startup(
            std::future::ready(true),
            Duration::from_secs(1),
        )));
    }

    #[test]
    fn rejects_backend_that_exits_before_ready() {
        assert!(!runtime().block_on(wait_for_startup(
            std::future::ready(false),
            Duration::from_secs(1),
        )));
    }

    #[test]
    fn times_out_even_when_backend_never_emits_an_event() {
        assert!(!runtime().block_on(wait_for_startup(
            std::future::pending(),
            Duration::from_millis(10),
        )));
    }
}
