-- RLS Policies pour NotreTab
-- À coller dans Supabase Dashboard > SQL Editor et exécuter

-- ─── GROUPS ─────────────────────────────────────────────────────────────────
alter table groups enable row level security;

drop policy if exists "groups_select" on groups;
drop policy if exists "groups_insert" on groups;
drop policy if exists "groups_update" on groups;
drop policy if exists "groups_delete" on groups;

create policy "groups_select" on groups
  for select using (auth.uid() is not null);

create policy "groups_insert" on groups
  for insert with check (auth.uid() is not null);

create policy "groups_update" on groups
  for update using (auth.uid() is not null);

create policy "groups_delete" on groups
  for delete using (auth.uid() is not null);

-- ─── MEMBERS ────────────────────────────────────────────────────────────────
alter table members enable row level security;

drop policy if exists "members_select" on members;
drop policy if exists "members_insert" on members;
drop policy if exists "members_update" on members;
drop policy if exists "members_delete" on members;

create policy "members_select" on members
  for select using (auth.uid() is not null);

create policy "members_insert" on members
  for insert with check (auth.uid() is not null);

create policy "members_update" on members
  for update using (auth.uid() is not null);

create policy "members_delete" on members
  for delete using (auth.uid() is not null);

-- ─── EXPENSES ───────────────────────────────────────────────────────────────
alter table expenses enable row level security;

drop policy if exists "expenses_select" on expenses;
drop policy if exists "expenses_insert" on expenses;
drop policy if exists "expenses_update" on expenses;
drop policy if exists "expenses_delete" on expenses;

create policy "expenses_select" on expenses
  for select using (auth.uid() is not null);

create policy "expenses_insert" on expenses
  for insert with check (auth.uid() is not null);

create policy "expenses_update" on expenses
  for update using (auth.uid() is not null);

create policy "expenses_delete" on expenses
  for delete using (auth.uid() is not null);

-- ─── PAYMENTS ───────────────────────────────────────────────────────────────
alter table payments enable row level security;

drop policy if exists "payments_select" on payments;
drop policy if exists "payments_insert" on payments;
drop policy if exists "payments_update" on payments;
drop policy if exists "payments_delete" on payments;

create policy "payments_select" on payments
  for select using (auth.uid() is not null);

create policy "payments_insert" on payments
  for insert with check (auth.uid() is not null);

create policy "payments_update" on payments
  for update using (auth.uid() is not null);

create policy "payments_delete" on payments
  for delete using (auth.uid() is not null);

-- ─── REMINDERS ──────────────────────────────────────────────────────────────
alter table reminders enable row level security;

drop policy if exists "reminders_select" on reminders;
drop policy if exists "reminders_insert" on reminders;
drop policy if exists "reminders_update" on reminders;
drop policy if exists "reminders_delete" on reminders;

create policy "reminders_select" on reminders
  for select using (auth.uid() is not null);

create policy "reminders_insert" on reminders
  for insert with check (auth.uid() is not null);

create policy "reminders_update" on reminders
  for update using (auth.uid() is not null);

create policy "reminders_delete" on reminders
  for delete using (auth.uid() is not null);
