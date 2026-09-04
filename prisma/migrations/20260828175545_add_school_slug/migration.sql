-- AlterTable
ALTER TABLE "School" ADD COLUMN "slug" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "School_slug_key" ON "School"("slug");
