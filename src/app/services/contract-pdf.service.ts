import { Injectable } from '@angular/core';

import { PropietarioData, InquilinoData, FiadorData, InmuebleData } from '../wizard/wizard-flow/steps/data-entry-step/data-entry-step.component';

export interface ContractData {
  // Datos básicos del usuario
  userData: {
    name: string;
    email: string;
    phone: string;
    postalCode: string;
  };
  
  // Datos del contrato
  selectedPlan: string;
  quotationNumber: string;
  policyNumber?: string;
  contractDate: string;
  generationDate: string;
  
  // Configuración del contrato (para compatibilidad con contract-step)
  tipoPersona?: 'fisica' | 'moral';
  tipoPersonaArrendatario?: 'fisica' | 'moral';
  tipoInmueble?: 'casa' | 'oficina' | 'bodega' | 'comercial';
  giroComercial?: string;
  
  // Datos capturados en el formulario
  propietario: PropietarioData;
  inquilino: InquilinoData;
  fiador: FiadorData;
  inmueble: InmuebleData;
  
  // Cláusulas adicionales
  clausulasAdicionales: string[];
  requerimientosAdicionales: string;
}

@Injectable({
  providedIn: 'root'
})
export class ContractPdfService {

  constructor() { }

  /**
   * Genera el HTML del contrato con los datos dinámicos
   */
  generateContractHtml(data: ContractData): string {
    console.log('🔄 ContractPdfService.generateContractHtml() ejecutado');
    console.log('📋 Datos recibidos para generar contrato:', data);
    
    const template = this.getContractTemplate();
    console.log('📄 Template del contrato obtenido, longitud:', template.length);
    
    // Reemplazar variables básicas
    let html = template
      .replace(/\{\{userData\.name\}\}/g, data.userData.name || '')
      .replace(/\{\{userData\.email\}\}/g, data.userData.email || '')
      .replace(/\{\{userData\.phone\}\}/g, data.userData.phone || '')
      .replace(/\{\{userData\.postalCode\}\}/g, data.userData.postalCode || '')
      .replace(/\{\{selectedPlan\}\}/g, data.selectedPlan || '')
      .replace(/\{\{quotationNumber\}\}/g, data.quotationNumber || '')
      .replace(/\{\{policyNumber\}\}/g, data.policyNumber || 'Pendiente')
      .replace(/\{\{contractDate\}\}/g, data.contractDate || '')
      .replace(/\{\{generationDate\}\}/g, data.generationDate || '')
      .replace(/\{\{requerimientosAdicionales\}\}/g, data.requerimientosAdicionales || 'Ninguno');

    // Reemplazar datos del inmueble
    html = html
      .replace(/\{\{inmueble\.calle\}\}/g, this.formatDireccion(data.inmueble?.calle || ''))
      .replace(/\{\{inmueble\.numero\}\}/g, data.inmueble?.numeroExterior || '')
      .replace(/\{\{inmueble\.interior\}\}/g, data.inmueble?.numeroInterior || '')
      .replace(/\{\{inmueble\.colonia\}\}/g, this.formatDireccion(data.inmueble?.colonia || ''))
      .replace(/\{\{inmueble\.delegacion\}\}/g, this.formatDireccion(data.inmueble?.alcaldiaMunicipio || ''))
      .replace(/\{\{inmueble\.cp\}\}/g, data.inmueble?.cp || '');

    // Reemplazar datos del propietario
    html = html
      .replace(/\{\{arrendador\.nombre\}\}/g, this.formatNombre(data.propietario?.nombre || ''))
      .replace(/\{\{arrendador\.tipoPersona\}\}/g, this.getTipoPersonaText(data.propietario?.tipoPersona || 'fisica'));

    // Reemplazar datos del inquilino
    html = html
      .replace(/\{\{arrendatario\.nombre\}\}/g, this.formatNombre(data.inquilino?.nombre || ''))
      .replace(/\{\{arrendatario\.tipoPersona\}\}/g, this.getTipoPersonaText(data.inquilino?.tipoPersona || 'fisica'));

    // Reemplazar datos económicos
    html = html
      .replace(/\{\{renta\.monto\}\}/g, data.inmueble?.renta?.toString() || '0')
      .replace(/\{\{renta\.mantenimiento\}\}/g, data.inmueble?.mantenimiento?.toString() || '0')
      .replace(/\{\{renta\.formaPago\}\}/g, 'transferencia');

    // Reemplazar vigencia
    html = html
      .replace(/\{\{vigencia\.inicio\}\}/g, data.inmueble?.vigenciaInicio || '')
      .replace(/\{\{vigencia\.fin\}\}/g, data.inmueble?.vigenciaFin || '');

    // Reemplazar tipo de inmueble
    html = html
      .replace(/\{\{tipoInmueble\}\}/g, this.getTipoInmuebleText(data.inmueble?.tipoInmueble || 'casa'))
      .replace(/\{\{giroComercial\}\}/g, this.formatDireccion(data.inmueble?.giroComercial || ''));

    // Reemplazar campos específicos del contrato con placeholders dinámicos
    html = html
      .replace(/\{\{inmueble\.calle\}\}/g, this.formatDireccion(data.inmueble?.calle || '________'))
      .replace(/\{\{inmueble\.numero\}\}/g, data.inmueble?.numeroExterior || '___')
      .replace(/\{\{inmueble\.interior\}\}/g, data.inmueble?.numeroInterior || '___')
      .replace(/\{\{inmueble\.colonia\}\}/g, this.formatDireccion(data.inmueble?.colonia || '________'))
      .replace(/\{\{inmueble\.delegacion\}\}/g, this.formatDireccion(data.inmueble?.alcaldiaMunicipio || '________'))
      .replace(/\{\{inmueble\.cp\}\}/g, data.inmueble?.cp || '______')
      .replace(/\{\{arrendador\.nombre\}\}/g, this.formatNombre(data.propietario?.nombre || '________'))
      .replace(/\{\{arrendatario\.nombre\}\}/g, this.formatNombre(data.inquilino?.nombre || '________'))
      .replace(/\{\{arrendador\.domicilio\.calle\}\}/g, this.formatDireccion(data.propietario?.calle || '________'))
      .replace(/\{\{arrendador\.domicilio\.numero\}\}/g, data.propietario?.numeroExterior || '___')
      .replace(/\{\{arrendador\.domicilio\.interior\}\}/g, data.propietario?.edificio || '___')
      .replace(/\{\{arrendador\.domicilio\.colonia\}\}/g, this.formatDireccion(data.propietario?.colonia || '________'))
      .replace(/\{\{arrendador\.domicilio\.delegacion\}\}/g, this.formatDireccion(data.propietario?.alcaldiaMunicipio || '________'))
      .replace(/\{\{arrendador\.domicilio\.cp\}\}/g, data.propietario?.cp || '______')
      .replace(/\{\{renta\.monto\}\}/g, data.inmueble?.renta?.toString() || '0')
      .replace(/\{\{renta\.mantenimiento\}\}/g, data.inmueble?.mantenimiento?.toString() || '0')
      .replace(/\{\{vigencia\.inicio\}\}/g, data.inmueble?.vigenciaInicio || '___')
      .replace(/\{\{vigencia\.fin\}\}/g, data.inmueble?.vigenciaFin || '___')
      .replace(/\{\{tipoInmueble\}\}/g, this.getTipoInmuebleText(data.inmueble?.tipoInmueble || 'casa'))
      .replace(/\{\{contractDate\}\}/g, data.contractDate || '___')
      .replace(/\{\{generationDate\}\}/g, data.generationDate || '___');

    // Reemplazar cláusulas adicionales
    const clausulasHtml = data.clausulasAdicionales.length > 0 
      ? data.clausulasAdicionales.map(clausula => `<li>${clausula}</li>`).join('')
      : '<li>Ninguna cláusula adicional seleccionada</li>';
    
    html = html.replace(/\*ngFor="let clausula of clausulasAdicionales"\>.*?<\/li>/g, clausulasHtml);

    // Generar la carátula y agregarla al inicio del contrato
    const coverPage = this.generateCoverPage(data);
    
    // Envolver el contrato en su clase CSS
    const contractContent = `<div class="contract-content">${html}</div>`;
    
    const finalHtml = coverPage + contractContent;
    console.log('✅ HTML del contrato generado exitosamente, longitud total:', finalHtml.length);
    console.log('📋 Primeros 500 caracteres del HTML:', finalHtml.substring(0, 500));
    
    return finalHtml;
  }

