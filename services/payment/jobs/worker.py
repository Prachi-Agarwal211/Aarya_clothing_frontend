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

REDIS_URL = os.getenv("REDIS_URL", "redis://aarya_redis:6002")
QUEUE_NAME = "payment-jobs"


def start_worker():
    """Start the RQ worker to process payment jobs."""
    logger.info(f"Starting RQ worker on queue '{QUEUE_NAME}' at {REDIS_URL}")

    redis_conn = redis.from_url(REDIS_URL)

    with Connection(redis_conn):
        worker = Worker([Queue(QUEUE_NAME)])
        worker.work()


def enqueue_job(func, *args, job_id=None, **kwargs):
    """Enqueue a job to the payment-jobs queue."""
    redis_conn = redis.from_url(REDIS_URL)
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
