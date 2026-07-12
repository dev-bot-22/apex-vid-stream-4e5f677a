
create table if not exists public.access_logs (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  kind text not null,
  path text,
  method text,
  ip text,
  user_agent text,
  referer text,
  origin text,
  batch_id text,
  video_id text,
  video_name text,
  blocked boolean not null default false
);
create index if not exists access_logs_created_at_idx on public.access_logs (created_at desc);
create index if not exists access_logs_ip_idx on public.access_logs (ip);
create index if not exists access_logs_referer_idx on public.access_logs (referer);
grant select, insert, delete on public.access_logs to service_role;
grant usage, select on sequence public.access_logs_id_seq to service_role;
alter table public.access_logs enable row level security;

create table if not exists public.blocked_clients (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  kind text not null check (kind in ('ip','referer','origin','user_agent','batch_id')),
  value text not null,
  message text,
  unique(kind, value)
);
grant select, insert, update, delete on public.blocked_clients to service_role;
grant usage, select on sequence public.blocked_clients_id_seq to service_role;
alter table public.blocked_clients enable row level security;

create table if not exists public.admin_settings (
  key text primary key,
  value text
);
grant select, insert, update, delete on public.admin_settings to service_role;
alter table public.admin_settings enable row level security;

insert into public.admin_settings (key, value) values ('block_message', 'Access denied. This player is protected. Contact @official_marco_22 on Telegram.') on conflict (key) do nothing;
