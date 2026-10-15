// Scripted trader entry point. Order files contain requests only; never quote or fill prices.
import { readFileSync } from 'node:fs';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../convex/_generated/api.js';
if (!process.argv[2]) throw new Error('Usage: node scripts/paper-order.mjs .office/order.json');
const request = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const ownerToken = readFileSync('.office/owner-token.txt', 'utf8').trim();
const client = new ConvexHttpClient('http://127.0.0.1:3210', { logger: false });
const orderId = await client.mutation(api.paper.propose, {
  ownerToken,
  runId: request.runId,
  proposal: request.proposal,
});
console.log(
  JSON.stringify({
    orderId,
    note: 'Inspect Paper lab for acceptance, rejection or later-quote fill. No model called.',
  }),
);
