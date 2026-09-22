import { useEffect, useMemo, useState } from 'react';

type Empresa = {
  id: string;
  nome: string;
  documento: string | null;
  papel: 'admin' | 'operador';
  unidadesMesEstimadas: number;
  criadoEm: string;
};

type User = {
  id: string;
  nome: string;
  email: string;
};

type AuthResponse = {
  token: string;
  user: User;
  empresaAtual?: Empresa;
  empresas: Empresa[];
};

type Categoria = {
  id: string;
  nome: string;
  cor?: string | null;
  ativo: boolean;
};

type Produto = {
  id: string;
  nome: string;
  sku: string;
  descricao?: string;
  categoriaId?: string | null;
  custoUnitario: number;
  precoVenda: number;
  quantidadeAtual: number;
  estoqueMinimo: number;
  ativo: boolean;
};

const API_URL = 'http://localhost:3000';

export function App() {
  const [modo, setModo] = useState<'login' | 'cadastro'>('login');
  const [nome, setNome] = useState('Maria da Silva');
  const [email, setEmail] = useState('admin@gestta.com');
  const [senha, setSenha] = useState('12345678');
  const [empresaNome, setEmpresaNome] = useState('Empresa Demo');
  const [unidadesMesEstimadas, setUnidadesMesEstimadas] = useState(300);
  const [session, setSession] = useState<AuthResponse | null>(null);
  const [erro, setErro] = useState('');
  const [empresaSelecionada, setEmpresaSelecionada] = useState<string>('');
  const [aba, setAba] = useState<'visao-geral' | 'categorias' | 'produtos'>('visao-geral');
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [nomeCategoria, setNomeCategoria] = useState('');
  const [nomeProduto, setNomeProduto] = useState('');
  const [skuProduto, setSkuProduto] = useState('');
  const [categoriaProduto, setCategoriaProduto] = useState('');
  const [precoProduto, setPrecoProduto] = useState('');
  const [custoProduto, setCustoProduto] = useState('');
  const [estoqueMinimo, setEstoqueMinimo] = useState('');
  const [carregandoDados, setCarregandoDados] = useState(false);

  const empresasDisponiveis = useMemo(() => session?.empresas ?? [], [session]);

  useEffect(() => {
    if (!session || !empresaSelecionada) return;

    async function carregarDados() {
      setCarregandoDados(true);
      try {
        const headers = { Authorization: `Bearer ${session.token}`, 'x-empresa-id': empresaSelecionada };
        const [categoriasResponse, produtosResponse] = await Promise.all([
          fetch(`${API_URL}/categorias`, { headers }),
          fetch(`${API_URL}/produtos`, { headers }),
        ]);
        const categoriasData = await categoriasResponse.json();
        const produtosData = await produtosResponse.json();

        if (!categoriasResponse.ok) throw new Error(categoriasData.message || 'Não foi possível carregar categorias.');
        if (!produtosResponse.ok) throw new Error(produtosData.message || 'Não foi possível carregar produtos.');
        setCategorias(categoriasData);
        setProdutos(produtosData);
      } catch (error) {
        setErro(error instanceof Error ? error.message : 'Erro ao carregar dados da empresa.');
      } finally {
        setCarregandoDados(false);
      }
    }

    void carregarDados();
  }, [empresaSelecionada, session]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setErro('');

    const endpoint = modo === 'login' ? '/auth/login' : '/auth/register';
    const payload =
      modo === 'login'
        ? { email, senha }
        : {
            nome,
            email,
            senha,
            empresaNome,
            unidadesMesEstimadas,
            documento: null,
          };

    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Erro ao autenticar.');
      }

      setSession(data);
      setEmpresaSelecionada(data.empresaAtual?.id ?? data.empresas?.[0]?.id ?? '');
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro inesperado.');
    }
  }

  async function handleCriarEmpresa() {
    if (!session) return;

    try {
      const response = await fetch(`${API_URL}/empresas`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`,
        },
        body: JSON.stringify({
          nome: 'Nova Empresa',
          documento: null,
          unidadesMesEstimadas: 200,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Erro ao criar empresa.');
      }

      const nextSession = {
        ...session,
        empresas: [...(session.empresas ?? []), data],
        empresaAtual: data,
      };
      setSession(nextSession);
      setEmpresaSelecionada(data.id);
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao criar empresa.');
    }
  }

  async function criarCategoria(event: React.FormEvent) {
    event.preventDefault();
    if (!session || !empresaSelecionada || !nomeCategoria.trim()) return;
    setErro('');
    const response = await fetch(`${API_URL}/categorias`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}`, 'x-empresa-id': empresaSelecionada },
      body: JSON.stringify({ nome: nomeCategoria }),
    });
    const data = await response.json();
    if (!response.ok) return setErro(data.message || 'Erro ao criar categoria.');
    setCategorias((current) => [...current, data]);
    setNomeCategoria('');
  }

  async function criarProduto(event: React.FormEvent) {
    event.preventDefault();
    if (!session || !empresaSelecionada || !nomeProduto.trim() || !skuProduto.trim()) return;
    setErro('');
    const response = await fetch(`${API_URL}/produtos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}`, 'x-empresa-id': empresaSelecionada },
      body: JSON.stringify({
        nome: nomeProduto,
        sku: skuProduto,
        categoriaId: categoriaProduto || null,
        custoUnitario: Number(custoProduto || 0),
        precoVenda: Number(precoProduto || 0),
        estoqueMinimo: Number(estoqueMinimo || 0),
      }),
    });
    const data = await response.json();
    if (!response.ok) return setErro(data.message || 'Erro ao criar produto.');
    setProdutos((current) => [...current, data]);
    setNomeProduto('');
    setSkuProduto('');
    setCategoriaProduto('');
    setPrecoProduto('');
    setCustoProduto('');
    setEstoqueMinimo('');
  }

  async function inativar(tipo: 'categorias' | 'produtos', id: string) {
    if (!session || !empresaSelecionada) return;
    const response = await fetch(`${API_URL}/${tipo}/${id}/inativar`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${session.token}`, 'x-empresa-id': empresaSelecionada },
    });
    const data = await response.json();
    if (!response.ok) return setErro(data.message || 'Não foi possível inativar o registro.');
    if (tipo === 'categorias') setCategorias((current) => current.map((item) => item.id === id ? data : item));
    else setProdutos((current) => current.map((item) => item.id === id ? data : item));
  }

  const empresaAtual = empresasDisponiveis.find((empresa) => empresa.id === empresaSelecionada) ?? session?.empresaAtual ?? empresasDisponiveis[0];

  return (
    <main className="min-h-screen bg-slate-100 p-4 text-slate-900 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        {!session ? (
          <div className="mx-auto max-w-lg rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="mb-6 flex gap-2 rounded-lg bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setModo('login')}
                className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold ${modo === 'login' ? 'bg-white shadow-sm' : 'text-slate-500'}`}
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => setModo('cadastro')}
                className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold ${modo === 'cadastro' ? 'bg-white shadow-sm' : 'text-slate-500'}`}
              >
                Cadastro
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {modo === 'cadastro' && (
                <div>
                  <label htmlFor="nome" className="mb-1 block text-sm font-medium">Seu nome</label>
                  <input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
                </div>
              )}

              <div>
                <label htmlFor="email" className="mb-1 block text-sm font-medium">E-mail</label>
                <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
              </div>

              <div>
                <label htmlFor="senha" className="mb-1 block text-sm font-medium">Senha</label>
                <input id="senha" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
              </div>

              {modo === 'cadastro' && (
                <>
                  <div>
                    <label htmlFor="empresaNome" className="mb-1 block text-sm font-medium">Nome da empresa</label>
                    <input id="empresaNome" value={empresaNome} onChange={(e) => setEmpresaNome(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
                  </div>

                  <div>
                    <label htmlFor="unidadesMesEstimadas" className="mb-1 block text-sm font-medium">Estimativa de unidades/mês</label>
                    <input id="unidadesMesEstimadas" type="number" min={1} value={unidadesMesEstimadas} onChange={(e) => setUnidadesMesEstimadas(Number(e.target.value || 1))} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
                  </div>
                </>
              )}

              {erro && <p className="text-sm text-rose-600">{erro}</p>}

              <button type="submit" className="w-full rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-500">
                {modo === 'login' ? 'Entrar' : 'Criar conta'}
              </button>
            </form>
          </div>
        ) : (
          <>
            <header className="panel-header">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm text-slate-500">Bem-vindo(a)</p>
                  <h1 className="text-2xl font-bold">{session.user.nome}</h1>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={handleCriarEmpresa}
                    className="button button-light"
                  >
                    + Nova empresa
                  </button>
                  <button
                    type="button"
                    onClick={() => setSession(null)}
                    className="button button-quiet"
                  >
                    Sair
                  </button>
                </div>
              </div>
            </header>

            <section className="workspace-grid">
              <aside className="sidebar">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Empresas</h2>
                <div className="space-y-2">
                  {empresasDisponiveis.map((empresa) => (
                    <button
                      key={empresa.id}
                      type="button"
                      onClick={() => setEmpresaSelecionada(empresa.id)}
                      className={`company-choice ${empresaSelecionada === empresa.id ? 'company-choice-active' : ''}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">{empresa.nome}</span>
                        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-700">
                          {empresa.papel}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">{empresa.unidadesMesEstimadas} unidades/mês</p>
                    </button>
                  ))}
                </div>
              </aside>

              <div className="content-panel">
                {empresaAtual && (
                  <>
                    <div className="content-heading">
                      <div>
                        <p className="eyebrow">Empresa atual</p>
                        <h2>{empresaAtual.nome}</h2>
                      </div>
                      <span className="status-dot">{carregandoDados ? 'Atualizando...' : 'Sincronizado'}</span>
                    </div>
                    <nav className="tabs" aria-label="Módulos da empresa">
                      {([['visao-geral', 'Visão geral'], ['categorias', 'Categorias'], ['produtos', 'Produtos']] as const).map(([key, label]) => (
                        <button key={key} type="button" className={aba === key ? 'tab tab-active' : 'tab'} onClick={() => setAba(key)}>{label}</button>
                      ))}
                    </nav>

                    {erro && <p className="error-banner">{erro}</p>}

                    {aba === 'visao-geral' && <div className="metric-grid">
                      <div className="metric-card">
                        <p className="text-sm text-slate-500">Papel</p>
                        <p className="mt-2 text-xl font-semibold capitalize">{empresaAtual.papel}</p>
                      </div>
                      <div className="metric-card">
                        <p className="text-sm text-slate-500">Estimativa mensal</p>
                        <p className="mt-2 text-xl font-semibold">{empresaAtual.unidadesMesEstimadas}</p>
                      </div>
                      <div className="metric-card">
                        <p className="text-sm text-slate-500">Documento</p>
                        <p className="mt-2 text-xl font-semibold">{empresaAtual.documento ?? '—'}</p>
                      </div>
                      <div className="metric-card"><p className="text-sm text-slate-500">Categorias ativas</p><p className="mt-2 text-xl font-semibold">{categorias.filter((item) => item.ativo).length}</p></div>
                      <div className="metric-card"><p className="text-sm text-slate-500">Produtos ativos</p><p className="mt-2 text-xl font-semibold">{produtos.filter((item) => item.ativo).length}</p></div>
                    </div>}

                    {aba === 'categorias' && <div className="module-layout">
                      <form onSubmit={criarCategoria} className="form-card">
                        <div><p className="eyebrow">Cadastro</p><h3>Nova categoria</h3></div>
                        <input value={nomeCategoria} onChange={(event) => setNomeCategoria(event.target.value)} placeholder="Ex.: Bebidas" className="field" required />
                        <button type="submit" className="button button-primary">Adicionar categoria</button>
                      </form>
                      <div className="list-card"><div className="list-heading"><h3>Categorias da empresa</h3><span>{categorias.length} registros</span></div>
                        {categorias.length === 0 ? <p className="empty-state">Nenhuma categoria cadastrada ainda.</p> : categorias.map((categoria) => <div className="list-row" key={categoria.id}><div><strong>{categoria.nome}</strong><span className={categoria.ativo ? 'tag tag-active' : 'tag'}>{categoria.ativo ? 'Ativa' : 'Inativa'}</span></div>{categoria.ativo && <button type="button" className="action-link" onClick={() => void inativar('categorias', categoria.id)}>Inativar</button>}</div>)}
                      </div>
                    </div>}

                    {aba === 'produtos' && <div className="module-layout">
                      <form onSubmit={criarProduto} className="form-card product-form">
                        <div><p className="eyebrow">Cadastro</p><h3>Novo produto</h3></div>
                        <input value={nomeProduto} onChange={(event) => setNomeProduto(event.target.value)} placeholder="Nome do produto" className="field" required />
                        <input value={skuProduto} onChange={(event) => setSkuProduto(event.target.value)} placeholder="SKU" className="field" required />
                        <select value={categoriaProduto} onChange={(event) => setCategoriaProduto(event.target.value)} className="field"><option value="">Sem categoria</option>{categorias.filter((item) => item.ativo).map((categoria) => <option key={categoria.id} value={categoria.id}>{categoria.nome}</option>)}</select>
                        <div className="field-grid"><input type="number" min="0" step="0.01" value={custoProduto} onChange={(event) => setCustoProduto(event.target.value)} placeholder="Custo" className="field" /><input type="number" min="0" step="0.01" value={precoProduto} onChange={(event) => setPrecoProduto(event.target.value)} placeholder="Preço de venda" className="field" /></div>
                        <input type="number" min="0" value={estoqueMinimo} onChange={(event) => setEstoqueMinimo(event.target.value)} placeholder="Estoque mínimo" className="field" />
                        <button type="submit" className="button button-primary">Adicionar produto</button>
                      </form>
                      <div className="list-card"><div className="list-heading"><h3>Produtos da empresa</h3><span>{produtos.length} registros</span></div>
                        {produtos.length === 0 ? <p className="empty-state">Nenhum produto cadastrado ainda.</p> : produtos.map((produto) => <div className="list-row product-row" key={produto.id}><div><strong>{produto.nome}</strong><small>{produto.sku} · R$ {produto.precoVenda.toFixed(2)}</small></div><div className="row-actions"><span className={produto.ativo ? 'tag tag-active' : 'tag'}>{produto.ativo ? `${produto.quantidadeAtual} em estoque` : 'Inativo'}</span>{produto.ativo && <button type="button" className="action-link" onClick={() => void inativar('produtos', produto.id)}>Inativar</button>}</div></div>)}
                      </div>
                    </div>}
                  </>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
