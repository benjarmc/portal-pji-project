import { Component, Output, EventEmitter, OnInit, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OpenPayService, OpenPayCardData, OpenPayTokenResponse } from '../../../services/openpay.service';
import { PaymentsService, PaymentData } from '../../../services/payments.service';
import { QuotationsService } from '../../../services/quotations.service';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-payment-step',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './payment-step.component.html',
  styleUrls: ['./payment-step.component.scss']
})
export class PaymentStepComponent implements OnInit {
  @Output() next = new EventEmitter<any>(); // Cambiar a any para incluir datos del pago
  @Output() previous = new EventEmitter<void>();
  @Input() quotationId?: string;
  @Input() quotationData?: any;
  @Input() userId?: string; // Agregar userId como Input

  // Datos de la tarjeta
  cardData: OpenPayCardData = {
    card_number: '',
    holder_name: '',
    expiration_year: '',
    expiration_month: '',
    cvv2: ''
  };

  // Estados del componente
  isProcessing = false;
  cardType = '';
  deviceDataId = '';
  paymentError = '';
  paymentSuccess = '';
  showQuotationSummary = true; // Siempre mostrar resumen de cotización

  // Errores de validación
  cardErrors = {
    number: '',
    cvv: '',
    expiry: ''
  };

  // Opciones para los selects
  months = [
    { value: '01', label: '01 - Enero' },
    { value: '02', label: '02 - Febrero' },
    { value: '03', label: '03 - Marzo' },
    { value: '04', label: '04 - Abril' },
    { value: '05', label: '05 - Mayo' },
    { value: '06', label: '06 - Junio' },
    { value: '07', label: '07 - Julio' },
    { value: '08', label: '08 - Agosto' },
    { value: '09', label: '09 - Septiembre' },
    { value: '10', label: '10 - Octubre' },
    { value: '11', label: '11 - Noviembre' },
    { value: '12', label: '12 - Diciembre' }
  ];

  years: string[] = [];

  // Plan seleccionado y precio (viene del wizard)
  selectedPlan = 'Póliza Jurídica Digital';
  planPrice = 0;
  quotationNumber = '';
  quotationAmount = 0;
  quotationCurrency = 'MXN';

  constructor(
    private openPayService: OpenPayService,
    private paymentsService: PaymentsService,
    private quotationsService: QuotationsService
  ) {
    // Generar años de 2 dígitos (actual + 10 años)
    const currentYear = new Date().getFullYear();
    for (let i = 0; i < 10; i++) {
      const year = currentYear + i;
      this.years.push(year.toString().slice(-2)); // Solo los últimos 2 dígitos
    }
  }

  ngOnInit() {
    console.log('🔄 PaymentStepComponent ngOnInit');
    console.log('📊 quotationId recibido:', this.quotationId);
    console.log('📊 quotationData recibido:', this.quotationData);
    
    // Configurar OpenPay usando environment
    this.openPayService.configure(
      environment.openpay.merchantId,
      environment.openpay.publicKey,
      environment.openpay.sandboxMode
    );

    // Configurar device data para detección de fraude
    this.deviceDataId = this.openPayService.setupDeviceData('paymentForm');

    // Cargar datos de cotización si están disponibles
    if (this.quotationData) {
      console.log('✅ Cargando datos de cotización desde quotationData');
      this.loadQuotationData();
    } else {
      console.log('⚠️ No hay quotationData, intentando cargar desde estado del wizard');
      this.loadQuotationFromWizardState();
    }
  }

  /**
   * Cargar datos de la cotización
   */
  loadQuotationData() {
    if (this.quotationData) {
      console.log('📊 Cargando datos de cotización:', this.quotationData);
      this.selectedPlan = this.quotationData.plan?.name || 'Póliza Jurídica Digital';
      this.planPrice = this.quotationData.plan?.price || 0;
      this.quotationNumber = this.quotationData.quotationNumber || '';
      this.quotationAmount = this.quotationData.quotationAmount || 0;
      this.quotationCurrency = this.quotationData.quotationCurrency || 'MXN';
      this.showQuotationSummary = true;
      
      console.log('💰 Datos cargados - Plan:', this.selectedPlan, 'Monto:', this.quotationAmount);
    }
  }

  /**
   * Cargar cotización desde el estado del wizard
   */
  private loadQuotationFromWizardState(): void {
    // Importar WizardStateService si no está disponible
    // Por ahora, intentar obtener datos de la URL o usar valores por defecto
    console.log('🔍 Intentando cargar cotización desde estado del wizard');
    
    // TODO: Implementar carga desde WizardStateService
    // Por ahora, usar valores por defecto
    this.quotationAmount = 299.00; // Valor por defecto
    this.quotationCurrency = 'MXN';
    this.quotationNumber = 'COT-' + Date.now();
    
    console.log('💰 Datos por defecto cargados - Monto:', this.quotationAmount);
  }

  validateCard() {
    // Limpiar errores anteriores
    this.cardErrors = { number: '', cvv: '', expiry: '' };

    // Validar número de tarjeta
    if (this.cardData.card_number) {
      if (!this.openPayService.validateCardNumber(this.cardData.card_number)) {
        this.cardErrors.number = 'Número de tarjeta inválido';
      } else {
        this.cardType = this.openPayService.getCardType(this.cardData.card_number);
      }
    }

    // Validar CVV
    if (this.cardData.cvv2) {
      if (!this.openPayService.validateCVC(this.cardData.cvv2)) {
        this.cardErrors.cvv = 'Código de seguridad inválido';
      }
    }

    // Validar fecha de expiración
    if (this.cardData.expiration_month && this.cardData.expiration_year) {
      if (!this.openPayService.validateExpiry(this.cardData.expiration_month, this.cardData.expiration_year)) {
        this.cardErrors.expiry = 'Fecha de expiración inválida';
      }
    }

    // Verificar si hay errores
    return Object.values(this.cardErrors).every(error => !error);
  }

