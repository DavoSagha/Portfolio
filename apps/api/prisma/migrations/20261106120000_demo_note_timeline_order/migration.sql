-- AlterTable
ALTER TABLE "ProjectTranslation" ADD COLUMN     "demoNote" TEXT;

-- La trayectoria pasa a ordenarse por `order`: se conserva el orden visible hasta ahora.
UPDATE "TimelineEntry" AS t
SET "order" = s.position
FROM (
  SELECT "id", row_number() OVER (ORDER BY "startDate" DESC, "order" ASC) - 1 AS position
  FROM "TimelineEntry"
) AS s
WHERE t."id" = s."id";
