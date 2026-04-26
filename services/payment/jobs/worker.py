"""
RQ Worker Entry Point
=====================
Starts the Redis Queue worker that processes background jobs.

Usage:
    python -m jobs.worker

Or with rq CLI:
    rq worker --url redis://aarya_redis:6002 payment-jobs
"""
import os
import sys
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


def _get_redis_connection():
    """Create a resilient Redis connection with retry settings."""
    return redis.from_url(
        REDIS_URL,
        retry_on_timeout=True,
        socket_connect_timeout=10,
        socket_timeout=30,
        health_check_interval=30,
        retry=redis.retry.Retry(
            redis.backoff.ExponentialBackoff(base=1, cap=30),
            3  # 3 retries: 1s, 2s, 4s
        ),
    )


def start_worker():
    """Start the RQ worker to process payment jobs."""
    logger.info(f"Starting RQ worker on queue '{QUEUE_NAME}' at {REDIS_URL}")

    redis_conn = _get_redis_connection()

    with Connection(redis_conn):
        worker = Worker([Queue(QUEUE_NAME)])
        worker.work()


def enqueue_job(func, *args, job_id=None, **kwargs):
    """Enqueue a job to the payment-jobs queue."""
    redis_conn = _get_redis_connection()
    queue = Queue(QUEUE_NAME, connection=redis_conn)

    job = queue.enqueue(
        func,
        *args,
        job_id=job_id,
        job_timeout=300,  # 5 minute timeout
        result_ttl=3600,  # Keep result for 1 hour
        failure_ttl=86400,  # Keep failure info for 24 hours
        **kwargs
    )

    logger.info(f"Enqueued job {job.id} — {func.__name__}")
    return job


if __name__ == "__main__":
    start_worker()
