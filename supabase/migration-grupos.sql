-- Migração: modelo de GRUPOS (simples / duplas / batedor) + disponibilidade do Leandro.
-- Rode UMA VEZ no SQL Editor do Supabase (é aditivo — não apaga dados).

-- Grupos passam a ter tipo, limite de tempo (60/30) e lista de membros (1 a 4).
alter table fila_duos add column if not exists type text not null default 'singles';
alter table fila_duos add column if not exists limit_min int not null default 60;
alter table fila_duos add column if not exists members jsonb not null default '[]'::jsonb;

-- Antes exigia exatamente 2 nomes; agora o grupo tem 1 a 4 membros (em "members").
alter table fila_duos alter column name1 drop not null;
alter table fila_duos alter column name2 drop not null;

-- Configurações simples (ex.: disponibilidade do batedor Leandro).
create table if not exists fila_settings (
  key text primary key,
  value text
);
insert into fila_settings (key, value) values ('batedor_available', 'false')
on conflict (key) do nothing;
