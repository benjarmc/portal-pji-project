import { Plan } from '../models/plan.model';

export const SAMPLE_PLANS: Plan[] = [
  {
    id: 'plan-juridica-digital',
    name: 'Póliza Jurídica Digital',
    description: 'Protección esencial para tu arrendamiento con cobertura legal básica.',
    price: 299.00,
    currency: 'MXN',
    coverageDetails: {
      type: 'legal',
      maxAmount: 50000
    },
    maxCoverage: 50000,
    deductible: 1000,
    coverage: ['Legal', 'Básico'],
    features: [
      'Falta de pago de renta',
      'Abandono de propiedad',
      'Devolución voluntaria',
      'Asesoría legal telefónica',
      'Documentación básica'
    ],
    isActive: true,
    imageUrl: '/assets/images/plan-juridica.png',
    createdAt: new Date(),
    updatedAt: new Date(),
    complementaryPlans: [
      {
        id: 'complemento-1',
        name: 'Recuperación de Inmueble',
        description: 'Cobertura adicional para recuperación de inmuebles',
        price: 99.00,
        currency: 'MXN',
        coverageDetails: {
          tipo: 'Complemento',
          planPrincipal: 'Póliza Jurídica Digital'
        },
        maxCoverage: 25000,
        deductible: 500,
        coverage: ['Recuperación'],
        features: ['Gestión de desalojo', 'Recuperación judicial'],
        isActive: true,
        imageUrl: '/assets/images/complemento-1.png',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'complemento-2',
        name: 'Asesoría Legal Avanzada',
        description: 'Asesoría legal personalizada y especializada',
        price: 149.00,
        currency: 'MXN',
        coverageDetails: {
          tipo: 'Complemento',
          planPrincipal: 'Póliza Jurídica Digital'
        },
        maxCoverage: 35000,
        deductible: 750,
        coverage: ['Asesoría'],
        features: ['Consultas ilimitadas', 'Asesoría especializada'],
        isActive: true,
        imageUrl: '/assets/images/complemento-2.png',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'complemento-3',
        name: 'Cobertura de Daños',
        description: 'Protección contra daños a la propiedad',
        price: 199.00,
        currency: 'MXN',
        coverageDetails: {
          tipo: 'Complemento',
          planPrincipal: 'Póliza Jurídica Digital'
        },
        maxCoverage: 40000,
        deductible: 1000,
        coverage: ['Daños'],
        features: ['Cobertura de daños', 'Reparaciones'],
        isActive: true,
        imageUrl: '/assets/images/complemento-3.png',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]
  },
  {
    id: 'plan-investigacion-digital',
    name: 'Investigación Digital',
    description: 'Cobertura ampliada con investigación y negociación de contrato.',
    price: 499.00,
    currency: 'MXN',
    coverageDetails: {
      type: 'investigation',
      maxAmount: 100000
    },
    maxCoverage: 100000,
    deductible: 1500,
    coverage: ['Legal', 'Investigación', 'Negociación'],
    features: [
      'Intervención si el inquilino se niega a salir',
      'Negociación de nuevo contrato',
      'Investigación de antecedentes',
      'Asesoría jurídica personalizada',
      'Gestión de desalojo',
      'Soporte legal completo'
    ],
    isActive: true,
    imageUrl: '/assets/images/plan-investigacion.png',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'plan-proteccion-total',
    name: 'Protección Total',
    description: 'Máxima protección legal y financiera con cobertura integral.',
    price: 799.00,
    currency: 'MXN',
    coverageDetails: {
      type: 'comprehensive',
      maxAmount: 200000
    },
    maxCoverage: 200000,
    deductible: 2000,
    coverage: ['Legal', 'Financiero', 'Completo'],
    features: [
      'Recuperación judicial de rentas y servicios',
      'Cobertura de daños a la propiedad',
      'Protección contra impago prolongado',
      'Asesoría financiera y legal',
      'Soporte 24/7',
      'Gestión completa del proceso',
      'Cobertura de gastos legales'
    ],
    isActive: true,
    imageUrl: '/assets/images/plan-total.png',
    createdAt: new Date(),
    updatedAt: new Date()
  }
];
