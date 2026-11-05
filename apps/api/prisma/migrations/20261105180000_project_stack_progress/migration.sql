-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "inProgress" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "stack" TEXT[] DEFAULT ARRAY[]::TEXT[];
