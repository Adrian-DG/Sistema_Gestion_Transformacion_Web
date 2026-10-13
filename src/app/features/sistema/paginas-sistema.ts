import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EncabezadoPagina } from '../../shared/ui/encabezado-pagina/encabezado-pagina';
import { EstadoVacio } from '../../shared/ui/estado-vacio/estado-vacio';

/** Marcador para los módulos de fases siguientes; el título llega por `data` de la ruta. */
@Component({
  selector: 'app-proximamente',
  imports: [EncabezadoPagina, EstadoVacio],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-encabezado-pagina [titulo]="titulo()" [descripcion]="descripcion()" />
    <div class="tarjeta">
      <app-estado-vacio
        icono="construccion"
        titulo="Módulo en desarrollo"
        mensaje="Esta sección se habilitará en una próxima fase del sistema."
      />
    </div>
  `,
})
export class Proximamente {
  readonly titulo = input('Módulo');
  readonly descripcion = input<string>();
}

@Component({
  selector: 'app-acceso-denegado',
  imports: [RouterLink, EstadoVacio],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tarjeta mx-auto mt-10 max-w-lg">
      <app-estado-vacio
        icono="candado"
        titulo="Acceso denegado"
        mensaje="Su usuario no tiene permiso para acceder a esta sección. Si lo necesita, solicítelo al administrador del sistema."
      >
        <a routerLink="/inicio" class="btn btn-primario">Volver al inicio</a>
      </app-estado-vacio>
    </div>
  `,
})
export class AccesoDenegado {}

@Component({
  selector: 'app-no-encontrado',
  imports: [RouterLink, EstadoVacio],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tarjeta mx-auto mt-10 max-w-lg">
      <app-estado-vacio
        icono="buscar"
        titulo="Página no encontrada"
        mensaje="La dirección solicitada no existe o fue movida."
      >
        <a routerLink="/inicio" class="btn btn-primario">Volver al inicio</a>
      </app-estado-vacio>
    </div>
  `,
})
export class NoEncontrado {}
