import { Component, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OpenPayService, OpenPayCardData, OpenPayTokenResponse } from '../../../services/openpay.service';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-payment-step',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './payment-step.component.html',
  styleUrls: ['./payment-step.component.scss']
})
export class PaymentStepComponent implements OnInit {
  @Output() next = new EventEmitter<void>();
  @Output() previous = new EventEmitter<void>();

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

  // Plan seleccionado (esto debería venir del wizard)
  selectedPlan = 'Póliza Jurídica Digital';

  constructor(private openPayService: OpenPayService) {
    // Generar años de 2 dígitos (actual + 10 años)
    const currentYear = new Date().getFullYear();
    for (let i = 0; i < 10; i++) {
      const year = currentYear + i;
      this.years.push(year.toString().slice(-2)); // Solo los últimos 2 dígitos
    }
  }

  ngOnInit() {
    // Configurar OpenPay usando environment
    this.openPayService.configure(
      environment.openpay.merchantId,
      environment.openpay.publicKey,
      environment.openpay.sandboxMode
    );

    // Configurar device data para detección de fraude
    this.deviceDataId = this.openPayService.setupDeviceData('paymentForm');
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
  }

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

  getPlanPrice(): string {
    switch (this.selectedPlan) {
      case 'Póliza Jurídica Digital':
        return '299.00';
      case 'Investigación Digital':
        return '499.00';
      case 'Protección Total':
        return '799.00';
      default:
        return '299.00';
    }
  }

  async processPayment() {
    if (!this.openPayService.isAvailable()) {
      this.paymentError = 'OpenPay no está disponible';
      return;
    }

    this.isProcessing = true;
    this.paymentError = '';
    this.paymentSuccess = '';

    try {
      // Validar tarjeta antes de procesar
      this.validateCard();
      if (Object.values(this.cardErrors).some(error => error !== '')) {
        this.paymentError = 'Por favor, corrige los errores en el formulario';
        this.isProcessing = false;
        return;
      }

      // Asegurar que el año sea de 2 dígitos
      const cardDataToSend = {
        ...this.cardData,
        expiration_year: this.cardData.expiration_year.length === 4 
          ? this.cardData.expiration_year.slice(-2) 
          : this.cardData.expiration_year
      };

      // Crear token de tarjeta
      const token = await this.openPayService.createToken(cardDataToSend);
      
      console.log('Token creado exitosamente:', token);
      
      // Aquí normalmente enviarías el token a tu backend para procesar el cargo
      // Por ahora, simulamos éxito
      this.paymentSuccess = 'Pago procesado exitosamente';
      
      // Simular delay para mostrar el procesamiento
      setTimeout(() => {
        this.onNext();
      }, 2000);

    } catch (error: any) {
      console.error('Error procesando pago:', error);
      this.paymentError = error.message || 'Error procesando el pago';
    } finally {
      this.isProcessing = false;
    }
  }

  onNext() {
    this.next.emit();
  }

  onPrevious() {
    this.previous.emit();
  }
} 