-- Profiles (extends Supabase auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text not null default '',
  avatar_url text,
  role text not null default 'member' check (role in ('admin', 'manager', 'member')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Public profiles viewable by authenticated users"
  on public.profiles for select
  to authenticated
  using (true);

create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Activities
create table public.activities (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  description text,
  status text not null default 'planned' check (status in ('planned', 'in_progress', 'completed', 'on_hold', 'cancelled')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'critical')),
  start_date date,
  deadline date,
  person_in_charge uuid references public.profiles(id),
  resources text,
  total_budget numeric(12,2) default 0,
  spent_budget numeric(12,2) default 0,
  created_by uuid references public.profiles(id) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.activities enable row level security;

create policy "Activities viewable by authenticated"
  on public.activities for select to authenticated using (true);
create policy "Activities insertable by authenticated"
  on public.activities for insert to authenticated with check (auth.uid() = created_by);
create policy "Activities updatable by authenticated"
  on public.activities for update to authenticated using (true);
create policy "Activities deletable by creator or admin"
  on public.activities for delete to authenticated
  using (auth.uid() = created_by or exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  ));

-- Budget Lines
create table public.budget_lines (
  id uuid default gen_random_uuid() primary key,
  activity_id uuid references public.activities(id) on delete cascade not null,
  description text not null,
  category text not null default 'general',
  amount numeric(12,2) not null default 0,
  spent numeric(12,2) not null default 0,
  created_by uuid references public.profiles(id) not null,
  created_at timestamptz not null default now()
);

alter table public.budget_lines enable row level security;

create policy "Budget lines viewable by authenticated"
  on public.budget_lines for select to authenticated using (true);
create policy "Budget lines insertable by authenticated"
  on public.budget_lines for insert to authenticated with check (auth.uid() = created_by);
create policy "Budget lines updatable by authenticated"
  on public.budget_lines for update to authenticated using (true);
create policy "Budget lines deletable by creator"
  on public.budget_lines for delete to authenticated using (auth.uid() = created_by);

-- Tasks
create table public.tasks (
  id uuid default gen_random_uuid() primary key,
  activity_id uuid references public.activities(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'review', 'done')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'critical')),
  assigned_to uuid references public.profiles(id),
  created_by uuid references public.profiles(id) not null,
  due_date date,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tasks enable row level security;

create policy "Tasks viewable by authenticated"
  on public.tasks for select to authenticated using (true);
create policy "Tasks insertable by authenticated"
  on public.tasks for insert to authenticated with check (auth.uid() = created_by);
create policy "Tasks updatable by authenticated"
  on public.tasks for update to authenticated using (true);
create policy "Tasks deletable by creator"
  on public.tasks for delete to authenticated using (auth.uid() = created_by);

-- Task Comments (for solving tasks / discussion)
create table public.task_comments (
  id uuid default gen_random_uuid() primary key,
  task_id uuid references public.tasks(id) on delete cascade not null,
  author_id uuid references public.profiles(id) not null,
  content text not null,
  created_at timestamptz not null default now()
);

alter table public.task_comments enable row level security;

create policy "Comments viewable by authenticated"
  on public.task_comments for select to authenticated using (true);
create policy "Comments insertable by authenticated"
  on public.task_comments for insert to authenticated with check (auth.uid() = author_id);
create policy "Comments deletable by author"
  on public.task_comments for delete to authenticated using (auth.uid() = author_id);

-- Messages (staff communication)
create table public.messages (
  id uuid default gen_random_uuid() primary key,
  sender_id uuid references public.profiles(id) not null,
  channel text not null default 'general',
  content text not null,
  created_at timestamptz not null default now()
);

alter table public.messages enable row level security;

create policy "Messages viewable by authenticated"
  on public.messages for select to authenticated using (true);
create policy "Messages insertable by authenticated"
  on public.messages for insert to authenticated with check (auth.uid() = sender_id);

-- Enable realtime for messages and task_comments
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.task_comments;
alter publication supabase_realtime add table public.tasks;

-- Updated_at triggers
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger set_activities_updated_at before update on public.activities
  for each row execute function public.set_updated_at();
create trigger set_tasks_updated_at before update on public.tasks
  for each row execute function public.set_updated_at();
