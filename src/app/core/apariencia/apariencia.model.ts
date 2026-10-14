/** Apariencia activa devuelta por GET api/configuracion/apariencia. */
export interface Apariencia {
  /** Cambia cuando se activa otra apariencia. */
  id: string;
  nombreSistema: string;
  nombreCorto: string | null;
  nombreInstitucion: string | null;
  tieneLogo: boolean;
  colorPrimario: string;
  colorSecundario: string;
  colorBotonPrimario: string;
  colorBotonSecundario: string;
  colorBotonPeligro: string;
  version: number;
  actualizadoEn: string;
}

/** Lo que se guarda en IndexedDB: la configuración y la imagen del logo. */
export interface AparienciaGuardada {
  apariencia: Apariencia;
  logo: Blob | null;
}

/** Mismos valores que el registro inicial del backend; se usan sin conexión en la primera visita. */
export const APARIENCIA_PREDETERMINADA: Apariencia = {
  id: '',
  nombreSistema: 'Sistema de Gestión de Transportación',
  nombreCorto: 'SGT',
  nombreInstitucion: 'Ministerio de Defensa · Dirección de Transportación (J-4)',
  tieneLogo: false,
  colorPrimario: '#002D62',
  colorSecundario: '#C9A227',
  colorBotonPrimario: '#002D62',
  colorBotonSecundario: '#5B6B7F',
  colorBotonPeligro: '#CE1126',
  version: 0,
  actualizadoEn: '',
};
