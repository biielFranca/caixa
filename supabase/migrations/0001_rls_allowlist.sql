-- Restringe o acesso a uma lista explícita de usuários autorizados.
--
-- Antes: as sete tabelas tinham a política "auth full access" com USING (true)
-- e WITH CHECK (true) para o papel `authenticated`. Como o cadastro público do
-- Supabase estava aberto e a chave publicável vai no bundle do navegador,
-- qualquer pessoa podia criar uma conta e ler, alterar ou apagar a folha de
-- pagamento e os lançamentos. Nenhuma conta indevida chegou a ser criada.
--
-- Depois: o acesso depende de estar em public.app_users. Para autorizar alguém
-- novo, insira a linha pelo painel do Supabase — o app não escreve nessa tabela.
--
-- Aplicado em produção em 2026-09-17.

create table if not exists public.app_users (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  nota       text,
  created_at timestamptz not null default now()
);

alter table public.app_users enable row level security;

insert into public.app_users (user_id, nota)
select id, 'conta existente na correção de segurança' from auth.users
on conflict (user_id) do nothing;

-- cada um enxerga apenas a própria linha
drop policy if exists "own row" on public.app_users;
create policy "own row" on public.app_users
  for select to authenticated using (user_id = (select auth.uid()));

grant select on public.app_users to authenticated;

-- SECURITY INVOKER de propósito: a política acima já limita o que a função lê,
-- então ela não precisa de privilégio elevado.
create or replace function public.is_app_user()
returns boolean language sql stable
set search_path = public
as $$ select exists (select 1 from public.app_users where user_id = (select auth.uid())) $$;

revoke execute on function public.is_app_user() from public, anon;
grant execute on function public.is_app_user() to authenticated;

do $$
declare t text;
begin
  foreach t in array array['day_shifts','days','descontos','employees','entries','platform_revenue','settings'] loop
    execute format('drop policy if exists "auth full access" on public.%I', t);
    execute format('create policy "app users only" on public.%I for all to authenticated using (public.is_app_user()) with check (public.is_app_user())', t);
  end loop;
end $$;
