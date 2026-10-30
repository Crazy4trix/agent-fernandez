// Creates or updates the admin account: npm run create-admin
import readline from 'node:readline';
import { upsertUser } from '../src/auth.js';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
const ask = (q, hidden = false) => new Promise((resolve) => {
  rl.question(q, (a) => { if (hidden) process.stdout.write('\n'); resolve(a.trim()); });
  if (hidden) rl._writeToOutput = (s) => { if (s.includes(q)) rl.output.write(q); };
});

const email = await ask('Admin email: ');
const password = await ask('Password (12+ characters): ', true);
rl._writeToOutput = (s) => rl.output.write(s);
const confirm = await ask('Repeat password: ', true);
rl.close();

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { console.error('That email address isn’t valid.'); process.exit(1); }
if (password.length < 12) { console.error('Use at least 12 characters.'); process.exit(1); }
if (password !== confirm) { console.error('The passwords don’t match.'); process.exit(1); }
upsertUser(email, password);
console.log(`Admin account ready for ${email}. Sign in at /admin.`);
