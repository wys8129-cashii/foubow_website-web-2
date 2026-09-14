-- =====================================================================
-- Foubow 打赏 + 白名单 功能迁移
-- 版本：0003
-- 说明：
--   1) profiles 表新增「管理员标识」与「白名单状态」字段
--   2) 新建 rewards 表（打赏订单，供管理员人工核对截图）
--   3) 新建 is_admin() SECURITY DEFINER 函数（用于 RLS 策略，避免递归）
--   4) 配置 RLS：用户只读自己；管理员可读写全部
--
-- 执行方式：在 Supabase 后台 → SQL Editor 全量执行本文件。
-- 注意：本文件可重复执行（已做 IF NOT EXISTS / DO $$ 幂等保护）。
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. profiles 表加字段
-- ---------------------------------------------------------------------
alter table public.profiles
  add column if not exists is_admin        boolean      not null default false;
alter table public.profiles
  add column if not exists reward_status   text         not null default 'none'
                                              check (reward_status in ('none', 'paid', 'whitelisted'));
alter table public.profiles
  add column if not exists whitelisted_by  uuid         references auth.users(id) on delete set null;
alter table public.profiles
  add column if not exists whitelisted_at  timestamptz;
alter table public.profiles
  add column if not exists whitelist_note  text;
alter table public.profiles
  add column if not exists admin_note      text;

comment on column public.profiles.is_admin       is '是否为管理员（可进入 /admin 后台审核打赏、加白名单）';
comment on column public.profiles.reward_status  is '打赏状态：none 未打赏 / paid 已打赏待审核 / whitelisted 已加白名单';
comment on column public.profiles.whitelisted_by is '操作加白名单的管理员 user id';
comment on column public.profiles.whitelist_note is '加白名单时的备注';

-- ---------------------------------------------------------------------
-- 2. rewards 表（打赏订单）
-- ---------------------------------------------------------------------
create table if not exists public.rewards (
  id             uuid         primary key default gen_random_uuid(),
  user_id        uuid         references auth.users(id) on delete set null,  -- 已登录用户可关联；纯小程序打赏可为空
  openid         text,                                                          -- 小程序 openid（未登录打赏时用于核对）
  order_id       text         unique not null,                                  -- 微信虚拟支付 out_trade_no
  amount         numeric(10,2) not null,
  item_id        text,                                                          -- 道具 ID（打赏档位）
  item_name      text,                                                          -- 档位名称
  status         text         not null default 'pending'
                                check (status in ('pending', 'paid')),
  paid_at        timestamptz,
  screenshot_note text,                                                         -- 管理员核对截图后的备注
  created_at     timestamptz   not null default now()
);

create index if not exists idx_rewards_order_id   on public.rewards(order_id);
create index if not exists idx_rewards_status     on public.rewards(status);
create index if not exists idx_rewards_user_id    on public.rewards(user_id);
create index if not exists idx_rewards_openid     on public.rewards(openid);

comment on table  public.rewards               is '打赏订单（虚拟支付）。支付成功后由 notify/report 更新为 paid，管理员核对截图后在 /admin 加白名单';
comment on column public.rewards.openid        is '小程序 openid，用于未登录用户打赏时与管理员核对';

-- ---------------------------------------------------------------------
-- 3. is_admin() 函数（SECURITY DEFINER，供 RLS 策略使用，避免策略递归查自身）
-- ---------------------------------------------------------------------
create or replace function public.is_admin(uid uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select coalesce((select is_admin from public.profiles where id = uid), false);
$$;

-- ---------------------------------------------------------------------
-- 4. RLS
-- ---------------------------------------------------------------------
alter table public.rewards enable row level security;

-- rewards：用户可读自己（按 user_id 或 openid 暂以 user_id 为主）；管理员读写全部
drop policy if exists "rewards_select_self" on public.rewards;
create policy "rewards_select_self" on public.rewards
  for select using (auth.uid() = user_id or public.is_admin(auth.uid()));

drop policy if exists "rewards_insert_anon" on public.rewards;
create policy "rewards_insert_anon" on public.rewards
  for insert with check (true);   -- 下单接口用 anon/service 写入，开放 insert（订单无敏感信息）

drop policy if exists "rewards_update_admin" on public.rewards;
create policy "rewards_update_admin" on public.rewards
  for update using (public.is_admin(auth.uid()));

drop policy if exists "rewards_delete_admin" on public.rewards;
create policy "rewards_delete_admin" on public.rewards
  for delete using (public.is_admin(auth.uid()));

-- profiles：用户可读/写自己；管理员可读写全部（含 is_admin / whitelisted_*）
drop policy if exists "profiles_select_self_or_admin" on public.profiles;
create policy "profiles_select_self_or_admin" on public.profiles
  for select using (auth.uid() = id or public.is_admin(auth.uid()));

drop policy if exists "profiles_update_self_or_admin" on public.profiles;
create policy "profiles_update_self_or_admin" on public.profiles
  for update using (auth.uid() = id or public.is_admin(auth.uid()));

-- ---------------------------------------------------------------------
-- 5. 种子：把首个管理员设为指定邮箱（请改成你自己的管理员邮箱后执行）
--    把下面邮箱替换为你（咖总）的 Supabase 登录邮箱即可。
-- ---------------------------------------------------------------------
-- update public.profiles set is_admin = true
--   where id = (select id from auth.users where email = 'you@example.com');
