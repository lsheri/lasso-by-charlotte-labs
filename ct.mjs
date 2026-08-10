import { Composio } from '@composio/core';
const c = new Composio({ apiKey: process.env.COMPOSIO_API_KEY });
const r = await c.connectedAccounts.link('probe-entity-1','ac_8W5fdKy5EPtH',{ callbackUrl: 'https://example.com' });
console.log(r.id, r.status, String(r.redirectUrl).slice(0,100));
try{ const a = await c.authConfigs.create('gmail', { type:'use_composio_managed_auth', name:'Gmail Auth Config' }); console.log('created', a.id);}catch(e){console.log('createerr', e.message);}
