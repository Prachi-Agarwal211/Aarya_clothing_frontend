FROM edoburu/pgbouncer:latest
# edoburu image supports SCRAM-SHA-256 since v1.18+
#
# Generate userlist from POSTGRES_PASSWORD at runtime (avoids a host file that
# often goes missing and breaks Docker Desktop bind mounts on Windows).
# Copy then strip CRLF (Windows checkouts) so paths and `exec` are not broken.
COPY docker/pgbouncer/entrypoint.sh /entrypoint.in.sh
RUN tr -d '\r' < /entrypoint.in.sh > /tmp/entrypoint.sh
ENTRYPOINT ["/bin/sh", "/tmp/entrypoint.sh"]
