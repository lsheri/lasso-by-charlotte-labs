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
    .from('tasks')
    .select('id, name')
    .eq('engagement_id', 'b8c86d0a-b99e-4e1f-b430-9578ce448111')
    .limit(20);
  if (error) { console.error(error); process.exit(1); }
  console.log(JSON.stringify(data, null, 2));
})();
