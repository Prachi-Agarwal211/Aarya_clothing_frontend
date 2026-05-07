"""
RQ Worker Entry Point
======================
Starts the Redis Queue worker that processes background jobs.

The worker monitors the 'payment-jobs' queue. If no jobs are enqueued,
it simply waits. Currently no code enqueues jobs to this queue as the
recovery system was deprecated.

For local debugging:
    python -m jobs.worker

Or with rq CLI:
    rq worker --url redis://aarya_redis:6379/2 payment-jobs
"""
import os
import sys
import time
import logging
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


def _get_redis_connection():
    """Create a resilient Redis connection with aggressive retry settings.

    This worker runs as a long-lived daemon — transient Redis blips should
    never crash it. Uses exponential backoff and extended timeouts.
    """
    return redis.from_url(
        REDIS_URL,
        retry_on_timeout=True,
        socket_connect_timeout=30,
        socket_timeout=60,
        health_check_interval=15,
        socket_keepalive=True,
        retry=redis.retry.Retry(
            redis.backoff.ExponentialBackoff(base=1, cap=60),
            5  # 5 retries: 1s, 2s, 4s, 8s, 16s
        ),
    )


def start_worker():
    """Start the RQ worker to process payment jobs with auto-reconnect.

    If the worker crashes (e.g. long Redis outage), sleeps briefly so Docker
    doesn't restart-loop, then lets the caller re-invoke.
    """
    logger.info(f"Starting worker '{WORKER_NAME}' on queue '{QUEUE_NAME}' at {REDIS_URL}")

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
        # Never quit on idle — this is a daemon
        worker.work(
            logging_level="INFO",
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
