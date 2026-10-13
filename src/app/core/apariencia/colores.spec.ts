import { TEXTO_CLARO, TEXTO_OSCURO, contraste, normalizarHex, textoSobre } from './colores';

describe('colores', () => {
  it('normaliza los formatos HEX aceptados por el backend', () => {
    expect(normalizarHex('#abc')).toBe('#AABBCC');
    expect(normalizarHex('abc')).toBe('#AABBCC');
    expect(normalizarHex(' #002d62 ')).toBe('#002D62');
    expect(normalizarHex('azul')).toBeNull();
    expect(normalizarHex('#12345')).toBeNull();
    expect(normalizarHex(null)).toBeNull();
  });

  it('calcula el contraste WCAG', () => {
    expect(contraste('#000000', '#FFFFFF')).toBeCloseTo(21, 0);
    expect(contraste('#777777', '#777777')).toBeCloseTo(1, 5);
  });

  it('elige texto claro sobre fondos oscuros y oscuro sobre claros', () => {
    expect(textoSobre('#002D62')).toBe(TEXTO_CLARO);
    expect(textoSobre('#CE1126')).toBe(TEXTO_CLARO);
    expect(textoSobre('#C9A227')).toBe(TEXTO_OSCURO);
    expect(textoSobre('#FFFFFF')).toBe(TEXTO_OSCURO);
  });
});
