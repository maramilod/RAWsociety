export interface ServiceRequest {
  fields: Record<string, unknown>;
  images: File[];
  /** Final gallery order ("e:<imageId>" / "n:<i>"), or null when the client did not send one */
  order: string[] | null;
}

/**
 * Reads a create/edit request. Services are sent as multipart form data (because of the images),
 * but plain JSON is accepted too (used for the quick pause/resume toggle).
 */
export async function readServiceRequest(request: Request): Promise<ServiceRequest | null> {
  const type = request.headers.get("content-type") ?? "";
  try {
    if (type.includes("multipart/form-data")) {
      const form = await request.formData();
      const images = form
        .getAll("images")
        .filter((f): f is File => f instanceof File && f.size > 0);

      let order: string[] | null = null;
      const rawOrder = form.get("imageOrder");
      if (typeof rawOrder === "string" && rawOrder.trim()) {
        const parsed = JSON.parse(rawOrder);
        if (Array.isArray(parsed)) order = parsed.map(String);
      }

      const text = (key: string) => form.get(key);
      return {
        fields: {
          title: text("title"),
          description: text("description"),
          categoryId: text("categoryId"),
          price: text("price"),
          deliveryDays: text("deliveryDays"),
          revisions: text("revisions"),
          requirements: text("requirements"),
          isActive: text("isActive"),
          tags: form.getAll("tags").map(String),
          deliverables: form.getAll("deliverables").map(String),
          links: text("links"), // JSON string: [{ kind, label, url }]
        },
        images,
        order,
      };
    }
    const body = await request.json();
    return { fields: body && typeof body === "object" ? body : {}, images: [], order: null };
  } catch {
    return null;
  }
}
