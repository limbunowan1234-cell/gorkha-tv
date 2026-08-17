// Generates the value to store as the ADMIN_PASSWORD_HASH secret.
// Usage: node scripts/hash-password.mjs "your-admin-password"

import { hashPassword } from '../shared/auth.js';

const password = process.argv[2];
if (!password) {
  console.error('Usage: node scripts/hash-password.mjs "your-admin-password"');
  process.exit(1);
}

const hash = await hashPassword(password);
console.log('\nADMIN_PASSWORD_HASH value (store this as a Cloudflare Pages secret, never the raw password):\n');
console.log(hash);
console.log('');
