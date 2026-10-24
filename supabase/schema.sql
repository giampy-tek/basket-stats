-- Basket Stats: schema cloud. Incolla tutto in Supabase > SQL Editor > Run.
-- Un "documento" per il club (rosa, stagioni) e uno per ogni partita.
-- Ogni utente vede e modifica SOLO i propri documenti (Row Level Security).

create table if not exists public.docs (
  user_id    uuid        not null references auth.users(id) on delete cascade,
  id         text        not null,
  kind       text        not null check (kind in ('club', 'game')),
  data       jsonb,
  deleted    boolean     not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists docs_user_updated on public.docs (user_id, updated_at);

alter table public.docs enable row level security;

drop policy if exists "docs: solo il proprietario" on public.docs;
create policy "docs: solo il proprietario" on public.docs
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- updated_at deciso dal server (serve da cursore di sincronizzazione)
create or replace function public.touch_docs() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists docs_touch on public.docs;
create trigger docs_touch before insert or update on public.docs
  for each row execute function public.touch_docs();
