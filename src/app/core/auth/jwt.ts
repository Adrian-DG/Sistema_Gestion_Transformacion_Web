/** Datos del usuario contenidos en el token que emite el backend (JwtTokenGenerator). */
export interface UsuarioSesion {
  id: string;
  usuario: string;
  institucion: string;
  permisos: string[];
  /** Vencimiento en milisegundos desde epoch. */
  expira: number;
}

const CLAIM_ID = 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier';
const CLAIM_ROL = 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role';

/**
 * Lee el contenido del token. No valida la firma (eso lo hace la API en cada petición);
 * solo sirve para mostrar datos y ocultar opciones sin permiso.
 */
export function leerToken(token: string): UsuarioSesion | null {
  try {
    const [, cuerpo] = token.split('.');
    if (!cuerpo) return null;

    const base64 = cuerpo.replace(/-/g, '+').replace(/_/g, '/');
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const datos = JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;

    const roles = datos[CLAIM_ROL] ?? datos['role'];
    const permisos = Array.isArray(roles)
      ? roles.map(String)
      : typeof roles === 'string'
        ? [roles]
        : String(datos['permisos'] ?? '')
            .split(',')
            .filter(Boolean);

    if (typeof datos['exp'] !== 'number') return null;

    return {
      id: String(datos[CLAIM_ID] ?? datos['sub'] ?? ''),
      usuario: String(datos['usuario'] ?? ''),
      institucion: String(datos['institucion'] ?? ''),
      permisos,
      expira: datos['exp'] * 1000,
    };
  } catch {
    return null;
  }
}
