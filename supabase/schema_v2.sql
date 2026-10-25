-- Basket Stats: squadre condivise con ruoli (v2).
-- Incolla tutto in Supabase > SQL Editor > Run. Si può rieseguire senza rischi.
-- Ruoli: owner (gestisce membri e dati), editor (modifica i dati), viewer (solo lettura).

create table if not exists public.teams (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.team_members (
  team_id    uuid not null references public.teams(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null check (role in ('owner', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (team_id, user_id)
);
create index if not exists team_members_user on public.team_members (user_id);

create table if not exists public.team_docs (
  team_id    uuid        not null references public.teams(id) on delete cascade,
  id         text        not null,
  kind       text        not null check (kind in ('club', 'game')),
  data       jsonb,
  deleted    boolean     not null default false,
  updated_at timestamptz not null default now(),
  primary key (team_id, id)
);
create index if not exists team_docs_updated on public.team_docs (team_id, updated_at);

-- ruolo dell'utente loggato in una squadra (null = non è membro)
create or replace function public.team_role(p_team uuid) returns text
language sql stable security definer set search_path = public as $$
  select role from public.team_members where team_id = p_team and user_id = auth.uid()
$$;

alter table public.teams        enable row level security;
alter table public.team_members enable row level security;
alter table public.team_docs    enable row level security;

revoke all on public.teams, public.team_members, public.team_docs from anon;
revoke all on public.teams, public.team_members from authenticated;
grant select on public.teams, public.team_members to authenticated;
grant select, insert, update, delete on public.team_docs to authenticated;

drop policy if exists "teams: i miei" on public.teams;
create policy "teams: i miei" on public.teams for select to authenticated
  using (public.team_role(id) is not null);

drop policy if exists "membri: le mie righe" on public.team_members;
create policy "membri: le mie righe" on public.team_members for select to authenticated
  using (user_id = auth.uid());

-- dati: leggono tutti i membri, scrivono solo owner ed editor
drop policy if exists "docs: leggo se membro" on public.team_docs;
create policy "docs: leggo se membro" on public.team_docs for select to authenticated
  using (public.team_role(team_id) is not null);

drop policy if exists "docs: scrivo se owner/editor" on public.team_docs;
create policy "docs: scrivo se owner/editor" on public.team_docs for insert to authenticated
  with check (public.team_role(team_id) in ('owner', 'editor'));

drop policy if exists "docs: aggiorno se owner/editor" on public.team_docs;
create policy "docs: aggiorno se owner/editor" on public.team_docs for update to authenticated
  using (public.team_role(team_id) in ('owner', 'editor'))
  with check (public.team_role(team_id) in ('owner', 'editor'));

drop policy if exists "docs: cancello se owner/editor" on public.team_docs;
create policy "docs: cancello se owner/editor" on public.team_docs for delete to authenticated
  using (public.team_role(team_id) in ('owner', 'editor'));

-- updated_at deciso dal server (cursore di sincronizzazione)
create or replace function public.touch_team_docs() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists team_docs_touch on public.team_docs;
create trigger team_docs_touch before insert or update on public.team_docs
  for each row execute function public.touch_team_docs();

-- ---------- funzioni (l'app le chiama con supabase.rpc) ----------

create or replace function public.create_team(p_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'Non sei collegato'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'Serve un nome'; end if;
  insert into public.teams (name, created_by) values (trim(p_name), auth.uid()) returning id into v_id;
  insert into public.team_members (team_id, user_id, role) values (v_id, auth.uid(), 'owner');
  return v_id;
end $$;

create or replace function public.list_members(p_team uuid)
returns table (user_id uuid, email text, role text)
language plpgsql security definer set search_path = public, auth as $$
begin
  if public.team_role(p_team) is null then raise exception 'Non sei membro di questa squadra'; end if;
  return query
    select m.user_id, u.email::text, m.role
    from public.team_members m join auth.users u on u.id = m.user_id
    where m.team_id = p_team
    order by case m.role when 'owner' then 0 when 'editor' then 1 else 2 end, u.email;
end $$;

-- aggiunge (o cambia il ruolo di) un account GIÀ esistente, cercandolo per email: solo owner
create or replace function public.add_member(p_team uuid, p_email text, p_role text) returns void
language plpgsql security definer set search_path = public, auth as $$
declare v_user uuid;
begin
  if public.team_role(p_team) is distinct from 'owner' then raise exception 'Solo il proprietario può gestire i membri'; end if;
  if p_role not in ('owner', 'editor', 'viewer') then raise exception 'Ruolo non valido'; end if;
  select id into v_user from auth.users where lower(email) = lower(trim(p_email));
  if v_user is null then raise exception 'Nessun account con questa email: crealo prima in Supabase'; end if;
  insert into public.team_members (team_id, user_id, role) values (p_team, v_user, p_role)
  on conflict (team_id, user_id) do update set role = excluded.role;
end $$;

-- toglie un membro (o esce dalla squadra); la squadra deve restare con almeno un owner
create or replace function public.remove_member(p_team uuid, p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_owners int; v_target text;
begin
  if p_user <> auth.uid() and public.team_role(p_team) is distinct from 'owner' then
    raise exception 'Solo il proprietario può togliere altri membri';
  end if;
  select role into v_target from public.team_members where team_id = p_team and user_id = p_user;
  if v_target = 'owner' then
    select count(*) into v_owners from public.team_members where team_id = p_team and role = 'owner';
    if v_owners <= 1 then raise exception 'La squadra deve avere almeno un proprietario'; end if;
  end if;
  delete from public.team_members where team_id = p_team and user_id = p_user;
end $$;

-- cambia ruolo: stessa regola dell'ultimo owner
create or replace function public.set_member_role(p_team uuid, p_user uuid, p_role text) returns void
language plpgsql security definer set search_path = public as $$
declare v_owners int; v_target text;
begin
  if public.team_role(p_team) is distinct from 'owner' then raise exception 'Solo il proprietario può cambiare i ruoli'; end if;
  if p_role not in ('owner', 'editor', 'viewer') then raise exception 'Ruolo non valido'; end if;
  select role into v_target from public.team_members where team_id = p_team and user_id = p_user;
  if v_target = 'owner' and p_role <> 'owner' then
    select count(*) into v_owners from public.team_members where team_id = p_team and role = 'owner';
    if v_owners <= 1 then raise exception 'La squadra deve avere almeno un proprietario'; end if;
  end if;
  update public.team_members set role = p_role where team_id = p_team and user_id = p_user;
end $$;

revoke execute on function public.create_team(text), public.list_members(uuid), public.add_member(uuid, text, text),
  public.remove_member(uuid, uuid), public.set_member_role(uuid, uuid, text), public.team_role(uuid) from public, anon;
grant execute on function public.create_team(text), public.list_members(uuid), public.add_member(uuid, text, text),
  public.remove_member(uuid, uuid), public.set_member_role(uuid, uuid, text), public.team_role(uuid) to authenticated;

-- ---------- migrazione dei dati già sincronizzati (tabella vecchia "docs") ----------
-- Ogni utente che aveva un club diventa proprietario di una squadra con gli stessi dati.
do $$
declare r record; v_team uuid;
begin
  if to_regclass('public.docs') is not null then
    for r in select distinct d.user_id, coalesce(d.data->>'clubName', 'Squadra') as name
             from public.docs d where d.id = 'club' and not d.deleted
    loop
      if not exists (select 1 from public.teams t join public.team_members m on m.team_id = t.id
                     where m.user_id = r.user_id and m.role = 'owner' and t.name = r.name) then
        insert into public.teams (name, created_by) values (r.name, r.user_id) returning id into v_team;
        insert into public.team_members (team_id, user_id, role) values (v_team, r.user_id, 'owner');
        insert into public.team_docs (team_id, id, kind, data, deleted)
          select v_team, d.id, d.kind, d.data, d.deleted from public.docs d where d.user_id = r.user_id;
      end if;
    end loop;
  end if;
end $$;
