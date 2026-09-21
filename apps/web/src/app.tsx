import { useMemo, useState } from 'react';

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

  const empresasDisponiveis = useMemo(() => session?.empresas ?? [], [session]);

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
                  <label className="mb-1 block text-sm font-medium">Seu nome</label>
                  <input value={nome} onChange={(e) => setNome(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
                </div>
              )}

              <div>
                <label className="mb-1 block text-sm font-medium">E-mail</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Senha</label>
                <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
              </div>

              {modo === 'cadastro' && (
                <>
                  <div>
                    <label className="mb-1 block text-sm font-medium">Nome da empresa</label>
                    <input value={empresaNome} onChange={(e) => setEmpresaNome(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium">Estimativa de unidades/mês</label>
                    <input type="number" min={1} value={unidadesMesEstimadas} onChange={(e) => setUnidadesMesEstimadas(Number(e.target.value || 1))} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
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
            <header className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm text-slate-500">Bem-vindo(a)</p>
                  <h1 className="text-2xl font-bold">{session.user.nome}</h1>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={handleCriarEmpresa}
                    className="rounded-lg border border-emerald-600 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700"
                  >
                    + Nova empresa
                  </button>
                  <button
                    type="button"
                    onClick={() => setSession(null)}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
                  >
                    Sair
                  </button>
                </div>
              </div>
            </header>

            <section className="grid gap-6 md:grid-cols-[280px_minmax(0,1fr)]">
              <aside className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Empresas</h2>
                <div className="space-y-2">
                  {empresasDisponiveis.map((empresa) => (
                    <button
                      key={empresa.id}
                      type="button"
                      onClick={() => setEmpresaSelecionada(empresa.id)}
                      className={`w-full rounded-xl border p-3 text-left ${empresaSelecionada === empresa.id ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}
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

              <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                {empresaAtual && (
                  <>
                    <p className="text-sm uppercase tracking-wide text-slate-500">Empresa atual</p>
                    <h2 className="mt-2 text-3xl font-bold">{empresaAtual.nome}</h2>
                    <div className="mt-5 grid gap-4 md:grid-cols-3">
                      <div className="rounded-xl bg-slate-50 p-4">
                        <p className="text-sm text-slate-500">Papel</p>
                        <p className="mt-2 text-xl font-semibold capitalize">{empresaAtual.papel}</p>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-4">
                        <p className="text-sm text-slate-500">Estimativa mensal</p>
                        <p className="mt-2 text-xl font-semibold">{empresaAtual.unidadesMesEstimadas}</p>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-4">
                        <p className="text-sm text-slate-500">Documento</p>
                        <p className="mt-2 text-xl font-semibold">{empresaAtual.documento ?? '—'}</p>
                      </div>
                    </div>
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
