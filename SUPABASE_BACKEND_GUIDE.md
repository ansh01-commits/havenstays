# Supabase Backend Guide for Hotel PMS

This repository is currently frontend-only. It calls Supabase directly from the browser, so the real backend security and business logic must be implemented inside Supabase itself.

## 1. Recommended auth model

### 1.1 Create a `profiles` table
Use this to give hotel managers explicit access.

```sql
create table if not exists profiles (
  id uuid primary key references auth.users(id),
  email text,
  role text not null default 'staff',
  created_at timestamptz not null default now()
);
```

### 1.2 Assign manager roles
Insert a row for each manager user after sign-up or via the Supabase dashboard.

```sql
insert into profiles (id, email, role)
values
  ('<manager-uid-1>', 'manager@example.com', 'manager');
```

### 1.3 Helper function
Create a helper to reuse in policies.

```sql
create or replace function public.is_manager() returns boolean
language sql stable as $$
  select exists (
    select 1 from profiles
    where id = auth.uid()
      and role = 'manager'
  );
$$;
```

## 2. Table security and RLS
Enable RLS on every sensitive table and only allow manager access.

### 2.1 `rooms`
```sql
alter table rooms enable row level security;

create policy rooms_select_manager on rooms
  for select using (public.is_manager());

create policy rooms_write_manager on rooms
  for insert, update, delete with check (public.is_manager());
```

### 2.2 `guests`
```sql
alter table guests enable row level security;

create policy guests_select_manager on guests
  for select using (public.is_manager());

create policy guests_write_manager on guests
  for insert, update, delete with check (public.is_manager());
```

### 2.3 `bookings`
```sql
alter table bookings enable row level security;

create policy bookings_select_manager on bookings
  for select using (public.is_manager());

create policy bookings_write_manager on bookings
  for insert, update, delete with check (public.is_manager());
```

### 2.4 Views such as `occupied_rooms`
If you use views, also enable RLS on the underlying tables and only expose the view to managers. A view inherits table permission rules, but you still should control who can select it.

```sql
create or replace view occupied_rooms as
select
  b.id as booking_id,
  b.room_id,
  r.room_no,
  r.floor,
  r.type,
  r.status as room_status,
  g.id as guest_id,
  g.name as guest_name,
  g.mobile,
  b.checkin_date,
  b.checkout_date,
  b.tariff,
  b.paid_online,
  b.paid_cash,
  b.paid_agoda,
  b.total_amount,
  b.balance,
  b.no_days,
  b.occupancy_type,
  b.notes
from bookings b
join rooms r on r.id = b.room_id
join guests g on g.id = b.guest_id
where b.status = 'active';

-- If needed, grant select explicitly:
grant select on occupied_rooms to authenticated;
```

> Note: In Supabase, `authenticated` means any signed-in user. Use `profiles` + `is_manager()` to restrict to managers.

## 3. Storage security

### 3.1 Use a private storage bucket for ID photos
The current frontend uses a public URL. That is not safe for ID documents.

- Set the `id-photos` bucket to **private**.
- Do not rely on `getPublicUrl()` for sensitive files.
- Prefer signed URLs or server-side retrieval.

### 3.2 Recommended approach
Keep the uploaded path in the DB and generate a signed URL for display or download.

```js
const { data } = await supabase.storage
  .from('id-photos')
  .createSignedUrl(path, 60);
```

If you need stronger control, create a backend function to generate signed URLs.

## 4. Secure check-in transaction flow

The frontend currently does these actions separately:
- upload photo
- upsert guest
- insert booking
- update room status

Those should be one atomic backend operation.

### 4.1 Strong backend transaction using an RPC function
Use a Postgres function that validates input and updates related rows in one transaction.

