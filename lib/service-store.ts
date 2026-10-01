import { randomUUID } from "node:crypto";
import type { PoolConnection } from "mysql2/promise";
import { getPool, query, queryOne, type RowDataPacket } from "@/lib/db";
import { removeFiles, saveImage, UploadError } from "@/lib/uploads";
import { CURRENCY, MAX_IMAGES, type ServiceInput } from "@/lib/services";

/** Saves uploaded images; if one of them is rejected, the ones already saved are removed again. */
async function saveAll(files: File[], ownerId: string): Promise<{ id: string; fileId: string }[]> {
  const saved: { id: string; fileId: string }[] = [];
  try {
    for (const file of files) {
      const { id } = await saveImage(file, ownerId, "work_media");
      saved.push({ id: randomUUID(), fileId: id });
    }
    return saved;
  } catch (err) {
    await removeFiles(saved.map((s) => s.fileId)).catch(() => {});
    throw err;
  }
}

async function writeLinks(conn: PoolConnection, serviceId: string, links: ServiceInput["links"]) {
  await conn.query("DELETE FROM service_links WHERE service_id = ?", [serviceId]);
  for (let i = 0; i < links.length; i++) {
    const l = links[i];
    await conn.query(
      "INSERT INTO service_links (id, service_id, kind, label, url, sort_order) VALUES (UUID(), ?, ?, ?, ?, ?)",
      [serviceId, l.kind, l.label, l.url, i]
    );
  }
}

const json = (list: string[]) => (list.length ? JSON.stringify(list) : null);

/** Creates a service with its images and links in one transaction. Returns the new id. */
export async function createService(ownerId: string, input: ServiceInput, files: File[]): Promise<string> {
  if (files.length > MAX_IMAGES) throw new UploadError(`You can upload up to ${MAX_IMAGES} images.`);
  const saved = await saveAll(files, ownerId);

  const id = randomUUID();
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      `INSERT INTO services
         (id, creator_id, category_id, title, description, price, currency, delivery_days,
          revisions, tags, deliverables, requirements, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, ownerId, input.categoryId, input.title, input.description, input.price, CURRENCY,
        input.deliveryDays, input.revisions, json(input.tags), json(input.deliverables),
        input.requirements, input.isActive ? 1 : 0,
      ]
    );
    for (let i = 0; i < saved.length; i++) {
      await conn.query(
        "INSERT INTO service_images (id, service_id, file_id, sort_order) VALUES (?, ?, ?, ?)",
        [saved[i].id, id, saved[i].fileId, i]
      );
    }
    await writeLinks(conn, id, input.links);
    await conn.commit();
    return id;
  } catch (err) {
    await conn.rollback();
    await removeFiles(saved.map((s) => s.fileId)).catch(() => {});
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * Edits a service. `order` lists the final gallery: "e:<imageId>" keeps an existing image,
 * "n:<i>" places the i-th newly uploaded file. The first entry becomes the cover.
 */
export async function updateService(
  ownerId: string,
  serviceId: string,
  input: ServiceInput,
  files: File[],
  order: string[] | null
): Promise<void> {
  const existing = await query<RowDataPacket & { id: string; file_id: string }>(
    "SELECT id, file_id FROM service_images WHERE service_id = ? ORDER BY sort_order, id",
    [serviceId]
  );
  const existingById = new Map(existing.map((e) => [e.id, e]));

  // Without an explicit order: keep everything as it is and add new files at the end
  const tokens =
    order ?? [...existing.map((e) => `e:${e.id}`), ...files.map((_, i) => `n:${i}`)];

  const usedNew = new Set<number>();
  const usedExisting = new Set<string>();
  for (const t of tokens) {
    if (t.startsWith("e:")) {
      const id = t.slice(2);
      if (!existingById.has(id) || usedExisting.has(id)) throw new UploadError("Invalid image list.");
      usedExisting.add(id);
    } else if (t.startsWith("n:")) {
      const i = Number(t.slice(2));
      if (!Number.isInteger(i) || i < 0 || i >= files.length || usedNew.has(i)) {
        throw new UploadError("Invalid image list.");
      }
      usedNew.add(i);
    } else {
      throw new UploadError("Invalid image list.");
    }
  }
  if (usedNew.size !== files.length) throw new UploadError("Invalid image list.");
  if (tokens.length > MAX_IMAGES) throw new UploadError(`You can have up to ${MAX_IMAGES} images.`);

  const saved = await saveAll(files, ownerId);
  const removedImages = existing.filter((e) => !usedExisting.has(e.id));
  const removedFileIds = removedImages.map((e) => e.file_id);

  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      `UPDATE services
          SET title = ?, description = ?, category_id = ?, price = ?, delivery_days = ?,
              revisions = ?, tags = ?, deliverables = ?, requirements = ?, is_active = ?
        WHERE id = ? AND creator_id = ?`,
      [
        input.title, input.description, input.categoryId, input.price, input.deliveryDays,
        input.revisions, json(input.tags), json(input.deliverables), input.requirements,
        input.isActive ? 1 : 0, serviceId, ownerId,
      ]
    );

    if (removedImages.length) {
      // only unlink the pictures here; their files are removed after the commit (see below)
      await conn.query("DELETE FROM service_images WHERE id IN (?) AND service_id = ?", [
        removedImages.map((e) => e.id),
        serviceId,
      ]);
    }
    for (let pos = 0; pos < tokens.length; pos++) {
      const t = tokens[pos];
      if (t.startsWith("e:")) {
        await conn.query("UPDATE service_images SET sort_order = ? WHERE id = ? AND service_id = ?", [
          pos, t.slice(2), serviceId,
        ]);
      } else {
        const s = saved[Number(t.slice(2))];
        await conn.query(
          "INSERT INTO service_images (id, service_id, file_id, sort_order) VALUES (?, ?, ?, ?)",
          [s.id, serviceId, s.fileId, pos]
        );
      }
    }
    await writeLinks(conn, serviceId, input.links);
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    await removeFiles(saved.map((s) => s.fileId)).catch(() => {});
    throw err;
  } finally {
    conn.release();
  }

  // Bytes of removed images are deleted only after the change is saved
  await removeFiles(removedFileIds).catch(() => {});
}

/** Deletes a service and all its uploaded images. */
export async function deleteService(serviceId: string): Promise<void> {
  const images = await query<RowDataPacket & { file_id: string }>(
    "SELECT file_id FROM service_images WHERE service_id = ?",
    [serviceId]
  );
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    await conn.query("DELETE FROM services WHERE id = ?", [serviceId]);
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
  await removeFiles(images.map((i) => i.file_id)).catch(() => {});
}

export async function getOwnedServiceId(serviceId: string, ownerId: string): Promise<string | null> {
  const row = await queryOne<RowDataPacket>("SELECT id FROM services WHERE id = ? AND creator_id = ?", [
    serviceId,
    ownerId,
  ]);
  return row ? (row.id as string) : null;
}
