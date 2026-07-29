-- Fila das Quadras — schema Supabase/Postgres
-- Rode isto no SQL Editor do seu projeto Supabase (uma vez).

create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  checked_in_at timestamptz not null default now(),
  duo_id uuid
);

create table if not exists duos (
  id uuid primary key default gen_random_uuid(),
  name1 text not null,
  name2 text not null,
  p1 uuid,
  p2 uuid,
  formed_at timestamptz not null default now(),
  status text not null default 'queued',   -- queued | called | playing | done
  court_id text
);

create table if not exists courts (
  id text primary key,
  name text not null,
  surface text not null,
  sort int not null default 0,
  status text not null default 'free',       -- free | prep | playing | lesson
  duo_id uuid,
  called_duo_id uuid,
  play_started_at timestamptz,
  lesson_label text,
  lesson_until timestamptz
);

create table if not exists schedule (
  id uuid primary key default gen_random_uuid(),
  court_id text not null references courts(id) on delete cascade,
  weekday int not null,      -- 0=domingo .. 6=sábado
  start_min int not null,    -- minutos desde a meia-noite
  end_min int not null,
  label text not null default 'Aula'
);

create table if not exists check_in_events (
  id bigint generated always as identity primary key,
  at timestamptz not null default now()
);

-- Quadras do clube (fixas)
insert into courts (id, name, surface, sort) values
  ('q1', 'Quadra 01', 'saibro', 1),
  ('q2', 'Quadra 02', 'saibro', 2),
  ('qd', 'Quadra Dura', 'rápida', 3)
on conflict (id) do nothing;

-- Realtime (opcional, para atualização instantânea entre telas)
alter publication supabase_realtime add table courts, duos, players, schedule;

-- Observação sobre segurança:
-- O app acessa o banco apenas pelo servidor (Route Handlers do Next) usando a
-- SERVICE ROLE KEY, que ignora RLS. Não exponha essa chave no cliente.
-- Mantenha RLS ligado (padrão) e não crie políticas públicas de escrita.