```sql
create or replace function public.hotel_check_in(
  _mobile text,
  _name text,
  _room_id int,
  _occupancy_type text,
  _checkin_date date,
  _checkout_date date,
  _tariff numeric,
  _paid_online numeric,
  _paid_cash numeric,
  _paid_agoda numeric,
  _notes text,
  _id_photo_url text
)
returns table (
  booking_id int,
  guest_id int,
  room_id int,
  total_amount numeric,
  balance numeric
) as $$
declare
  guest_rec guests%rowtype;
  nights int;
  amount numeric;
begin
  if not public.is_manager() then
    raise exception 'Access denied';
  end if;

  if _checkout_date <= _checkin_date then
    raise exception 'Checkout date must be after check-in date';
  end if;

  select * into guest_rec from guests where mobile = _mobile;

  if guest_rec.id is null then
    insert into guests (name, mobile, id_photo_url)
    values (_name, _mobile, _id_photo_url)
    returning * into guest_rec;
  else
    update guests
      set name = _name,
          id_photo_url = coalesce(_id_photo_url, id_photo_url)
      where id = guest_rec.id;
  end if;

  select extract(day from _checkout_date - _checkin_date)::int into nights;
  amount := _tariff * greatest(nights, 0);

  insert into bookings (
    room_id,
    guest_id,
    occupancy_type,
    checkin_date,
    checkout_date,
    tariff,
    paid_online,
    paid_cash,
    paid_agoda,
    notes,
    status,
    total_amount,
    balance,
    no_days
  ) values (
    _room_id,
    guest_rec.id,
    _occupancy_type,
    _checkin_date,
    _checkout_date,
    _tariff,
    coalesce(_paid_online, 0),
    coalesce(_paid_cash, 0),
    coalesce(_paid_agoda, 0),
    nullif(trim(_notes), ''),
    'active',
    amount,
    amount - coalesce(_paid_online, 0) - coalesce(_paid_cash, 0) - coalesce(_paid_agoda, 0),
    nights
  ) returning id, room_id, total_amount, balance into booking_id, room_id, total_amount, balance;

  update rooms
    set status = 'occupied'
    where id = _room_id
      and status in ('available', 'cleaning');

  if not found then
    raise exception 'Room is not available for check-in';
  end if;

  return query select booking_id, guest_rec.id, room_id, total_amount, balance;
end;
$$ language plpgsql;
```

### 4.2 Why this is safer
- a single transaction prevents partial check-in state
- business rules are enforced in the database
- `total_amount`, `balance`, `no_days` are computed server-side
- room state is updated atomically with the booking

## 5. Checkout flow

Create a safe checkout function too.

```sql
create or replace function public.hotel_check_out(
  _booking_id int
) returns void as $$
begin
  if not public.is_manager() then
    raise exception 'Access denied';
  end if;

  update bookings
    set status = 'checked_out'
    where id = _booking_id
      and status = 'active';

  if not found then
    raise exception 'Booking not found or not active';
  end if;

  update rooms
    set status = 'cleaning'
    where id = (
      select room_id from bookings where id = _booking_id
    );
end;
$$ language plpgsql;
```

## 6. Field validation and computed columns

### 6.1 Compute amounts in the database
If your schema does not already compute these fields, add them in DB logic rather than client-side:
- `total_amount = tariff * no_days`
- `balance = total_amount - paid_online - paid_cash - paid_agoda`

### 6.2 Example generated column approach
```sql
alter table bookings
  add column no_days int generated always as (
    greatest(extract(day from checkout_date - checkin_date)::int, 0)
  ) stored;

alter table bookings
  add column total_amount numeric generated always as (
    tariff * no_days
  ) stored;

alter table bookings
  add column balance numeric generated always as (
    total_amount - coalesce(paid_online,0) - coalesce(paid_cash,0) - coalesce(paid_agoda,0)
  ) stored;
```

> If your current schema already calculates `total_amount`, `balance`, and `no_days` with triggers or generated columns, keep those as the source of truth.

## 7. Frontend integration notes

### 7.1 Use an RPC call for check-in
Once the DB function exists, replace the multi-step client flow with one RPC call.

```js
const { data, error } = await supabase.rpc('hotel_check_in', {
  _mobile: form.mobile.trim(),
  _name: form.name.trim(),
  _room_id: parseInt(form.room_id),
  _occupancy_type: form.occupancy_type,
  _checkin_date: form.checkin_date,
  _checkout_date: form.checkout_date,
  _tariff: parseFloat(form.tariff),
  _paid_online: parseFloat(form.paid_online) || 0,
  _paid_cash: parseFloat(form.paid_cash) || 0,
  _paid_agoda: parseFloat(form.paid_agoda) || 0,
  _notes: form.notes || null,
  _id_photo_url: photoUrl,
});
```

### 7.2 Keep auth gated
The frontend already blocks routes with `ProtectedRoute`, but backend must still enforce it via RLS and the `is_manager()` guard.

## 8. Summary of the safest backend setup

- Use Supabase Auth plus a `profiles` manager role
- Enable RLS on every table
- Restrict queries to `public.is_manager()`
- Move actual booking logic into a DB function or server-side routine
- Use a private storage bucket for ID photos
- Compute money and dates in DB
- Add a checkout endpoint or function

## 9. Next step

If you want, I can also help by converting your current client check-in flow into a secure `supabase.rpc` integration and adjusting the upload code for private storage.
