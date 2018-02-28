import * as path from "path";


export const enum Environment { homologation = "homologation", production = "production" }
export const enum Operation { webPayment = "webPayment", directPayment = "directPayment", extended = "extended" }

export type EnvironmentsProperty<T> = {[key in Environment]:T};
export type OperationsProperty<T> = {[key in Operation]:T};

export enum CURRENCIES {
    EUR = 978,
    USD = 840,
    GBP = 826,
}

export enum ACTIONS {
    AUTHORIZATION = 100,
    PAYMENT = 101, // validation + payment
    VALIDATION = 201
}

export enum MODE {
    CPT = "CPT",
}

export interface Wallet {
    walletId: string,
    card: Card,
    lastName?: string,
    firstName?: string,
    email?: string,
    shippingAddress?: string,
    comment?: string,
    default?: string,
    cardStatus?: string,
    cardBrand?: string,
}

export interface PaymentData {
    transactionID: string,
    network: string,
    tokenData: string,
}

export interface Card {
    number: string,
    type?: string,
    expirationDate: Date,
    cvx: string,
    encryptedData?: string,
    encryptionKeyId?: string,
    ownerBirthdayDate?: string,
    password?: string,
    cardPresent?: string,
    cardholder?: string,
    token?: string,
    paymentData?: PaymentData,
}

export interface Payment {
    amount: number,
    currency?: CURRENCIES,
    action?: ACTIONS,
    mode?: MODE,
    contractNumber?: string,
    softDescriptor?: string,
}

export interface Order {
    ref?: string,
    amount?: number,
    currency?: CURRENCIES,
    date?: Date,
}

/**
 * ISO 3166-1 Standard
 */
export interface Countries {
    FR: "FR",
    DE: "DE",
    "GB": "GB",
    "ES": "ES"
    IT: "IT",
    PT: "PT",
    [country: string]: string,
}

export interface Address {
    title?: string,
    name?: string,
    firstName?: string,
    lastName?: string,
    street1?: string,
    street2?: string,
    cityName?: string,
    zipCode?: string,
    country?: Countries, // 2 letter country code
    phone?: string,
    phoneType?: string,
    state?: string,
}

export interface AddressOwner {
    street?: string,
    cityName?: string,
    zipCode?: string,
    country?: Countries, // 2 letter country code
    phone?: string,
}

export interface Owner {
    lastName?: string,
    firstName?: string,
    billingAddress?: AddressOwner,
    issueCardDate?: Date,
}

export interface RawResult {
    raw: any;
}

export interface TransactionResult extends RawResult {
    id: string;
}

export interface SuccessResult extends RawResult {
    success: boolean;
}

export interface ValidationResult extends SuccessResult {
    raw: {
        authorization: TransactionResult | null,
        reset: TransactionResult | null;
    };
}

export interface WalletResult extends RawResult {
    wallet: Wallet;
}

export const DEFAULT_ENDPOINTS_PREFIX: EnvironmentsProperty<string> = {
    homologation: "https://homologation.payline.com/V4/services/",
    production: "https://services.payline.com/V4/services/",
};

export const DEFAULT_WSDLS_PREFIX: EnvironmentsProperty<string> = {
    homologation: path.join(__dirname, "wsdl/homologation/"),
    production: path.join(__dirname, "wsdl/production/"),
};

export const DEFAULT_WSDLS_NAME: OperationsProperty<string> = {
    webPayment: "WebPaymentAPI.wsdl",
    directPayment: "DirectPaymentAPI.wsdl",
    extended: "ExtendedAPI.wsdl",
};

export const MIN_AMOUNT = 1;

