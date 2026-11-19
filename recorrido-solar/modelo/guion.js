export const INICIO_EMPRESAS = .823;
export const FIN_ENLACE = .837;
export const CORTE_MUELLES = .738;
export const SEGUNDOS_MANIOBRA = 7.6;
export const DESPEGUE = .798;
export const FIN_LLEGADA = .855;
export const INICIO_PARKING = INICIO_EMPRESAS + .465 * (1-INICIO_EMPRESAS);
export const INICIO_PLACAS_NAVE = .49;
export const faseCubierta = progreso => Math.min(1,Math.max(0,(progreso-FIN_LLEGADA)/(INICIO_PARKING-FIN_LLEGADA)));
export const DURACION_PARKING = .205;
export const FIN_RECORRIDO = 1+DURACION_PARKING;
export const tiempoParking = p => Math.min(1,Math.max(0,(p-INICIO_PARKING)/DURACION_PARKING));
export const INICIO_DRON = .655;

// El montaje y sus cámaras comparten un reloj propio, también en la vista del cargador.
export const progresoResidencial = p => Math.min(1, p / .82);
export const tiempoDron = p => Math.min(1, Math.max(0, (p - INICIO_DRON) / (.810 - INICIO_DRON)));

// Mantiene los tiempos originales de montaje y de iluminación de la villa.
// El plano del cargador ocupa más recorrido que el último alejamiento.
export function tiempoVilla(p) {
  if (p <= .58) return p * .895 / .58;
  if (p <= .71) return .895 + (p-.58) * .06 / .13;
  return Math.min(1, .955 + (p-.71) * .045 / .075);
}

export function tiempoNave(p) {
  return Math.min(1,Math.max(0,(p-tiempoParking(p)*DURACION_PARKING-INICIO_EMPRESAS)/(1-INICIO_EMPRESAS)));
}
