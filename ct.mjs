import { Composio } from '@composio/core';
const c = new Composio({ apiKey: process.env.COMPOSIO_API_KEY });
const t = await c.tools.getRawComposioTools({ toolkits: ['googledrive'], search: 'list files', limit: 15 }).catch(e=>e.message);
console.log(Array.isArray(t) ? t.map(x=>x.slug) : t);
const acc = await c.connectedAccounts.list({ userIds: ['test-entity'] }).catch(e=>e.message);
console.log(JSON.stringify(acc).slice(0,500));
