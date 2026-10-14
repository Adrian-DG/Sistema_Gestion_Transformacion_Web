import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  Observable,
  catchError,
  combineLatest,
  firstValueFrom,
  of,
  startWith,
  switchMap,
} from 'rxjs';
import { esApiError } from '../../../core/api/api';
import { CatalogosService } from '../../../core/catalogos/catalogos.service';
import { DialogosService } from '../../../core/dialogos/dialogos.service';
import { NotificacionesService } from '../../../core/notificaciones/notificaciones.service';
import { Campo } from '../../../shared/formularios/campo';
import { aplicarErroresServidor } from '../../../shared/formularios/errores-servidor';
import { ArchivoSeleccionado, SelectorArchivo } from '../../../shared/formularios/selector-archivo';
import { Cargando } from '../../../shared/ui/cargando/cargando';
import { EncabezadoPagina } from '../../../shared/ui/encabezado-pagina/encabezado-pagina';
import { EstadoBadge } from '../../../shared/ui/estado-badge/estado-badge';
import { Icono } from '../../../shared/ui/icono/icono';
import {
  AdjuntoResumen,
  InventarioService,
  PiezaCatalogo,
  abrirArchivo,
  moneda,
} from '../../inventario/inventario.service';
import { UNIDADES_MEDIDA } from '../../inventario/piezas/pieza-formulario';
import {
  CODIGO_COMPRA_REQUERIDA,
  SolicitudTallerDetalle as Detalle,
  TallerService,
  nombreEstatus,
  nombreTipo,
} from '../taller.service';

/**
 * Orden de taller. Pendiente: ingreso con mecánico, rechazo o cancelación. En taller: piezas
 * utilizadas (se toma lo que hay en inventario y lo faltante se compra con costo y recibo), cierre
 * con diagnóstico y dictamen de baja, o cancelación (las piezas vuelven al inventario).
 */
