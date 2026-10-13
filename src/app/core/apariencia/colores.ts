const PATRON_HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

export const TEXTO_CLARO = '#FFFFFF';
export const TEXTO_OSCURO = '#0F172A';

/** Convierte #abc, abc o #aabbcc a #AABBCC; devuelve null si no es un HEX válido. */
export function normalizarHex(valor: string | null | undefined): string | null {
  const coincidencia = PATRON_HEX.exec(valor?.trim() ?? '');
  if (!coincidencia) return null;

  let hex = coincidencia[1].toUpperCase();
  if (hex.length === 3) {
    hex = [...hex].map((c) => c + c).join('');
  }

  return `#${hex}`;
}

/** Luminancia relativa según WCAG 2.x. */
export function luminancia(hex: string): number {
  const normalizado = normalizarHex(hex) ?? '#000000';
  const canales = [1, 3, 5].map((i) => parseInt(normalizado.slice(i, i + 2), 16) / 255);
  const [r, g, b] = canales.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contraste(a: string, b: string): number {
  const [claro, oscuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (claro + 0.05) / (oscuro + 0.05);
}

/** Color de texto (blanco u oscuro) con mejor contraste sobre el fondo indicado. */
export function textoSobre(fondo: string): string {
  return contraste(fondo, TEXTO_CLARO) >= contraste(fondo, TEXTO_OSCURO)
    ? TEXTO_CLARO
    : TEXTO_OSCURO;
}
