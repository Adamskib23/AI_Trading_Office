import { readFileSync } from 'node:fs';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../convex/_generated/api.js';
if (!process.argv[2])
  throw new Error('Usage: node scripts/review-feed.mjs .office/feed-review.json');
const review = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const ownerToken = readFileSync('.office/owner-token.txt', 'utf8').trim();
const client = new ConvexHttpClient('http://127.0.0.1:3210', { logger: false });
await client.mutation(api.marketData.review, { ...review, ownerToken });
console.log('Feed review recorded. Refresh the feed again before any provider-data test order.');
