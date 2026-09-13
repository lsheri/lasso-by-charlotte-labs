const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const session = JSON.parse(fs.readFileSync(process.env.HOME + '/.cache/lovable-auth/session.json', 'utf8'));
const supabase = createClient(
  'https://mcmoxcvcdrlxiifnkejh.supabase.co',
  'sb_publishable_YqJCEsQRJ3UxwmtUaXkOJg_rAN8lYC6',
  {
    global: { headers: { Authorization: `Bearer ${session.session.access_token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  }
);

(async () => {
  const { data, error } = await supabase
    .from('work_item_tasks')
    .select('task_id, work_items(id, title, type)')
    .in('task_id', ['56c0b144-121a-42e0-8843-2891d56862ba','d0384ae3-6287-4b44-b3dd-0fbbda4205d0','508dde3f-db2d-4f5e-adac-f9a9eff5fe39'])
    .limit(200);
  if (error) { console.error(error); process.exit(1); }
  const byTask = {};
  for (const row of data) {
    const tid = row.task_id;
    if (!byTask[tid]) byTask[tid] = [];
    byTask[tid].push(row.work_items);
  }
  for (const [tid, items] of Object.entries(byTask)) {
    console.log(tid, items.map(i => `${i.type}: ${i.title}`).join(' | '));
  }
})();
