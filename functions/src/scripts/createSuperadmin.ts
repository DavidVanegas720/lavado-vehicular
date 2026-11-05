import { pathToFileURL } from 'node:url';

// G7: the only way a superadmin account is made. Never overwrites: an existing email -> email_taken.
export async function createSuperadmin(email: string, password: string) {
  // the emulator guard in firebase.ts reads GCLOUD_PROJECT; the plan's variable is GOOGLE_CLOUD_PROJECT
  process.env.GCLOUD_PROJECT ??= process.env.GOOGLE_CLOUD_PROJECT;
  const { createLogin, loginInput } = await import('../operators.controller.js');
  const i = loginInput({ email, password }, 12);
  return createLogin(i.email, i.password, { role: 'superadmin' }, async () => {});
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const project = process.env.GOOGLE_CLOUD_PROJECT;
  const email = process.argv[2] ?? process.env.SUPERADMIN_EMAIL;
  const fail = (m: string) => { console.error(m); process.exit(1); };
  if (!project) fail('GOOGLE_CLOUD_PROJECT is not set: refusing to pick a project.');
  if (!email) fail('Usage: SUPERADMIN_PASSWORD=... npm run superadmin:create -- <email>');
  if (!process.env.SUPERADMIN_PASSWORD) fail('SUPERADMIN_PASSWORD is not set (the password is read only from the environment).');
  console.log(`Project: ${project}` + (process.env.FIREBASE_AUTH_EMULATOR_HOST ? ` (Auth emulator ${process.env.FIREBASE_AUTH_EMULATOR_HOST})` : ''));
  try {
    await createSuperadmin(email!, process.env.SUPERADMIN_PASSWORD!);
    console.log(`Superadmin created: ${email}`);
  } catch (e) {
    const code = (e as { code?: string }).code;
    fail(code === 'email_taken' ? 'That email already has an account; nothing was changed.'
      : code === 'validation' ? 'Invalid email, or the password is shorter than 12 characters.'
      : `Failed: ${code ?? 'internal'}`);
  }
  process.exit(0);
}
