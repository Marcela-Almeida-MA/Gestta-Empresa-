-- =====================================================================
-- MIGRATION 6 · PERMISSÕES (GRANTS)
--
-- Segunda camada de defesa, além do RLS:
--   * visitantes sem login (anon) não acessam NADA;
--   * usuários logados (authenticated) só executam as funções liberadas aqui;
--   * as funções de gatilho não ficam expostas como RPC.
-- =====================================================================


-- ---------------------------------------------------------------------
-- TABELAS
-- ---------------------------------------------------------------------
revoke all on all tables in schema public from anon;

grant select, insert, update, delete on all tables in schema public to authenticated;

-- Histórico imutável: nem por engano alguém altera ou apaga movimentações.
revoke update, delete on public.movimentacoes from authenticated;

-- Estas tabelas só mudam pelas funções criar_empresa() / excluir_empresa() e pelo gatilho de cadastro.
revoke insert, delete on public.empresas from authenticated;
revoke insert, delete on public.perfis   from authenticated;


-- ---------------------------------------------------------------------
-- FUNÇÕES
-- Começa fechando tudo e libera apenas o que o app precisa chamar.
-- ---------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;

-- Funções criadas no futuro também nascem fechadas
alter default privileges in schema public revoke execute on functions from public, anon;

-- Usadas pelas políticas de RLS (precisam ser executáveis pelo usuário logado)
grant execute on function public.empresas_do_usuario()          to authenticated;
grant execute on function public.papel_na_empresa(uuid)         to authenticated;
grant execute on function public.eh_admin_da_empresa(uuid)      to authenticated;

-- Chamadas pelo backend (RPC)
grant execute on function public.criar_empresa(text, integer, text)                       to authenticated;
grant execute on function public.excluir_empresa(uuid)                                    to authenticated;
grant execute on function public.registrar_movimentacao(uuid, text, integer, numeric, text, text) to authenticated;
grant execute on function public.despesas_fixas_mensais(uuid)                             to authenticated;
grant execute on function public.unidades_mes_para_rateio(uuid)                           to authenticated;

-- Dashboard (e apoio usado por ele)
grant execute on function public.inicio_do_dia(date)                                      to authenticated;
grant execute on function public.exigir_papel(uuid)                                       to authenticated;
grant execute on function public.dashboard_resumo(uuid, date, date, uuid)                 to authenticated;
grant execute on function public.dashboard_movimentacao_periodo(uuid, date, date, text, uuid) to authenticated;
grant execute on function public.dashboard_ranking_produtos(uuid, text, date, date, integer)  to authenticated;
grant execute on function public.dashboard_por_categoria(uuid, date, date)                to authenticated;
grant execute on function public.dashboard_produtos_parados(uuid, integer)                to authenticated;
