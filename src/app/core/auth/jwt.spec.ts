import { leerToken } from './jwt';
import { Permiso, cumplePermisos } from './permisos';

function token(datos: object): string {
  const base64Url = (o: object) =>
    btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(o))))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  return `${base64Url({ alg: 'HS256' })}.${base64Url(datos)}.firma`;
}

const ROL = 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role';
const ID = 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier';

describe('leerToken', () => {
  it('lee los claims que emite el backend', () => {
    const sesion = leerToken(
      token({
        [ID]: 'abc',
        usuario: 'josé.pérez',
        institucion: 'MIDE',
        [ROL]: ['GestionCombustible', 'GestionAsignaciones'],
        exp: 2000000000,
      }),
    );
    expect(sesion).toEqual({
      id: 'abc',
      usuario: 'josé.pérez',
      institucion: 'MIDE',
      permisos: ['GestionCombustible', 'GestionAsignaciones'],
      expira: 2000000000000,
    });
  });

  it('acepta un único rol como texto y usa "permisos" si no hay roles', () => {
    expect(leerToken(token({ [ROL]: 'Administrador', exp: 1 }))?.permisos).toEqual([
      'Administrador',
    ]);
    expect(leerToken(token({ permisos: 'A,B', exp: 1 }))?.permisos).toEqual(['A', 'B']);
  });

  it('rechaza tokens mal formados o sin vencimiento', () => {
    expect(leerToken('no-es-un-token')).toBeNull();
    expect(leerToken(token({ usuario: 'x' }))).toBeNull();
  });
});

describe('cumplePermisos', () => {
  it('Administrador cubre todo y basta con uno de los requeridos', () => {
    expect(cumplePermisos(['Administrador'], [Permiso.GestionUsuarios])).toBe(true);
    expect(
      cumplePermisos(
        ['GestionCombustible'],
        [Permiso.GestionAsignaciones, Permiso.GestionCombustible],
      ),
    ).toBe(true);
    expect(cumplePermisos(['GestionCombustible'], [Permiso.GestionUsuarios])).toBe(false);
    expect(cumplePermisos([], [])).toBe(true);
  });
});
