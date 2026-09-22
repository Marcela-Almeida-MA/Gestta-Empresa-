import { useEffect, useMemo, useState } from 'react';

type Empresa = {
  id: string;
  nome: string;
  documento: string | null;
  papel: 'admin' | 'operador';
  unidadesMesEstimadas: number;
  criadoEm: string;
  fotoUrl?: string | null;
  descricao?: string;
  slogan?: string;
  paleta?: 'folha' | 'oceano' | 'grafite' | 'terracota';
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

type DashboardResumo = {
  unidadesEntrada: number;
  unidadesSaida: number;
  saldoUnidades: number;
  produtosEstoqueBaixo: number;
  financeiro: { totalEntradas: number; totalSaidas: number; valorEmEstoque: number; lucroBruto: number };
};

type ResultadoPrecificacao = {
  custoProduto: number;
  despesasAdicionais: number;
  unidadesMes: number;
  custoFixoUnitario: number;
  precoBase: number;
  lucroPercentual: number;
  precoSugerido: number;
  alertas: string[];
};

type Movimentacao = {
  id: string;
  produtoId: string;
  tipo: 'entrada' | 'saida';
  quantidade: number;
  valorUnitario: number;
  motivo: string;
  criadoEm: string;
};

const API_URL = 'http://localhost:3000';

const PALETAS = {
  folha: { nome: 'Folha', accent: '#236d42', accentStrong: '#174b2d', soft: '#eef8f0', ink: '#173a25' },
  oceano: { nome: 'Oceano', accent: '#17658a', accentStrong: '#10445e', soft: '#edf7fb', ink: '#123746' },
  grafite: { nome: 'Grafite', accent: '#4b5563', accentStrong: '#27303b', soft: '#f1f3f5', ink: '#252b33' },
  terracota: { nome: 'Terracota', accent: '#a45239', accentStrong: '#713528', soft: '#fff3ee', ink: '#48231b' },
} as const;

export function App() { // NOSONAR - componente raiz compõe as áreas autenticada e pública.
  const [modo, setModo] = useState<'login' | 'cadastro'>('login');
  const [nome, setNome] = useState('Maria da Silva');
  const [email, setEmail] = useState('admin@gestta.com');
  const [senha, setSenha] = useState('12345678');
  const [empresaNome, setEmpresaNome] = useState('Empresa Demo');
  const [unidadesMesEstimadas, setUnidadesMesEstimadas] = useState(300);
  const [session, setSession] = useState<AuthResponse | null>(null);
  const [erro, setErro] = useState('');
  const [empresaSelecionada, setEmpresaSelecionada] = useState<string>('');
  const [aba, setAba] = useState<'visao-geral' | 'categorias' | 'produtos' | 'precificacao'>('visao-geral');
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [nomeCategoria, setNomeCategoria] = useState('');
  const [nomeProduto, setNomeProduto] = useState('');
  const [skuProduto, setSkuProduto] = useState('');
  const [categoriaProduto, setCategoriaProduto] = useState('');
  const [precoProduto, setPrecoProduto] = useState('');
  const [custoProduto, setCustoProduto] = useState('');
  const [estoqueMinimo, setEstoqueMinimo] = useState('');
  const [estoqueInicial, setEstoqueInicial] = useState('');
  const [fotoProduto, setFotoProduto] = useState<string | null>(null);
  const [movimentacaoEditando, setMovimentacaoEditando] = useState<string | null>(null);
  const [movimentacaoTipoEditando, setMovimentacaoTipoEditando] = useState<'entrada' | 'saida'>('entrada');
  const [movimentacaoQuantidadeEditando, setMovimentacaoQuantidadeEditando] = useState('');
  const [carregandoDados, setCarregandoDados] = useState(false);
  const [resumo, setResumo] = useState<DashboardResumo | null>(null);
  const [produtoMovimentacao, setProdutoMovimentacao] = useState('');
  const [tipoMovimentacao, setTipoMovimentacao] = useState<'entrada' | 'saida'>('entrada');
  const [quantidadeMovimentacao, setQuantidadeMovimentacao] = useState('');
  const [despesasFixas, setDespesasFixas] = useState<{ id: string; descricao: string; valorMensal: number }[]>([]);
  const [despesaDescricao, setDespesaDescricao] = useState('');
  const [despesaValor, setDespesaValor] = useState('');
  const [adicionalDescricao, setAdicionalDescricao] = useState('');
  const [adicionalValor, setAdicionalValor] = useState('');
  const [produtoPrecificacao, setProdutoPrecificacao] = useState('');
  const [lucroPercentual, setLucroPercentual] = useState('30');
  const [resultadoPrecificacao, setResultadoPrecificacao] = useState<ResultadoPrecificacao | null>(null);
  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>([]);
  const [empresaFormAberto, setEmpresaFormAberto] = useState(false);
  const [empresaEditando, setEmpresaEditando] = useState(false);
  const [empresaFormNome, setEmpresaFormNome] = useState('');
  const [empresaFormDocumento, setEmpresaFormDocumento] = useState('');
  const [empresaFormUnidades, setEmpresaFormUnidades] = useState('200');
  const [empresaFormFoto, setEmpresaFormFoto] = useState<string | null>(null);
  const [empresaFormDescricao, setEmpresaFormDescricao] = useState('');
  const [empresaFormSlogan, setEmpresaFormSlogan] = useState('');
  const [empresaFormPaleta, setEmpresaFormPaleta] = useState<keyof typeof PALETAS>('folha');

  const empresasDisponiveis = useMemo(() => session?.empresas ?? [], [session]);

  useEffect(() => {
    const token = session?.token;
    if (!token || !empresaSelecionada) return;

    async function carregarDados() {
      setCarregandoDados(true);
      try {
        const headers = { Authorization: `Bearer ${token}`, 'x-empresa-id': empresaSelecionada };
        const [categoriasResponse, produtosResponse, resumoResponse, fixasResponse, movimentacoesResponse] = await Promise.all([
          fetch(`${API_URL}/categorias`, { headers }),
          fetch(`${API_URL}/produtos`, { headers }),
          fetch(`${API_URL}/dashboard/resumo`, { headers }),
          fetch(`${API_URL}/despesas-fixas`, { headers }),
          fetch(`${API_URL}/dashboard/movimentacoes`, { headers }),
        ]);
        const categoriasData = await categoriasResponse.json();
        const produtosData = await produtosResponse.json();
        const resumoData = await resumoResponse.json();
        const fixasData = await fixasResponse.json();
        const movimentacoesData = await movimentacoesResponse.json();

        if (!categoriasResponse.ok) throw new Error(categoriasData.message || 'Não foi possível carregar categorias.');
        if (!produtosResponse.ok) throw new Error(produtosData.message || 'Não foi possível carregar produtos.');
        if (!resumoResponse.ok) throw new Error(resumoData.message || 'Não foi possível carregar o dashboard.');
        if (!fixasResponse.ok) throw new Error(fixasData.message || 'Não foi possível carregar despesas fixas.');
        if (!movimentacoesResponse.ok) throw new Error(movimentacoesData.message || 'Não foi possível carregar movimentações.');
        setCategorias(categoriasData);
        setProdutos(produtosData);
        setResumo(resumoData);
        setDespesasFixas(fixasData);
        setMovimentacoes(movimentacoesData);
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

  function abrirNovaEmpresa() {
    setEmpresaEditando(false);
    setEmpresaFormNome('');
    setEmpresaFormDocumento('');
    setEmpresaFormUnidades('200');
    setEmpresaFormFoto(null);
    setEmpresaFormDescricao('');
    setEmpresaFormSlogan('');
    setEmpresaFormPaleta('folha');
    setEmpresaFormAberto(true);
  }

  function abrirEdicaoEmpresa() {
    if (!empresaAtual) return;
    setEmpresaEditando(true);
    setEmpresaFormNome(empresaAtual.nome);
    setEmpresaFormDocumento(empresaAtual.documento ?? '');
    setEmpresaFormUnidades(String(empresaAtual.unidadesMesEstimadas));
    setEmpresaFormFoto(empresaAtual.fotoUrl ?? null);
    setEmpresaFormDescricao(empresaAtual.descricao ?? '');
    setEmpresaFormSlogan(empresaAtual.slogan ?? '');
    setEmpresaFormPaleta(empresaAtual.paleta ?? 'folha');
    setEmpresaFormAberto(true);
  }

  function selecionarFoto(event: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = event.target.files?.[0];
    if (!arquivo) return;
    const leitor = new FileReader();
    leitor.onload = () => setEmpresaFormFoto(typeof leitor.result === 'string' ? leitor.result : null);
    leitor.readAsDataURL(arquivo);
  }

  function selecionarFotoProduto(event: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = event.target.files?.[0];
    if (!arquivo) return;
    const leitor = new FileReader();
    leitor.onload = () => setFotoProduto(typeof leitor.result === 'string' ? leitor.result : null);
    leitor.readAsDataURL(arquivo);
  }

  async function salvarEmpresa(event: React.FormEvent) {
    event.preventDefault();
    if (!session || !empresaFormNome.trim()) return;
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}`, ...(empresaEditando ? { 'x-empresa-id': empresaSelecionada } : {}) };
    const response = await fetch(`${API_URL}/empresas${empresaEditando ? '/atual' : ''}`, {
      method: empresaEditando ? 'PATCH' : 'POST',
      headers,
      body: JSON.stringify({ nome: empresaFormNome, documento: empresaFormDocumento || null, unidadesMesEstimadas: Number(empresaFormUnidades || 1), fotoUrl: empresaFormFoto, descricao: empresaFormDescricao, slogan: empresaFormSlogan, paleta: empresaFormPaleta }),
    });
    const data = await response.json();
    if (!response.ok) return setErro(data.message || 'Não foi possível salvar a empresa.');
    const empresas = empresaEditando ? session.empresas.map((empresa) => empresa.id === data.id ? data : empresa) : [...session.empresas, data];
    setSession({ ...session, empresas, empresaAtual: data });
    setEmpresaSelecionada(data.id);
    setEmpresaFormAberto(false);
  }

  function imprimirRelatorio() {
    if (!empresaAtual) return;
    const nomeResponsavel = 'Usuário autenticado';
    const linhas = produtos.map((produto) => `<tr><td>${produto.nome}</td><td>${produto.sku}</td><td>${produto.quantidadeAtual}</td><td>${produto.estoqueMinimo}</td><td>R$ ${produto.custoUnitario.toFixed(2)}</td><td>R$ ${produto.precoVenda.toFixed(2)}</td></tr>`).join('');
    const nomesProdutos = new Map(produtos.map((produto) => [produto.id, produto.nome]));
    const linhasMovimentacoes = movimentacoes.map((movimentacao) => `<tr><td>${new Date(movimentacao.criadoEm).toLocaleString('pt-BR')}</td><td>${nomesProdutos.get(movimentacao.produtoId) ?? 'Produto'}</td><td>${movimentacao.tipo === 'entrada' ? 'Entrada' : 'Saída'}</td><td>${movimentacao.motivo}</td><td>${movimentacao.quantidade}</td><td>R$ ${(movimentacao.quantidade * movimentacao.valorUnitario).toFixed(2)}</td></tr>`).join('');
    const fotoRelatorio = empresaAtual.fotoUrl ? `<img src="${empresaAtual.fotoUrl}" style="width:64px;height:64px;object-fit:cover;border-radius:12px;float:right" />` : '';
    const janela = window.open('', '_blank');
    if (!janela) return;
    janela.document.documentElement.innerHTML = `<head><title>Relatório - ${empresaAtual.nome}</title><style>@page{size:A4;margin:18mm}body{font-family:Arial;color:#173a25;padding:4px}header{border-bottom:4px solid ${PALETAS[empresaAtual.paleta ?? 'folha'].accent};padding-bottom:18px;margin-bottom:20px}h1{margin:0 0 5px;font-size:28px}h2{font-size:15px;color:${PALETAS[empresaAtual.paleta ?? 'folha'].accent};margin:22px 0 8px}p{color:#557062;line-height:1.5}.meta{display:grid;grid-template-columns:1fr 1fr;gap:8px;background:${PALETAS[empresaAtual.paleta ?? 'folha'].soft};padding:14px;border-radius:8px}.metricas{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:16px 0}.metricas div{border:1px solid #d5e1d8;padding:12px;border-radius:7px}.metricas strong{display:block;font-size:18px;margin-top:5px}table{border-collapse:collapse;width:100%;margin-top:10px;font-size:11px}th,td{border:1px solid #d5e1d8;padding:8px;text-align:left}th{background:${PALETAS[empresaAtual.paleta ?? 'folha'].soft};color:${PALETAS[empresaAtual.paleta ?? 'folha'].ink}}footer{margin-top:30px;border-top:1px solid #d5e1d8;padding-top:12px;color:#718278;font-size:10px}</style></head><body><header>${fotoRelatorio}<h1>${empresaAtual.nome}</h1><h2>${empresaAtual.slogan || 'Relatório empresarial'}</h2><p>${empresaAtual.descricao || 'Relatório consolidado de estoque e movimentações.'}</p></header><div class="meta"><span><b>Documento:</b> ${empresaAtual.documento || 'Não informado'}</span><span><b>Estimativa mensal:</b> ${empresaAtual.unidadesMesEstimadas} unidades</span><span><b>Gerado em:</b> ${new Date().toLocaleString('pt-BR')}</span><span><b>Responsável:</b> ${nomeResponsavel}</span></div><div class="metricas"><div>Entradas<strong>${resumo?.unidadesEntrada ?? 0} un.</strong></div><div>Saídas<strong>${resumo?.unidadesSaida ?? 0} un.</strong></div><div>Estoque baixo<strong>${resumo?.produtosEstoqueBaixo ?? 0}</strong></div><div>Lucro bruto<strong>R$ ${(resumo?.financeiro.lucroBruto ?? 0).toFixed(2)}</strong></div></div><h2>Posição de estoque</h2><table><thead><tr><th>Produto</th><th>SKU</th><th>Atual</th><th>Mínimo</th><th>Custo</th><th>Venda</th></tr></thead><tbody>${linhas || '<tr><td colspan="6">Nenhum produto cadastrado</td></tr>'}</tbody></table><h2>Movimentações de entrada e saída</h2><table><thead><tr><th>Data</th><th>Produto</th><th>Tipo</th><th>Motivo</th><th>Qtd.</th><th>Valor</th></tr></thead><tbody>${linhasMovimentacoes || '<tr><td colspan="6">Nenhuma movimentação no período.</td></tr>'}</tbody></table><footer>Documento gerado pelo Gestta Empresa+ • Estoque, movimentações e controle financeiro</footer></body>`;
    janela.print();
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
        quantidadeInicial: Number(estoqueInicial || 0),
        fotoUrl: fotoProduto,
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
    setEstoqueInicial('');
    setFotoProduto(null);
    const headers = { Authorization: `Bearer ${session.token}`, 'x-empresa-id': empresaSelecionada };
    const [resumoResponse, movimentacoesResponse] = await Promise.all([
      fetch(`${API_URL}/dashboard/resumo`, { headers }),
      fetch(`${API_URL}/dashboard/movimentacoes`, { headers }),
    ]);
    if (resumoResponse.ok) setResumo(await resumoResponse.json());
    if (movimentacoesResponse.ok) setMovimentacoes(await movimentacoesResponse.json());
  }

  function iniciarEdicaoMovimentacao(movimentacao: Movimentacao) {
    setMovimentacaoEditando(movimentacao.id);
    setMovimentacaoTipoEditando(movimentacao.tipo);
    setMovimentacaoQuantidadeEditando(String(movimentacao.quantidade));
  }

  async function salvarEdicaoMovimentacao(movimentacao: Movimentacao) {
    if (!session || !empresaSelecionada) return;
    const response = await fetch(`${API_URL}/dashboard/movimentacoes/${movimentacao.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}`, 'x-empresa-id': empresaSelecionada },
      body: JSON.stringify({ tipo: movimentacaoTipoEditando, quantidade: Number(movimentacaoQuantidadeEditando) }),
    });
    const data = await response.json();
    if (!response.ok) return setErro(data.message || 'Não foi possível editar a movimentação.');
    setMovimentacoes((current) => current.map((item) => item.id === data.id ? data : item));
    setMovimentacaoEditando(null);
    const headers = { Authorization: `Bearer ${session.token}`, 'x-empresa-id': empresaSelecionada };
    const [produtosResponse, resumoResponse] = await Promise.all([
      fetch(`${API_URL}/produtos`, { headers }),
      fetch(`${API_URL}/dashboard/resumo`, { headers }),
    ]);
    if (produtosResponse.ok) setProdutos(await produtosResponse.json());
    if (resumoResponse.ok) setResumo(await resumoResponse.json());
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

  async function registrarMovimentacao(event: React.FormEvent) {
    event.preventDefault();
    if (!session || !empresaSelecionada || !produtoMovimentacao || !quantidadeMovimentacao) return;
    setErro('');
    const quantidade = Number(quantidadeMovimentacao);
    const response = await fetch(`${API_URL}/dashboard/movimentacoes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}`, 'x-empresa-id': empresaSelecionada },
      body: JSON.stringify({ produtoId: produtoMovimentacao, tipo: tipoMovimentacao, quantidade }),
    });
    const data = await response.json();
    if (!response.ok) return setErro(data.message || 'Não foi possível registrar a movimentação.');
    setProdutos((current) => current.map((produto) => produto.id === produtoMovimentacao
      ? { ...produto, quantidadeAtual: produto.quantidadeAtual + (tipoMovimentacao === 'entrada' ? quantidade : -quantidade) }
      : produto));
    setProdutoMovimentacao('');
    setQuantidadeMovimentacao('');
    const headers = { Authorization: `Bearer ${session.token}`, 'x-empresa-id': empresaSelecionada };
    const resumoResponse = await fetch(`${API_URL}/dashboard/resumo`, { headers });
    if (resumoResponse.ok) setResumo(await resumoResponse.json());
  }

  async function criarDespesaFixa(event: React.FormEvent) {
    event.preventDefault();
    if (!session || !empresaSelecionada || !despesaDescricao.trim()) return;
    const response = await fetch(`${API_URL}/despesas-fixas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}`, 'x-empresa-id': empresaSelecionada },
      body: JSON.stringify({ descricao: despesaDescricao, valorMensal: Number(despesaValor || 0) }),
    });
    const data = await response.json();
    if (!response.ok) return setErro(data.message || 'Não foi possível criar a despesa fixa.');
    setDespesasFixas((current) => [...current, data]);
    setDespesaDescricao('');
    setDespesaValor('');
  }

  async function simularPreco(event: React.FormEvent) {
    event.preventDefault();
    if (!session || !empresaSelecionada || !produtoPrecificacao) return;
    const response = await fetch(`${API_URL}/produtos/${produtoPrecificacao}/precificacao/simular`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}`, 'x-empresa-id': empresaSelecionada },
      body: JSON.stringify({ lucroPercentual: Number(lucroPercentual || 0) }),
    });
    const data = await response.json();
    if (!response.ok) return setErro(data.message || 'Não foi possível simular o preço.');
    setResultadoPrecificacao(data);
  }

  async function criarDespesaAdicional() {
    if (!session || !empresaSelecionada || !produtoPrecificacao || !adicionalDescricao.trim()) return;
    const response = await fetch(`${API_URL}/produtos/${produtoPrecificacao}/despesas-adicionais`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}`, 'x-empresa-id': empresaSelecionada },
      body: JSON.stringify({ descricao: adicionalDescricao, valor: Number(adicionalValor || 0) }),
    });
    const data = await response.json();
    if (!response.ok) return setErro(data.message || 'Não foi possível adicionar a embalagem.');
    setAdicionalDescricao('');
    setAdicionalValor('');
    setResultadoPrecificacao(null);
  }

  const empresaAtual = empresasDisponiveis.find((empresa) => empresa.id === empresaSelecionada) ?? session?.empresaAtual ?? empresasDisponiveis[0];
  const temaAtual = PALETAS[empresaAtual?.paleta ?? 'folha'];

  return (
    <main className="app-shell min-h-screen p-4 text-slate-900 md:p-8" style={{ '--brand-accent': temaAtual.accent, '--brand-strong': temaAtual.accentStrong, '--brand-soft': temaAtual.soft, '--brand-ink': temaAtual.ink } as React.CSSProperties}>
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
                    onClick={abrirNovaEmpresa}
                    className="button button-light"
                  >
                    + Nova empresa
                  </button>
                  <button type="button" onClick={abrirEdicaoEmpresa} className="button button-quiet">Editar empresa</button>
                  <button type="button" onClick={imprimirRelatorio} className="button button-quiet">Imprimir PDF</button>
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
                        <span className="company-name">
                          {empresa.fotoUrl ? <img src={empresa.fotoUrl} alt="" className="company-mini-avatar" /> : <span className="company-mini-avatar company-mini-fallback" aria-hidden="true">{empresa.nome.slice(0, 1).toUpperCase()}</span>}
                          <span><span className="palette-dot" style={{ backgroundColor: PALETAS[empresa.paleta ?? 'folha'].accent }} />{empresa.nome}</span>
                        </span>
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
                        {empresaAtual.fotoUrl ? <img src={empresaAtual.fotoUrl} alt={`Logo de ${empresaAtual.nome}`} className="company-avatar" /> : <div className="company-avatar company-avatar-fallback" aria-hidden="true">{empresaAtual.nome.slice(0, 1).toUpperCase()}</div>}
                        <p className="eyebrow">Empresa atual</p>
                        <h2>{empresaAtual.nome}</h2>
                        {empresaAtual.slogan && <p className="company-slogan">{empresaAtual.slogan}</p>}
                        {empresaAtual.descricao && <p className="company-description">{empresaAtual.descricao}</p>}
                      </div>
                      <span className="status-dot">{carregandoDados ? 'Atualizando...' : 'Sincronizado'}</span>
                    </div>
                    {empresaFormAberto && <form onSubmit={salvarEmpresa} className="company-form">
                      <div><p className="eyebrow">Identidade empresarial</p><h3>{empresaEditando ? 'Editar empresa' : 'Nova empresa'}</h3></div>
                      <div className="field-grid"><input value={empresaFormNome} onChange={(event) => setEmpresaFormNome(event.target.value)} placeholder="Nome da empresa" className="field" required /><input value={empresaFormDocumento} onChange={(event) => setEmpresaFormDocumento(event.target.value)} placeholder="CNPJ ou documento" className="field" /></div>
                      <textarea value={empresaFormDescricao} onChange={(event) => setEmpresaFormDescricao(event.target.value)} placeholder="Descrição da empresa" className="field field-textarea" rows={2} />
                      <input value={empresaFormSlogan} onChange={(event) => setEmpresaFormSlogan(event.target.value)} placeholder="Slogan" className="field" />
                      <div className="field-grid"><input type="number" min="1" value={empresaFormUnidades} onChange={(event) => setEmpresaFormUnidades(event.target.value)} placeholder="Unidades/mês" className="field" /><label htmlFor="empresaFoto" className="photo-picker"><span className="photo-picker-icon" aria-hidden="true">+</span><span>{empresaFormFoto ? 'Trocar foto' : 'Adicionar foto'}</span></label><input id="empresaFoto" type="file" accept="image/*" onChange={selecionarFoto} className="visually-hidden" /></div>
                      <fieldset className="palette-fieldset">
                        <legend className="field-label">Paleta visual da empresa</legend>
                        <div className="palette-options">
                          {Object.entries(PALETAS).map(([key, paleta]) => {
                            const paletaId = key as keyof typeof PALETAS;
                            const selecionada = empresaFormPaleta === paletaId;
                            return <button key={paletaId} type="button" className={`palette-option ${selecionada ? 'palette-option-active' : ''}`} onClick={() => setEmpresaFormPaleta(paletaId)} aria-pressed={selecionada}>
                              <span className="palette-swatches" aria-hidden="true"><i style={{ backgroundColor: paleta.accentStrong }} /><i style={{ backgroundColor: paleta.accent }} /><i style={{ backgroundColor: paleta.soft }} /></span>
                              <span className="palette-option-copy"><strong>{paleta.nome}</strong><small>{selecionada ? 'Selecionada' : 'Aplicar identidade'}</small></span>
                              {selecionada && <span className="palette-check" aria-hidden="true">&#10003;</span>}
                            </button>;
                          })}
                        </div>
                      </fieldset>
                      {empresaFormFoto && <img src={empresaFormFoto} alt="Pré-visualização da empresa" className="company-preview" />}
                      <div className="form-actions"><button type="submit" className="button button-primary">Salvar empresa</button><button type="button" onClick={() => setEmpresaFormAberto(false)} className="button button-quiet">Cancelar</button></div>
                    </form>}
                    <nav className="tabs" aria-label="Módulos da empresa">
                      {([['visao-geral', 'Visão geral'], ['categorias', 'Categorias'], ['produtos', 'Produtos'], ['precificacao', 'Precificação']] as const).map(([key, label]) => (
                        <button key={key} type="button" className={aba === key ? 'tab tab-active' : 'tab'} onClick={() => setAba(key)}>{label}</button>
                      ))}
                    </nav>

                    {erro && <p className="error-banner">{erro}</p>}

                    {aba === 'visao-geral' && <>
                    <div className="metric-grid">
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
                      <div className="metric-card"><p className="text-sm text-slate-500">Entradas</p><p className="mt-2 text-xl font-semibold">{resumo?.unidadesEntrada ?? 0} un.</p></div>
                      <div className="metric-card"><p className="text-sm text-slate-500">Saídas</p><p className="mt-2 text-xl font-semibold">{resumo?.unidadesSaida ?? 0} un.</p></div>
                      <div className="metric-card"><p className="text-sm text-slate-500">Estoque baixo</p><p className="mt-2 text-xl font-semibold">{resumo?.produtosEstoqueBaixo ?? 0}</p></div>
                      <div className="metric-card"><p className="text-sm text-slate-500">Saldo do período</p><p className="mt-2 text-xl font-semibold">{resumo?.saldoUnidades ?? 0} un.</p></div>
                      <div className="metric-card"><p className="text-sm text-slate-500">Entradas em R$</p><p className="mt-2 text-xl font-semibold">R$ {(resumo?.financeiro.totalEntradas ?? 0).toFixed(2)}</p></div>
                      <div className="metric-card"><p className="text-sm text-slate-500">Saídas em R$</p><p className="mt-2 text-xl font-semibold">R$ {(resumo?.financeiro.totalSaidas ?? 0).toFixed(2)}</p></div>
                      <div className="metric-card"><p className="text-sm text-slate-500">Lucro bruto</p><p className="mt-2 text-xl font-semibold">R$ {(resumo?.financeiro.lucroBruto ?? 0).toFixed(2)}</p></div>
                    </div>
                    <div className="dashboard-lower">
                      <form onSubmit={registrarMovimentacao} className="form-card movement-form">
                        <div><p className="eyebrow">Estoque</p><h3>Registrar movimentação</h3></div>
                        <select value={produtoMovimentacao} onChange={(event) => setProdutoMovimentacao(event.target.value)} className="field" required><option value="">Selecione um produto</option>{produtos.filter((item) => item.ativo).map((produto) => <option key={produto.id} value={produto.id}>{produto.nome} · saldo {produto.quantidadeAtual}</option>)}</select>
                        <div className="field-grid"><select value={tipoMovimentacao} onChange={(event) => setTipoMovimentacao(event.target.value as 'entrada' | 'saida')} className="field"><option value="entrada">Entrada</option><option value="saida">Saída</option></select><input type="number" min="1" step="1" value={quantidadeMovimentacao} onChange={(event) => setQuantidadeMovimentacao(event.target.value)} placeholder="Quantidade" className="field" required /></div>
                        <button type="submit" className="button button-primary">Lançar movimentação</button>
                      </form>
                      <div className="dashboard-note"><p className="eyebrow">Acompanhamento</p><h3>Estoque em movimento</h3><p>As entradas aumentam o saldo e as saídas reduzem o estoque. Saídas maiores que o saldo são bloqueadas.</p><div className="movement-total"><span>Valor em estoque</span><strong>R$ {(resumo?.financeiro.valorEmEstoque ?? 0).toFixed(2)}</strong></div></div>
                    </div>
                    </>}

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
                        <input type="number" min="0" step="1" value={estoqueInicial} onChange={(event) => setEstoqueInicial(event.target.value)} placeholder="Estoque inicial" className="field" />
                        <button type="submit" className="button button-primary">Adicionar produto</button>
                      </form>
                      <div className="list-card"><div className="list-heading"><h3>Produtos da empresa</h3><span>{produtos.length} registros</span></div>
                        {produtos.length === 0 ? <p className="empty-state">Nenhum produto cadastrado ainda.</p> : produtos.map((produto) => <div className="list-row product-row" key={produto.id}><div><strong>{produto.nome}</strong><small>{produto.sku} · R$ {produto.precoVenda.toFixed(2)}</small></div><div className="row-actions"><span className={produto.ativo ? 'tag tag-active' : 'tag'}>{produto.ativo ? `${produto.quantidadeAtual} em estoque` : 'Inativo'}</span>{produto.ativo && <button type="button" className="action-link" onClick={() => void inativar('produtos', produto.id)}>Inativar</button>}</div></div>)}
                      </div>
                    </div>}

                    {aba === 'precificacao' && <div className="module-layout">
                      <div className="form-card">
                        <div><p className="eyebrow">Custos da empresa</p><h3>Despesas fixas</h3></div>
                        <form onSubmit={criarDespesaFixa} className="form-card nested-form">
                          <input value={despesaDescricao} onChange={(event) => setDespesaDescricao(event.target.value)} placeholder="Ex.: aluguel" className="field" required />
                          <input type="number" min="0" step="0.01" value={despesaValor} onChange={(event) => setDespesaValor(event.target.value)} placeholder="Valor mensal" className="field" required />
                          <button type="submit" className="button button-primary">Adicionar despesa</button>
                        </form>
                        <div className="expense-list">{despesasFixas.map((despesa) => <div className="expense-row" key={despesa.id}><span>{despesa.descricao}</span><strong>R$ {despesa.valorMensal.toFixed(2)}</strong></div>)}{despesasFixas.length === 0 && <p className="empty-state">Nenhuma despesa fixa.</p>}</div>
                      </div>
                      <form onSubmit={simularPreco} className="form-card">
                        <div><p className="eyebrow">Preço sugerido</p><h3>Calcular precificação</h3></div>
                        <select value={produtoPrecificacao} onChange={(event) => setProdutoPrecificacao(event.target.value)} className="field" required><option value="">Selecione um produto</option>{produtos.filter((item) => item.ativo).map((produto) => <option key={produto.id} value={produto.id}>{produto.nome} · custo R$ {produto.custoUnitario.toFixed(2)}</option>)}</select>
                        <div className="nested-form"><p className="eyebrow">Embalagem</p><div className="field-grid"><input value={adicionalDescricao} onChange={(event) => setAdicionalDescricao(event.target.value)} placeholder="Descrição" className="field" /><input type="number" min="0" step="0.01" value={adicionalValor} onChange={(event) => setAdicionalValor(event.target.value)} placeholder="Valor" className="field" /></div><button type="button" className="button button-quiet" onClick={() => void criarDespesaAdicional()}>Adicionar custo adicional</button></div>
                        <input type="number" min="0" step="0.01" value={lucroPercentual} onChange={(event) => setLucroPercentual(event.target.value)} placeholder="Lucro (%)" className="field" required />
                        <button type="submit" className="button button-primary">Simular preço</button>
                        {resultadoPrecificacao && <div className="pricing-result"><span>Preço base: R$ {resultadoPrecificacao.precoBase.toFixed(2)}</span><span>Custo fixo/unidade: R$ {resultadoPrecificacao.custoFixoUnitario.toFixed(2)}</span><strong>Preço sugerido: R$ {resultadoPrecificacao.precoSugerido.toFixed(2)}</strong>{resultadoPrecificacao.alertas.map((alerta) => <small key={alerta}>{alerta}</small>)}</div>}
                      </form>
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
