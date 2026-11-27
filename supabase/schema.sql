-- =====================================================================
-- OPR IDEXS GENERATOR – SM Imtiaz YT Dungun
-- Skema Supabase (PostgreSQL + Row Level Security + Storage)
-- Jalankan SEKALI dalam Supabase Dashboard → SQL Editor → New query → Run
-- =====================================================================

-- 1. PROFIL PENGGUNA ---------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  role text not null default 'guru' check (role in ('guru','admin')),
  can_manage_all boolean not null default false,   -- kebenaran tambahan daripada admin
  created_at timestamptz not null default now()
);

-- Profil dicipta automatik bila guru mendaftar
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''), new.email)
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Admin atau pengguna dengan kebenaran tambahan
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles
                where id = auth.uid() and (role = 'admin' or can_manage_all));
$$;

-- 2. LAPORAN OPR -------------------------------------------------------
create table if not exists public.oprs (
  id text primary key,
  author_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kategori text check (kategori in ('akademik','hem','koku','ulul')),
  status text not null default 'draft' check (status in ('draft','pending','confirmed','sent')),
  nama text,
  data jsonb not null default '{}',          -- maklumat penuh OPR (medan, objektif, impak, gambar)
  tg_status text, tg_sent_at timestamptz, tg_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists oprs_author_idx on public.oprs(author_id, created_at desc);
create index if not exists oprs_kat_idx on public.oprs(kategori, status);

-- 3. TETAPAN SEKOLAH (1 baris) -----------------------------------------
create table if not exists public.settings (
  id int primary key default 1 check (id = 1),
  slogan text,
  logo_path text,
  tg_group text,
  updated_at timestamptz not null default now()
);
insert into public.settings(id) values (1) on conflict do nothing;

-- 4. ROW LEVEL SECURITY ------------------------------------------------
alter table public.profiles enable row level security;
alter table public.oprs     enable row level security;
alter table public.settings enable row level security;

drop policy if exists "profiles_select" on public.profiles;
drop policy if exists "profiles_admin_update" on public.profiles;
create policy "profiles_select" on public.profiles for select
  using (id = auth.uid() or public.is_admin());
create policy "profiles_admin_update" on public.profiles for update
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "oprs_select" on public.oprs;
drop policy if exists "oprs_insert" on public.oprs;
drop policy if exists "oprs_update" on public.oprs;
drop policy if exists "oprs_delete" on public.oprs;
create policy "oprs_select" on public.oprs for select using (author_id = auth.uid() or public.is_admin());
create policy "oprs_insert" on public.oprs for insert with check (author_id = auth.uid() or public.is_admin());
create policy "oprs_update" on public.oprs for update using (author_id = auth.uid() or public.is_admin())
  with check (author_id = auth.uid() or public.is_admin());
create policy "oprs_delete" on public.oprs for delete using (author_id = auth.uid() or public.is_admin());

drop policy if exists "settings_select" on public.settings;
drop policy if exists "settings_admin_write" on public.settings;
create policy "settings_select" on public.settings for select using (auth.role() = 'authenticated');
create policy "settings_admin_write" on public.settings for all using (public.is_admin()) with check (public.is_admin());

-- 5. STORAGE: bucket peribadi 'opr-files' -------------------------------
--   <user_id>/<opr_id>/xxx.jpg  → gambar aktiviti (pemilik + admin)
--   settings/xxx.png            → logo sekolah (semua boleh baca, admin tulis)
insert into storage.buckets (id, name, public) values ('opr-files', 'opr-files', false)
on conflict (id) do nothing;

drop policy if exists "opr_files_read" on storage.objects;
drop policy if exists "opr_files_insert" on storage.objects;
drop policy if exists "opr_files_modify" on storage.objects;
create policy "opr_files_read" on storage.objects for select using (
  bucket_id = 'opr-files' and auth.role() = 'authenticated' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or (storage.foldername(name))[1] = 'settings'
    or public.is_admin()));
create policy "opr_files_insert" on storage.objects for insert with check (
  bucket_id = 'opr-files' and (
    (storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
create policy "opr_files_modify" on storage.objects for delete using (
  bucket_id = 'opr-files' and (
    (storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

-- 6. ADMIN PERTAMA ------------------------------------------------------
-- Selepas anda mendaftar akaun di aplikasi, jalankan (tukar e-mel):
-- update public.profiles set role = 'admin' where email = 'admin@sekolah.edu.my';
