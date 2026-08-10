import { Composio } from '@composio/core';
const c = new Composio({ apiKey: process.env.COMPOSIO_API_KEY });
const list = await c.authConfigs.list({});
console.log(JSON.stringify(list.items?.map(i=>({id:i.id,toolkit:i.toolkit?.slug,type:i.type,name:i.name}))));
