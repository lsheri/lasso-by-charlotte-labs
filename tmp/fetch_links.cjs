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
    .eq('task_id', 'b8c86d0a-b99e-4e1f-b430-9578ce448111')
    .limit(100);
  if (error) { console.error(error); process.exit(1); }
  const byTask = {};
  for (const row of data) {
    const tid = row.task_id;
    if (!byTask[tid]) byTask[tid] = [];
    byTask[tid].push(row.work_items);
  }
  console.log(JSON.stringify(byTask, null, 2));
})();
