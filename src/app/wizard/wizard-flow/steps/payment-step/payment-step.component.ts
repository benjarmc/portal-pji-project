import { Component, Output, EventEmitter, OnInit, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OpenPayService, OpenPayCardData, OpenPayTokenResponse } from '../../../../services/openpay.service';
import { PaymentsService, PaymentData } from '../../../../services/payments.service';
import { QuotationsService } from '../../../../services/quotations.service';
import { WizardStateService } from '../../../../services/wizard-state.service';
import { environment } from '../../../../../environments/environment';
import { LoggerService } from '../../../../services/logger.service';
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
  selectedPlan = ''; // Ya no se usa nombre hardcodeado
  planPrice = 0;
  quotationNumber = '';
  quotationAmount = 0;
  quotationCurrency = 'MXN';

  constructor(
    private openPayService: OpenPayService,
    private paymentsService: PaymentsService,
    private quotationsService: QuotationsService,
    private wizardStateService: WizardStateService,
    private logger: LoggerService
  ) {
    // Generar años de 2 dígitos (actual + 10 años)
    const currentYear = new Date().getFullYear();
    for (let i = 0; i < 10; i++) {
      const year = currentYear + i;
      this.years.push(year.toString().slice(-2)); // Solo los últimos 2 dígitos
    }
  }

  ngOnInit() {
    this.logger.log('🔄 PaymentStepComponent ngOnInit');
    this.logger.log('📊 quotationId recibido:', this.quotationId);
    this.logger.log('📊 quotationData recibido:', this.quotationData);
    
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
      this.logger.log('✅ Cargando datos de cotización desde quotationData');
      this.loadQuotationData();
    } else {
      this.logger.log('⚠️ No hay quotationData, intentando cargar desde estado del wizard');
      this.loadQuotationFromWizardState();
    }
  }

  /**
   * Cargar datos de la cotización
   */
  loadQuotationData() {
    if (this.quotationData) {
      this.logger.log('📊 Cargando datos de cotización:', this.quotationData);
      this.selectedPlan = this.quotationData.plan?.name || ''; // Ya no se usa nombre hardcodeado
      this.planPrice = this.quotationData.plan?.price || 0;
      this.quotationNumber = this.quotationData.quotationNumber || '';
      this.quotationAmount = this.quotationData.quotationAmount || 0;
      this.quotationCurrency = this.quotationData.quotationCurrency || 'MXN';
      this.showQuotationSummary = true;
      
      this.logger.log('💰 Datos cargados - Plan:', this.selectedPlan, 'Monto:', this.quotationAmount);
    }
  }

  /**
   * Cargar cotización desde el estado del wizard
   */
  private loadQuotationFromWizardState(): void {
    this.logger.log('🔍 Intentando cargar cotización desde estado del wizard');
    
    try {
      const wizardState = this.wizardStateService.getState();
      this.logger.log('📊 Estado del wizard cargado:', wizardState);
      
      // Obtener datos del estado del wizard
      if (wizardState.quotationId && !this.quotationId) {
        this.quotationId = wizardState.quotationId;
        this.logger.log('🔑 quotationId obtenido del estado:', this.quotationId);
      }
      
      if (wizardState.quotationNumber) {
        this.quotationNumber = wizardState.quotationNumber;
        this.logger.log('📋 quotationNumber obtenido del estado:', this.quotationNumber);
      } else {
        this.logger.log('⚠️ No hay quotationNumber en el estado del wizard');
      }
      
      if (wizardState.userId && !this.userId) {
        this.userId = wizardState.userId;
        this.logger.log('👤 userId obtenido del estado:', this.userId);
      }
      
      // Si tenemos quotationId, intentar obtener datos de la API
      if (this.quotationId) {
        this.logger.log('🔍 Obteniendo datos de cotización desde API con ID:', this.quotationId);
        this.loadQuotationFromAPI();
      } else {
        // Usar valores por defecto si no hay datos
        this.logger.log('⚠️ No hay quotationId, usando valores por defecto');
        this.quotationAmount = 0; // Ya no se usa precio hardcodeado
        this.quotationCurrency = 'MXN';
        this.quotationNumber = 'COT-' + Date.now();
        
        this.logger.log('💰 Datos por defecto cargados - Monto:', this.quotationAmount);
      }
    } catch (error) {
      this.logger.error('❌ Error cargando estado del wizard:', error);
      // Usar valores por defecto en caso de error
      this.quotationAmount = 0; // Ya no se usa precio hardcodeado
      this.quotationCurrency = 'MXN';
      this.quotationNumber = 'COT-' + Date.now();
    }
  }

  /**
   * Cargar datos de cotización desde la API
   */
  private loadQuotationFromAPI(): void {
    if (!this.quotationId) {
      this.logger.warning('⚠️ No hay quotationId para cargar desde API');
      return;
    }
    
    this.logger.log('🔍 Iniciando llamada a API con quotationId:', this.quotationId);
    
    this.quotationsService.getQuotationById(this.quotationId).subscribe({
      next: (response) => {
        this.logger.log('📡 Respuesta completa de la API:', response);
        
        if (response.success && response.data) {
          this.logger.log('✅ Datos de cotización obtenidos desde API:', response.data);
          this.logger.log('💰 finalPrice en response.data:', response.data.finalPrice);
          this.logger.log('💰 basePrice en response.data:', response.data.basePrice);
          this.logger.log('📋 quotationNumber en response.data:', response.data.quotationNumber);
          this.logger.log('📋 plan en response.data:', response.data.plan);
          
          // Actualizar datos del componente usando la estructura correcta del modelo
          // Usar finalPrice, basePrice, o precio del plan como fallback
          const finalPrice = parseFloat(response.data.finalPrice || '0');
          const basePrice = parseFloat(response.data.basePrice || '0');
          const planPrice = parseFloat(response.data.plan?.price || '0');
          
          this.logger.log('💰 Análisis de precios:');
          this.logger.log('  - finalPrice:', finalPrice);
          this.logger.log('  - basePrice:', basePrice);
          this.logger.log('  - planPrice:', planPrice);
          this.logger.log('  - ¿finalPrice > 0?', finalPrice > 0);
          this.logger.log('  - ¿basePrice > 0?', basePrice > 0);
          this.logger.log('  - ¿planPrice > 0?', planPrice > 0);
          
          // TEMPORAL: Forzar uso del precio de la API si está disponible
          if (finalPrice > 0) {
            this.quotationAmount = finalPrice;
            this.logger.log('✅ Usando finalPrice de la API:', finalPrice);
          } else if (basePrice > 0) {
            this.quotationAmount = basePrice;
            this.logger.log('✅ Usando basePrice de la API:', basePrice);
          } else if (planPrice > 0) {
            this.quotationAmount = planPrice;
            this.logger.log('✅ Usando planPrice de la API:', planPrice);
          } else {
            // Calcular precio basado en renta mensual si está disponible
            const rentaMensual = response.data.userData?.rentaMensual;
            if (rentaMensual && rentaMensual > 0) {
              this.quotationAmount = Math.max(0, rentaMensual * 0.01); // Cálculo dinámico sin precio mínimo hardcodeado
              this.logger.log('✅ Calculando precio basado en renta mensual:', rentaMensual, '->', this.quotationAmount);
            } else {
              this.quotationAmount = 0; // Ya no se usa precio hardcodeado
              this.logger.log('⚠️ Usando precio por defecto (no hay datos de renta)');
            }
          }
          this.quotationCurrency = 'MXN'; // Por defecto MXN
          this.quotationNumber = response.data.quotationNumber || response.data.id || this.quotationId || 'COT-' + Date.now();
          this.selectedPlan = response.data.plan?.name || ''; // Ya no se usa nombre hardcodeado
          
          this.logger.log('💰 Precio final seleccionado:', this.quotationAmount);
          this.logger.log('💰 Precio obtenido desde API:', this.quotationAmount > 0);
          
          this.logger.log('💰 Datos de cotización actualizados:', {
            amount: this.quotationAmount,
            currency: this.quotationCurrency,
            number: this.quotationNumber,
            plan: this.selectedPlan
          });
          
          // Mostrar el resumen
          this.showQuotationSummary = true;
        } else {
          this.logger.warning('⚠️ Respuesta de API no exitosa:', response);
          this.loadDefaultValues();
        }
      },
      error: (error) => {
        this.logger.error('❌ Error obteniendo cotización desde API:', error);
        this.logger.error('❌ Error details:', error.error);
        this.loadDefaultValues();
      }
    });
  }

  /**
   * Cargar valores por defecto
   */
  private loadDefaultValues(): void {
    this.logger.log('🔄 Cargando valores por defecto');
    this.quotationAmount = 0; // Ya no se usa precio hardcodeado
    this.quotationCurrency = 'MXN';
    this.quotationNumber = 'COT-' + Date.now();
    this.selectedPlan = ''; // Ya no se usa nombre hardcodeado
    
    this.logger.log('💰 Valores por defecto cargados:', {
      amount: this.quotationAmount,
      currency: this.quotationCurrency,
      number: this.quotationNumber,
      plan: this.selectedPlan
    });
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

    // Validar que el monto sea válido
    if (!this.quotationAmount || this.quotationAmount <= 0) {
      this.paymentError = 'El monto de la cotización no es válido. Por favor, regresa al paso anterior.';
      return;
    }

    this.isProcessing = true;
    this.paymentError = '';
    this.paymentSuccess = '';

    try {
      const paymentData: PaymentData = {
        quotationId: this.quotationId,
        cardData: this.cardData,
        amount: this.quotationAmount, // Usar quotationAmount en lugar de planPrice
        currency: this.quotationCurrency,
        description: `Pago de póliza: ${this.selectedPlan}`
      };

      // Procesar pago usando el servicio
      this.paymentsService.processPayment(paymentData, this.userId).subscribe({
        next: (response) => {
          this.logger.log('💰 Procesando respuesta del pago...');
          this.logger.log('📡 Respuesta completa del pago:', JSON.stringify(response, null, 2));
          
          // Verificar si la respuesta es exitosa (puede venir en response.success o response.data.success)
          const isSuccess = response.success || (response.data && response.data?.success);
          
          if (isSuccess) {
            // Obtener el mensaje de éxito de la respuesta o usar uno por defecto
            const successMessage = response.data?.message || response.message || '¡Pago procesado exitosamente!';
            this.paymentSuccess = successMessage;
            
            this.logger.log('✅ Pago procesado exitosamente');
            
            // Limpiar formulario
            this.resetForm();
            
            // Guardar información del pago en el estado del wizard
            const responseData = response as any; // Usar any para evitar errores de TypeScript
            const paymentResult = {
              success: true,
              paymentId: responseData.paymentId || responseData.data?.paymentId || responseData.data?.id,
              chargeId: responseData.chargeId || responseData.data?.chargeId || 'N/A',
              policyId: responseData.policyId || responseData.data?.policyId || 'N/A',
              policyNumber: responseData.policyNumber || responseData.data?.policyNumber || 'N/A',
              status: responseData.status || responseData.data?.status || 'COMPLETED',
              message: responseData.message || responseData.data?.message || 'Pago procesado exitosamente'
            };
            
            this.logger.log('📋 paymentResult creado:', paymentResult);
            this.logger.log('🔍 Campos extraídos:');
            this.logger.log('  - paymentId:', paymentResult.paymentId);
            this.logger.log('  - policyId:', paymentResult.policyId);
            this.logger.log('  - policyNumber:', paymentResult.policyNumber);
            
            // Guardar información del pago en el estado del wizard
            this.wizardStateService.saveState({
              paymentResult: paymentResult,
              policyId: paymentResult.policyId !== 'N/A' ? paymentResult.policyId : undefined,
              policyNumber: paymentResult.policyNumber !== 'N/A' ? paymentResult.policyNumber : undefined,
              paymentAmount: this.quotationAmount,
              metadata: {
                transactionId: paymentResult.paymentId,
                paymentTimestamp: new Date().toISOString()
              }
            });
            
            this.logger.log('💾 Estado guardado en wizardStateService:', {
              paymentResult: paymentResult,
              policyId: paymentResult.policyId !== 'N/A' ? paymentResult.policyId : undefined,
              policyNumber: paymentResult.policyNumber !== 'N/A' ? paymentResult.policyNumber : undefined,
              paymentAmount: this.quotationAmount
            });
            
            // Sincronizar con el backend para guardar los datos del pago
            this.wizardStateService.syncWithBackendCorrected(this.wizardStateService.getState()).then(() => {
              this.logger.log('✅ Datos del pago sincronizados con el backend');
            }).catch(error => {
              this.logger.error('❌ Error sincronizando datos del pago con backend:', error);
            });
            
            // Esperar 3 segundos para que el usuario vea el mensaje
            setTimeout(() => {
              this.next.emit(paymentResult);
            }, 3000);
          } else {
            const errorMessage = response.message || response.data?.message || 'Error procesando el pago';
            this.paymentError = errorMessage;
            this.logger.log('❌ Error en pago:', errorMessage);
          }
        },
        error: (error) => {
          this.logger.error('Error en pago:', error);
          this.paymentError = error.message || 'Error procesando el pago';
        },
        complete: () => {
          this.isProcessing = false;
        }
      });

    } catch (error: any) {
      this.logger.error('Error procesando pago:', error);
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
          this.logger.log('Email enviado:', response);
        } else {
          this.paymentError = response.message || 'Error enviando la cotización';
        }
      },
      error: (error) => {
        this.logger.error('Error enviando email:', error);
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
    this.logger.log('🔄 onNext() llamado en PaymentStepComponent');
    // Emitir sin datos para navegación manual
    this.next.emit(null);
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