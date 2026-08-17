import { cacheableJson } from '../../shared/http.js';
import { LOCATIONS } from '../../shared/constants.js';

export async function onRequestGet() {
  // Static, code-defined list — never changes without a deploy.
  return cacheableJson({ locations: LOCATIONS }, 3600);
}
