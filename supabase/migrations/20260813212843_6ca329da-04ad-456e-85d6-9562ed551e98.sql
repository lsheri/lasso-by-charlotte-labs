do $$
declare o uuid := 'bd05c677-0f30-41e8-a2e9-f2a9e084fbdf';
        pr uuid := '3642aaa3-81f6-4a9a-9728-4e935054074e';
        e1 uuid; e2 uuid; t1 uuid; t2 uuid; w uuid; i int;
begin
  insert into engagements (org_id, code, title, client_label) values (o,'QA1','Pricing refresh','Northwind') returning id into e1;
  insert into engagements (org_id, code, title, client_label) values (o,'QA2','Ops redesign','Contoso') returning id into e2;
  insert into engagement_members (engagement_id, profile_id, member_role) values (e1, pr, 'em'), (e2, pr, 'em');
  insert into tasks (engagement_id, owner_id, name, position) values (e1, pr, 'Discovery', 1) returning id into t1;
  insert into tasks (engagement_id, owner_id, name, position) values (e2, pr, 'Process map', 1) returning id into t2;
  for i in 1..4 loop
    insert into work_items (org_id, owner_id, title, type, visibility, source, content_fidelity)
      values (o, pr, 'QA thread '||i, 'ai_thread', 'mapped', 'paste', 'verbatim') returning id into w;
    insert into work_item_tasks (work_item_id, task_id) values (w, t1);
  end loop;
  for i in 1..4 loop
    insert into work_items (org_id, owner_id, title, type, visibility, source, content_fidelity)
      values (o, pr, 'QA note '||i, 'ai_thread', 'mapped', 'paste', 'verbatim') returning id into w;
    insert into work_item_tasks (work_item_id, task_id) values (w, t2);
  end loop;
end $$;