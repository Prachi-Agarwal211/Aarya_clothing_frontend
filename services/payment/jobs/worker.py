"""
RQ Worker Entry Point
======================
Starts the Redis Queue worker that processes background jobs AND runs
periodic payment recovery every 5 minutes.

The worker monitors the 'payment-jobs' queue for external job requests
(admin-enqueued recovery tasks, etc.) while independently running
the orphan payment recovery cycle in a background thread.

This guarantees that any completed payment without an order is caught
within 5 minutes, even if the frontend redirect failed or the user
never reached the confirmation page.

For local debugging:
    python -m jobs.worker

Or with rq CLI:
    rq worker --url redis://aarya_redis:6379/2 payment-jobs
"""
import os
import sys
import time
import logging
import threading
from rq import Worker, Queue, Connection
import redis

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s'
)
logger = logging.getLogger(__name__)

# Add parent directory to path so we can import payment service modules
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/2")
QUEUE_NAME = "payment-jobs"
WORKER_NAME = os.getenv("WORKER_NAME", f"rq:worker:payment-{os.getpid()}")

# ── Recovery cycle config ──
RECOVERY_INTERVAL_SECONDS = int(os.getenv("RECOVERY_INTERVAL_SECONDS", "300"))  # 5 min
from jobs.recover_orders import run_recovery_cycle


def _get_redis_connection():
    """Create a resilient Redis connection with aggressive retry settings.

    This worker runs as a long-lived daemon — transient Redis blips should
    never crash it. Uses exponential backoff and extended timeouts.
    """
    return redis.from_url(
        REDIS_URL,
        retry_on_timeout=True,
        socket_connect_timeout=30,
        socket_timeout=120,
        health_check_interval=15,
        socket_keepalive=True,
        retry=redis.retry.Retry(
            redis.backoff.ExponentialBackoff(base=1, cap=60),
            5  # 5 retries: 1s, 2s, 4s, 8s, 16s
        ),
    )


def recovery_loop():
    """Run the order recovery cycle every N seconds in a background thread.

    The recovery thread is a daemon — it shuts down automatically when the
    main process exits. This avoids any race with process termination.
    """
    logger.info(
        f"Recovery thread started: checking every {RECOVERY_INTERVAL_SECONDS}s "
        f"for orphan payments"
    )

    # Wait briefly on startup so dependent services (commerce) are ready
    logger.info("Waiting 30s before first recovery cycle (allowing services to start)...")
    time.sleep(30)

    # Run immediately after initial wait, then every N seconds
    while True:
        try:
            run_recovery_cycle()
        except Exception as e:
            logger.error(f"Recovery cycle error: {e}", exc_info=True)

        time.sleep(RECOVERY_INTERVAL_SECONDS)


def start_worker():
    """Start the RQ worker + recovery thread with auto-reconnect.

    Starts the recovery thread first, then enters the RQ worker loop.
    If the worker crashes (e.g. long Redis outage), sleeps briefly so Docker
    doesn't restart-loop, then lets the caller re-invoke.
    """
    logger.info(f"Starting worker '{WORKER_NAME}' on queue '{QUEUE_NAME}' at {REDIS_URL}")

    # ── Start background recovery thread ──
    recovery_thread = threading.Thread(target=recovery_loop, daemon=True)
    recovery_thread.start()
    logger.info("✓ Recovery thread started (daemon)")

    redis_conn = _get_redis_connection()

    # Verify Redis connectivity before starting
    try:
        redis_conn.ping()
        logger.info("✓ Redis connection verified")
    except Exception as e:
        logger.error(f"✗ Redis ping failed on startup: {e}")
        logger.info("Retrying in 5 seconds...")
        time.sleep(5)
        # Let Docker restart policy handle retry
        raise

    with Connection(redis_conn):
        worker = Worker(
            [Queue(QUEUE_NAME)],
            name=WORKER_NAME,
            connection=redis_conn,
        )
        # Never quit on idle — this is a daemon.
        # max_jobs: force periodic worker restarts to prevent connection leaks
        # and stale Redis state. After 500 jobs the worker exits cleanly and
        # the outer loop restarts it (connection pool is refreshed).
        # Socket timeout is set to 120s on the Redis connection above to
        # prevent "Redis connection timeout, quitting" during BGSAVE.
        worker.work(
            logging_level="INFO",
            max_jobs=500,
        )


if __name__ == "__main__":
    # Keep trying forever — never let a transient Redis timeout kill the worker
    MAX_RETRIES = 0  # infinite
    retry_delay = 10
    attempt = 0

    while True:
        attempt += 1
        try:
            start_worker()
            break  # worker exited cleanly (shouldn't happen)
        except (redis.exceptions.TimeoutError,
                redis.exceptions.ConnectionError,
                redis.exceptions.BusyLoadingError,
                OSError) as exc:
            logger.error(
                f"Worker crashed on attempt {attempt}: {exc}. "
                f"Restarting in {retry_delay}s..."
            )
            time.sleep(retry_delay)
            retry_delay = min(retry_delay * 1.5, 60)  # cap at 60s
        except Exception as exc:
            logger.error(
                f"Worker crashed with unexpected error on attempt {attempt}: {exc}",
                exc_info=True,
            )
            time.sleep(retry_delay)
            retry_delay = min(retry_delay * 1.5, 60)
