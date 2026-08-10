CREATE OR REPLACE FUNCTION public.make_invite(p_role app_role DEFAULT 'em'::app_role, p_email text DEFAULT NULL::text, p_org_id uuid DEFAULT NULL::uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare v_code text; v_org uuid; v_creator uuid;
begin
  if p_org_id is not null then
    v_org := p_org_id;
  else
    select org_id into v_org from profiles
      where user_id = auth.uid() and role in ('admin','lead');
    if (select count(*) from profiles where user_id = auth.uid() and role in ('admin','lead')) > 1 then
      raise exception 'multiple orgs: specify p_org_id';
    end if;
  end if;
  select id into v_creator from profiles
    where user_id = auth.uid() and org_id = v_org and role in ('admin','lead');
  if v_creator is null then raise exception 'not permitted'; end if;
  v_code := encode(gen_random_bytes(6),'hex');
  insert into invites (code, org_id, invited_role, created_by, email)
    values (v_code, v_org, p_role, v_creator, lower(p_email));
  return v_code;
end $function$;

DROP EXTENSION IF EXISTS pgcrypto CASCADE;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;