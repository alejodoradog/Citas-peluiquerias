-- Task 7.2, migration add_business_type: the kind of business chosen at
-- sign-up, kept in the barbershop and inherited by the owner's next ones.
begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(13);

select ok(
  has_column_privilege('authenticated', 'public.barbershops', 'business_type', 'SELECT')
    and not has_column_privilege('authenticated', 'public.barbershops', 'business_type', 'UPDATE')
    and not has_column_privilege('authenticated', 'public.barbershops', 'business_type_other', 'UPDATE'),
  'an owner reads the kind of their business and cannot change it from the browser'
);
select ok(
  not has_column_privilege('anon', 'public.barbershops', 'business_type', 'SELECT')
    and not has_column_privilege('anon', 'public.barbershops', 'business_type_other', 'SELECT'),
  'the public cannot read it'
);

insert into auth.users (id, email, raw_user_meta_data) values (
  '00000000-0000-0000-0000-0000000065a1', 'dentista@example.com',
  '{"owner_name": "Diana Dientes", "barbershop_name": "Sonrisas", "barbershop_slug": "tipo-65-dentista",
    "phone": "+573001230651", "business_type": "dentistry", "business_type_other": "No aplica"}'
), (
  '00000000-0000-0000-0000-0000000065a2', 'otro@example.com',
  '{"owner_name": "Omar Otro", "barbershop_name": "Tinta", "barbershop_slug": "tipo-65-otro",
    "phone": "+573001230652", "business_type": "other", "business_type_other": "  Estudio de tatuajes  "}'
), (
  '00000000-0000-0000-0000-0000000065a3', 'sin-tipo@example.com',
  '{"owner_name": "Sara Sin", "barbershop_name": "Sin tipo", "barbershop_slug": "tipo-65-sin",
    "phone": "+573001230653"}'
), (
  '00000000-0000-0000-0000-0000000065a4', 'inventado@example.com',
  '{"owner_name": "Ivan Inventa", "barbershop_name": "Inventado", "barbershop_slug": "tipo-65-inventado",
    "phone": "+573001230654", "business_type": "casino", "business_type_other": "Casino"}'
);
insert into auth.users (id, email, raw_user_meta_data) values (
  '00000000-0000-0000-0000-0000000065a5', 'largo@example.com',
  jsonb_build_object(
    'owner_name', 'Lina Larga', 'barbershop_name', 'Largo', 'barbershop_slug', 'tipo-65-largo',
    'phone', '+573001230655', 'business_type', 'other', 'business_type_other', repeat('a', 200))
), (
  '00000000-0000-0000-0000-0000000065a6', 'otro-vacio@example.com',
  jsonb_build_object(
    'owner_name', 'Vera Vacia', 'barbershop_name', 'Vacio', 'barbershop_slug', 'tipo-65-vacio',
    'phone', '+573001230656', 'business_type', 'other', 'business_type_other', '   ')
);

select is(
  (select row(business_type, business_type_other)::text from public.barbershops where slug = 'tipo-65-dentista'),
  '(dentistry,)', 'the barbershop keeps the kind chosen at sign-up, and no text when it is not "other"'
);
select is(
  (select row(business_type, business_type_other)::text from public.barbershops where slug = 'tipo-65-otro'),
  '(other,"Estudio de tatuajes")', '"other" keeps what the owner wrote, trimmed'
);
select is(
  (select row(business_type, business_type_other)::text from public.barbershops where slug = 'tipo-65-sin'),
  '(,)', 'an account without a kind keeps nothing'
);
select is(
  (select row(business_type, business_type_other)::text from public.barbershops where slug = 'tipo-65-inventado'),
  '(,)', 'a kind that does not exist is ignored, and the account is still created'
);
select is(
  (select row(business_type, char_length(business_type_other))::text from public.barbershops where slug = 'tipo-65-largo'),
  '(other,60)', 'a long text is cut to 60 characters'
);
select is(
  (select row(business_type, business_type_other)::text from public.barbershops where slug = 'tipo-65-vacio'),
  '(other,)', '"other" with only spaces keeps no text'
);

-- Metadata sent by hand, with line breaks and the character that reverses
-- the text (U+202E).
insert into auth.users (id, email, raw_user_meta_data) values (
  '00000000-0000-0000-0000-0000000065a7', 'raro@example.com',
  jsonb_build_object(
    'owner_name', 'Rita Rara', 'barbershop_name', 'Raro', 'barbershop_slug', 'tipo-65-raro',
    'phone', '+573001230657', 'business_type', 'other',
    'business_type_other', 'Estudio' || chr(10) || chr(9) || 'de' || chr(8238) || '  tatuajes' || chr(8203))
);
select is(
  (select business_type_other from public.barbershops where slug = 'tipo-65-raro'),
  'Estudio de tatuajes', 'the text is kept as plain text on one line, without invisible characters'
);
select throws_ok(
  format(
    $$update public.barbershops set business_type_other = %L where slug = 'tipo-65-raro'$$,
    'Estudio' || chr(8238) || 'x'
  ),
  '23514', null, 'and the table refuses one that carries them'
);

select throws_ok(
  $$update public.barbershops set business_type_other = 'Algo' where slug = 'tipo-65-dentista'$$,
  '23514', null, 'the text is only for "other"'
);

-- The owner's next barbershop, as create_barbershop makes it: the row, then
-- the membership.
insert into public.barbershops (id, name, slug, expires_on) values
  ('00000000-0000-0000-0000-0000000065b1', 'Tinta Norte', 'tipo-65-otro-norte', current_date + 10),
  ('00000000-0000-0000-0000-0000000065b2', 'Sin tipo Sur', 'tipo-65-sin-sur', current_date + 10);
insert into public.memberships (user_id, barbershop_id, role) values
  ('00000000-0000-0000-0000-0000000065a2', '00000000-0000-0000-0000-0000000065b1', 'owner'),
  ('00000000-0000-0000-0000-0000000065a3', '00000000-0000-0000-0000-0000000065b2', 'owner');
select is(
  (select row(business_type, business_type_other)::text from public.barbershops where slug = 'tipo-65-otro-norte'),
  '(other,"Estudio de tatuajes")', 'a new barbershop takes the kind of the owner''s first one'
);
select is(
  (select row(business_type, business_type_other)::text from public.barbershops where slug = 'tipo-65-sin-sur'),
  '(,)', 'and nothing when the first one has no kind'
);

select * from finish();
rollback;
