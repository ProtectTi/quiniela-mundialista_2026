import { config } from "../config.js";

const FIRESTORE_BASE_URL = `https://firestore.googleapis.com/v1/projects/${config.firebase.projectId}/databases/(default)/documents`;

function decodeFirestoreValue(value) {
  if (!value || typeof value !== "object") return null;
  if ("nullValue" in value) return null;
  if ("stringValue" in value) return value.stringValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return Number(value.doubleValue);
  if ("timestampValue" in value) return value.timestampValue;
  if ("mapValue" in value) {
    return decodeFirestoreFields(value.mapValue.fields || {});
  }
  if ("arrayValue" in value) {
    return (value.arrayValue.values || []).map(decodeFirestoreValue);
  }
  return null;
}

function decodeFirestoreFields(fields = {}) {
  return Object.fromEntries(
    Object.entries(fields).map(([key, rawValue]) => [key, decodeFirestoreValue(rawValue)])
  );
}

function buildCollectionUrl(collectionName, pageToken = "") {
  const url = new URL(`${FIRESTORE_BASE_URL}/${collectionName}`);
  url.searchParams.set("key", config.firebase.apiKey);
  url.searchParams.set("pageSize", "1000");
  if (pageToken) {
    url.searchParams.set("pageToken", pageToken);
  }
  return url.toString();
}

async function fetchCollectionPage(collectionName, pageToken = "") {
  const response = await fetch(buildCollectionUrl(collectionName, pageToken));
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.error?.message || `No fue posible leer Firestore para ${collectionName}.`
    );
  }

  return data;
}

export async function fetchCollectionDocs(collectionName) {
  const docs = [];
  let nextPageToken = "";

  do {
    const data = await fetchCollectionPage(collectionName, nextPageToken);
    const pageDocs = Array.isArray(data.documents) ? data.documents : [];

    pageDocs.forEach(document => {
      docs.push({
        id: String(document.name || "").split("/").pop(),
        data: decodeFirestoreFields(document.fields || {})
      });
    });

    nextPageToken = data.nextPageToken || "";
  } while (nextPageToken);

  return docs;
}
