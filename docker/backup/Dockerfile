# syntax=docker/dockerfile:1
# La misma versión de PostgreSQL que la base: pg_dump tiene que coincidir con el servidor.
FROM postgres:18-alpine

RUN apk add --no-cache age rclone

COPY docker/backup/backup.sh /usr/local/bin/backup
COPY docker/backup/restore.sh /usr/local/bin/restore
COPY docker/backup/healthcheck.sh /usr/local/bin/backup-healthcheck
COPY docker/backup/entrypoint.sh /usr/local/bin/backup-entrypoint
RUN chmod +x /usr/local/bin/backup /usr/local/bin/restore \
  /usr/local/bin/backup-healthcheck /usr/local/bin/backup-entrypoint

ENTRYPOINT ["backup-entrypoint"]
