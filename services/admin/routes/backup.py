"""Super-admin database backup endpoints (manual create, list, delete)."""
import glob
import logging
import os
import subprocess
from datetime import datetime
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException

from shared.auth_middleware import require_super_admin
from shared.time_utils import IST, now_ist

logger = logging.getLogger(__name__)
router = APIRouter()

BACKUP_DIR = os.environ.get("BACKUP_DIR", "/backups")


@router.post("/api/v1/admin/backup/create", tags=["Super Admin Backup"])
async def create_backup(user: dict = Depends(require_super_admin)):
    """Trigger a manual `pg_dump` of the primary database."""
    os.makedirs(BACKUP_DIR, exist_ok=True)
    timestamp = now_ist().strftime("%Y%m%d_%H%M%S")
    filename = f"aarya_backup_{timestamp}.sql"
    filepath = os.path.join(BACKUP_DIR, filename)

    db_url = os.environ.get("DATABASE_URL", "")
    try:
        parsed = urlparse(db_url)
        env = {**os.environ, "PGPASSWORD": parsed.password or ""}
        cmd = [
            "pg_dump",
            "-h", parsed.hostname or "postgres",
            "-p", str(parsed.port or 5432),
            "-U", parsed.username or "postgres",
            "-d", parsed.path.lstrip("/") or "aarya_clothing",
            "-f", filepath,
            "--no-owner",
            "--no-acl",
        ]
        result = subprocess.run(cmd, env=env, capture_output=True, text=True, timeout=120)
        if result.returncode != 0:
            raise RuntimeError(result.stderr)

        file_size = os.path.getsize(filepath)
        logger.info(
            "Backup created: %s (%d bytes) by user %s",
            filename, file_size, user.get("user_id"),
        )
        return {
            "success": True,
            "filename": filename,
            "size_bytes": file_size,
            "created_at": now_ist().isoformat(),
            "message": f"Backup created successfully: {filename}",
        }
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=504, detail="Backup timed out")
    except Exception as e:
        logger.error("Backup failed: %s", e)
        raise HTTPException(status_code=500, detail=f"Backup failed: {e}")


@router.get("/api/v1/admin/backup/list", tags=["Super Admin Backup"])
async def list_backups(user: dict = Depends(require_super_admin)):
    """List the 50 most recent backup files in `BACKUP_DIR`."""
    os.makedirs(BACKUP_DIR, exist_ok=True)
    files = sorted(glob.glob(os.path.join(BACKUP_DIR, "*.sql")), reverse=True)
    backups = []
    for f in files[:50]:
        stat = os.stat(f)
        backups.append({
            "filename": os.path.basename(f),
            "size_bytes": stat.st_size,
            "size_mb": round(stat.st_size / 1024 / 1024, 2),
            "created_at": datetime.fromtimestamp(stat.st_mtime, tz=IST).isoformat(),
        })
    return {"backups": backups, "total": len(backups), "backup_dir": BACKUP_DIR}


@router.delete("/api/v1/admin/backup/{filename}", tags=["Super Admin Backup"])
async def delete_backup(filename: str, user: dict = Depends(require_super_admin)):
    """Delete a single backup file. Filename is validated to prevent path traversal."""
    # Allow only .sql files, no path components, no parent traversal.
    if not filename.endswith(".sql") or "/" in filename or ".." in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")
    filepath = os.path.join(BACKUP_DIR, filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Backup not found")
    os.remove(filepath)
    logger.info("Backup deleted: %s by user %s", filename, user.get("user_id"))
    return {"success": True, "message": f"Backup {filename} deleted"}