@Component({
  selector: 'app-solicitud-taller-detalle',
  imports: [
    DatePipe,
    DecimalPipe,
    ReactiveFormsModule,
    RouterLink,
    EncabezadoPagina,
    Campo,
    Cargando,
    EstadoBadge,
    Icono,
    SelectorArchivo,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './solicitud-taller-detalle.html',
})
export class SolicitudTallerDetalle {
  private readonly taller = inject(TallerService);
  private readonly inventario = inject(InventarioService);
  private readonly catalogos = inject(CatalogosService);
  private readonly dialogos = inject(DialogosService);
  private readonly notificaciones = inject(NotificacionesService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly id = input.required<string>();

  protected readonly moneda = moneda;
  protected readonly nombreEstatus = nombreEstatus;
  protected readonly nombreTipo = nombreTipo;
  protected readonly unidades = UNIDADES_MEDIDA;

  private readonly recarga = signal(0);
  protected readonly detalle = signal<Detalle | null>(null);
  protected readonly noEncontrada = signal(false);
  protected readonly procesando = signal(false);

  protected readonly mecanicos = toSignal(
    this.taller.catalogoMecanicos().pipe(catchError(() => of([]))),
    { initialValue: [] },
  );
  protected readonly proveedores = toSignal(
    this.inventario.catalogoProveedores().pipe(catchError(() => of([]))),
    { initialValue: [] },
  );
  protected readonly piezas = signal<PiezaCatalogo[]>([]);
  private readonly tiposDocumento = toSignal(
    this.catalogos.tiposDocumento().pipe(catchError(() => of([]))),
    { initialValue: [] },
  );

  // Ingreso
  protected readonly ingreso = this.fb.group({
    mecanicoId: this.fb.control<string | null>(null, Validators.required),
    kilometraje: this.fb.control<number | null>(null, Validators.min(0)),
  });

  // Pieza utilizada (y compra de lo faltante)
  protected readonly pieza = this.fb.group({
    piezaId: this.fb.control<string | null>(null, Validators.required),
    cantidad: this.fb.control<number | null>(1, [Validators.required, Validators.min(0.01)]),
    proveedorId: this.fb.control<string | null>(null),
    costoUnitario: this.fb.control<number | null>(null),
    numeroFactura: ['', Validators.maxLength(50)],
    recibo: this.fb.control<ArchivoSeleccionado | null>(null),
  });
  protected readonly errorPieza = signal<string | null>(null);

  // Pieza nueva (cuando no está en el catálogo)
  protected readonly creandoPieza = signal(false);
  protected readonly nuevaPieza = this.fb.group({
    codigo: ['', [Validators.required, Validators.maxLength(30)]],
    nombre: ['', [Validators.required, Validators.maxLength(200)]],
    unidadMedida: ['Unidad', [Validators.required, Validators.maxLength(30)]],
  });

  // Cierre
  protected readonly cierre = this.fb.group({
    diagnostico: ['', [Validators.required, Validators.maxLength(2000)]],
    trabajoRealizado: ['', [Validators.required, Validators.maxLength(2000)]],
    procedeBaja: [false],
  });
  protected readonly errorCierre = signal<string | null>(null);

  private readonly valoresPieza = toSignal(this.pieza.valueChanges.pipe(startWith(null)));

  /** Lo que hay en inventario de la pieza elegida y lo que falta comprar. */
  protected readonly calculo = computed(() => {
    this.valoresPieza();
    const v = this.pieza.getRawValue();
    const elegida = this.piezas().find((p) => p.id === v.piezaId) ?? null;
    if (!elegida) return null;
    const disponible = Math.max(elegida.existencia, 0);
    const cantidad = v.cantidad ?? 0;
    const delInventario = Math.min(disponible, cantidad);
    return {
      pieza: elegida,
      disponible,
      delInventario,
      faltante: Math.max(cantidad - delInventario, 0),
    };
  });

  protected readonly totalCompra = computed(() => {
    this.valoresPieza();
    const c = this.calculo();
    return c ? c.faltante * (this.pieza.controls.costoUnitario.value ?? 0) : 0;
  });

  constructor() {
    combineLatest([toObservable(this.id), toObservable(this.recarga)])
      .pipe(
        switchMap(([id]) => this.taller.solicitud(id).pipe(catchError(() => of(null)))),
        takeUntilDestroyed(),
      )
      .subscribe((detalle) => {
        this.detalle.set(detalle);
        this.noEncontrada.set(detalle === null);
      });

    toObservable(this.recarga)
      .pipe(
        switchMap(() => this.inventario.catalogoPiezas().pipe(catchError(() => of([])))),
        takeUntilDestroyed(),
      )
      .subscribe((piezas) => this.piezas.set(piezas));
  }

  protected async ingresar(): Promise<void> {
    if (this.ingreso.invalid) {
      this.ingreso.markAllAsTouched();
      return;
    }
    const v = this.ingreso.getRawValue();
    await this.ejecutar(this.taller.ingresar(this.id(), v.mecanicoId!, v.kilometraje), (r) => {
      this.notificaciones.exito('El vehículo ingresó al taller y quedó en mantenimiento.');
      if (r.asignacionesAprobadas > 0) {
        this.notificaciones.advertencia(
          `El vehículo tiene ${r.asignacionesAprobadas} asignación(es) aprobada(s) a futuro; reprográmelas o cancélelas.`,
        );
      }
    });
  }

  protected async rechazar(): Promise<void> {
    const motivo = await this.dialogos.solicitarMotivo({
      titulo: 'Rechazar solicitud',
      mensaje: 'La solicitud quedará rechazada y el vehículo no ingresará al taller.',
      textoConfirmar: 'Rechazar',
      tipo: 'peligro',
      motivo: { etiqueta: 'Motivo del rechazo', maximo: 500 },
    });
    if (motivo) {
      await this.ejecutar(this.taller.rechazar(this.id(), motivo), () =>
        this.notificaciones.exito('Solicitud rechazada.'),
      );
    }
  }

  protected async cancelar(): Promise<void> {
    const enTaller = this.detalle()?.solicitud.estatus === 'EnTaller';
    const motivo = await this.dialogos.solicitarMotivo({
      titulo: 'Cancelar solicitud',
      mensaje: enTaller
        ? 'El vehículo sale del taller sin cambios y las piezas registradas vuelven al inventario. Queda en el historial como cancelada.'
        : 'Use esta opción para anular una solicitud registrada por error. Queda en el historial como cancelada.',
      textoConfirmar: 'Cancelar solicitud',
      textoCancelar: 'Volver',
      tipo: 'peligro',
      motivo: { etiqueta: 'Motivo de la cancelación', maximo: 500 },
    });
    if (motivo) {
      await this.ejecutar(this.taller.cancelar(this.id(), motivo), () =>
        this.notificaciones.exito('Solicitud cancelada.'),
      );
    }
  }

  protected async agregarPieza(): Promise<void> {
    this.errorPieza.set(null);
    const calculo = this.calculo();
    const c = this.pieza.controls;

    // Los datos de la compra solo se exigen cuando la existencia no alcanza.
    const compra = !!calculo && calculo.faltante > 0;
    c.proveedorId.setValidators(compra ? Validators.required : null);
    c.costoUnitario.setValidators(compra ? [Validators.required, Validators.min(0.01)] : null);
    c.recibo.setValidators(compra ? Validators.required : null);
    for (const control of [c.proveedorId, c.costoUnitario, c.recibo])
      control.updateValueAndValidity();

    if (this.pieza.invalid || !calculo) {
      this.pieza.markAllAsTouched();
      return;
    }

    const v = this.pieza.getRawValue();
    const tipoRecibo = this.tiposDocumento().find((t) => /recibo/i.test(t.nombre))?.id;
    if (compra && !tipoRecibo) {
      this.errorPieza.set('No se encontró el tipo de documento "Recibo de compra".');
      return;
    }

    this.procesando.set(true);
    try {
      const r = await firstValueFrom(
        this.taller.agregarPieza(
          this.id(),
          v.piezaId!,
          v.cantidad!,
          compra
            ? {
                proveedorId: v.proveedorId!,
                costoUnitario: v.costoUnitario!,
                numeroFactura: v.numeroFactura.trim() || null,
                recibo: {
                  tipoDocumentoId: tipoRecibo!,
                  nombreArchivo: v.recibo!.nombreArchivo,
                  contentType: v.recibo!.contentType,
                  fileBase64: v.recibo!.fileBase64,
                },
              }
            : null,
        ),
      );
      const partes = [
        r.delInventario > 0 ? `${r.delInventario} del inventario` : null,
        r.compradas > 0 ? `${r.compradas} comprada(s)` : null,
      ].filter(Boolean);
      this.notificaciones.exito(`${calculo.pieza.nombre}: ${partes.join(' y ')}.`);
      this.pieza.reset({
        piezaId: null,
        cantidad: 1,
        proveedorId: null,
        costoUnitario: null,
        numeroFactura: '',
        recibo: null,
      });
      this.recarga.update((n) => n + 1);
    } catch (e) {
      // Otra orden consumió la pieza mientras tanto: se actualiza la existencia para pedir la compra.
      if (esApiError(e) && e.codigo === CODIGO_COMPRA_REQUERIDA) this.recarga.update((n) => n + 1);
      this.errorPieza.set(aplicarErroresServidor(this.pieza, e));
    } finally {
      this.procesando.set(false);
    }
  }

  protected async registrarPiezaNueva(): Promise<void> {
    if (this.nuevaPieza.invalid) {
      this.nuevaPieza.markAllAsTouched();
      return;
    }
    const v = this.nuevaPieza.getRawValue();
    this.procesando.set(true);
    try {
      const id = await firstValueFrom(
        this.inventario.crearPieza({
          codigo: v.codigo.trim().toUpperCase(),
          nombre: v.nombre.trim(),
          descripcion: null,
          unidadMedida: v.unidadMedida.trim(),
          existenciaMinima: 0,
        }),
      );
      this.piezas.set(await firstValueFrom(this.inventario.catalogoPiezas()));
      this.pieza.controls.piezaId.setValue(id);
      this.nuevaPieza.reset({ codigo: '', nombre: '', unidadMedida: 'Unidad' });
      this.creandoPieza.set(false);
      this.notificaciones.exito(
        `Pieza ${v.nombre} registrada; indique la cantidad y los datos de la compra.`,
      );
    } catch (e) {
      const mensaje = aplicarErroresServidor(this.nuevaPieza, e);
      if (mensaje) this.notificaciones.error(mensaje);
    } finally {
      this.procesando.set(false);
    }
  }

  protected async finalizar(): Promise<void> {
    this.errorCierre.set(null);
    if (this.cierre.invalid) {
      this.cierre.markAllAsTouched();
      return;
    }
    const v = this.cierre.getRawValue();
    const placa = this.detalle()!.solicitud.placa;
    const confirmado = await this.dialogos.confirmar(
      v.procedeBaja
        ? {
            titulo: 'Dar de baja el vehículo',
            mensaje: `Según el dictamen del mecánico, el vehículo ${placa} pasará a INACTIVO y no se podrá asignar. Solo se reactiva por excepción.`,
            textoConfirmar: 'Finalizar y dar de baja',
            tipo: 'peligro',
          }
        : {
            titulo: 'Finalizar orden',
            mensaje: `El vehículo ${placa} sale del taller y queda disponible para asignaciones.`,
            textoConfirmar: 'Finalizar',
          },
    );
    if (!confirmado) return;

    this.procesando.set(true);
    try {
      await firstValueFrom(
        this.taller.finalizar(
          this.id(),
          v.diagnostico.trim(),
          v.trabajoRealizado.trim(),
          v.procedeBaja,
        ),
      );
      this.notificaciones.exito(
        v.procedeBaja ? `Vehículo ${placa} dado de baja.` : 'Orden finalizada.',
      );
      this.recarga.update((n) => n + 1);
    } catch (e) {
      this.errorCierre.set(aplicarErroresServidor(this.cierre, e));
    } finally {
      this.procesando.set(false);
    }
  }

  protected async verRecibo(a: AdjuntoResumen): Promise<void> {
    abrirArchivo(await firstValueFrom(this.inventario.adjunto(a.id)));
  }

  private async ejecutar<T>(accion: Observable<T>, alTerminar: (r: T) => void): Promise<void> {
    this.procesando.set(true);
    try {
      alTerminar(await firstValueFrom(accion));
      this.recarga.update((n) => n + 1);
    } catch (e) {
      // El interceptor ya mostró el aviso (ej. vehículo en misión, estado inválido).
      if (!esApiError(e)) throw e;
    } finally {
      this.procesando.set(false);
    }
  }
}
