import { buscarPorCodigo } from './lector-codigo-barras';

const piezas = [
  { id: '1', codigo: 'FIL-ACE-001', codigoBarras: '7501234567893' },
  { id: '2', codigo: 'BAN-010', codigoBarras: null },
  { id: '3', codigo: '7501234567893', codigoBarras: 'abc-128' },
];

describe('buscarPorCodigo', () => {
  it('prefiere el código de barras sobre el código interno', () => {
    expect(buscarPorCodigo(piezas, '7501234567893')?.id).toBe('1');
  });

  it('usa el código interno cuando la pieza no tiene código de barras', () => {
    expect(buscarPorCodigo(piezas, 'ban-010')?.id).toBe('2');
  });

  it('ignora espacios y mayúsculas de la lectura', () => {
    expect(buscarPorCodigo(piezas, '  ABC-128 ')?.id).toBe('3');
  });

  it('devuelve null si ninguna pieza coincide', () => {
    expect(buscarPorCodigo(piezas, '000')).toBeNull();
  });
});