  async processPayment() {
    if (!this.validateCard()) {
      this.paymentError = 'Por favor, corrige los errores en la tarjeta';
      return;
    }

    if (!this.quotationId) {
      this.paymentError = 'No se encontró la cotización. Por favor, regresa al paso anterior.';
      return;
    }

    this.isProcessing = true;
    this.paymentError = '';
    this.paymentSuccess = '';

    try {
      const paymentData: PaymentData = {
        quotationId: this.quotationId,
        cardData: this.cardData,
        amount: this.planPrice,
        currency: 'MXN',
        description: `Pago de póliza: ${this.selectedPlan}`
      };

      // Procesar pago usando el servicio
      this.paymentsService.processPayment(paymentData, this.userId).subscribe({
        next: (response) => {
          console.log('💰 Respuesta del pago recibida:', response);
          console.log('💰 Tipo de respuesta:', typeof response);
          console.log('💰 Estructura de respuesta:', JSON.stringify(response, null, 2));
          
          // Verificar si la respuesta es exitosa (puede venir en response.success o response.data.success)
          const isSuccess = response.success || (response.data && response.data?.success);
          console.log('💰 isSuccess calculado:', isSuccess);
          
          if (isSuccess) {
            // Obtener el mensaje de éxito de la respuesta o usar uno por defecto
            const successMessage = response.data?.message || response.message || '¡Pago procesado exitosamente!';
            this.paymentSuccess = successMessage;
            
            console.log('✅ Pago exitoso:', response.data || response);
            console.log('✅ Mensaje de éxito:', successMessage);
            
            // Limpiar formulario
            this.resetForm();
            
            // Guardar información del pago en el estado del wizard
            const paymentResult = {
              success: true,
              paymentId: response.data?.paymentId || response.data?.id,
              chargeId: response.data?.chargeId || 'N/A',
              policyId: response.data?.policyId || 'N/A',
              policyNumber: response.data?.policyNumber || 'N/A',
              status: response.data?.status || 'COMPLETED',
              message: response.data?.message || response.message || 'Pago procesado exitosamente'
            };
            
            console.log('💰 Información del pago a guardar:', paymentResult);
            
            // Mostrar mensaje de éxito y esperar antes de avanzar
            console.log('🚀 Pago exitoso, mostrando mensaje antes de avanzar');
            
            // Esperar 3 segundos para que el usuario vea el mensaje
            setTimeout(() => {
              console.log('⏰ Tiempo de espera completado, avanzando al siguiente paso');
              this.next.emit(paymentResult);
              console.log('✅ Evento next emitido con datos del pago');
            }, 3000);
          } else {
            const errorMessage = response.message || response.data?.message || 'Error procesando el pago';
            this.paymentError = errorMessage;
            console.log('❌ Error en pago:', errorMessage);
          }
        },
        error: (error) => {
          console.error('Error en pago:', error);
          this.paymentError = error.message || 'Error procesando el pago';
        },
        complete: () => {
          this.isProcessing = false;
        }
      });

    } catch (error: any) {
      console.error('Error procesando pago:', error);
      this.paymentError = error.message || 'Error inesperado procesando el pago';
      this.isProcessing = false;
    }
  }

  /**
   * Enviar cotización por email
   */
  sendQuotationEmail(): void {
    if (!this.quotationId) {
      this.paymentError = 'No se encontró la cotización';
      return;
    }

    this.isProcessing = true;
    this.paymentError = '';

    this.quotationsService.sendQuotationEmail(this.quotationId).subscribe({
      next: (response) => {
        if (response.success) {
          this.paymentSuccess = 'Cotización enviada por email exitosamente';
          console.log('Email enviado:', response);
        } else {
          this.paymentError = response.message || 'Error enviando la cotización';
        }
      },
      error: (error) => {
        console.error('Error enviando email:', error);
        this.paymentError = error.message || 'Error enviando la cotización';
      },
      complete: () => {
        this.isProcessing = false;
      }
    });
  }

  /**
   * Resetear formulario
   */
  private resetForm(): void {
    this.cardData = {
      card_number: '',
      holder_name: '',
      expiration_year: '',
      expiration_month: '',
      cvv2: ''
    };
    this.cardErrors = { number: '', cvv: '', expiry: '' };
    this.cardType = '';
  }

  onNext() {
    console.log('🔄 onNext() llamado en PaymentStepComponent');
    // Emitir sin datos para navegación manual
    this.next.emit(null);
  }

  /**
   * Método de prueba para debuggear el avance del wizard
   */
  testNextStep() {
    console.log('🧪 testNextStep() llamado - Probando avance manual');
    console.log('Estado actual del componente:');
    console.log('  - paymentSuccess:', this.paymentSuccess);
    console.log('  - isProcessing:', this.isProcessing);
    console.log('  - quotationId:', this.quotationId);
    
    // Emitir evento next manualmente
    this.next.emit();
    console.log('✅ Evento next emitido manualmente');
  }

  onPrevious() {
    this.previous.emit();
  }

  /**
   * Obtener clase CSS para el tipo de tarjeta
   */
  getCardTypeClass(): string {
    if (!this.cardType) return '';
    return `card-${this.cardType.toLowerCase()}`;
  }

  /**
   * Obtener icono para el tipo de tarjeta
   */
  getCardIcon(): string {
    switch (this.cardType.toLowerCase()) {
      case 'visa':
        return 'bi-credit-card';
      case 'mastercard':
        return 'bi-credit-card-fill';
      case 'american express':
        return 'bi-credit-card';
      default:
        return 'bi-credit-card';
    }
  }
} 