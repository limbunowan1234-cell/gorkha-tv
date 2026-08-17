// Reaching this route at all means _middleware.js already validated the
// session cookie — its mere 200 response is the "am I logged in" check the
// admin frontend uses to decide whether to show the login form or the hub.
import { json } from '../../../shared/http.js';

export async function onRequestGet() {
  return json({ authenticated: true });
}
