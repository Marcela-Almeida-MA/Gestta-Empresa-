export type EntradaPrecificacao = {
  despesasFixasMensais: number;
  unidadesVendidas: number;
  unidadesEstimadas: number;
  custoProduto: number;
  despesasAdicionais: number;
  lucroPercentual: number;
  precoAtual?: number;
};

export type ResultadoPrecificacao = {
  custoProduto: number;
  despesasAdicionais: number;
  unidadesMes: number;
  custoFixoUnitario: number;
  precoBase: number;
  lucroPercentual: number;
  metodoLucro: 'markup';
  precoSugerido: number;
  alertas: string[];
};

export class CalculadoraDePreco {
  calcular(entrada: EntradaPrecificacao): ResultadoPrecificacao {
    if (entrada.custoProduto < 0 || entrada.despesasAdicionais < 0 || entrada.despesasFixasMensais < 0 || entrada.lucroPercentual < 0) {
      throw new Error('Os valores da precificação não podem ser negativos.');
    }

    const unidadesMes = 30;
    const custoFixoUnitario = entrada.despesasFixasMensais / 30;
    const precoBase = entrada.custoProduto + entrada.despesasAdicionais + custoFixoUnitario;
    const precoSugerido = Math.round(precoBase * (1 + entrada.lucroPercentual / 100) * 100) / 100;
    const alertas: string[] = [];

    if (entrada.precoAtual !== undefined && entrada.precoAtual < precoBase) {
      alertas.push('O preço atual está abaixo do custo total estimado.');
    }
    return {
      custoProduto: entrada.custoProduto,
      despesasAdicionais: entrada.despesasAdicionais,
      unidadesMes,
      custoFixoUnitario: Math.round(custoFixoUnitario * 10000) / 10000,
      precoBase: Math.round(precoBase * 100) / 100,
      lucroPercentual: entrada.lucroPercentual,
      metodoLucro: 'markup',
      precoSugerido,
      alertas,
    };
  }
}
