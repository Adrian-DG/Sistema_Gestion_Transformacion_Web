import {
  CargoSipffaa,
  DepartamentoSipffaa,
  MiembroSipffaa,
} from '../../core/sipffaa/sipffaa.service';

/** Cargo y departamento del miembro en SIPFFAA, para proponerlos como los del solicitante. */
export function cargoDe(m: MiembroSipffaa): CargoSipffaa | null {
  return m.codCargo > 0 && m.cargo
    ? {
        codCargo: m.codCargo,
        nombre: m.cargo,
        descripcion: m.descripcionCargo,
        codInstitucion: m.codInstitucion,
        esEncargado: false,
        esUnica: null,
        cantidadOcupantes: 1,
        ocupantes: [],
      }
    : null;
}

export function departamentoDe(m: MiembroSipffaa): DepartamentoSipffaa | null {
  return m.codDepartamento > 0 && m.departamento
    ? {
        codDepartamento: m.codDepartamento,
        nombre: m.departamento,
        descripcion: null,
        codInstitucion: m.codInstitucion,
        codigoDeRegistro: null,
        codDptoPadre: 0,
        departamentoPadre: null,
        estaEnElRecintoMilitar: false,
        status: true,
      }
    : null;
}