  /**
   * Genera la carátula del contrato con los datos dinámicos
   */
  generateCoverPage(data: ContractData): string {
    // Usar las fechas reales de vigencia del inmueble si están disponibles
    let startDate: Date;
    let endDate: Date;
    
    if (data.inmueble?.vigenciaInicio && data.inmueble?.vigenciaFin) {
      // Usar fechas reales del inmueble
      console.log('📅 Fechas recibidas en ContractPdfService:', {
        vigenciaInicio: data.inmueble.vigenciaInicio,
        vigenciaFin: data.inmueble.vigenciaFin
      });
      
      // Las fechas pueden venir formateadas (30/9/2025) o como ISO (2025-09-30)
      let startDateParsed: Date;
      let endDateParsed: Date;
      
      if (data.inmueble.vigenciaInicio.includes('/')) {
        // Formato: 30/9/2025
        const [day, month, year] = data.inmueble.vigenciaInicio.split('/');
        startDateParsed = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      } else {
        // Formato ISO: 2025-09-30
        const [year, month, day] = data.inmueble.vigenciaInicio.split('-');
        startDateParsed = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      }
      
      if (data.inmueble.vigenciaFin.includes('/')) {
        // Formato: 30/10/2025
        const [day, month, year] = data.inmueble.vigenciaFin.split('/');
        endDateParsed = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      } else {
        // Formato ISO: 2025-10-30
        const [year, month, day] = data.inmueble.vigenciaFin.split('-');
        endDateParsed = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      }
      
      startDate = startDateParsed;
      endDate = endDateParsed;
      
      console.log('📅 Fechas procesadas correctamente:', {
        startDate: startDate.toLocaleDateString('es-MX'),
        endDate: endDate.toLocaleDateString('es-MX')
      });
    } else {
      // Fallback: usar fechas por defecto
      const currentDate = new Date();
      startDate = new Date(currentDate);
      endDate = new Date(currentDate);
      endDate.setFullYear(endDate.getFullYear() + 1);
      
      console.log('📅 Usando fechas por defecto (no hay fechas de vigencia)');
    }

    // Calcular la duración real entre las fechas
    const calculateDuration = (start: Date, end: Date): string => {
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      console.log('📅 Calculando duración:', {
        startDate: start.toLocaleDateString('es-MX'),
        endDate: end.toLocaleDateString('es-MX'),
        diffDays: diffDays
      });
      
      if (diffDays < 30) {
        return `${diffDays} día${diffDays > 1 ? 's' : ''}`;
      } else if (diffDays < 365) {
        const months = Math.floor(diffDays / 30);
        const remainingDays = diffDays % 30;
        
        if (remainingDays === 0) {
          return `${months} mes${months > 1 ? 'es' : ''}`;
        } else {
          return `${months} mes${months > 1 ? 'es' : ''} y ${remainingDays} día${remainingDays > 1 ? 's' : ''}`;
        }
      } else {
        const years = Math.floor(diffDays / 365);
        const remainingDays = diffDays % 365;
        const remainingMonths = Math.floor(remainingDays / 30);
        
        if (remainingMonths === 0) {
          return `${years} año${years > 1 ? 's' : ''}`;
        } else {
          return `${years} año${years > 1 ? 's' : ''} y ${remainingMonths} mes${remainingMonths > 1 ? 'es' : ''}`;
        }
      }
    };

    const duration = calculateDuration(startDate, endDate);
    console.log('📅 Duración calculada:', duration);

    const formatDate = (date: Date) => {
      const months = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 
                     'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
      return `${date.getDate()}-${months[date.getMonth()]}-${date.getFullYear()}`;
    };

    const formatDateLong = (date: Date) => {
      const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
                     'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
      return `${date.getDate()} de ${months[date.getMonth()]} del ${date.getFullYear()}`;
    };

    // Calcular totales
    const subtotal = data.inmueble?.renta || 0;
    const iva = subtotal * 0.16;
    const total = subtotal + iva;

    return `
      <div class="cover-page">
        <div class="cover-header">
          <div class="logo-section">
            <div class="logo">PJI</div>
          </div>
          <div class="title-section">
            <h1>PROTECCIÓN JURÍDICA INMOBILIARIA</h1>
            <h2>CARÁTULA DE PÓLIZA DE PRESTACIÓN DE SERVICIOS JURÍDICOS A FUTURO EN MATERIA DE ARRENDAMIENTO</h2>
          </div>
          <div class="contact-section">
            <div class="whatsapp-info">
              <i class="pi pi-whatsapp"></i>
              <span>55 8249 8689</span>
            </div>
            <p>Servicio al cliente ¿Cómo te atendimos?</p>
          </div>
        </div>

        <div class="cover-content">
          <div class="policy-info">
            <div class="policy-dates">
              <div class="info-item">
                <label>INICIO VIGENCIA</label>
                <span>${formatDate(startDate)}</span>
              </div>
              <div class="info-item">
                <label>FIN VIGENCIA</label>
                <span>${formatDate(endDate)}</span>
              </div>
              <div class="info-item">
                <label>TIEMPO</label>
                <span>${duration}</span>
              </div>
              <div class="info-item">
                <label>ELABORÓ</label>
                <span>ejecutivodepji</span>
              </div>
              <div class="payment-notice">
                <p>Tu pago se verá reflejado los 10 próximos días hábiles en la plataforma después de la entrega de tu carátula, en caso de no ver tu pago reflejado contáctanos a Servicio al Cliente.</p>
              </div>
            </div>

            <div class="qr-section">
              <div class="qr-code">
                <div class="qr-placeholder">QR CODE</div>
              </div>
              <div class="qr-instructions">
                <p>Escanea el QR y verifica la originalidad de tu póliza (ingresa el correo y contraseña)</p>
                <div class="login-info">
                  <p><strong>correo:</strong> clientespji@gmail.com</p>
                  <p><strong>contraseña:</strong> PJICliente@</p>
                </div>
              </div>
            </div>

            <div class="policy-financials">
              <div class="info-item">
                <label>PÓLIZA ANTERIOR (RENOVACIÓN)</label>
                <span>-</span>
              </div>
              <div class="info-item">
                <label>PÓLIZA NÚMERO</label>
                <span>${data.policyNumber || 'P-' + Math.floor(Math.random() * 10000)}</span>
              </div>
              <div class="info-item">
                <label>IMPORTE</label>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              <div class="info-item">
                <label>RECARGO</label>
                <span>0.00</span>
              </div>
              <div class="info-item">
                <label>SUBTOTAL</label>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              <div class="info-item">
                <label>IVA</label>
                <span>${iva.toFixed(2)}</span>
              </div>
              <div class="info-item total">
                <label>TOTAL</label>
                <span>${total.toFixed(2)}</span>
              </div>
              <div class="info-item">
                <label>COBERTURA</label>
                <span>${data.selectedPlan || 'ESENCIAL'}</span>
              </div>
              <div class="info-item">
                <label>PROTECT DOMINIO</label>
                <span>NO AMPARADA</span>
              </div>
            </div>
          </div>

          <div class="data-sections">
            <div class="data-section">
              <h3>Datos del beneficiario</h3>
              <div class="data-item">
                <label>Beneficiario</label>
                <span>${this.formatNombre(data.propietario?.nombre || '')}</span>
              </div>
            </div>

            <div class="data-section">
              <h3>Datos del arrendatario</h3>
              <div class="data-item">
                <label>Inquilino</label>
                <span>${this.formatNombre(data.inquilino?.nombre || '')}</span>
              </div>
            </div>

            <div class="data-section">
              <h3>Datos del inmueble arrendado</h3>
              <div class="data-grid">
                <div class="data-item">
                  <label>Calle</label>
                  <span>${this.formatDireccion(data.inmueble?.calle || '')}</span>
                </div>
                <div class="data-item">
                  <label>No. Exterior</label>
                  <span>${data.inmueble?.numeroExterior || ''}</span>
                </div>
                <div class="data-item">
                  <label>No. Interior</label>
                  <span>${data.inmueble?.numeroInterior || ''}</span>
                </div>
                <div class="data-item">
                  <label>Edificio</label>
                  <span>-</span>
                </div>
                <div class="data-item">
                  <label>CP</label>
                  <span>${data.inmueble?.cp || ''}</span>
                </div>
                <div class="data-item">
                  <label>Colonia</label>
                  <span>${this.formatDireccion(data.inmueble?.colonia || '')}</span>
                </div>
                <div class="data-item">
                  <label>Alcaldía o Municipio</label>
                  <span>${this.formatDireccion(data.inmueble?.alcaldiaMunicipio || '')}</span>
                </div>
                <div class="data-item">
                  <label>Estado</label>
                  <span>${this.formatDireccion(data.inmueble?.estado || '')}</span>
                </div>
                <div class="data-item">
                  <label>Uso del inmueble</label>
                  <span>CASA/DEPARTAMENTO</span>
                </div>
              </div>
            </div>

            <div class="data-section">
              <h3>Datos del fiador</h3>
              <div class="data-grid">
                <div class="data-item">
                  <label>Nombre</label>
                  <span>${this.formatNombre(data.fiador?.nombre || '')}</span>
                </div>
                <div class="data-item">
                  <label>Calle</label>
                  <span>${this.formatDireccion(data.fiador?.calle || '')}</span>
                </div>
                <div class="data-item">
                  <label>No. Exterior</label>
                  <span>${data.fiador?.numeroExterior || ''}</span>
                </div>
                <div class="data-item">
                  <label>No. Interior</label>
                  <span>${data.fiador?.numeroInteriorGarantia || ''}</span>
                </div>
                <div class="data-item">
                  <label>Edificio</label>
                  <span>${this.formatDireccion(data.fiador?.edificioGarantia || '')}</span>
                </div>
                <div class="data-item">
                  <label>CP</label>
                  <span>${data.fiador?.cpGarantia || ''}</span>
                </div>
                <div class="data-item">
                  <label>Colonia</label>
                  <span>${this.formatDireccion(data.fiador?.coloniaGarantia || '')}</span>
                </div>
                <div class="data-item">
                  <label>Alcaldía o Municipio</label>
                  <span>${this.formatDireccion(data.fiador?.alcaldiaMunicipioGarantia || '')}</span>
                </div>
                <div class="data-item">
                  <label>Estado</label>
                  <span>${this.formatDireccion(data.fiador?.estadoGarantia || '')}</span>
                </div>
              </div>
            </div>

            <div class="data-section">
              <h3>Inmueble en garantía</h3>
              <div class="data-grid">
                <div class="data-item">
                  <label>Calle</label>
                  <span>${this.formatDireccion(data.fiador?.calleGarantia || '')}</span>
                </div>
                <div class="data-item">
                  <label>No. Exterior</label>
                  <span>${data.fiador?.numeroExteriorGarantia || ''}</span>
                </div>
                <div class="data-item">
                  <label>No. Interior</label>
                  <span>${data.fiador?.numeroInteriorGarantia || ''}</span>
                </div>
                <div class="data-item">
                  <label>Edificio</label>
                  <span>${this.formatDireccion(data.fiador?.edificioGarantia || '')}</span>
                </div>
                <div class="data-item">
                  <label>CP</label>
                  <span>${data.fiador?.cpGarantia || ''}</span>
                </div>
                <div class="data-item">
                  <label>Colonia</label>
                  <span>${this.formatDireccion(data.fiador?.coloniaGarantia || '')}</span>
                </div>
                <div class="data-item">
                  <label>Alcaldía o Municipio</label>
                  <span>${this.formatDireccion(data.fiador?.alcaldiaMunicipioGarantia || '')}</span>
                </div>
                <div class="data-item">
                  <label>Estado</label>
                  <span>${this.formatDireccion(data.fiador?.estadoGarantia || '')}</span>
                </div>
              </div>
            </div>

            <div class="data-section">
              <h3>Datos del contrato</h3>
              <div class="data-grid">
                <div class="data-item">
                  <label>Oficina Inmobiliaria</label>
                  <span>INDEPENDIENTE</span>
                </div>
                <div class="data-item">
                  <label>Asesor</label>
                  <span>MARISOL ESPINOSA HERNANDEZ</span>
                </div>
                <div class="data-item">
                  <label>Monto de la renta mensual</label>
                  <span>$${(data.inmueble?.renta || 0).toFixed(2)}</span>
                </div>
                <div class="data-item">
                  <label>Tiempo Contrato</label>
                  <span>${duration}</span>
                </div>
                <div class="data-item">
                  <label>vigencia</label>
                  <span>${formatDateLong(startDate)} hasta el día ${formatDateLong(endDate)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="cover-footer">
          <div class="contact-numbers">
            <p>55 8249 8689 | 55 1234 5678 | 55 9876 5432 | 55 1111 2222 | 55 3333 4444</p>
          </div>
          <div class="website">
            <p>www.proteccionjuridica.com.mx/</p>
          </div>
          <div class="partners">
            <div class="partner-logo">SOCIO</div>
            <div class="partner-logo">R</div>
            <div class="partner-logo">COPIM</div>
            <div class="partner-logo">SUMA</div>
          </div>
          <div class="legal-disclaimer">
            <p>PROTECCION INMOBILIARIA TOTAL, S.A. DE C.V., (DENOMINADA EN ADELANTE "PROTECCION JURIDICA INMOBILIARIA"), PRESTARÁ AL CONTRATANTE (QUE EN LO SUCESIVO SE DENOMINA "BENEFICIARIO"), SUS SERVICIOS JURÍDICOS PROFESIONALES, CONFORME A LAS CONDICIONES GENERALES DE CONTRATO ANEXAS.</p>
          </div>
          <div class="signature-line">
            <p>Nombre y Firma de quien recibe la Póliza:</p>
            <div class="signature-space"></div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Obtiene el texto del tipo de inmueble
   */
  private getTipoInmuebleText(tipo: string): string {
    const tipoLower = tipo?.toLowerCase() || 'casa';
    switch (tipoLower) {
      case 'casa':
        return 'CASA/HABITACIÓN';
      case 'oficina':
        return 'OFICINAS';
      case 'bodega':
        return 'BODEGA';
      case 'comercial':
        return 'LOCAL COMERCIAL';
      default:
        return 'CASA/HABITACIÓN';
    }
  }

  /**
   * Obtiene el texto del tipo de persona
   */
  private getTipoPersonaText(tipo: string): string {
    const tipoLower = tipo?.toLowerCase() || 'fisica';
    switch (tipoLower) {
      case 'fisica':
        return 'PERSONA FÍSICA';
      case 'moral':
        return 'PERSONA MORAL';
      default:
        return 'PERSONA FÍSICA';
    }
  }

  /**
   * Obtiene el texto del estado civil
   */
  private getEstadoCivilText(estado: string): string {
    const estadoLower = estado?.toLowerCase() || '';
    switch (estadoLower) {
      case 'soltero':
      case 'soltera':
        return 'SOLTERO(A)';
      case 'casado':
      case 'casada':
        return 'CASADO(A)';
      case 'divorciado':
      case 'divorciada':
        return 'DIVORCIADO(A)';
      case 'viudo':
      case 'viuda':
        return 'VIUDO(A)';
      case 'union libre':
      case 'unión libre':
        return 'UNIÓN LIBRE';
      default:
        return estado ? estado.toUpperCase() : '';
    }
  }

  /**
   * Formatea nombres propios (primera letra mayúscula)
   */
  private formatNombre(nombre: string): string {
    if (!nombre) return '';
    return nombre.toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Formatea direcciones (primera letra mayúscula)
   */
  private formatDireccion(direccion: string): string {
    if (!direccion) return '';
    return direccion.toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Convierte HTML a PDF usando jsPDF con mejor configuración
   */
  async generatePdfFromHtml(html: string, filename: string = 'contrato-pji.pdf'): Promise<Blob> {
    try {
      // Usar jsPDF con mejor configuración para texto
      const { jsPDF } = await import('jspdf');
      
      // Crear un nuevo documento PDF
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      // Configurar fuente y tamaño
      pdf.setFont('times', 'normal');
      pdf.setFontSize(12);

      // Dividir el HTML en líneas y agregar al PDF
      const lines = this.parseHtmlToLines(html);
      
      let yPosition = 20; // Margen superior
      const pageHeight = 297; // Altura A4 en mm
      const marginBottom = 20; // Margen inferior
      const lineHeight = 6; // Altura de línea

      for (const line of lines) {
        // Verificar si necesitamos una nueva página
        if (yPosition + lineHeight > pageHeight - marginBottom) {
          pdf.addPage();
          yPosition = 20;
        }

        // Agregar la línea al PDF
        pdf.text(line.text, 15, yPosition); // Margen izquierdo de 15mm
        yPosition += lineHeight;
      }

      return pdf.output('blob');
    } catch (error) {
      console.error('Error generando PDF:', error);
      throw error;
    }
  }

  /**
   * Parsea HTML y lo convierte en líneas de texto para el PDF
   */
  private parseHtmlToLines(html: string): Array<{text: string, isTitle?: boolean}> {
    // Crear un elemento temporal para parsear el HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    
    const lines: Array<{text: string, isTitle?: boolean}> = [];
    
    // Función recursiva para extraer texto
    const extractText = (node: ChildNode) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent?.trim();
        if (text) {
          lines.push({ text });
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as Element;
        
        // Manejar títulos
        if (el.tagName === 'H1' || el.tagName === 'H2' || el.tagName === 'H3') {
          lines.push({ text: el.textContent?.trim() || '', isTitle: true });
        } else {
          // Procesar hijos
          Array.from(el.childNodes).forEach(extractText);
        }
      }
    };
    
    Array.from(tempDiv.childNodes).forEach(extractText);
    
    return lines;
  }

  /**
   * Descarga el PDF generado
   */
  async downloadPdf(data: ContractData, filename: string = 'contrato-pji.pdf'): Promise<void> {
    try {
      const html = this.generateContractHtml(data);
      const pdfBlob = await this.generatePdfFromHtml(html, filename);
      
      // Crear enlace de descarga
      const url = window.URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error generando PDF:', error);
      throw error;
    }
  }

  /**
   * Obtiene el template del contrato de arrendamiento
   */
  private getContractTemplate(): string {
    console.log('📄 Obteniendo template del contrato...');
    const template = this.generateFullContractTemplate();
    console.log('📄 Template obtenido, longitud:', template.length);
    return template;
  }

  /**
   * Genera el template completo del contrato con todas las cláusulas
   */
  private generateFullContractTemplate(): string {
    return this.generateCompleteContractTemplate();
  }

  /**
   * Genera el contrato completo con todas las cláusulas del documento original
   */
  private generateCompleteContractTemplate(): string {
    return `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Contrato de Arrendamiento - PJI</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Times+New+Roman:wght@400;700&display=swap');
        
        body {
            font-family: 'Times New Roman', Times, serif;
            font-size: 12pt;
            line-height: 1.5;
            margin: 0;
            padding: 2.5cm 1.5cm;
            color: #000;
            text-align: justify !important;
        }
        
        * {
            text-align: justify !important;
        }
        
        div, span, p, li, td, strong, em, i, b {
            text-align: justify !important;
        }
        
        // Sobrescribir cualquier estilo que pueda estar causando centrado
        .contract-content {
            text-align: justify !important;
        }
        
        .contract-content * {
            text-align: justify !important;
        }
        
        .contract-header {
            text-align: center;
            margin-bottom: 30px;
            font-weight: bold;
            font-size: 14pt;
        }
        
        .contract-title {
            font-size: 16pt;
            font-weight: bold;
            text-align: center;
            margin-bottom: 20px;
            text-transform: uppercase;
        }
        
        .declarations-section {
            margin-bottom: 20px;
        }
        
        .declaration-title {
            font-weight: bold;
            font-size: 13pt;
            margin-bottom: 10px;
            text-transform: uppercase;
        }
        
        .declaration-item p {
            margin-bottom: 8px;
            text-align: justify !important;
            text-indent: 0;
            font-size: 12pt;
            line-height: 1.5;
        }
        
        .clause-content p {
            margin-bottom: 8px;
            text-align: justify !important;
            text-indent: 0;
            font-size: 12pt;
            line-height: 1.5;
        }
        
        p {
            font-size: 12pt;
            line-height: 1.5;
            text-align: justify !important;
        }
        
        strong {
            font-weight: bold;
            font-size: 12pt;
        }
        
        .clauses-section {
            margin-top: 30px;
        }
        
        .clause-title {
            font-weight: bold;
            font-size: 13pt;
            margin-bottom: 10px;
            text-transform: uppercase;
        }
        
        .clause-content {
            margin-bottom: 15px;
            text-align: justify !important;
        }
        
        .signature-section {
            margin-top: 40px;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
        }
        
        .signature-box {
            width: 45%;
            text-align: center;
        }
        
        .signature-line {
            border-bottom: 1px solid #000;
            height: 30px;
            margin-bottom: 10px;
        }
        
        .signature-label {
            font-weight: bold;
            font-size: 11pt;
        }
        
        .field-blank {
            border-bottom: 1px solid #000;
            display: inline-block;
            min-width: 100px;
            height: 12px;
            margin: 0 5px;
            font-size: 12pt;
        }
        
        .page-break {
            page-break-before: always;
        }
        
        .text-center {
            text-align: center !important;
            font-size: 10pt;
            margin-top: 30px;
        }
        
        .text-center p {
            font-size: 10pt;
            margin-bottom: 10px;
        }
        
        .text-uppercase {
            text-transform: uppercase;
        }
        
        .font-bold {
            font-weight: bold;
        }
        
        ul {
            margin: 10px 0;
            padding-left: 20px;
        }
        
        li {
            margin-bottom: 5px;
        }
    </style>
</head>
<body>
    <div class="contract-header">
        <div class="contract-title">CONTRATO DE ARRENDAMIENTO</div>
        <p style="text-align: justify !important;"><strong>QUE CELEBRAN POR UNA PARTE</strong> <span class="field-blank">{{arrendador.nombre}}</span>, <strong>A QUIEN EN LO SUCESIVO Y PARA LOS EFECTOS DEL PRESENTE CONTRATO SE LE DENOMINARA "EL ARRENDADOR", POR LA OTRA PARTE</strong> <span class="field-blank">{{arrendatario.nombre}}</span>, <strong>A QUIEN EN LO SUCESIVO Y PARA LOS EFECTOS DEL PRESENTE CONTRATO SE LE DENOMINARA "EL ARRENDATARIO"</strong>, <strong>CONJUNTAMENTE SE LES DENOMINARA "LAS PARTES", QUIENES MANIFIESTAN QUE ES SU VOLUNTAD SUJETARSE A LAS SIGUIENTES DECLARACIONES Y CLAUSULAS:</strong></p>
    </div>
    
    <div class="declarations-section">
        <div class="declaration-title">D E C L A R A C I O N E S</div>
        
        <div class="declaration-item">
            <p style="text-align: justify !important;"><strong>I.- DECLARA "EL ARRENDADOR":</strong></p>
            <p style="text-align: justify !important;">a) Que cuenta con la capacidad jurídica suficiente y bastante para celebrar el presente contrato.</p>
            <p style="text-align: justify !important;">b) Que es propietario del inmueble ubicado en CALLE <span class="field-blank">{{inmueble.calle}}</span> NÚMERO <span class="field-blank">{{inmueble.numero}}</span> INTERIOR <span class="field-blank">{{inmueble.interior}}</span>, COLONIA <span class="field-blank">{{inmueble.colonia}}</span>, DELEGACIÓN <span class="field-blank">{{inmueble.delegacion}}</span>, CIUDAD DE MÉXICO, C.P. <span class="field-blank">{{inmueble.cp}}</span>.</p>
            <p style="text-align: justify !important;">c) Que para efectos de este contrato señala como su domicilio convencional para oír y recibir toda clase de documentos y notificaciones el ubicado en CALLE <span class="field-blank">{{arrendador.domicilio.calle}}</span> NÚMERO <span class="field-blank">{{arrendador.domicilio.numero}}</span> INTERIOR <span class="field-blank">{{arrendador.domicilio.interior}}</span>, COLONIA <span class="field-blank">{{arrendador.domicilio.colonia}}</span>, DELEGACIÓN <span class="field-blank">{{arrendador.domicilio.delegacion}}</span>, CIUDAD DE MÉXICO, C.P. <span class="field-blank">{{arrendador.domicilio.cp}}</span>.</p>
        </div>
        
        <div class="declaration-item">
            <p style="text-align: justify !important;"><strong>II.- DECLARA "EL ARRENDATARIO":</strong></p>
            <p style="text-align: justify !important;">a) Que tiene las facultades suficientes y bastantes para obligarse en términos del presente instrumento.</p>
            <p style="text-align: justify !important;">b) Que tiene interés en recibir en arrendamiento el inmueble que se describe en el inciso b) de la declaración número I (uno romano), el cual sabe y le consta se encuentra en las condiciones necesarias de seguridad, higiene y salubridad para ser habitado y que se encuentra en perfecto estado de uso, por lo que no condicionará el pago de rentas a por ningún tipo de mejora.</p>
            <p style="text-align: justify !important;">c) Que para efectos de este contrato señala como su domicilio convencional para oír y recibir todo tipo de notificaciones y documentos el mismo del inmueble motivo del arrendamiento.</p>
        </div>
    </div>
    
    <div class="clauses-section">
        <div class="clause-title">C L A U S U L A S</div>
        
        <div class="clause-content">
            <p style="text-align: justify !important;"><strong>PRIMERA.- OBJETO.-</strong> "EL ARRENDADOR" da en arrendamiento a "EL ARRENDATARIO", y éste toma en dicha calidad, el inmueble que se encuentra ubicado en domicilio descrito en el inciso b) de la declaración I (uno romano) que antecede en el capítulo de declaraciones, mismo que se tiene como si se encontrara inserto a la letra para todos los efectos legales a que haya lugar.</p>
        </div>
        
        <div class="clause-content">
            <p style="text-align: justify !important;"><strong>SEGUNDA.- RENTA.-</strong> "LAS PARTES" convienen voluntariamente y de común acuerdo que "EL ARRENDATARIO" pagará a "EL ARRENDADOR" o a quien sus intereses represente de manera incondicional por concepto de contraprestación, una renta mensual en los siguientes términos:</p>
            <p style="text-align: justify !important;">El monto de la renta mensual será de $<span class="field-blank">{{renta.monto}}</span> ({{renta.monto}} PESOS 00/100 M.N.) incluido el pago de mantenimiento. más la cantidad de $<span class="field-blank">{{renta.mantenimiento}}</span> ({{renta.mantenimiento}} PESOS 00/100 M.N.) por concepto de mantenimiento, por lo que si hubiere algún incremento del mismo, este pago correrá a cargo de "EL ARRENDATARIO".</p>
            <p style="text-align: justify !important;">El pago mensual de la renta, será por meses adelantados, siéndole forzoso a "EL ARRENDATARIO" cubrir íntegra la mensualidad, aun cuando no usare el inmueble durante el mes completo.</p>
            <p style="text-align: justify !important;">A la fecha de la firma del presente instrumento, "EL ARRENDATARIO" paga a "EL ARRENDADOR", el primer mes de renta, sirviendo el presente contrato como el recibo más eficaz que en derecho corresponde.</p>
        </div>
        
        <div class="clause-content">
            <strong>TERCERA.- DEPÓSITO EN GARANTÍA.-</strong> A la fecha de firma del presente contrato, "EL ARRENDATARIO" entrega a "EL ARRENDADOR" por concepto de depósito en garantía una cantidad igual al importe de UN MES de la renta establecida en el inciso a) de la cláusula segunda de este contrato. "LAS PARTES" acuerdan que "EL ARRENDADOR" no aplicará el depósito en garantía al pago de cualquier mensualidad vencida o de cualquier otra obligación incumplida por parte de "EL ARRENDATARIO" durante la vigencia del arrendamiento.
        </div>
        
        <div class="clause-content">
            <strong>CUARTA.- VIGENCIA.-</strong> El plazo de vigencia del presente contrato es de un año forzoso para "LAS PARTES", iniciando su vigencia el día <span class="field-blank">{{vigencia.inicio}}</span> y concluyendo el día <span class="field-blank">{{vigencia.fin}}</span>, por lo que es obligación de "EL ARRENDATARIO" dar aviso por escrito a "EL ARRENDADOR" con treinta días de anticipación a su vencimiento, si es su deseo renovar el presente arrendamiento.
        </div>
        
        <div class="clause-content">
            <strong>QUINTA.- SERVICIOS.-</strong> "EL ARRENDATARIO" se obliga a pagar oportunamente el importe de los servicios de: suministro de energía eléctrica, agua potable y gas, así como a entregar los recibos originales por tales conceptos ya liquidados a "EL ARRENDADOR" o a quien sus intereses represente de manera periódica.
        </div>
        
        <div class="clause-content">
            <strong>SEXTA.- ESTACIONAMIENTO.-</strong> El inmueble motivo del presente arrendamiento NO cuenta con cajón de estacionamiento. "EL ARRENDATARIO" deberá ocupar para estacionar su automóvil únicamente en el(los) espacio(s) que le sea(n) asignado(s) para tal efecto y solo en caso de ser necesario brindar las facilidades pertinentes para que se pueda mover su auto a fin de permitir la circulación de los demás vehículos.
        </div>
        
        <div class="clause-content">
            <strong>SÉPTIMA.- ACONDICIONAMIENTO DEL INMUEBLE.-</strong> Todas las mejoras, modificaciones y adaptaciones que se realicen en el inmueble deberán ponerse a consideración de "EL ARRENDADOR" y podrán realizarse únicamente con la autorización por escrito de éste, las cuales serán cubiertas íntegramente por "EL ARRENDATARIO", así como los desperfectos no atribuibles al uso normal del inmueble, accesorios y mobiliario originados por descuido o negligencia de "EL ARRENDATARIO".
        </div>
        
        <div class="clause-content">
            <strong>OCTAVA.- MANTENIMIENTO DEL INMUEBLE.-</strong> "EL ARRENDATARIO" deberá mantener limpios los conductos de cañerías y/o drenajes del inmueble para evitar humedades y goteras y solo en caso de ser necesario mantener limpias las áreas abiertas, pues de no hacerlo así cualquier daño causado por esta omisión correrá por su cuenta ya que este tipo de mantenimiento es de su entera responsabilidad.
        </div>
        
        <div class="clause-content">
            <strong>NOVENA.- FORMA DE USO.-</strong> "EL ARRENDATARIO" podrá gozar y disponer del inmueble arrendado en forma ordenada y tranquila no debiendo destinarlo a usos contrarios a la moral y a las buenas costumbres, observando las disposiciones y limitaciones establecidas ya sea por el reglamento del condominio o por la legislación aplicable.
        </div>
        
        <div class="clause-content">
            <strong>DÉCIMA.- USO DE SUELO.-</strong> El uso del inmueble será destinado únicamente para <span class="field-blank">{{tipoInmueble}}</span>, quedando prohibido a "EL ARRENDATARIO" cambiar el uso referido y éste lo acepta expresamente, salvo autorización por escrito que le dé "EL ARRENDADOR". "LAS PARTES" convienen que "EL ARRENDADOR" no es responsable de las autorizaciones y licencias relacionadas con el uso de suelo del inmueble, siendo responsabilidad total de "EL ARRENDATARIO" el cerciorarse previamente a la celebración del presente contrato, de que el uso que pretende dar al inmueble en materia de esta operación esté permitido por las autoridades competentes.
        </div>
        
        <div class="clause-content" *ngIf="clausulasAdicionales.length > 0">
            <strong>CLÁUSULAS ADICIONALES:</strong>
            <ul>
                <li *ngFor="let clausula of clausulasAdicionales">{{clausula}}</li>
            </ul>
        </div>
        
        <div class="clause-content" *ngIf="requerimientosAdicionales">
            <strong>REQUERIMIENTOS ADICIONALES:</strong>
            <p>{{requerimientosAdicionales}}</p>
        </div>
    </div>
    
    <div class="signature-section">
        <div class="signature-box">
            <div class="signature-line"></div>
            <div class="signature-label">"EL ARRENDADOR"</div>
        </div>
        <div class="signature-box">
            <div class="signature-line"></div>
            <div class="signature-label">"EL ARRENDATARIO"</div>
        </div>
    </div>
    
    <div class="text-center" style="margin-top: 30px; font-size: 9pt;">
        <p>LEIDO QUE FUE EL PRESENTE INSTRUMENTO CONSTANTE DE 6 FOJAS UTILES Y ENTERADAS QUE FUERON "LAS PARTES" QUE EN EL INTERVIENEN, DE SU CONTENIDO, VALOR Y ALCANCE LEGAL, PARA SU CONSTANCIA LO FIRMAN AL MARGEN EN CADA UNA DE SUS HOJAS CON EXCEPCION DE LA ULTIMA QUE SE FIRMA AL CALCE POR _____PLICADO, EL DIA {{contractDate}} EN LA CIUDAD DE MÉXICO.</p>
        <p><strong>Documento generado automáticamente por PJI - Protección Jurídica Inmobiliaria</strong></p>
        <p>{{generationDate}}</p>
    </div>
</body>
</html>`;
  }
}
