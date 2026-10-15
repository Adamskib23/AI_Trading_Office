export function assertOwner(token: string, expected = process.env.OFFICE_OWNER_TOKEN) {
  if (!expected || expected.length < 32) throw new Error('Owner access is not configured');
  let difference = token.length ^ expected.length;
  for (let i = 0; i < expected.length; i++)
    difference |= expected.charCodeAt(i) ^ (token.charCodeAt(i) || 0);
  if (difference !== 0) throw new Error('Owner access denied');
}
