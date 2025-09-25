import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService, ApiResponse } from './api.service';

export interface PropietarioData {
  fechaAlta: string;
  curp: string;
  tipoPersona: 'fisica' | 'moral';
  nombre: string;
  telefono: string;
  celular: string;
  estadoCivil: string;
  canal: string;
  calle: string;
  numeroExterior: string;
  edificio: string;
  cp: string;
  colonia: string;
  alcaldiaMunicipio: string;
  estado: string;
}

export interface InquilinoData {
  fechaAlta: string;
  curp: string;
  tipoPersona: 'fisica' | 'moral';
  nombre: string;
  telefono: string;
  celular: string;
  estadoCivil: string;
  canal: string;
  calle: string;
  numeroExterior: string;
  edificio: string;
  cp: string;
  colonia: string;
  alcaldiaMunicipio: string;
  estado: string;
  ine: File | null;
  pasaporte: File | null;
  comprobanteDomicilio: File | null;
  comprobanteIngresos: File | null;
  comprobanteDomicilioImagen: File | null;
  comprobanteIngresos2: File | null;
}

export interface FiadorData {
  fechaAlta: string;
  curp: string;
  tipoPersona: 'fisica' | 'moral';
  nombre: string;
  telefono: string;
  celular: string;
  calle: string;
  numeroExterior: string;
  edificio: string;
  cp: string;
  colonia: string;
  alcaldiaMunicipio: string;
  estado: string;
  ine: File | null;
  escrituras: File | null;
  actaMatrimonio: File | null;
  empresaLabora: string;
  relacionFiador: string;
  estadoCivil: string;
  regimenPatrimonial: string;
  nombreConyuge: string;
  // Datos del inmueble garantía
  calleGarantia: string;
  numeroExteriorGarantia: string;
  edificioGarantia: string;
  numeroInteriorGarantia: string;
  cpGarantia: string;
  coloniaGarantia: string;
  alcaldiaMunicipioGarantia: string;
  estadoGarantia: string;
  entreCalleGarantia: string;
  yCalleGarantia: string;
  escrituraGarantia: string;
  numeroEscrituraGarantia: string;
  fechaEscrituraGarantia: string;
  notarioNumero: string;
  ciudadNotario: string;
  nombreNotario: string;
  datosRegistrales: string;
  fechaRegistro: string;
}

export interface InmuebleData {
  calle: string;
  numeroExterior: string;
  edificio: string;
  numeroInterior: string;
  cp: string;
  colonia: string;
  alcaldiaMunicipio: string;
  estado: string;
  entreCalle: string;
  yCalle: string;
  escritura: string;
  numeroEscritura: string;
  fechaEscritura: string;
  notarioNumero: string;
  ciudadNotario: string;
  nombreNotario: string;
  datosRegistrales: string;
  fechaRegistro: string;
}

export interface CaptureDataResponse {
  propietario: PropietarioData | null;
  inquilino: InquilinoData | null;
  fiador: FiadorData | null;
  inmueble: InmuebleData | null;
}

@Injectable({
  providedIn: 'root'
})
export class CaptureDataService {
  private readonly endpoint = '/capture-data';

  constructor(private apiService: ApiService) {}

  // Métodos para Propietario
  createPropietario(userId: string, data: PropietarioData): Observable<ApiResponse<PropietarioData>> {
    return this.apiService.post<PropietarioData>(`${this.endpoint}/propietario`, {
      userId,
      ...data
    });
  }

  getPropietario(userId: string): Observable<ApiResponse<PropietarioData>> {
    return this.apiService.get<PropietarioData>(`${this.endpoint}/propietario/${userId}`);
  }

  updatePropietario(userId: string, data: Partial<PropietarioData>): Observable<ApiResponse<PropietarioData>> {
    return this.apiService.patch<PropietarioData>(`${this.endpoint}/propietario/${userId}`, data);
  }

  // Métodos para Inquilino
  createInquilino(userId: string, data: InquilinoData): Observable<ApiResponse<InquilinoData>> {
    return this.apiService.post<InquilinoData>(`${this.endpoint}/inquilino`, {
      userId,
      ...data
    });
  }

  getInquilino(userId: string): Observable<ApiResponse<InquilinoData>> {
    return this.apiService.get<InquilinoData>(`${this.endpoint}/inquilino/${userId}`);
  }

  updateInquilino(userId: string, data: Partial<InquilinoData>): Observable<ApiResponse<InquilinoData>> {
    return this.apiService.patch<InquilinoData>(`${this.endpoint}/inquilino/${userId}`, data);
  }

  // Métodos para Fiador
  createFiador(userId: string, data: FiadorData): Observable<ApiResponse<FiadorData>> {
    return this.apiService.post<FiadorData>(`${this.endpoint}/fiador`, {
      userId,
      ...data
    });
  }

  getFiador(userId: string): Observable<ApiResponse<FiadorData>> {
    return this.apiService.get<FiadorData>(`${this.endpoint}/fiador/${userId}`);
  }

  updateFiador(userId: string, data: Partial<FiadorData>): Observable<ApiResponse<FiadorData>> {
    return this.apiService.patch<FiadorData>(`${this.endpoint}/fiador/${userId}`, data);
  }

  // Métodos para Inmueble
  createInmueble(userId: string, data: InmuebleData): Observable<ApiResponse<InmuebleData>> {
    return this.apiService.post<InmuebleData>(`${this.endpoint}/inmueble`, {
      userId,
      ...data
    });
  }

  getInmueble(userId: string): Observable<ApiResponse<InmuebleData>> {
    return this.apiService.get<InmuebleData>(`${this.endpoint}/inmueble/${userId}`);
  }

  updateInmueble(userId: string, data: Partial<InmuebleData>): Observable<ApiResponse<InmuebleData>> {
    return this.apiService.patch<InmuebleData>(`${this.endpoint}/inmueble/${userId}`, data);
  }

  // Método para obtener todos los datos de captura de un usuario
  getAllCaptureData(userId: string): Observable<ApiResponse<CaptureDataResponse>> {
    return this.apiService.get<CaptureDataResponse>(`${this.endpoint}/all/${userId}`);
  }

  // Método para guardar todos los datos de captura de una vez
  saveAllCaptureData(userId: string, data: {
    propietario?: PropietarioData;
    inquilino?: InquilinoData;
    fiador?: FiadorData;
    inmueble?: InmuebleData;
  }): Observable<any> {
    const requests: Observable<any>[] = [];

    if (data.propietario) {
      requests.push(this.createPropietario(userId, data.propietario));
    }
    if (data.inquilino) {
      requests.push(this.createInquilino(userId, data.inquilino));
    }
    if (data.fiador) {
      requests.push(this.createFiador(userId, data.fiador));
    }
    if (data.inmueble) {
      requests.push(this.createInmueble(userId, data.inmueble));
    }

    // Ejecutar todas las peticiones en paralelo
    return new Observable(observer => {
      if (requests.length === 0) {
        observer.next({ success: true, message: 'No hay datos para guardar' });
        observer.complete();
        return;
      }

      Promise.all(requests.map(req => req.toPromise()))
        .then(results => {
          observer.next({ success: true, data: results, message: 'Datos guardados exitosamente' });
          observer.complete();
        })
        .catch(error => {
          observer.error(error);
        });
    });
  }
}
