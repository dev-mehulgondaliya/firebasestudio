import { FieldPath } from "firebase-admin/firestore";
import { HttpError } from "@/lib/api/errors";

const DOCUMENT_ID_FIELD = "__name__";

function fieldRef(field) {
  return field === DOCUMENT_ID_FIELD ? FieldPath.documentId() : field;
}

/** Builds an Admin SDK query from the explorer's query-builder state. */
export async function buildAdminQuery(db, codec, { collection, filters = [], orderBy, direction = "asc", limit = 50, cursor }) {
  let query = db.collection(collection);

  for (const filter of filters) {
    let value;
    try {
      value = codec.decode(filter.value);
    } catch (error) {
      throw new HttpError(400, `Filter on "${filter.field}": ${error.message}`);
    }
    if (["in", "not-in", "array-contains-any"].includes(filter.op) && !Array.isArray(value)) {
      throw new HttpError(400, `Filter "${filter.op}" on "${filter.field}" needs an array value.`);
    }
    query = query.where(fieldRef(filter.field), filter.op, value);
  }

  if (orderBy) query = query.orderBy(fieldRef(orderBy), direction);

  if (cursor) {
    const snapshot = await db.collection(collection).doc(cursor).get();
    if (!snapshot.exists) throw new HttpError(400, "The pagination cursor document no longer exists. Run the query again.");
    query = query.startAfter(snapshot);
  }

  return query.limit(limit);
}
