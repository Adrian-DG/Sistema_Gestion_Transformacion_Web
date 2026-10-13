import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, shareReplay, throwError } from 'rxjs';
import { api } from '../api/api';

export interface Rango {
  id: string;
  nombre: string;
  /** Denominación equivalente en la Armada. */
  nombreArmada: string;
}

/** Catálogos de la API (api/catalogos). Se consultan una vez por sesión de navegador. */
@Injectable({ providedIn: 'root' })
export class CatalogosService {
  private readonly http = inject(HttpClient);
  private rangos$?: Observable<Rango[]>;

  rangos(): Observable<Rango[]> {
    this.rangos$ ??= this.http.get<Rango[]>(api('catalogos/rangos')).pipe(
      // Si falla, no se guarda el error: el próximo uso vuelve a consultar.
      catchError((error) => {
        this.rangos$ = undefined;
        return throwError(() => error);
      }),
      shareReplay(1),
    );
    return this.rangos$;
  }
}
