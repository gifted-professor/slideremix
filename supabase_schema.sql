-- Create a table for public profiles
create table public.profiles (
  id uuid not null references auth.users on delete cascade,
  email text,
  updated_at timestamp with time zone,
  
  primary key (id)
);

alter table public.profiles enable row level security;

create policy "Public profiles are viewable by everyone."
  on profiles for select
  using ( true );

create policy "Users can insert their own profile."
  on profiles for insert
  with check ( auth.uid() = id );

create policy "Users can update own profile."
  on profiles for update
  using ( auth.uid() = id );

-- Function to handle new user signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, updated_at)
  values (new.id, new.email, now());
  return new;
end;
$$;

-- Trigger to call the function on new user creation
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ==========================================
-- Projects Table (SlideRemix Data)
-- ==========================================

create table public.projects (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  title text not null default 'Untitled Project',
  thumbnail_url text,
  slide_data jsonb,      -- Stores the main SlideData result
  element_settings jsonb, -- Stores user customizations (elementSettingsMap)
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Enable RLS
alter table public.projects enable row level security;

-- Policies
create policy "Users can view their own projects" 
  on projects for select 
  using (auth.uid() = user_id);

create policy "Users can create their own projects" 
  on projects for insert 
  with check (auth.uid() = user_id);

create policy "Users can update their own projects" 
  on projects for update 
  using (auth.uid() = user_id);

create policy "Users can delete their own projects" 
  on projects for delete 
  using (auth.uid() = user_id);
