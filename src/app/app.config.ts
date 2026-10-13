import { registerLocaleData } from '@angular/common';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import localeEsDo from '@angular/common/locales/es-DO';
import {
  ApplicationConfig,
  LOCALE_ID,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import {
  TitleStrategy,
  provideRouter,
  withComponentInputBinding,
  withInMemoryScrolling,
} from '@angular/router';
import { routes } from './app.routes';
import { AparienciaService } from './core/apariencia/apariencia.service';
import { erroresInterceptor, tokenInterceptor } from './core/http/interceptores';
import { TituloPaginas } from './core/titulo-paginas';

registerLocaleData(localeEsDo);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: 'top' }),
    ),
    provideHttpClient(withInterceptors([tokenInterceptor, erroresInterceptor])),
    { provide: TitleStrategy, useExisting: TituloPaginas },
    { provide: LOCALE_ID, useValue: 'es-DO' },
    // Aplica logo, nombre y colores antes de mostrar la primera pantalla.
    provideAppInitializer(() => inject(AparienciaService).inicializar()),
  ],
};
