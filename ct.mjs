import { Composio } from '@composio/core';
const c = new Composio({ apiKey: process.env.COMPOSIO_API_KEY });
const [t] = await c.tools.getRawComposioTools({ tools: ['GOOGLEDRIVE_LIST_FILES'] });
console.log(JSON.stringify(t.inputParameters).slice(0,1200));
try {
  const r = await c.toolkits.authorize('probe-entity-1', 'googledrive');
  console.log('AUTH', r.id, r.status, String(r.redirectUrl).slice(0,80));
} catch(e){ console.log('AUTHERR', e.message, JSON.stringify(e).slice(0,400)); }
