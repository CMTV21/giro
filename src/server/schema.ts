/**
 * Ordered, append-only migrations. Never edit a shipped entry; add a new one instead.
 */
export const MIGRATIONS: string[][] = [
  [
    `create table users (
      id text primary key,
      email text not null unique,
      name text not null,
      password_hash text not null,
      home_currency text not null default 'CAD',
      home_airport text not null default '',
      taste jsonb,
      created_at timestamptz not null default now()
    )`,
    `create table sessions (
      id text primary key,
      user_id text not null references users(id) on delete cascade,
      expires_at timestamptz not null,
      created_at timestamptz not null default now()
    )`,
    `create index sessions_user_idx on sessions(user_id)`,
    `create table auth_attempts (
      key text not null,
      at timestamptz not null default now()
    )`,
    `create index auth_attempts_key_idx on auth_attempts(key, at)`,
    `create table trips (
      id text primary key,
      owner_id text not null references users(id) on delete cascade,
      data jsonb not null,
      version integer not null default 1,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )`,
    `create table trip_members (
      trip_id text not null references trips(id) on delete cascade,
      user_id text not null references users(id) on delete cascade,
      role text not null check (role in ('owner', 'editor', 'viewer')),
      joined_at timestamptz not null default now(),
      primary key (trip_id, user_id)
    )`,
    `create index trip_members_user_idx on trip_members(user_id)`,
    `create table trip_invites (
      token_hash text primary key,
      trip_id text not null references trips(id) on delete cascade,
      role text not null check (role in ('editor', 'viewer')),
      created_by text not null references users(id) on delete cascade,
      expires_at timestamptz not null,
      created_at timestamptz not null default now()
    )`,
    `create table votes (
      trip_id text not null references trips(id) on delete cascade,
      activity_id text not null,
      user_id text not null references users(id) on delete cascade,
      value smallint not null check (value in (-1, 1)),
      primary key (trip_id, activity_id, user_id)
    )`,
    `create table expenses (
      id text primary key,
      trip_id text not null references trips(id) on delete cascade,
      paid_by text not null references users(id) on delete cascade,
      amount numeric(12, 2) not null check (amount > 0),
      currency text not null,
      amount_usd numeric(12, 2) not null,
      description text not null,
      split_between jsonb not null,
      created_by text not null references users(id) on delete cascade,
      created_at timestamptz not null default now()
    )`,
    `create index expenses_trip_idx on expenses(trip_id)`,
    `create table clicks (
      id text primary key,
      user_id text references users(id) on delete set null,
      trip_id text,
      provider text not null,
      kind text not null,
      value_usd numeric(12, 2) not null default 0,
      expected_commission_usd numeric(12, 4) not null default 0,
      created_at timestamptz not null default now()
    )`,
    `create index clicks_created_idx on clicks(created_at)`,
  ],
  [
    `alter table users add column email_verified_at timestamptz`,
    `create table auth_tokens (
      token_hash text primary key,
      user_id text not null references users(id) on delete cascade,
      purpose text not null check (purpose in ('reset', 'verify')),
      expires_at timestamptz not null,
      used_at timestamptz,
      created_at timestamptz not null default now()
    )`,
    `create index auth_tokens_user_idx on auth_tokens(user_id, purpose)`,
  ],
  [
    `create table place_info (
      key text primary key,
      title text,
      description text,
      extract text,
      url text,
      thumbnail text,
      lat double precision,
      lon double precision,
      facts jsonb,
      source text not null,
      fetched_at timestamptz not null default now()
    )`,
    `create table receipts (
      id text primary key,
      trip_id text not null references trips(id) on delete cascade,
      expense_id text references expenses(id) on delete cascade,
      uploaded_by text not null references users(id) on delete cascade,
      mime text not null,
      size integer not null,
      name text not null,
      data bytea not null,
      created_at timestamptz not null default now()
    )`,
    `create index receipts_trip_idx on receipts(trip_id)`,
    `create index receipts_expense_idx on receipts(expense_id)`,
  ],
  [
    `alter table place_info add column photo jsonb`,
    // Earlier lookups could cache non-free thumbnails and always generated facts; refetch places
    // (not geocoded addresses) under the new rules.
    `delete from place_info where key not like 'addr:%'`,
  ],
  [
    // Secret per-trip links: a calendar feed URL and an email address for forwarding bookings.
    // Lowercase hex so they survive email systems that lowercase addresses.
    `create table trip_links (
      trip_id text not null references trips(id) on delete cascade,
      purpose text not null check (purpose in ('calendar', 'inbox')),
      token text not null unique,
      created_by text not null references users(id) on delete cascade,
      created_at timestamptz not null default now(),
      primary key (trip_id, purpose)
    )`,
  ],
  [
    // Confirmations forwarded to a trip's address. Mail from members is applied straight away;
    // anything else waits for a member to add or dismiss it.
    `create table trip_inbox (
      id text primary key,
      trip_id text not null references trips(id) on delete cascade,
      sender text not null,
      subject text not null,
      status text not null check (status in ('applied', 'pending', 'dismissed', 'empty', 'failed')),
      summary text not null default '',
      extracted jsonb,
      created_at timestamptz not null default now()
    )`,
    `create index trip_inbox_trip_idx on trip_inbox(trip_id, created_at)`,
  ],
  [
    // Paid lookups are cached so each place or route is fetched rarely.
    `create table place_hours (
      key text primary key,
      hours jsonb,
      maps_url text,
      fetched_at timestamptz not null default now()
    )`,
    `create table route_cache (
      key text primary key,
      minutes integer not null,
      km double precision not null,
      fetched_at timestamptz not null default now()
    )`,
  ],
  [
    // A matching bookable tour per stop and currency, refreshed weekly (prices move).
    `create table tour_cache (
      key text primary key,
      data jsonb,
      fetched_at timestamptz not null default now()
    )`,
  ],
];
