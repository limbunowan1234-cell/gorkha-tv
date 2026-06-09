import { Client, Databases, Storage, Account, Query, ID } from "https://cdn.jsdelivr.net/npm/appwrite@14.0.1/+esm";

const client = new Client()
  .setEndpoint("https://nyc.cloud.appwrite.io/v1")
  .setProject("6a280cbd0022eeb574a5");

export const databases = new Databases(client);
export const storage = new Storage(client);
export const account = new Account(client);
export const client_ = client;

export const DB_ID = "6a280cde0009e6b2b556";
export const COLLECTION_ID = "content";
export const ARTISTS_COLLECTION_ID = "artists";
export const BUCKET_ID = "6a280d4100046ab86533";
export const ADMIN_EMAIL = "Nowanad@gmail.com";

export { Query, ID };
 