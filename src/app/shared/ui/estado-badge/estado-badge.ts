import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

type Tono = 'ambar' | 'verde' | 'rojo' | 'gris' | 'azul';

/**
 * Estados de solicitudes (EstatusSolicitud), tickets (EstatusTicket), cobertura de pólizas y
 * disponibilidad de vehículos.
 */
const TONOS: Record<string, Tono> = {
  Vigente: 'verde',
  'Por vencer': 'ambar',
  Vencida: 'rojo',
  'No disponible': 'ambar',
  'En mantenimiento': 'rojo',
  'En taller': 'rojo',
  'Bajo mínimo': 'rojo',
  'En garantía': 'verde',
  'Garantía vencida': 'gris',
  'Taller autorizado': 'azul',
  Externo: 'azul',
  Activa: 'verde',
  Pendiente: 'ambar',
  Aprobada: 'verde',
  Rechazada: 'rojo',
  Cancelada: 'gris',
  Finalizada: 'azul',
  Reservado: 'ambar',
  Disponible: 'verde',
  Utilizado: 'azul',
  Anulado: 'gris',
  Activo: 'verde',
  Inactivo: 'gris',
};

const CLASES: Record<Tono, string> = {
  ambar: 'bg-amber-50 text-amber-800 ring-amber-600/30',
  verde: 'bg-emerald-50 text-emerald-800 ring-emerald-600/30',
  rojo: 'bg-red-50 text-red-800 ring-red-600/30',
  gris: 'bg-slate-100 text-slate-700 ring-slate-500/30',
  azul: 'bg-sky-50 text-sky-800 ring-sky-600/30',
};

@Component({
  selector: 'app-estado-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset"
      [class]="clases()"
    >
      <span class="size-1.5 rounded-full bg-current"></span>
      {{ estado() }}
    </span>
  `,
})
export class EstadoBadge {
  readonly estado = input.required<string>();
  protected readonly clases = computed(() => CLASES[TONOS[this.estado()] ?? 'gris']);
}
