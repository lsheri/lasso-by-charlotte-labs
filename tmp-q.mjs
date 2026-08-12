import { createClient } from '@supabase/supabase-js';
const s = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { data, error } = await s.from('work_items').select('id,title,type,content_ref,meta,source_meta,source').limit(50);
if (error) throw error;
for (const i of data) console.log(i.id, '|', i.type, '|', i.title, '|', i.content_ref, '|', JSON.stringify(i.meta));
