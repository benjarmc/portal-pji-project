import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService, ApiResponse } from './api.service';
import { LoggerService } from './logger.service';

export interface BuroCreditoConsulta {
  persona: {
    cuentaC?: Array<{
      claveOtorgante?: string;
      nombreOtorgante?: string;
      numeroCuenta: string;
    }>;
    domicilios?: Array<{
      ciudad?: string;
      codPais?: string;
      coloniaPoblacion?: string;
      cp?: string;
      delegacionMunicipio?: string;
      direccion1?: string;
      direccion2?: string;
      estado?: string;
      extension?: string;
      fax?: string;
      fechaResidencia?: string;
      indicadorEspecialDomicilio?: string;
      numeroTelefono?: string;
      tipoDomicilio?: string;
    }>;
    empleos?: Array<{
      baseSalarial?: string;
      cargo?: string;
      ciudad?: string;
      claveMonedaSalario?: string;
      codPais?: string;
      coloniaPoblacion?: string;
      cp?: string;
      delegacionMunicipio?: string;
      direccion1?: string;
      direccion2?: string;
      estado?: string;
      extension?: string;
      fax?: string;
      fechaContratacion?: string;
      fechaUltimoDiaEmpleo?: string;
      nombreEmpresa?: string;
      numeroEmpleado?: string;
      numeroTelefono?: string;
      salario?: string;
    }>;
    encabezado: {
      clavePais: string;
      claveUnidadMonetaria: string;
      identificadorBuro: string;
      idioma: string;
      importeContrato: string;
      numeroReferenciaOperador: string;
      productoRequerido?: string;
      tipoConsulta: string;
      tipoContrato: string;
    };
    nombre: {
      apellidoAdicional?: string;
      apellidoMaterno: string;
      apellidoPaterno: string;
      claveImpuestosOtroPais?: string;
      claveOtroPais?: string;
      edadesDependientes?: string;
      estadoCivil: string;
      fechaNacimiento: string;
      nacionalidad?: string;
      numeroCedulaProfesional?: string;
      numeroDependientes?: string;
      numeroLicenciaConducir?: string;
      numeroRegistroElectoral?: string;
      prefijo?: string;
      primerNombre: string;
      residencia: string;
      rfc: string;
      segundoNombre?: string;
      sexo: string;
      sufijo?: string;
    };
  };
}

export interface BuroCreditoRequest {
  consulta: BuroCreditoConsulta;
  userId?: string;
  quotationId?: string;
  policyId?: string;
}

export interface BuroCreditoResponse {
  id: string;
  userId?: string;
  quotationId?: string;
  policyId?: string;
  consultaData: BuroCreditoConsulta;
  respuestaData?: any;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'ERROR';
  errorCode?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class BuroCreditoService {
  constructor(
    private apiService: ApiService,
    private logger: LoggerService
  ) {}

  /**
   * Crear consulta al Buro de Crédito
   */
  createConsulta(request: BuroCreditoRequest): Observable<ApiResponse<BuroCreditoResponse>> {
    this.logger.log('📋 Creando consulta al Buro de Crédito:', request);
    return this.apiService.post<BuroCreditoResponse>('/buro-credito', request);
  }

  /**
   * Obtener consulta por ID
   */
  getConsulta(id: string): Observable<ApiResponse<BuroCreditoResponse>> {
    return this.apiService.get<BuroCreditoResponse>(`/buro-credito/${id}`);
  }

  /**
   * Obtener consultas por userId
   */
  getConsultasByUserId(userId: string): Observable<ApiResponse<BuroCreditoResponse[]>> {
    return this.apiService.get<BuroCreditoResponse[]>(`/buro-credito/user/${userId}`);
  }

  /**
   * Obtener consultas por quotationId
   */
  getConsultasByQuotationId(quotationId: string): Observable<ApiResponse<BuroCreditoResponse[]>> {
    return this.apiService.get<BuroCreditoResponse[]>(`/buro-credito/quotation/${quotationId}`);
  }

  /**
   * Obtener consultas por policyId
   */
  getConsultasByPolicyId(policyId: string): Observable<ApiResponse<BuroCreditoResponse[]>> {
    return this.apiService.get<BuroCreditoResponse[]>(`/buro-credito/policy/${policyId}`);
  }

  /**
   * Obtener la última consulta de un usuario
   */
  getLatestByUserId(userId: string): Observable<ApiResponse<BuroCreditoResponse>> {
    return this.apiService.get<BuroCreditoResponse>(`/buro-credito/user/${userId}/latest`);
  }

  /**
   * Obtener la última consulta por policyId
   */
  getLatestByPolicyId(policyId: string): Observable<ApiResponse<BuroCreditoResponse>> {
    return this.apiService.get<BuroCreditoResponse>(`/buro-credito/policy/${policyId}/latest`);
  }

  /**
   * Obtener la última consulta por quotationId
   */
  getLatestByQuotationId(quotationId: string): Observable<ApiResponse<BuroCreditoResponse>> {
    return this.apiService.get<BuroCreditoResponse>(`/buro-credito/quotation/${quotationId}/latest`);
  }

  /**
   * Actualizar consulta al Buro de Crédito
   */
  updateConsulta(id: string, request: BuroCreditoRequest): Observable<ApiResponse<BuroCreditoResponse>> {
    this.logger.log(`📋 Actualizando consulta al Buro de Crédito: ${id}`, request);
    return this.apiService.patch<BuroCreditoResponse>(`/buro-credito/${id}`, request);
  }
}

